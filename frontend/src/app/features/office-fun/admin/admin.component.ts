import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OfficeFunService, SmsLogEntry } from '../office-fun.service';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="admin-panel">

      <!-- Left Column: Controls -->
      <div class="admin-col left-col">

        <!-- Server Status -->
        <div class="card">
          <div class="card-header">🔌 Server Status</div>
          <div class="card-body status-body">
            <div class="status-row">
              <div class="conn-dot" [class.connected]="connected$ | async"></div>
              <span>{{ (connected$ | async) ? 'Connected to Game Server' : 'Server Offline (start backend on port 3000)' }}</span>
            </div>
            <div class="status-row" *ngIf="serverInfo">
              <span class="status-tag">{{ serverInfo.provider | uppercase }}</span> SMS Provider
            </div>
          </div>
        </div>

        <!-- Excel Config -->
        <div class="card">
          <div class="card-header">📊 Game Configuration</div>
          <div class="card-body">
            <div class="config-stats" *ngIf="configInfo">
              <div class="cstat"><span class="cnum">{{ configInfo.questions }}</span> Questions</div>
              <div class="cstat"><span class="cnum">{{ configInfo.players }}</span> Players</div>
            </div>
            <div class="config-stats" *ngIf="!configInfo">
              <span class="no-config">No config loaded</span>
            </div>
            <div class="btn-group">
              <label class="btn btn-secondary">
                📥 Upload Excel
                <input type="file" accept=".xlsx,.xls" (change)="onUploadConfig($event)" hidden>
              </label>
              <button class="btn btn-ghost" (click)="svc.downloadTemplate()">📋 Template</button>
            </div>
          </div>
        </div>

        <!-- Game Controls -->
        <div class="card">
          <div class="card-header">🎮 Game Controls</div>
          <div class="card-body">
            <div class="ctrl-status">Status: <strong>{{ (state$ | async)?.status | uppercase }}</strong></div>
            <div class="ctrl-info">Q{{ ((state$ | async)?.currentIndex ?? -1) + 1 }} / {{ (state$ | async)?.totalQuestions }}</div>
            <div class="btn-group-v">
              <button class="btn btn-primary" (click)="control('start')"
                [disabled]="(state$ | async)?.status !== 'idle'">▶ Start Game</button>
              <div class="btn-row">
                <button class="btn btn-warning" (click)="control('pause')"
                  [disabled]="(state$ | async)?.status !== 'playing'">⏸ Pause</button>
                <button class="btn btn-success" (click)="control('resume')"
                  [disabled]="(state$ | async)?.status !== 'paused'">▶ Resume</button>
              </div>
              <button class="btn btn-secondary" (click)="control('next')"
                [disabled]="(state$ | async)?.status === 'idle' || (state$ | async)?.status === 'finished'">⏭ Next Question</button>
              <button class="btn btn-danger" (click)="resetGame()">🔄 Reset Game</button>
            </div>
          </div>
        </div>

        <!-- Mock SMS (for testing) -->
        <div class="card">
          <div class="card-header">📲 Test SMS (Mock)</div>
          <div class="card-body">
            <div class="form-row"><label>Phone</label><input type="text" [(ngModel)]="mockPhone" class="input-field" placeholder="+911234567890"></div>
            <div class="form-row"><label>Message (Answer)</label><input type="text" [(ngModel)]="mockMsg" class="input-field" placeholder="Your answer..."></div>
            <button class="btn btn-secondary" (click)="sendMock()">Send Mock SMS</button>
          </div>
        </div>

        <!-- Export -->
        <div class="card">
          <div class="card-header">📤 Export</div>
          <div class="card-body">
            <button class="btn btn-secondary" (click)="svc.exportScores(state?.scores || {})">⬇ Download Leaderboard (Excel)</button>
          </div>
        </div>
      </div>

      <!-- Right Column: Live SMS Feed -->
      <div class="admin-col right-col">
        <div class="card fill">
          <div class="card-header">
            📨 Live SMS Feed
            <span class="feed-count">{{ (smsLog$ | async)?.length ?? 0 }} messages</span>
          </div>
          <div class="sms-feed">
            <div *ngFor="let entry of ((smsLog$ | async) ?? []).slice().reverse()" 
              class="sms-entry" [class.correct]="entry.correct" [class.wrong]="!entry.correct">
              <div class="sms-avatar">{{ getInitials(entry.name) }}</div>
              <div class="sms-body">
                <div class="sms-meta">
                  <span class="sms-name">{{ entry.name }}</span>
                  <span class="sms-phone">{{ entry.phone }}</span>
                  <span class="sms-time">{{ formatTime(entry.time) }}</span>
                </div>
                <div class="sms-message">{{ entry.message }}</div>
                <div class="sms-verdict" *ngIf="entry.correct">✅ CORRECT!</div>
              </div>
            </div>
            <div *ngIf="!(smsLog$ | async)?.length" class="feed-empty">
              Waiting for SMS responses...
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .admin-panel { display: flex; gap: 1.25rem; flex: 1; overflow: hidden; padding: 1.25rem; }
    .admin-col { display: flex; flex-direction: column; gap: 1rem; overflow-y: auto; }
    .left-col { width: 340px; min-width: 340px; }
    .right-col { flex: 1; }
    .fill { flex: 1; display: flex; flex-direction: column; min-height: 0; }

    .card { background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 12px; overflow: hidden; box-shadow: var(--shadow-sm); }
    .card-header { padding: 0.85rem 1rem; background: var(--bg-tertiary); font-size: 0.88rem; font-weight: 700; color: var(--text-primary); border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; }
    .card-body { padding: 1rem; display: flex; flex-direction: column; gap: 0.75rem; }

    /* Status */
    .status-body .status-row { display: flex; align-items: center; gap: 0.6rem; font-size: 0.83rem; color: var(--text-primary); }
    .conn-dot { width: 10px; height: 10px; border-radius: 50%; background: var(--danger); flex-shrink: 0; }
    .conn-dot.connected { background: var(--success); box-shadow: 0 0 6px var(--success); }
    .status-tag { background: var(--accent-surface); color: var(--accent-primary); padding: 0.15rem 0.5rem; border-radius: 6px; font-size: 0.72rem; font-weight: 700; }

    /* Config */
    .config-stats { display: flex; gap: 1rem; }
    .cstat { text-align: center; }
    .cnum { display: block; font-size: 1.75rem; font-weight: 800; color: var(--accent-primary); }
    .no-config { font-size: 0.82rem; color: var(--text-secondary); font-style: italic; }

    /* Controls */
    .ctrl-status { font-size: 0.82rem; color: var(--text-secondary); }
    .ctrl-info { font-size: 0.85rem; color: var(--text-primary); font-weight: 600; }
    .btn-group-v { display: flex; flex-direction: column; gap: 0.5rem; }
    .btn-row { display: flex; gap: 0.5rem; }
    .btn-row .btn { flex: 1; }

    /* Buttons */
    .btn { display: inline-flex; align-items: center; justify-content: center; gap: 0.4rem; padding: 0.55rem 1rem; border-radius: 8px; font-size: 0.85rem; font-weight: 600; cursor: pointer; border: 1px solid transparent; transition: all 0.15s; white-space: nowrap; }
    .btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .btn-primary { background: var(--accent-primary); color: white; }
    .btn-primary:not(:disabled):hover { opacity: 0.9; }
    .btn-secondary { background: var(--accent-surface); border-color: var(--accent-primary); color: var(--accent-primary); }
    .btn-secondary:hover { background: var(--accent-surface); opacity: 0.8; }
    .btn-success { background: rgba(16,185,129,0.15); border-color: var(--success); color: var(--success); }
    .btn-success:not(:disabled):hover { background: rgba(16,185,129,0.25); }
    .btn-warning { background: rgba(245,158,11,0.15); border-color: var(--warning); color: var(--warning); }
    .btn-warning:not(:disabled):hover { background: rgba(245,158,11,0.25); }
    .btn-danger { background: rgba(239,68,68,0.15); border-color: var(--danger); color: var(--danger); }
    .btn-danger:hover { background: rgba(239,68,68,0.25); }
    .btn-ghost { background: none; border-color: var(--border-color); color: var(--text-secondary); }
    .btn-ghost:hover { background: var(--bg-tertiary); }
    .btn-group { display: flex; gap: 0.5rem; }

    /* Form */
    .form-row { display: flex; flex-direction: column; gap: 0.3rem; }
    .form-row label { font-size: 0.78rem; font-weight: 600; color: var(--text-secondary); }
    .input-field { padding: 0.5rem 0.75rem; border: 1px solid var(--border-color); border-radius: 8px; background: var(--bg-input); color: var(--text-primary); font-size: 0.85rem; outline: none; }
    .input-field:focus { border-color: var(--accent-primary); }

    /* SMS Feed */
    .feed-count { font-size: 0.75rem; font-weight: 600; background: var(--accent-surface); color: var(--accent-primary); padding: 0.15rem 0.5rem; border-radius: 20px; }
    .sms-feed { flex: 1; overflow-y: auto; padding: 0.75rem; display: flex; flex-direction: column; gap: 0.6rem; min-height: 0; }
    .sms-entry { display: flex; gap: 0.75rem; padding: 0.75rem; border-radius: 10px; border: 1px solid var(--border-color); transition: border-color 0.15s; background: var(--bg-secondary); }
    .sms-entry.correct { border-color: var(--success); background: rgba(16,185,129,0.08); }
    .sms-avatar { width: 36px; height: 36px; border-radius: 50%; background: var(--accent-primary); display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: 700; color: white; flex-shrink: 0; }
    .sms-body { flex: 1; min-width: 0; }
    .sms-meta { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; margin-bottom: 0.25rem; }
    .sms-name { font-weight: 700; font-size: 0.85rem; color: var(--text-primary); }
    .sms-phone { font-size: 0.75rem; color: var(--text-secondary); }
    .sms-time { font-size: 0.72rem; color: var(--text-secondary); margin-left: auto; }
    .sms-message { font-size: 0.88rem; color: var(--text-primary); }
    .sms-verdict { font-size: 0.78rem; font-weight: 700; color: var(--success); margin-top: 0.25rem; }
    .feed-empty { text-align: center; padding: 3rem; color: var(--text-secondary); font-style: italic; }
  `]
})
export class AdminComponent implements OnInit {
  svc = inject(OfficeFunService);
  state$    = this.svc.state$;
  state: any = null;
  smsLog$   = this.svc.smsLog$;
  connected$ = this.svc.connected$;
  configInfo: { questions: number; players: number } | null = null;
  serverInfo: { ok: boolean; provider: string } | null = null;

  mockPhone = '+911234567890';
  mockMsg   = '';

  ngOnInit() {
    this.state$.subscribe(s => this.state = s);
    this.svc.config$.subscribe(c => this.configInfo = c);
    this.svc.checkHealth().subscribe({
      next: (info) => this.serverInfo = info,
      error: () => this.serverInfo = null,
    });
  }

  control(action: 'start' | 'next' | 'pause' | 'resume') {
    this.svc.control(action).subscribe({ error: (e) => console.error(e) });
  }

  resetGame() {
    if (confirm('Reset the game? This will clear all scores and progress.')) {
      this.svc.control('reset').subscribe();
    }
  }

  onNext() {
    this.svc.control('next', true).subscribe();
  }

  onUploadConfig(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) this.svc.uploadConfig(file).subscribe({
      next: () => alert('Config loaded!'),
      error: (err) => alert('Upload failed: ' + err.error?.error),
    });
  }

  sendMock() {
    if (!this.mockPhone || !this.mockMsg) return;
    this.svc.mockSms(this.mockPhone, this.mockMsg).subscribe({
      next: () => { this.mockMsg = ''; },
      error: (e) => console.error(e),
    });
  }

  getInitials(name: string): string {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }
  formatTime(iso: string): string {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
}
