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
  dice?: BoardDice[];
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

type BoardDice = {
  id: string;
  value: number;
  x: number; // 0..1 (relative to board)
  y: number; // 0..1 (relative to board)
  sizeRel: number; // relative to board width
  rotationDeg: number;
  z: number;
  rolling: boolean;
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

          <div class="form-group mt-4">
            <label>Dice</label>
            <button class="btn-primary full" type="button" [disabled]="dice.length > 0" (click)="addDice()">
              Add Dice
            </button>
            <div class="row mt-2">
              <button
                class="btn-outline danger"
                type="button"
                [disabled]="dice.length === 0"
                (click)="clearDice()"
              >
                Remove Dice
              </button>
            </div>
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
              <span class="pill" *ngIf="boardSrc && tokens.length === 0 && dice.length === 0">
                Add tokens or dice from the left panel
              </span>
            </div>
            <div class="toolbar-right">
              <button class="btn-outline" type="button" (click)="toggleBoardFullscreen()">
                {{ isBoardFullscreen ? 'Exit Full Screen' : 'Full Screen' }}
              </button>
              <button class="btn-outline" type="button" [disabled]="tokens.length === 0" (click)="clearTokens()">
                Clear Tokens
              </button>
              <button class="btn-outline" type="button" [disabled]="dice.length === 0" (click)="clearDice()">
                Clear Dice
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

              <ng-container *ngFor="let die of diceSorted; trackBy: trackById">
                <button
                  class="board-die"
                  type="button"
                  [class.selected]="die.id === selectedDiceId"
                  [class.rolling]="die.rolling"
                  (pointerdown)="onDicePointerDown($event, die)"
                  [style.left.%]="die.x * 100"
                  [style.top.%]="die.y * 100"
                  [style.width.px]="getDiceWidthPx(die)"
                  [style.height.px]="getDiceWidthPx(die)"
                  [style.zIndex]="die.z"
                  [style.transform]="'translate(-50%, -50%) rotate(' + die.rotationDeg + 'deg)'"
                  [title]="'Roll dice: ' + die.value"
                  [attr.aria-label]="'Dice showing ' + die.value"
                >
                  <span
                    class="die-pip"
                    *ngFor="let pip of getDicePips(die.value)"
                    [style.gridColumn]="pip.col"
                    [style.gridRow]="pip.row"
                  ></span>
                  <span class="die-value">{{ die.value }}</span>
                </button>
              </ng-container>
            </div>
          </div>
        </div>

        <!-- Right Panel -->
        <div class="glass-card panel right-panel">
          <h2>{{ selectedDice ? 'Selected Dice' : 'Selected Token' }}</h2>

          <ng-container *ngIf="selectedToken as t">
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

          <ng-container *ngIf="selectedDice as d">
            <div class="selected-preview dice-selected-preview">
              <button
                class="board-die preview-die"
                type="button"
                (click)="rollDice(d.id)"
                [attr.aria-label]="'Roll selected dice showing ' + d.value"
              >
                <span
                  class="die-pip"
                  *ngFor="let pip of getDicePips(d.value)"
                  [style.gridColumn]="pip.col"
                  [style.gridRow]="pip.row"
                ></span>
                <span class="die-value">{{ d.value }}</span>
              </button>
              <div class="selected-meta">
                <div class="name">Dice {{ d.value }}</div>
                <div class="sub">ID: {{ d.id }}</div>
              </div>
            </div>

            <div class="form-group mt-3">
              <label>Size</label>
              <input
                type="range"
                min="0.02"
                max="0.20"
                step="0.005"
                [(ngModel)]="d.sizeRel"
                (ngModelChange)="touchDice(d.id)"
              />
              <div class="hint">{{ (d.sizeRel * 100) | number:'1.0-1' }}% of board width</div>
            </div>

            <div class="form-group mt-4">
              <div class="row">
                <button class="btn-primary" type="button" (click)="rollDice(d.id)">Roll Dice</button>
                <button class="btn-outline danger" type="button" (click)="deleteDice(d.id)">Delete Dice</button>
              </div>
            </div>
          </ng-container>

          <ng-container *ngIf="!selectedToken && !selectedDice">
            <div class="empty-note">Tap/click a token or dice on the board to edit it.</div>
          </ng-container>
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
      .form-group input[type='number'],
      .form-group select,
      .form-group input[type='file'] {
        width: 100%;
      }

      input[type='text'],
      input[type='number'],
      select {
        padding: 10px 12px;
        border-radius: var(--radius-md);
        border: 1px solid var(--border-color);
        background: var(--bg-input);
        color: var(--text-primary);
        outline: none;
      }

      input[type='text']:focus,
      input[type='number']:focus,
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

      .board-die {
        position: absolute;
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        grid-template-rows: repeat(3, 1fr);
        gap: 12%;
        align-items: center;
        justify-items: center;
        padding: 14%;
        border: 1px solid rgba(15, 23, 42, 0.18);
        border-radius: 14%;
        background:
          radial-gradient(circle at 30% 24%, rgba(255, 255, 255, 0.96), rgba(255, 255, 255, 0.16) 34%, transparent 35%),
          linear-gradient(145deg, #ffffff 0%, #eef3f8 45%, #c7d2df 100%);
        box-shadow:
          0 14px 24px rgba(15, 23, 42, 0.28),
          8px 10px 0 rgba(100, 116, 139, 0.18),
          inset 5px 5px 10px rgba(255, 255, 255, 0.92),
          inset -7px -8px 12px rgba(100, 116, 139, 0.3);
        cursor: grab;
        touch-action: none;
        user-select: none;
        transform-origin: center center;
        transform-style: preserve-3d;
        perspective: 1200px;
        transition:
          box-shadow 160ms ease,
          border-color 160ms ease,
          filter 160ms ease;
      }

      .board-die:active {
        cursor: grabbing;
      }

      .board-die.selected {
        border-color: rgba(99, 102, 241, 0.85);
        box-shadow:
          0 12px 28px rgba(0, 0, 0, 0.24),
          8px 10px 0 rgba(100, 116, 139, 0.18),
          inset 5px 5px 10px rgba(255, 255, 255, 0.92),
          inset -7px -8px 12px rgba(100, 116, 139, 0.3),
          0 0 0 4px rgba(99, 102, 241, 0.22);
      }

      .board-die.rolling {
        animation: diceRoll 0.22s ease-in-out infinite;
      }

      .die-pip {
        width: 74%;
        height: 74%;
        border-radius: 999px;
        background: #111827;
        box-shadow:
          inset 0 1px 2px rgba(0, 0, 0, 0.46),
          0 1px 0 rgba(255, 255, 255, 0.6);
      }

      .die-value {
        position: absolute;
        right: -8%;
        bottom: -8%;
        min-width: 38%;
        height: 38%;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 999px;
        background: #111827;
        color: #fff;
        border: 2px solid rgba(255, 255, 255, 0.95);
        font-size: clamp(12px, 34%, 24px);
        font-weight: 900;
        line-height: 1;
        box-shadow: 0 6px 12px rgba(15, 23, 42, 0.28);
      }

      .preview-die {
        position: static;
        width: 56px;
        height: 56px;
        transform: none !important;
      }

      .dice-selected-preview {
        grid-template-columns: 56px 1fr;
      }

      @keyframes diceRoll {
        0% {
          transform: translate(-50%, -50%) perspective(1000px) rotateX(0deg) rotateY(0deg) rotateZ(0deg) scale(1);
          filter: blur(0);
        }
        15% {
          transform: translate(-50%, -50%) perspective(1000px) rotateX(45deg) rotateY(60deg) rotateZ(30deg) scale(1.1);
          filter: blur(0.5px);
        }
        30% {
          transform: translate(-50%, -50%) perspective(1000px) rotateX(120deg) rotateY(150deg) rotateZ(90deg) scale(1.12);
          filter: blur(0.8px);
        }
        50% {
          transform: translate(-50%, -50%) perspective(1000px) rotateX(200deg) rotateY(240deg) rotateZ(180deg) scale(1.08);
          filter: blur(1px);
        }
        70% {
          transform: translate(-50%, -50%) perspective(1000px) rotateX(300deg) rotateY(320deg) rotateZ(270deg) scale(1.05);
          filter: blur(0.6px);
        }
        85% {
          transform: translate(-50%, -50%) perspective(1000px) rotateX(350deg) rotateY(340deg) rotateZ(330deg) scale(1.02);
          filter: blur(0.3px);
        }
        100% {
          transform: translate(-50%, -50%) perspective(1000px) rotateX(360deg) rotateY(360deg) rotateZ(360deg) scale(1);
          filter: blur(0);
        }
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
  dice: BoardDice[] = [];
  selectedTokenId: string | null = null;
  selectedDiceId: string | null = null;

  isBoardFullscreen = false;

  saveLabel = 'My Board';
  selectedSavedKey = '';
  savedStates: Array<{ key: string; label: string }> = [];

  private boardMetrics = { width: 0, height: 0 };
  private resizeObserver: ResizeObserver | null = null;

  private dragging:
    | {
        kind: 'token' | 'dice';
        id: string;
        pointerId: number;
        startClientX: number;
        startClientY: number;
        offsetXRel: number;
        offsetYRel: number;
        moved: boolean;
      }
    | null = null;

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

  get diceSorted(): BoardDice[] {
    return [...this.dice].sort((a, b) => a.z - b.z);
  }

  get selectedToken(): BoardToken | null {
    return this.tokens.find((t) => t.id === this.selectedTokenId) ?? null;
  }

  get selectedDice(): BoardDice | null {
    return this.dice.find((d) => d.id === this.selectedDiceId) ?? null;
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
    this.selectToken(token.id);
  }

  addDice(): void {
    if (this.dice.length > 0) {
      this.selectDice(this.dice[0].id);
      return;
    }

    const die: BoardDice = {
      id: this.uid('die'),
      value: 1,
      x: 0.5,
      y: 0.5,
      sizeRel: 0.045,
      rotationDeg: 0,
      z: this.getMaxZ() + 1,
      rolling: false,
    };
    this.dice = [die];
    this.selectDice(die.id);
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
    if (tokenId) this.selectedDiceId = null;
  }

  selectDice(diceId: string | null): void {
    this.selectedDiceId = diceId;
    if (diceId) this.selectedTokenId = null;
  }

  onSurfacePointerDown(evt: PointerEvent): void {
    if (this.dragging) return;
    // Click/tap the surface (or board image) to deselect.
    this.selectToken(null);
    this.selectDice(null);
  }

  onTokenPointerDown(evt: PointerEvent, token: BoardToken): void {
    evt.preventDefault();
    evt.stopPropagation();

    this.selectToken(token.id);
    this.bringToFront(token.id);

    const el = evt.currentTarget as HTMLElement | null;
    if (el) el.setPointerCapture(evt.pointerId);

    const pointerRel = this.getRelativePointFromClient(evt.clientX, evt.clientY);
    this.dragging = {
      kind: 'token',
      id: token.id,
      pointerId: evt.pointerId,
      startClientX: evt.clientX,
      startClientY: evt.clientY,
      offsetXRel: token.x - pointerRel.x,
      offsetYRel: token.y - pointerRel.y,
      moved: false,
    };
  }

  onDicePointerDown(evt: PointerEvent, die: BoardDice): void {
    evt.preventDefault();
    evt.stopPropagation();

    this.selectDice(die.id);
    this.bringDiceToFront(die.id);

    const el = evt.currentTarget as HTMLElement | null;
    if (el) el.setPointerCapture(evt.pointerId);

    const pointerRel = this.getRelativePointFromClient(evt.clientX, evt.clientY);
    this.dragging = {
      kind: 'dice',
      id: die.id,
      pointerId: evt.pointerId,
      startClientX: evt.clientX,
      startClientY: evt.clientY,
      offsetXRel: die.x - pointerRel.x,
      offsetYRel: die.y - pointerRel.y,
      moved: false,
    };
  }

  @HostListener('window:pointermove', ['$event'])
  onWindowPointerMove(evt: PointerEvent): void {
    if (!this.dragging) return;
    if (evt.pointerId !== this.dragging.pointerId) return;
    const dx = evt.clientX - this.dragging.startClientX;
    const dy = evt.clientY - this.dragging.startClientY;
    if (Math.hypot(dx, dy) > 5) this.dragging.moved = true;

    if (this.dragging.kind === 'token') {
      this.updateTokenPositionFromClient(
        evt.clientX,
        evt.clientY,
        this.dragging.id,
        this.dragging.offsetXRel,
        this.dragging.offsetYRel,
      );
      return;
    }
    this.updateDicePositionFromClient(
      evt.clientX,
      evt.clientY,
      this.dragging.id,
      this.dragging.offsetXRel,
      this.dragging.offsetYRel,
    );
  }

  @HostListener('window:pointerup', ['$event'])
  onWindowPointerUp(evt: PointerEvent): void {
    if (!this.dragging) return;
    if (evt.pointerId !== this.dragging.pointerId) return;
    const wasClick = this.dragging.kind === 'dice' && !this.dragging.moved;
    const diceId = this.dragging.id;
    this.dragging = null;
    if (wasClick) this.rollDice(diceId);
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

  getDiceWidthPx(die: BoardDice): number {
    const width = this.boardMetrics.width;
    if (width <= 0) return 58;
    return Math.max(34, Math.round(die.sizeRel * width));
  }

  getDicePips(value: number): Array<{ row: number; col: number }> {
    const pipMap: Record<number, Array<{ row: number; col: number }>> = {
      1: [{ row: 2, col: 2 }],
      2: [
        { row: 1, col: 1 },
        { row: 3, col: 3 },
      ],
      3: [
        { row: 1, col: 1 },
        { row: 2, col: 2 },
        { row: 3, col: 3 },
      ],
      4: [
        { row: 1, col: 1 },
        { row: 1, col: 3 },
        { row: 3, col: 1 },
        { row: 3, col: 3 },
      ],
      5: [
        { row: 1, col: 1 },
        { row: 1, col: 3 },
        { row: 2, col: 2 },
        { row: 3, col: 1 },
        { row: 3, col: 3 },
      ],
      6: [
        { row: 1, col: 1 },
        { row: 1, col: 3 },
        { row: 2, col: 1 },
        { row: 2, col: 3 },
        { row: 3, col: 1 },
        { row: 3, col: 3 },
      ],
    };
    return pipMap[this.clamp(Math.round(value), 1, 6)] ?? pipMap[1];
  }

  touchToken(tokenId: string): void {
    // noop: called to keep template interactions explicit.
    const t = this.tokens.find((x) => x.id === tokenId);
    if (!t) return;
  }

  touchDice(diceId: string): void {
    // noop: called to keep template interactions explicit.
    const d = this.dice.find((x) => x.id === diceId);
    if (!d) return;
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

  bringDiceToFront(diceId: string): void {
    const d = this.dice.find((x) => x.id === diceId);
    if (!d) return;
    d.z = this.getMaxZ() + 1;
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

  deleteDice(diceId: string): void {
    this.dice = this.dice.filter((d) => d.id !== diceId);
    if (this.selectedDiceId === diceId) this.selectedDiceId = null;
  }

  clearTokens(): void {
    this.tokens = [];
    this.selectedTokenId = null;
  }

  clearDice(): void {
    this.dice = [];
    this.selectedDiceId = null;
  }

  rollDice(diceId: string): void {
    const die = this.dice.find((d) => d.id === diceId);
    if (!die || die.rolling) return;

    die.rolling = true;
    const originalRotation = die.rotationDeg;
    let ticks = 0;
    const interval = window.setInterval(() => {
      const current = this.dice.find((d) => d.id === diceId);
      if (!current) {
        window.clearInterval(interval);
        return;
      }
      current.value = this.randomDiceValue();
      current.rotationDeg = this.clamp(originalRotation + (ticks % 2 === 0 ? 14 : -14), -180, 180);
      ticks++;
    }, 85);

    window.setTimeout(() => {
      window.clearInterval(interval);
      const current = this.dice.find((d) => d.id === diceId);
      if (!current) return;
      current.value = this.randomDiceValue();
      current.rotationDeg = originalRotation;
      current.rolling = false;
    }, 700);
  }

  clearBoard(): void {
    this.boardSrc = null;
    this.refreshBoardMetrics();
  }

  resetWorkspace(): void {
    this.boardSrc = null;
    this.tokenLibrary = [];
    this.tokens = [];
    this.dice = [];
    this.selectedTokenId = null;
    this.selectedDiceId = null;
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
      dice: this.dice.map((d) => ({ ...d, rolling: false })),
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
    this.dice = this.normalizeDice(parsed.dice);
    this.selectedTokenId = null;
    this.selectedDiceId = null;
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

  private updateTokenPositionFromClient(
    clientX: number,
    clientY: number,
    tokenId: string,
    offsetXRel = 0,
    offsetYRel = 0,
  ): void {
    const token = this.tokens.find((t) => t.id === tokenId);
    if (!token) return;

    const point = this.getRelativePointFromClient(clientX, clientY);
    token.x = this.clamp(point.x + offsetXRel, 0, 1);
    token.y = this.clamp(point.y + offsetYRel, 0, 1);
  }

  private updateDicePositionFromClient(
    clientX: number,
    clientY: number,
    diceId: string,
    offsetXRel = 0,
    offsetYRel = 0,
  ): void {
    const die = this.dice.find((d) => d.id === diceId);
    if (!die) return;

    const point = this.getRelativePointFromClient(clientX, clientY);
    die.x = this.clamp(point.x + offsetXRel, 0, 1);
    die.y = this.clamp(point.y + offsetYRel, 0, 1);
  }

  private getRelativePointFromClient(clientX: number, clientY: number): { x: number; y: number } {
    const surface = this.boardSurfaceRef?.nativeElement;
    if (!surface) return { x: 0.5, y: 0.5 };

    const rect = surface.getBoundingClientRect();
    return {
      x: rect.width > 0 ? (clientX - rect.left) / rect.width : 0.5,
      y: rect.height > 0 ? (clientY - rect.top) / rect.height : 0.5,
    };
  }

  private normalizeDice(value: unknown): BoardDice[] {
    if (!Array.isArray(value)) return [];
    return value
      .map((item) => item as Partial<BoardDice>)
      .filter((item) => typeof item.id === 'string')
      .slice(0, 1)
      .map((item) => ({
        id: item.id ?? this.uid('die'),
        value: this.clamp(Math.round(Number(item.value) || 1), 1, 6),
        x: this.clamp(Number(item.x) || 0.5, 0, 1),
        y: this.clamp(Number(item.y) || 0.5, 0, 1),
        sizeRel: this.clamp(Number(item.sizeRel) || 0.075, 0.04, 0.16),
        rotationDeg: this.clamp(Number(item.rotationDeg) || 0, -180, 180),
        z: Number.isFinite(Number(item.z)) ? Number(item.z) : this.getMaxZ() + 1,
        rolling: false,
      }));
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

  private randomDiceValue(): number {
    return Math.floor(Math.random() * 6) + 1;
  }

  private getMaxZ(): number {
    const tokenMax = this.tokens.reduce((m, t) => Math.max(m, t.z), 0);
    return this.dice.reduce((m, d) => Math.max(m, d.z), tokenMax);
  }

  private getMinZ(): number {
    const tokenMin = this.tokens.reduce((m, t) => Math.min(m, t.z), 0);
    return this.dice.reduce((m, d) => Math.min(m, d.z), tokenMin);
  }
}
