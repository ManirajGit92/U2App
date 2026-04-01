import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CompareService, CompareResult } from './compare.service';
import { SupabaseService } from '../../core/services/supabase.service';

@Component({
  selector: 'app-compare',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="compare-page container">
      <!-- Header -->
      <div class="page-header">
        <div class="header-left">
          <h1 class="page-title">
            <span class="page-icon">🔍</span>
            Text / JSON Compare
          </h1>
          <p class="page-desc">Paste your content below and compare instantly</p>
        </div>
      </div>

      <!-- Controls Bar -->
      <div class="controls-bar glass-card">
        <div class="controls-left">
          <!-- Mode Toggle -->
          <div class="mode-toggle">
            <button
              class="mode-btn"
              [class.active]="mode() === 'text'"
              (click)="mode.set('text')"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
              Text
            </button>
            <button
              class="mode-btn"
              [class.active]="mode() === 'json'"
              (click)="mode.set('json')"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/></svg>
              JSON
            </button>
          </div>
        </div>

        <div class="controls-right">
          <!-- Add Content Box -->
          <button class="btn btn-secondary btn-sm" (click)="addContentBox()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add Content
          </button>

          <!-- Compare Button -->
          <button class="btn btn-primary" (click)="runCompare()" [disabled]="!canCompare()">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>
            Compare
          </button>

          <!-- History (Premium) -->
          <button class="btn btn-ghost btn-sm history-btn" (click)="toggleHistory()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            History
            <span class="badge badge-premium">PRO</span>
          </button>
        </div>
      </div>

      <!-- History Panel (Premium) -->
      @if (showHistory()) {
        <div class="history-panel glass-card animate-fade-in">
          @if (!supabaseService.isAuthenticated()) {
            <div class="history-locked">
              <div class="locked-icon">🔒</div>
              <h3>Sign in to view comparison history</h3>
              <p>This is a premium feature. Sign in with Google to unlock.</p>
              <button class="btn btn-primary" (click)="supabaseService.signInWithGoogle()">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                Sign in with Google
              </button>
            </div>
          } @else if (!supabaseService.isPremiumUser()) {
            <div class="history-locked">
              <div class="locked-icon">⭐</div>
              <h3>Premium Feature</h3>
              <p>Upgrade to Premium to access your comparison history.</p>
              <button class="btn btn-primary">Upgrade to Premium</button>
            </div>
          } @else {
            <div class="history-content">
              <h3>Comparison History</h3>
              <p class="text-secondary">Your recent comparisons will appear here.</p>
            </div>
          }
        </div>
      }

      <!-- Content Input Boxes -->
      <div class="input-grid" [style.grid-template-columns]="getGridColumns()">
        @for (box of contentBoxes(); track box.id; let i = $index) {
          <div class="input-panel glass-card" [style.animation-delay]="i * 0.08 + 's'" style="animation: fadeInUp 0.4s ease-out both;">
            <div class="panel-header">
              <span class="panel-label">Content {{ i + 1 }}</span>
              <div class="panel-actions">
                @if (mode() === 'json') {
                  <button class="btn btn-secondary btn-sm panel-action-btn" (click)="beautifyJson(box.id)">
                    Beautify JSON
                  </button>
                }
                @if (i >= 2) {
                  <button class="btn-remove" (click)="removeContentBox(box.id)" title="Remove">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                }
              </div>
            </div>
            <textarea
              class="textarea-styled"
              [placeholder]="mode() === 'json' ? '{\\n  \\'key\\': \\'value\\'\\n}' : 'Paste your content here...'"
              [(ngModel)]="box.content"
              [attr.aria-label]="'Content ' + (i + 1)"
              spellcheck="false"
            ></textarea>
            @if (mode() === 'text') {
              <div class="text-metrics">
                <span>{{ getCharacterCount(box.content) }} characters</span>
                <span>{{ getWordCount(box.content) }} words</span>
                <span>{{ getSentenceCount(box.content) }} sentences</span>
                <span>{{ getParagraphCount(box.content) }} paragraphs</span>
              </div>
            }
            @if (mode() === 'json' && jsonStatus()[box.id]) {
              <div class="json-status" [class.error]="jsonStatus()[box.id]?.type === 'error'">
                {{ jsonStatus()[box.id]?.message }}
              </div>
            }
          </div>
        }
      </div>

      <!-- Results Section -->
      @if (results().length > 0) {
        <div class="results-section animate-fade-in">
          @for (result of results(); track $index; let ri = $index) {
            <div class="result-block">
              <!-- Result Header -->
              <div class="result-header glass-card">
                <div class="result-header-left">
                  <h3 class="result-title">
                    @if (results().length === 1) {
                      Comparison Result
                    } @else {
                      Content 1 vs Content {{ ri + 2 }}
                    }
                  </h3>
                </div>
                <div class="match-badge" [class.high]="result.matchPercentage >= 80" [class.medium]="result.matchPercentage >= 40 && result.matchPercentage < 80" [class.low]="result.matchPercentage < 40">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/></svg>
                  <span class="match-value">{{ result.matchPercentage }}%</span>
                  <span class="match-label">Match</span>
                </div>
              </div>

              <!-- Diff View -->
              <div class="diff-view glass-card">
                <div class="diff-lines">
                  @for (line of result.diffs; track $index; let li = $index) {
                    <div class="diff-line" [class.match]="line.type === 'match'" [class.added]="line.type === 'added'" [class.removed]="line.type === 'removed'">
                      <span class="line-num">{{ li + 1 }}</span>
                      <span class="line-indicator">
                        @if (line.type === 'added') { + }
                        @else if (line.type === 'removed') { - }
                        @else { &nbsp; }
                      </span>
                      <span class="line-content">{{ line.value || ' ' }}</span>
                    </div>
                  }
                </div>
              </div>

              <!-- Mismatched Content -->
              @if (result.mismatches.length > 0) {
                <div class="mismatch-box glass-card">
                  <div class="mismatch-header">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                    <span>Mismatched Content ({{ result.mismatches.length }} differences)</span>
                  </div>
                  <div class="mismatch-content">
                    @for (m of result.mismatches; track $index) {
                      <div class="mismatch-line" [class.is-added]="m.startsWith('+')" [class.is-removed]="m.startsWith('-')">
                        {{ m }}
                      </div>
                    }
                  </div>
                </div>
              }
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .compare-page {
      padding: 32px 24px 80px;
    }

    /* ───── Page Header ───── */
    .page-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: 24px;
    }

    .page-icon {
      font-size: 1.8rem;
      margin-right: 8px;
    }

    .page-title {
      font-size: 1.8rem;
      font-weight: 800;
      letter-spacing: -0.5px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .page-desc {
      font-size: 0.95rem;
      color: var(--text-secondary);
      margin-top: 6px;
    }

    /* ───── Controls Bar ───── */
    .controls-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 20px;
      margin-bottom: 24px;
      flex-wrap: wrap;
      gap: 12px;
    }

    .controls-left,
    .controls-right {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }

    .mode-toggle {
      display: flex;
      background: var(--bg-input);
      border-radius: var(--radius-sm);
      padding: 3px;
      gap: 2px;
    }

    .mode-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 18px;
      font-family: var(--font-family);
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--text-secondary);
      background: transparent;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      transition: all var(--transition-fast);
    }

    .mode-btn.active {
      background: var(--accent-primary);
      color: #fff;
      box-shadow: 0 2px 8px rgba(99,102,241,0.3);
    }

    .mode-btn:not(.active):hover {
      color: var(--text-primary);
      background: var(--accent-surface);
    }

    .history-btn {
      position: relative;
    }

    .history-btn .badge {
      margin-left: 4px;
    }

    /* ───── History Panel ───── */
    .history-panel {
      padding: 32px;
      margin-bottom: 24px;
      text-align: center;
    }

    .history-locked {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
    }

    .locked-icon {
      font-size: 2.5rem;
    }

    .history-locked h3 {
      font-size: 1.15rem;
      font-weight: 700;
    }

    .history-locked p {
      color: var(--text-secondary);
      font-size: 0.9rem;
      max-width: 400px;
    }

    .text-secondary {
      color: var(--text-secondary);
    }

    /* ───── Input Grid ───── */
    .input-grid {
      display: grid;
      gap: 24px;
      margin-bottom: 32px;
    }

    .input-panel {
      padding: 0;
      overflow: hidden;
    }

    .input-panel:hover {
      transform: none;
    }

    .panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 20px;
      border-bottom: 1px solid var(--border-color);
      gap: 12px;
    }

    .panel-label {
      font-size: 0.85rem;
      font-weight: 700;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.8px;
    }

    .panel-actions {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-left: auto;
    }

    .panel-action-btn {
      white-space: nowrap;
    }

    .btn-remove {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      background: none;
      border: none;
      color: var(--text-tertiary);
      cursor: pointer;
      border-radius: 50%;
      transition: all var(--transition-fast);
    }

    .btn-remove:hover {
      background: var(--diff-mismatch);
      color: var(--danger);
    }

    .input-panel .textarea-styled {
      border: none;
      border-radius: 0;
      min-height: 240px;
      background: transparent;
    }

    .input-panel .textarea-styled:focus {
      box-shadow: inset 0 0 0 2px var(--accent-surface);
    }

    /* ───── Results ───── */
    .json-status {
      padding: 10px 20px 14px;
      font-size: 0.83rem;
      color: var(--success);
      border-top: 1px solid var(--border-color);
      background: rgba(16,185,129,0.08);
    }

    .json-status.error {
      color: var(--danger);
      background: rgba(239,68,68,0.08);
    }

    .text-metrics {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 16px;
      padding: 12px 20px 14px;
      border-top: 1px solid var(--border-color);
      font-size: 0.8rem;
      color: var(--text-secondary);
      background: rgba(148,163,184,0.06);
    }

    .text-metrics span {
      white-space: nowrap;
    }

    .results-section {
      margin-top: 16px;
    }

    .result-block {
      margin-bottom: 40px;
    }

    .result-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 24px;
      margin-bottom: 16px;
    }

    .result-header:hover {
      transform: none;
    }

    .result-title {
      font-size: 1.1rem;
      font-weight: 700;
    }

    .match-badge {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 18px;
      border-radius: 50px;
      font-weight: 700;
    }

    .match-badge.high {
      background: rgba(16,185,129,0.12);
      color: var(--success);
    }

    .match-badge.medium {
      background: rgba(245,158,11,0.12);
      color: var(--warning);
    }

    .match-badge.low {
      background: rgba(239,68,68,0.12);
      color: var(--danger);
    }

    .match-value {
      font-size: 1.2rem;
      font-weight: 800;
    }

    .match-label {
      font-size: 0.78rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      opacity: 0.8;
    }

    /* ───── Diff View ───── */
    .diff-view {
      padding: 0;
      overflow: hidden;
      margin-bottom: 16px;
    }

    .diff-view:hover {
      transform: none;
    }

    .diff-lines {
      font-family: 'Fira Code', 'Cascadia Code', 'Consolas', monospace;
      font-size: 0.84rem;
      line-height: 1.8;
      overflow-x: auto;
      max-height: 500px;
      overflow-y: auto;
    }

    .diff-line {
      display: flex;
      align-items: stretch;
      min-height: 28px;
      transition: background var(--transition-fast);
    }

    .diff-line.match {
      background: transparent;
    }

    .diff-line.added {
      background: var(--diff-match);
    }

    .diff-line.removed {
      background: var(--diff-mismatch);
    }

    .line-num {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      width: 48px;
      padding: 0 12px;
      font-size: 0.75rem;
      color: var(--text-tertiary);
      background: var(--bg-tertiary);
      border-right: 1px solid var(--border-color);
      user-select: none;
      flex-shrink: 0;
    }

    .line-indicator {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      font-weight: 700;
      flex-shrink: 0;
    }

    .diff-line.added .line-indicator {
      color: var(--diff-match-text);
    }

    .diff-line.removed .line-indicator {
      color: var(--diff-mismatch-text);
    }

    .line-content {
      flex: 1;
      padding: 2px 12px 2px 4px;
      white-space: pre-wrap;
      word-break: break-all;
    }

    .diff-line.added .line-content {
      color: var(--diff-match-text);
    }

    .diff-line.removed .line-content {
      color: var(--diff-mismatch-text);
    }

    /* ───── Mismatch Box ───── */
    .mismatch-box {
      overflow: hidden;
    }

    .mismatch-box:hover {
      transform: none;
    }

    .mismatch-header {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 16px 20px;
      font-weight: 700;
      font-size: 0.9rem;
      color: var(--warning);
      background: rgba(245,158,11,0.06);
      border-bottom: 1px solid var(--border-color);
    }

    .mismatch-content {
      padding: 4px 0;
      font-family: 'Fira Code', 'Cascadia Code', 'Consolas', monospace;
      font-size: 0.82rem;
      max-height: 300px;
      overflow-y: auto;
    }

    .mismatch-line {
      padding: 6px 20px;
      border-bottom: 1px solid var(--border-color);
      white-space: pre-wrap;
      word-break: break-all;
    }

    .mismatch-line.is-added {
      color: var(--diff-match-text);
      background: var(--diff-added);
    }

    .mismatch-line.is-removed {
      color: var(--diff-mismatch-text);
      background: var(--diff-removed);
    }

    /* ───── Responsive ───── */
    @media (max-width: 768px) {
      .compare-page {
        padding: 20px 16px 60px;
      }

      .page-header {
        flex-direction: column;
        gap: 10px;
      }

      .page-title {
        font-size: 1.3rem;
      }

      .controls-bar {
        flex-direction: column;
        align-items: stretch;
      }

      .controls-right {
        flex-wrap: wrap;
      }

      .panel-header {
        flex-wrap: wrap;
        align-items: flex-start;
      }

      .panel-actions {
        width: 100%;
        justify-content: space-between;
      }

      .panel-action-btn {
        flex: 1 1 auto;
      }

      .input-grid {
        grid-template-columns: 1fr !important;
      }

      .result-header {
        flex-direction: column;
        gap: 12px;
        text-align: center;
      }
    }
  `],
})
export class CompareComponent {
  private compareService = inject(CompareService);
  supabaseService = inject(SupabaseService);

  mode = signal<'text' | 'json'>('text');
  showHistory = signal(false);
  results = signal<CompareResult[]>([]);
  jsonStatus = signal<Record<number, { type: 'success' | 'error'; message: string }>>({});

  private nextId = 3;
  contentBoxes = signal([
    { id: 1, content: '' },
    { id: 2, content: '' },
  ]);

  addContentBox(): void {
    this.contentBoxes.update((boxes) => [
      ...boxes,
      { id: this.nextId++, content: '' },
    ]);
  }

  removeContentBox(id: number): void {
    this.contentBoxes.update((boxes) => boxes.filter((b) => b.id !== id));
    this.jsonStatus.update((status) => {
      const nextStatus = { ...status };
      delete nextStatus[id];
      return nextStatus;
    });
  }

  canCompare(): boolean {
    const boxes = this.contentBoxes();
    return boxes.length >= 2 && boxes.filter((b) => b.content.trim()).length >= 2;
  }

  getGridColumns(): string {
    const count = this.contentBoxes().length;
    if (count <= 2) return 'repeat(2, 1fr)';
    if (count <= 3) return 'repeat(3, 1fr)';
    return 'repeat(2, 1fr)';
  }

  runCompare(): void {
    const contents = this.contentBoxes().map((b) => b.content);
    const all = this.compareService.compareMultiple(contents, this.mode());
    this.results.set(all);
  }

  beautifyJson(id: number): void {
    const box = this.contentBoxes().find((item) => item.id === id);

    if (!box) {
      return;
    }

    const result = this.compareService.beautifyJSON(box.content);

    if (result.error) {
      this.setJsonStatus(id, 'error', result.error);
      return;
    }

    this.contentBoxes.update((boxes) =>
      boxes.map((item) =>
        item.id === id
          ? { ...item, content: result.formatted ?? item.content }
          : item
      )
    );

    this.setJsonStatus(
      id,
      'success',
      box.content.trim()
        ? 'JSON formatted successfully.'
        : 'Box is empty and ready for JSON input.'
    );
  }

  toggleHistory(): void {
    this.showHistory.update((v) => !v);
  }

  private setJsonStatus(id: number, type: 'success' | 'error', message: string): void {
    this.jsonStatus.update((status) => ({
      ...status,
      [id]: { type, message },
    }));
  }

  getCharacterCount(content: string): number {
    return content.length;
  }

  getWordCount(content: string): number {
    return content.trim() ? content.trim().split(/\s+/).length : 0;
  }

  getSentenceCount(content: string): number {
    const matches = content.match(/[^.!?]+[.!?]+|[^.!?]+$/g);
    return matches?.map((sentence) => sentence.trim()).filter(Boolean).length ?? 0;
  }

  getParagraphCount(content: string): number {
    return content.trim()
      ? content.split(/\n\s*\n/).map((paragraph) => paragraph.trim()).filter(Boolean).length
      : 0;
  }
}
