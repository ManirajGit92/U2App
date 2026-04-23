import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

type SavedStateV1 = {
  version: 1;
  label: string;
  updatedAt: number;
  boardSrc: string | null;
  library: TokenLibraryItem[];
  tokens: BoardToken[];
};

type TokenLibraryItem = {
  id: string;
  name: string;
  src: string;
};

type BoardToken = {
  id: string;
  libraryId: string;
  name: string;
  src: string;
  x: number; // 0..1 (relative to board)
  y: number; // 0..1 (relative to board)
  sizeRel: number; // relative to board width (e.g. 0.08)
  rotationDeg: number;
  z: number;
};

@Component({
  selector: 'app-custom-board-creator',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="creator-container">
      <div class="header-section">
        <div class="header-titles">
          <h1>Custom Board Game Creator</h1>
          <p>Upload any board image and freely move custom tokens like a digital tabletop.</p>
        </div>

        <div class="header-actions">
          <a class="btn-outline" routerLink="/real-life-steps/game">Back to Real Life Steps</a>
          <button class="btn-outline" type="button" (click)="resetWorkspace()">Reset Workspace</button>
        </div>
      </div>

      <div class="creator-grid">
        <!-- Left Panel -->
        <div class="glass-card panel left-panel">
          <h2>Assets</h2>

          <div class="form-group">
            <label>Board / Background Image</label>
            <input type="file" accept="image/*" (change)="onBoardUpload($event)" />
            <button
              class="btn-outline mt-2"
              type="button"
              [disabled]="!boardSrc"
              (click)="clearBoard()"
            >
              Clear Board
            </button>
          </div>

          <div class="form-group mt-4">
            <label>Token Images</label>
            <input type="file" accept="image/*" multiple (change)="onTokenLibraryUpload($event)" />
            <p class="hint">Tip: Upload multiple icons (coins, cars, people). Click a token below to add it to the board.</p>
          </div>

          <div class="library" *ngIf="tokenLibrary.length > 0; else noLibrary">
            <button
              class="library-item"
              type="button"
              *ngFor="let item of tokenLibrary; trackBy: trackById"
              (click)="addTokenInstance(item.id)"
              [title]="'Add ' + item.name"
            >
              <img [src]="item.src" [alt]="item.name" />
              <span>{{ item.name }}</span>
            </button>
          </div>
          <ng-template #noLibrary>
            <div class="empty-note">Upload token images to build your token tray.</div>
          </ng-template>

          <hr class="divider" />

          <h3>Save / Load</h3>
          <div class="form-group">
            <label>Save Name</label>
            <input type="text" [(ngModel)]="saveLabel" placeholder="e.g. My Ludo Board" />
            <button class="btn-primary mt-2" type="button" (click)="saveState()">Save</button>
          </div>

          <div class="form-group mt-3">
            <label>Saved Games</label>
            <select [(ngModel)]="selectedSavedKey">
              <option value="" disabled>Select...</option>
              <option *ngFor="let s of savedStates; trackBy: trackBySavedKey" [value]="s.key">
                {{ s.label }}
              </option>
            </select>
            <div class="row mt-2">
              <button class="btn-outline" type="button" [disabled]="!selectedSavedKey" (click)="loadState()">
                Load
              </button>
              <button class="btn-outline danger" type="button" [disabled]="!selectedSavedKey" (click)="deleteSavedState()">
                Delete
              </button>
            </div>
          </div>
        </div>

        <!-- Center Board -->
        <div class="glass-card panel board-panel" #boardPanel>
          <div class="board-toolbar">
            <div class="toolbar-left">
              <span class="pill" *ngIf="!boardSrc">Upload a board image to start</span>
              <span class="pill" *ngIf="boardSrc && tokens.length === 0">Add tokens from the left panel</span>
            </div>
            <div class="toolbar-right">
              <button class="btn-outline" type="button" (click)="toggleBoardFullscreen()">
                {{ isBoardFullscreen ? 'Exit Full Screen' : 'Full Screen' }}
              </button>
              <button class="btn-outline" type="button" [disabled]="tokens.length === 0" (click)="clearTokens()">
                Clear Tokens
              </button>
            </div>
          </div>

          <div class="board-scroll">
            <div
              class="board-surface"
              #boardSurface
              (pointerdown)="onSurfacePointerDown($event)"
              [class.board-empty]="!boardSrc"
            >
              <img
                *ngIf="boardSrc"
                class="board-image"
                [src]="boardSrc"
                alt="Board"
                (load)="refreshBoardMetrics()"
                draggable="false"
              />

              <ng-container *ngFor="let token of tokensSorted; trackBy: trackById">
                <img
                  class="board-token"
                  [class.selected]="token.id === selectedTokenId"
                  [src]="token.src"
                  [alt]="token.name"
                  draggable="false"
                  (pointerdown)="onTokenPointerDown($event, token)"
                  (click)="selectToken(token.id)"
                  [style.left.%]="token.x * 100"
                  [style.top.%]="token.y * 100"
                  [style.width.px]="getTokenWidthPx(token)"
                  [style.zIndex]="token.z"
                  [style.transform]="'translate(-50%, -50%) rotate(' + token.rotationDeg + 'deg)'"
                />
              </ng-container>
            </div>
          </div>
        </div>

        <!-- Right Panel -->
        <div class="glass-card panel right-panel">
          <h2>Selected Token</h2>

          <ng-container *ngIf="selectedToken as t; else nothingSelected">
            <div class="selected-preview">
              <img [src]="t.src" [alt]="t.name" />
              <div class="selected-meta">
                <div class="name">{{ t.name }}</div>
                <div class="sub">ID: {{ t.id }}</div>
              </div>
            </div>

            <div class="form-group mt-3">
              <label>Size</label>
              <input
                type="range"
                min="0.02"
                max="0.30"
                step="0.005"
                [(ngModel)]="t.sizeRel"
                (ngModelChange)="touchToken(t.id)"
              />
              <div class="hint">{{ (t.sizeRel * 100) | number:'1.0-1' }}% of board width</div>
            </div>

            <div class="form-group mt-3">
              <label>Rotate</label>
              <input
                type="range"
                min="-180"
                max="180"
                step="1"
                [(ngModel)]="t.rotationDeg"
                (ngModelChange)="touchToken(t.id)"
              />
              <div class="row mt-2">
                <button class="btn-outline" type="button" (click)="nudgeRotate(-15)">-15°</button>
                <button class="btn-outline" type="button" (click)="nudgeRotate(15)">+15°</button>
                <button class="btn-outline" type="button" (click)="setRotation(0)">Reset</button>
              </div>
            </div>

            <div class="form-group mt-3">
              <label>Layer</label>
              <div class="row">
                <button class="btn-outline" type="button" (click)="sendToBack(t.id)">Send to back</button>
                <button class="btn-outline" type="button" (click)="bringToFront(t.id)">Bring to front</button>
              </div>
            </div>

            <div class="form-group mt-4">
              <button class="btn-outline danger full" type="button" (click)="deleteToken(t.id)">Delete Token</button>
            </div>
          </ng-container>

          <ng-template #nothingSelected>
            <div class="empty-note">Tap/click a token on the board to edit it.</div>
          </ng-template>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .creator-container {
        padding: 18px;
        max-width: 1400px;
        margin: 0 auto;
      }

      .header-section {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 14px;
        padding: 14px 16px;
        margin-bottom: 16px;
        border-radius: var(--radius-lg);
        background: var(--bg-overlay);
        border: 1px solid var(--border-color);
        position: sticky;
        top: 0;
        z-index: 50;
        backdrop-filter: blur(14px);
        -webkit-backdrop-filter: blur(14px);
      }

      .header-titles h1 {
        margin: 0;
        font-size: 20px;
        color: var(--text-primary);
      }

      .header-titles p {
        margin: 6px 0 0;
        color: var(--text-secondary);
        font-size: 13px;
      }

      .header-actions {
        display: flex;
        gap: 10px;
        align-items: center;
        flex-wrap: wrap;
        justify-content: flex-end;
      }

      .btn-primary,
      .btn-outline {
        padding: 10px 14px;
        border-radius: var(--radius-md);
        font-weight: 700;
        cursor: pointer;
        transition: var(--transition-fast);
        border: 1px solid transparent;
        background: transparent;
        text-decoration: none;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        white-space: nowrap;
        color: var(--text-primary);
      }

      .btn-primary {
        background: var(--accent-gradient);
        color: #fff;
        box-shadow: 0 4px 16px rgba(99, 102, 241, 0.28);
      }

      .btn-primary:hover {
        transform: translateY(-1px);
      }

      .btn-outline {
        border-color: var(--border-color-strong);
        background: var(--bg-overlay);
      }

      .btn-outline:hover {
        border-color: var(--accent-primary);
        background: var(--accent-surface);
      }

      .btn-outline[disabled],
      .btn-primary[disabled] {
        opacity: 0.55;
        cursor: not-allowed;
        transform: none;
      }

      .creator-grid {
        display: grid;
        grid-template-columns: 320px minmax(0, 1fr) 320px;
        gap: 16px;
        align-items: start;
      }

      .panel {
        padding: 16px;
      }

      .form-group {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .form-group label {
        font-size: 12px;
        font-weight: 800;
        color: var(--text-secondary);
      }

      .form-group input[type='text'],
      .form-group select,
      .form-group input[type='file'] {
        width: 100%;
      }

      input[type='text'],
      select {
        padding: 10px 12px;
        border-radius: var(--radius-md);
        border: 1px solid var(--border-color);
        background: var(--bg-input);
        color: var(--text-primary);
        outline: none;
      }

      input[type='text']:focus,
      select:focus {
        border-color: rgba(99, 102, 241, 0.6);
        box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.12);
      }

      input[type='range'] {
        width: 100%;
      }

      .left-panel h2,
      .right-panel h2 {
        margin-top: 0;
      }

      .divider {
        border: none;
        border-top: 1px solid var(--border-color);
        margin: 16px 0;
      }

      .hint {
        font-size: 12px;
        color: var(--text-secondary);
        margin: 6px 0 0;
      }

      .mt-2 {
        margin-top: 8px;
      }
      .mt-3 {
        margin-top: 12px;
      }
      .mt-4 {
        margin-top: 16px;
      }

      .row {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
      }

      .full {
        width: 100%;
      }

      .danger {
        border-color: rgba(239, 68, 68, 0.55) !important;
        color: var(--danger) !important;
      }

      .library {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
        margin-top: 10px;
      }

      .library-item {
        display: grid;
        grid-template-columns: 40px 1fr;
        gap: 10px;
        align-items: center;
        padding: 10px;
        border-radius: var(--radius-md);
        border: 1px solid var(--border-color);
        background: var(--bg-overlay);
        cursor: pointer;
        transition: var(--transition-fast);
        text-align: left;
      }

      .library-item:hover {
        transform: translateY(-1px);
        border-color: var(--border-color-strong);
      }

      .library-item img {
        width: 40px;
        height: 40px;
        object-fit: contain;
        background: rgba(0, 0, 0, 0.04);
        border-radius: 10px;
        padding: 6px;
      }

      .library-item span {
        font-size: 13px;
        color: var(--text-primary);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .board-panel {
        padding: 12px;
      }

      .board-panel:fullscreen {
        width: 100vw;
        height: 100vh;
        border-radius: 0;
        margin: 0;
        padding: 12px;
        background: var(--bg-primary);
        display: flex;
        flex-direction: column;
      }

      .board-toolbar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 10px;
        padding: 6px 6px 12px;
      }

      .pill {
        display: inline-block;
        padding: 6px 10px;
        border-radius: 999px;
        border: 1px solid var(--border-color);
        background: var(--bg-overlay);
        color: var(--text-secondary);
        font-size: 12px;
      }

      .board-scroll {
        overflow: auto;
        max-height: calc(100vh - 220px);
        padding: 8px;
      }

      .board-panel:fullscreen .board-scroll {
        flex: 1 1 auto;
        max-height: none;
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .board-surface {
        position: relative;
        display: inline-block;
        min-width: 420px;
        min-height: 320px;
        border-radius: var(--radius-lg);
        border: 1px dashed var(--border-color);
        background: var(--bg-overlay);
        touch-action: none;
        user-select: none;
      }

      .board-panel:fullscreen .board-surface {
        border-style: solid;
        min-width: 0;
        min-height: 0;
        max-width: calc(100vw - 48px);
        max-height: calc(100vh - 108px);
      }

      .board-surface.board-empty {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
        min-width: 420px;
        min-height: 420px;
      }

      .board-image {
        display: block;
        max-width: 100%;
        height: auto;
        border-radius: var(--radius-lg);
        pointer-events: none;
      }

      .board-panel:fullscreen .board-image {
        max-width: calc(100vw - 48px);
        max-height: calc(100vh - 132px);
        width: auto;
        height: auto;
        object-fit: contain;
      }

      .board-token {
        position: absolute;
        left: 50%;
        top: 50%;
        height: auto;
        transform-origin: center center;
        cursor: grab;
        filter: drop-shadow(0 6px 14px rgba(0, 0, 0, 0.18));
        border-radius: 10px;
        touch-action: none;
        user-select: none;
      }

      .board-token:active {
        cursor: grabbing;
      }

      .board-token.selected {
        outline: 3px solid rgba(99, 102, 241, 0.65);
        outline-offset: 2px;
      }

      .empty-note {
        padding: 12px;
        border-radius: var(--radius-md);
        border: 1px solid var(--border-color);
        background: var(--bg-overlay);
        color: var(--text-secondary);
        font-size: 13px;
      }

      .selected-preview {
        display: grid;
        grid-template-columns: 56px 1fr;
        gap: 12px;
        align-items: center;
        padding: 10px;
        border-radius: var(--radius-md);
        border: 1px solid var(--border-color);
        background: var(--bg-overlay);
      }

      .selected-preview img {
        width: 56px;
        height: 56px;
        object-fit: contain;
        background: rgba(0, 0, 0, 0.04);
        border-radius: 14px;
        padding: 8px;
      }

      .selected-meta .name {
        font-weight: 700;
        color: var(--text-primary);
        margin-bottom: 2px;
      }

      .selected-meta .sub {
        font-size: 12px;
        color: var(--text-secondary);
      }

      @media (max-width: 1100px) {
        .creator-grid {
          grid-template-columns: 300px minmax(0, 1fr);
        }
        .right-panel {
          grid-column: 1 / -1;
        }
      }

      @media (max-width: 860px) {
        .creator-grid {
          grid-template-columns: 1fr;
        }
        .board-surface,
        .board-surface.board-empty {
          min-width: 0;
          width: 100%;
        }
      }
    `,
  ],
})
export class CustomBoardCreatorComponent implements AfterViewInit, OnDestroy {
  private static readonly STORAGE_PREFIX = 'u2app.custom-board-creator.state.';

  @ViewChild('boardPanel', { static: false })
  private readonly boardPanelRef?: ElementRef<HTMLElement>;

  @ViewChild('boardSurface', { static: false })
  private readonly boardSurfaceRef?: ElementRef<HTMLElement>;

  boardSrc: string | null = null;
  tokenLibrary: TokenLibraryItem[] = [];
  tokens: BoardToken[] = [];
  selectedTokenId: string | null = null;

  isBoardFullscreen = false;

  saveLabel = 'My Board';
  selectedSavedKey = '';
  savedStates: Array<{ key: string; label: string }> = [];

  private boardMetrics = { width: 0, height: 0 };
  private resizeObserver: ResizeObserver | null = null;

  private dragging: { tokenId: string; pointerId: number } | null = null;

  @HostListener('document:fullscreenchange')
  onFullscreenChange(): void {
    this.syncFullscreenState();
  }

  ngAfterViewInit(): void {
    this.refreshSavedStates();
    this.setupResizeObserver();
    this.refreshBoardMetrics();
    this.syncFullscreenState();
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
  }

  get tokensSorted(): BoardToken[] {
    return [...this.tokens].sort((a, b) => a.z - b.z);
  }

  get selectedToken(): BoardToken | null {
    return this.tokens.find((t) => t.id === this.selectedTokenId) ?? null;
  }

  trackById(_: number, item: { id: string }): string {
    return item.id;
  }

  trackBySavedKey(_: number, item: { key: string }): string {
    return item.key;
  }

  onBoardUpload(evt: Event): void {
    const input = evt.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.readFileAsDataUrl(file).then((src) => {
      this.boardSrc = src;
      this.refreshBoardMetrics();
    });

    input.value = '';
  }

  onTokenLibraryUpload(evt: Event): void {
    const input = evt.target as HTMLInputElement;
    const files = input.files ? Array.from(input.files) : [];
    if (files.length === 0) return;

    Promise.all(files.map((f) => this.readFileAsDataUrl(f).then((src) => ({ f, src }))))
      .then((items) => {
        for (const it of items) {
          this.tokenLibrary.push({
            id: this.uid('lib'),
            name: this.safeName(it.f.name),
            src: it.src,
          });
        }
      })
      .finally(() => {
        input.value = '';
      });
  }

  addTokenInstance(libraryId: string): void {
    const lib = this.tokenLibrary.find((x) => x.id === libraryId);
    if (!lib) return;

    const nextZ = this.getMaxZ() + 1;
    const token: BoardToken = {
      id: this.uid('tok'),
      libraryId: lib.id,
      name: lib.name,
      src: lib.src,
      x: 0.5,
      y: 0.5,
      sizeRel: 0.08,
      rotationDeg: 0,
      z: nextZ,
    };
    this.tokens.push(token);
    this.selectedTokenId = token.id;
  }

  toggleBoardFullscreen(): void {
    const el = this.boardPanelRef?.nativeElement;
    if (!el) return;

    const isSelfFullscreen = document.fullscreenElement === el;
    if (isSelfFullscreen) {
      document.exitFullscreen?.();
      return;
    }

    el.requestFullscreen?.().catch(() => {
      // ignore
    });
  }

  selectToken(tokenId: string | null): void {
    this.selectedTokenId = tokenId;
  }

  onSurfacePointerDown(evt: PointerEvent): void {
    if (this.dragging) return;
    // Click/tap the surface (or board image) to deselect.
    this.selectToken(null);
  }

  onTokenPointerDown(evt: PointerEvent, token: BoardToken): void {
    evt.preventDefault();
    evt.stopPropagation();

    this.selectedTokenId = token.id;
    this.bringToFront(token.id);

    const el = evt.currentTarget as HTMLElement | null;
    if (el) el.setPointerCapture(evt.pointerId);

    this.dragging = { tokenId: token.id, pointerId: evt.pointerId };
    this.updateTokenPositionFromClient(evt.clientX, evt.clientY, token.id);
  }

  @HostListener('window:pointermove', ['$event'])
  onWindowPointerMove(evt: PointerEvent): void {
    if (!this.dragging) return;
    if (evt.pointerId !== this.dragging.pointerId) return;
    this.updateTokenPositionFromClient(evt.clientX, evt.clientY, this.dragging.tokenId);
  }

  @HostListener('window:pointerup', ['$event'])
  onWindowPointerUp(evt: PointerEvent): void {
    if (!this.dragging) return;
    if (evt.pointerId !== this.dragging.pointerId) return;
    this.dragging = null;
  }

  @HostListener('window:pointercancel', ['$event'])
  onWindowPointerCancel(evt: PointerEvent): void {
    if (!this.dragging) return;
    if (evt.pointerId !== this.dragging.pointerId) return;
    this.dragging = null;
  }

  getTokenWidthPx(token: BoardToken): number {
    const width = this.boardMetrics.width;
    if (width <= 0) return 56;
    return Math.max(24, Math.round(token.sizeRel * width));
  }

  touchToken(tokenId: string): void {
    // noop: called to keep template interactions explicit.
    const t = this.tokens.find((x) => x.id === tokenId);
    if (!t) return;
  }

  nudgeRotate(delta: number): void {
    const t = this.selectedToken;
    if (!t) return;
    t.rotationDeg = this.clamp(t.rotationDeg + delta, -180, 180);
    this.touchToken(t.id);
  }

  setRotation(rotation: number): void {
    const t = this.selectedToken;
    if (!t) return;
    t.rotationDeg = this.clamp(rotation, -180, 180);
    this.touchToken(t.id);
  }

  bringToFront(tokenId: string): void {
    const t = this.tokens.find((x) => x.id === tokenId);
    if (!t) return;
    t.z = this.getMaxZ() + 1;
  }

  sendToBack(tokenId: string): void {
    const t = this.tokens.find((x) => x.id === tokenId);
    if (!t) return;
    t.z = this.getMinZ() - 1;
  }

  deleteToken(tokenId: string): void {
    this.tokens = this.tokens.filter((t) => t.id !== tokenId);
    if (this.selectedTokenId === tokenId) this.selectedTokenId = null;
  }

  clearTokens(): void {
    this.tokens = [];
    this.selectedTokenId = null;
  }

  clearBoard(): void {
    this.boardSrc = null;
    this.refreshBoardMetrics();
  }

  resetWorkspace(): void {
    this.boardSrc = null;
    this.tokenLibrary = [];
    this.tokens = [];
    this.selectedTokenId = null;
    this.saveLabel = 'My Board';
    this.selectedSavedKey = '';
    this.refreshBoardMetrics();
  }

  saveState(): void {
    const label = this.saveLabel.trim() || 'Untitled';
    const key = CustomBoardCreatorComponent.STORAGE_PREFIX + this.slug(label) + '-' + Date.now();
    const state: SavedStateV1 = {
      version: 1,
      label,
      updatedAt: Date.now(),
      boardSrc: this.boardSrc,
      library: this.tokenLibrary,
      tokens: this.tokens,
    };
    localStorage.setItem(key, JSON.stringify(state));
    this.refreshSavedStates();
    this.selectedSavedKey = key;
  }

  loadState(): void {
    const key = this.selectedSavedKey;
    if (!key) return;
    const raw = localStorage.getItem(key);
    if (!raw) return;

    const parsedUnknown: unknown = JSON.parse(raw);
    const parsed = parsedUnknown as Partial<SavedStateV1>;
    if (parsed.version !== 1) return;

    this.boardSrc = parsed.boardSrc ?? null;
    this.tokenLibrary = Array.isArray(parsed.library) ? (parsed.library as TokenLibraryItem[]) : [];
    this.tokens = Array.isArray(parsed.tokens) ? (parsed.tokens as BoardToken[]) : [];
    this.selectedTokenId = null;
    this.saveLabel = parsed.label ?? this.saveLabel;
    this.refreshBoardMetrics();
  }

  deleteSavedState(): void {
    const key = this.selectedSavedKey;
    if (!key) return;
    localStorage.removeItem(key);
    this.selectedSavedKey = '';
    this.refreshSavedStates();
  }

  private refreshSavedStates(): void {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(CustomBoardCreatorComponent.STORAGE_PREFIX)) keys.push(k);
    }

    const entries: Array<{ key: string; label: string; updatedAt: number }> = [];
    for (const k of keys) {
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw) as Partial<SavedStateV1>;
        if (parsed.version !== 1) continue;
        entries.push({
          key: k,
          label: parsed.label ?? 'Untitled',
          updatedAt: parsed.updatedAt ?? 0,
        });
      } catch {
        // ignore corrupted states
      }
    }

    entries.sort((a, b) => b.updatedAt - a.updatedAt);
    this.savedStates = entries.map(({ key, label }) => ({ key, label }));

    if (this.selectedSavedKey && !this.savedStates.some((s) => s.key === this.selectedSavedKey)) {
      this.selectedSavedKey = '';
    }
  }

  refreshBoardMetrics(): void {
    const el = this.boardSurfaceRef?.nativeElement;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    this.boardMetrics = { width: rect.width, height: rect.height };
  }

  private syncFullscreenState(): void {
    const el = this.boardPanelRef?.nativeElement;
    this.isBoardFullscreen = !!el && document.fullscreenElement === el;
    setTimeout(() => this.refreshBoardMetrics(), 50);
  }

  private setupResizeObserver(): void {
    const el = this.boardSurfaceRef?.nativeElement;
    if (!el || typeof ResizeObserver === 'undefined') return;

    this.resizeObserver?.disconnect();
    this.resizeObserver = new ResizeObserver(() => this.refreshBoardMetrics());
    this.resizeObserver.observe(el);
  }

  private updateTokenPositionFromClient(clientX: number, clientY: number, tokenId: string): void {
    const token = this.tokens.find((t) => t.id === tokenId);
    const surface = this.boardSurfaceRef?.nativeElement;
    if (!token || !surface) return;

    const rect = surface.getBoundingClientRect();
    const x = (clientX - rect.left) / rect.width;
    const y = (clientY - rect.top) / rect.height;
    token.x = this.clamp(x, 0, 1);
    token.y = this.clamp(y, 0, 1);
  }

  private readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.onload = () => resolve(String(reader.result));
      reader.readAsDataURL(file);
    });
  }

  private uid(prefix: string): string {
    const rand = Math.random().toString(16).slice(2, 10);
    return `${prefix}-${Date.now().toString(16)}-${rand}`;
  }

  private safeName(filename: string): string {
    const base = filename.replace(/\.[^/.]+$/, '');
    return base.trim() || 'Token';
  }

  private slug(label: string): string {
    return label
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40);
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }

  private getMaxZ(): number {
    return this.tokens.reduce((m, t) => Math.max(m, t.z), 0);
  }

  private getMinZ(): number {
    return this.tokens.reduce((m, t) => Math.min(m, t.z), 0);
  }
}
