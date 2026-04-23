import { Component, ElementRef, HostListener, inject, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { RealLifeStepsService, GameState, CellConfig, Player, Token } from './real-life-steps.service';
import { Observable, Subscription } from 'rxjs';

@Component({
  selector: 'app-real-life-steps',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="game-container">
      <div class="header-section">
        <div class="header-titles">
          <h1>Real Life Steps Game</h1>
          <p>A multiplayer strategic board game inspired by life's ups and downs.</p>
        </div>
        
        <div class="header-actions" *ngIf="!(state$ | async)?.isStarted">
          <a class="btn-outline" routerLink="/real-life-steps/custom-board-creator">Custom Board Creator</a>
          <button class="btn-outline" (click)="downloadRules()">Download Board Rules (Excel)</button>
          <div class="upload-wrapper">
            <input type="file" id="rulesUpload" accept=".xlsx, .xls" (change)="uploadRules($event)" #fileInput hidden>
            <button class="btn-outline" (click)="fileInput.click()">Upload Rules (Excel)</button>
          </div>
        </div>
        <div class="header-actions" *ngIf="(state$ | async)?.isStarted">
          <!-- Zoom Controls -->
          <div class="zoom-controls">
            <button class="btn-icon" (click)="zoomOut()" title="Zoom Out">➖</button>
            <span class="zoom-level">{{ (zoomLevel * 100) | number:'1.0-0' }}%</span>
            <button class="btn-icon" (click)="zoomIn()" title="Zoom In">➕</button>
          </div>
          <button class="btn-outline" (click)="toggleBoardFullscreen()">
            {{ isBoardFullscreen ? 'Exit Full Screen' : 'Full Screen Board' }}
          </button>
          <a class="btn-outline" routerLink="/real-life-steps/custom-board-creator">Custom Board Creator</a>
          <button class="btn-outline" (click)="resetGame()">End & Reset Game</button>
        </div>
      </div>

      <!-- Game Setup -->
      <div class="glass-card setup-card" *ngIf="!(state$ | async)?.isStarted">
        <h2>Game Setup</h2>
        <div class="setup-grid">
          <div class="form-group">
            <label>Number of Players</label>
            <select [(ngModel)]="setup.playerCount" (change)="updatePlayerNames()">
              <option [value]="2">2 Players</option>
              <option [value]="3">3 Players</option>
              <option [value]="4">4 Players</option>
            </select>
          </div>
          <div class="form-group">
            <label>Tokens Per Player</label>
            <select [(ngModel)]="setup.tokensPerPlayer">
              <option [value]="1">1 Token</option>
              <option [value]="2">2 Tokens</option>
              <option [value]="3">3 Tokens</option>
              <option [value]="4">4 Tokens</option>
              <option [value]="5">5 Tokens</option>
            </select>
          </div>
        </div>
        
        <div class="players-setup">
          <div class="form-group" *ngFor="let p of setup.playerNames; let i = index; trackBy: trackByFn">
            <label>Player {{ i + 1 }} Name</label>
            <input type="text" [(ngModel)]="setup.playerNames[i]">
          </div>
        </div>
        
        <button class="btn-primary mt-4" (click)="startGame()">Start Game</button>
      </div>

      <!-- Main Game Area -->
      <div class="main-game" *ngIf="(state$ | async) as state">
        <ng-container *ngIf="state.isStarted">
          
          <!-- Left: Board -->
          <div class="board-column" #boardColumn>
            <!-- The board grid itself with scaling applied -->
            <div class="board-wrapper" [style.transform]="'scale(' + zoomLevel + ')'">
              <div class="board-grid">
                
                <!-- Cells -->
                <div *ngFor="let cell of boardCells; let i = index" 
                     class="board-cell"
                     [ngClass]="getCellClass(cell)"
                     [class]="cell.animation ? 'anim-' + cell.animation : ''"
                     [title]="cell.description">
                  
                  <div class="cell-media" *ngIf="cell.image">
                     <!-- Allow both emoji and standard images via simple detection -->
                     <span class="cell-emoji" *ngIf="cell.image.length <= 4">{{ cell.image }}</span>
                     <img [src]="cell.image" *ngIf="cell.image.length > 4" class="cell-bg-image" alt="cell bg">
                  </div>
                     
                  <span class="cell-number">{{ cell.position }}</span>
                  <span class="cell-title" *ngIf="cell.position !== 0">{{ cell.title }}</span>
                </div>
                
                <!-- Smooth Animating Tokens overlay placed over the board -->
                <div class="tokens-overlay">
                  <ng-container *ngFor="let player of state.players; let pIdx = index">
                     <ng-container *ngFor="let token of player.tokens; let tIdx = index">
                       <div class="player-token-absolute" 
                            [style.backgroundColor]="player.color"
                            [style.left]="getTokenX(token.position, pIdx, tIdx)"
                            [style.top]="getTokenY(token.position, pIdx, tIdx)"
                            [title]="player.name + ' - ' + token.id">
                         {{ token.id }}
                       </div>
                     </ng-container>
                  </ng-container>
                </div>

              </div>
            </div>
          </div>

          <!-- Right: Controls & Stats (Sticky) -->
          <div class="panel-column">
            
            <!-- Winner -->
            <div class="glass-card winner-card" *ngIf="state.winner">
              <h2>🎉 We have a Winner! 🎉</h2>
              <p>Congratulations to <strong>{{ state.winner }}</strong>!</p>
            </div>

            <!-- Current Turn & Dice -->
            <div class="glass-card action-card" [ngClass]="{ 'inactive': state.winner }">
              <h3 class="turn-indicator">
                Current Turn: 
                <span [style.color]="state.players[state.currentPlayerIndex].color">
                  {{ state.players[state.currentPlayerIndex].name }}
                </span>
              </h3>
              
              <div class="dice-section">
                <button class="dice-btn" (click)="rollDice(state)" [disabled]="!!state.winner || pendingRoll !== null">
                  <span class="dice-icon" [class.rolling]="isRolling">🎲</span> Roll Dice
                </button>
                <div class="dice-result" *ngIf="pendingRoll !== null">
                  Rolled: <strong class="roll-value">{{ pendingRoll }}</strong>
                </div>
              </div>

              <div class="token-selection" *ngIf="pendingRoll !== null">
                <p>Select Token to move {{ pendingRoll }} steps:</p>
                <div class="token-options">
                  <button *ngFor="let token of state.players[state.currentPlayerIndex].tokens"
                          class="token-btn"
                          [disabled]="token.isFinished"
                          [style.borderColor]="state.players[state.currentPlayerIndex].color"
                          (click)="moveToken(pendingRoll, token.id)">
                    {{ token.id }} (Pos {{ token.position }})
                  </button>
                </div>
              </div>
            </div>

            <!-- Players Stats -->
            <div class="glass-card players-card">
              <h3>Players</h3>
              <div class="player-stat" *ngFor="let p of state.players" [style.borderLeftColor]="p.color">
                <div class="p-header"><strong>{{ p.name }}</strong> <span>💰 {{ p.money }}</span></div>
                <div class="p-sub">Investments: {{ p.investments }}</div>
                <div class="p-tokens">
                   Tokens: 
                   <span *ngFor="let t of p.tokens" [ngClass]="{'finished': t.isFinished}">
                     {{ t.id }}:{{ t.position }}
                   </span>
                </div>
              </div>
            </div>

            <!-- Logs -->
            <div class="glass-card logs-card">
              <h3>Game Events</h3>
              <div class="logs-container">
                <p *ngFor="let log of state.logs.slice().reverse()">{{ log }}</p>
              </div>
            </div>

          </div>

        </ng-container>
      </div>

    </div>
  `,
  styles: [`
    .game-container {
      padding: 1.5rem;
      min-height: 100vh;
      background: linear-gradient(135deg, #e0eafc 0%, #cfdef3 100%);
      font-family: 'Inter', sans-serif;
    }
    
    .header-section {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2rem;
      background: rgba(255, 255, 255, 0.7);
      backdrop-filter: blur(10px);
      padding: 1.5rem 2rem;
      border-radius: 16px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.05);
      position: sticky;
      top: 0;
      z-index: 100;
    }
    .header-titles h1 { margin: 0; color: #2d3748; }
    .header-titles p { margin: 0.5rem 0 0 0; color: #718096; }
    
    .header-actions { display: flex; gap: 1rem; align-items: center; }

    .zoom-controls {
      display: flex; align-items: center; gap: 0.5rem;
      background: rgba(255,255,255,0.8); padding: 0.4rem; border-radius: 8px; border: 1px solid #cbd5e0;
    }
    .btn-icon {
      background: none; border: none; font-size: 1.2rem; cursor: pointer; padding: 0.2rem; transition: 0.2s;
    }
    .btn-icon:hover { transform: scale(1.2); }
    .zoom-level { font-weight: 600; width: 45px; text-align: center; font-size: 0.9rem; }

    .btn-primary, .btn-outline {
      padding: 0.6rem 1.2rem; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.2s;
    }
    .btn-primary { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; }
    .btn-primary:active { transform: translateY(2px); }
    .btn-outline { background: transparent; border: 2px solid #718096; color: #4a5568; }
    .btn-outline:hover { background: #718096; color: white; }

    .glass-card {
      background: rgba(255, 255, 255, 0.5); backdrop-filter: blur(12px); border-radius: 20px;
      padding: 1.5rem; border: 1px solid rgba(255, 255, 255, 0.4); box-shadow: 0 4px 20px rgba(0,0,0,0.05);
    }

    /* Setup */
    .setup-card { max-width: 600px; margin: 0 auto; }
    .setup-grid { display: flex; gap: 1rem; margin-bottom: 1rem; }
    .form-group { display: flex; flex-direction: column; gap: 0.4rem; flex: 1; margin-bottom: 0.8rem; }
    .form-group label { font-size: 0.85rem; font-weight: 600; color: #4a5568; }
    .form-group select, .form-group input { padding: 0.6rem; border-radius: 8px; border: 1px solid #cbd5e0; }
    .players-setup { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
    .mt-4 { margin-top: 1rem; }

    /* Main Game */
    .main-game {
      display: grid;
      grid-template-columns: 3fr 1fr;
      gap: 1.5rem;
      align-items: start; /* prevents columns from stretching equally */
    }
    
    @media (max-width: 1024px) { .main-game { grid-template-columns: 1fr; } }

    /* Board */
    .board-column { width: 100%; overflow-x: auto; padding-bottom: 2rem; }
    .board-column:fullscreen {
      width: 100vw;
      height: 100vh;
      padding: 1rem;
      background: #f7fafc;
      overflow: auto;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    
    .board-wrapper {
      transform-origin: top left;
      transition: transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
    }

    .board-column:fullscreen .board-wrapper { margin: 0 auto; }

    .board-grid {
      display: grid;
      grid-template-columns: repeat(10, 1fr);
      grid-template-rows: repeat(11, 1fr);
      gap: 4px; padding: 4px;
      background: rgba(0,0,0,0.1); border-radius: 12px;
      width: 1000px; height: 1100px;
      position: relative;
    }
    
    .board-cell {
      background: rgba(255,255,255,0.85); border-radius: 8px;
      position: relative; display: flex; flex-direction: column; align-items: center;
      transition: box-shadow 0.2s; overflow: hidden;
    }
    .board-cell:hover { z-index: 10; box-shadow: 0 4px 15px rgba(0,0,0,0.3); }
    .cell-number { position: absolute; top: 4px; left: 6px; font-size: 0.85rem; font-weight: 800; color: rgba(0,0,0,0.3); z-index: 2; }
    .cell-title { font-size: 0.75rem; text-align: center; margin-top: 55%; font-weight: 700; color: #2d3748; line-height: 1.2; z-index: 2; padding: 0 4px; }
    
    .cell-media { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; z-index: 1; opacity: 0.4; }
    .cell-bg-image { width: 100%; height: 100%; object-fit: cover; }
    .cell-emoji { font-size: 3rem; }

    /* Cell Types styling */
    .bg-neutral { background: rgba(255,255,255,0.9); }
    .bg-safe { background: #e6fffa; border: 2px solid #319795; }
    .bg-positive { background: #f0fff4; border: 2px solid #38a169; }
    .bg-negative { background: #fff5f5; border: 2px solid #e53e3e; }

    /* Animations config from Excel */
    .anim-pulse .cell-emoji { animation: p 2s infinite; }
    .anim-bounce .cell-emoji { animation: b 1s infinite alternate; }
    .anim-shake .cell-emoji { animation: s 0.5s infinite alternate; }
    .anim-spin .cell-emoji { animation: sp 3s linear infinite; }
    .anim-zoom-in .cell-emoji { animation: zi 2s infinite alternate; }
    .anim-slide-up .cell-emoji { animation: su 2s infinite; }

    @keyframes p { 0% { transform: scale(1); } 50% { transform: scale(1.2); } 100% { transform: scale(1); } }
    @keyframes b { from { transform: translateY(0); } to { transform: translateY(-10px); } }
    @keyframes s { from { transform: translateX(-5px); } to { transform: translateX(5px); } }
    @keyframes sp { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    @keyframes zi { from { transform: scale(0.8); } to { transform: scale(1.1); } }
    @keyframes su { 0% { transform: translateY(10px); opacity: 0;} 50% { transform: translateY(0); opacity:1;} 100% { transform: translateY(-10px); opacity: 0;} }

    /* Absolute Smooth Tokens Overlay */
    .tokens-overlay {
      position: absolute;
      top: 4px; left: 4px; bottom: 4px; right: 4px;
      pointer-events: none; /* Let hovers pass to cells */
    }
    
    .player-token-absolute {
      position: absolute;
      width: 24px; height: 24px;
      border-radius: 50%;
      color: white; font-size: 0.7rem; display: flex; align-items: center; justify-content: center;
      font-weight: 800; border: 2px solid white;
      box-shadow: 0 4px 10px rgba(0,0,0,0.5);
      transition: all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1); /* Smooth bouncy pop */
      z-index: 50;
      transform: translate(-50%, -50%);
    }

    /* Sticky Right Panel */
    .panel-column {
      display: flex; flex-direction: column; gap: 1rem;
      position: sticky;
      top: 6rem;
      height: fit-content;
      max-height: calc(100vh - 8rem);
      overflow-y: auto;
      padding-right: 0.5rem;
    }
    .panel-column::-webkit-scrollbar { width: 6px; }
    .panel-column::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.2); border-radius: 10px; }

    .action-card { text-align: center; }
    .action-card.inactive { opacity: 0.6; pointer-events: none; }
    .turn-indicator { margin-top: 0; font-size: 1.2rem; }
    .dice-section { background: rgba(0,0,0,0.03); padding: 1rem; border-radius: 12px; margin-top: 1rem; }
    .dice-btn {
      padding: 0.8rem 1.5rem; font-size: 1.2rem; background: #fff; border: 2px solid #cbd5e0;
      border-radius: 12px; font-weight: bold; cursor: pointer; color: #2d3748;
      box-shadow: 0 4px 6px rgba(0,0,0,0.05); transition: 0.2s;
    }
    .dice-btn:hover:not([disabled]) { border-color: #4facfe; transform: translateY(-2px); }
    .dice-btn[disabled] { opacity: 0.5; cursor: not-allowed; }
    
    .dice-icon { display: inline-block; }
    .dice-icon.rolling { animation: dr 0.4s infinite; }
    @keyframes dr { 0% { transform: rotate(0deg) scale(1); } 50% { transform: rotate(180deg) scale(1.3); } 100% { transform: rotate(360deg) scale(1); } }
    
    .dice-result { margin-top: 1rem; font-size: 1.2rem; color: #e53e3e; animation: popIn 0.3s; }
    .roll-value { font-size: 1.6rem; }
    
    @keyframes popIn { 0% { transform: scale(0); } 80% { transform: scale(1.2); } 100% { transform: scale(1); } }
    
    .token-selection { margin-top: 1rem; animation: slideDown 0.3s; }
    @keyframes slideDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
    
    .token-options { display: flex; flex-wrap: wrap; gap: 0.5rem; justify-content: center; }
    .token-btn {
      padding: 0.4rem 0.8rem; background: #fff; border: 2px solid #ccc;
      border-radius: 8px; cursor: pointer; font-weight: 600; transition: 0.2s;
    }
    .token-btn:hover:not([disabled]) { background: #f7fafc; transform: scale(1.05); }
    .token-btn[disabled] { opacity: 0.4; text-decoration: line-through; }

    .players-card h3 { margin-top: 0; border-bottom: 1px solid rgba(0,0,0,0.1); padding-bottom: 0.5rem; }
    .player-stat {
      background: white; padding: 0.8rem; border-radius: 8px; margin-bottom: 0.5rem;
      border-left: 4px solid #000; box-shadow: 0 2px 5px rgba(0,0,0,0.02); transition: 0.3s;
    }
    .player-stat:hover { transform: translateX(5px); }
    .p-header { display: flex; justify-content: space-between; font-size: 1rem; color: #2d3748; }
    .p-sub { font-size: 0.8rem; color: #718096; margin-top: 0.2rem; }
    .p-tokens { font-size: 0.75rem; margin-top: 0.4rem; display: flex; gap: 0.4rem; flex-wrap: wrap; }
    .p-tokens span { background: #edf2f7; padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(0,0,0,0.05); }
    .p-tokens span.finished { background: #c6f6d5; color: #22543d; text-decoration: line-through; }

    .logs-card h3 { margin-top: 0; border-bottom: 1px solid rgba(0,0,0,0.1); padding-bottom: 0.5rem; }
    .logs-container { font-size: 0.8rem; color: #4a5568; }
    .logs-container p { margin: 0.3rem 0; border-bottom: 1px dashed rgba(0,0,0,0.05); padding-bottom: 0.2rem; animation: slideLeft 0.3s; }
    @keyframes slideLeft { from { opacity: 0; transform: translateX(10px); } to { opacity: 1; transform: translateX(0); } }

    .winner-card { background: linear-gradient(135deg, #f6d365 0%, #fda085 100%); color: white; text-align: center; font-size: 1.2rem; animation: zoomOutBounce 0.5s; }
    .winner-card h2 { margin: 0 0 0.5rem 0; border: none; color: white;}
    @keyframes zoomOutBounce { 0% { transform: scale(0); } 70% { transform: scale(1.1); } 100% { transform: scale(1); } }
  `]
})
export class RealLifeStepsComponent implements OnInit, OnDestroy {
  gameService = inject(RealLifeStepsService);
  
  state$!: Observable<GameState>;
  boardCells: CellConfig[] = [];
  sub!: Subscription;

  setup = {
    playerCount: 2,
    tokensPerPlayer: 1,
    playerNames: ['Player 1', 'Player 2']
  };

  pendingRoll: number | null = null;
  isRolling = false;
  zoomLevel = 1;
  isBoardFullscreen = false;

  @ViewChild('boardColumn', { static: false })
  private readonly boardColumnRef?: ElementRef<HTMLElement>;

  @HostListener('document:fullscreenchange')
  onFullscreenChange(): void {
    this.syncFullscreenState();
  }

  // Web Audio Context for synthesizer sounds
  private audioCtx: AudioContext | null = null;
  private priorLogsCount = 0;

  ngOnInit() {
    this.state$ = this.gameService.state$;
    
    this.gameService.board$.subscribe(board => {
      this.boardCells = [...board];
    });

    // Subscribe to state to watch for events indicating sound effects
    this.sub = this.state$.subscribe(state => {
      if (!state.isStarted) return;
      
      // Look for new logs to trigger cell sounds
      if (state.logs.length > this.priorLogsCount) {
        this.priorLogsCount = state.logs.length;
        this.detectSoundTriggers(state);
      }
    });

    this.syncFullscreenState();
  }

  ngOnDestroy() {
    if (this.sub) this.sub.unsubscribe();
  }

  toggleBoardFullscreen(): void {
    const el = this.boardColumnRef?.nativeElement;
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

  private syncFullscreenState(): void {
    const el = this.boardColumnRef?.nativeElement;
    this.isBoardFullscreen = !!el && document.fullscreenElement === el;
  }

  updatePlayerNames() {
    this.setup.playerNames = Array.from({ length: this.setup.playerCount }, (_, i) => `Player ${i+1}`);
  }

  trackByFn(index: number) { return index; }

  startGame() {
    try {
      this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch(e) {}
    this.gameService.startGame(this.setup.playerNames, this.setup.tokensPerPlayer);
    this.playSound('start', 600, 'sine');
  }

  resetGame() {
    this.gameService.resetGame();
    this.pendingRoll = null;
    this.priorLogsCount = 0;
  }

  // --- Zoom Controls ---
  zoomIn() {
    this.zoomLevel = Math.min(2.0, this.zoomLevel + 0.1);
  }

  zoomOut() {
    this.zoomLevel = Math.max(0.4, this.zoomLevel - 0.1);
  }

  // --- Smooth Absolute Positioning ---
  // The board is a 10x11 CSS Grid mathematically sized 1000px wide x 1100px height.
  // Each cell is roughly 10% width, ~9.09% height.
  // Returns styling percentage values based on 0-100 positions.
  getTokenX(pos: number, playerIdx: number, tokenIdx: number): string {
    const col = pos % 10;
    // Offset slightly so tokens don't overlap completely (-20px to +20px variations base on indices)
    const offset = (playerIdx * 8) + (tokenIdx * 4) - 10;
    // Each column is 10vw of the board. Center is 5% + col*10%;
    return `calc(${(col * 10) + 5}% + ${offset}px)`;
  }

  getTokenY(pos: number, playerIdx: number, tokenIdx: number): string {
    const row = Math.floor(pos / 10);
    // 11 rows total, so each row is (100 / 11) = 9.0909%
    const offset = (playerIdx * 8) - (tokenIdx * 4) - 10;
    return `calc(${(row * 9.0909) + 4.5}% + ${offset}px)`;
  }

  getCellClass(cell: CellConfig) {
    if (cell.eventType === 'Positive') return 'bg-positive';
    if (cell.eventType === 'Negative') return 'bg-negative';
    if (cell.eventType === 'SafeZone') return 'bg-safe';
    return 'bg-neutral';
  }

  // --- External Input Simulation ---
  rollDice(state: GameState) {
    if (this.pendingRoll !== null || this.isRolling) return;
    
    // Play dice roll sound
    this.playSound('dice', 300, 'square');
    this.isRolling = true;
    
    setTimeout(() => {
      this.isRolling = false;
      const roll = Math.floor(Math.random() * 6) + 1;
      this.pendingRoll = roll;

      const player = state.players[state.currentPlayerIndex];
      const activeTokens = player.tokens.filter(t => !t.isFinished);
      
      if (activeTokens.length === 1) {
        setTimeout(() => {
          this.moveToken(roll, activeTokens[0].id);
        }, 500); 
      } else if (activeTokens.length === 0) {
        this.moveToken(roll, '');
      }
    }, 400); // 400ms animation simulation
  }

  moveToken(diceValue: number, tokenId: string) {
    // Movement sound
    this.playSound('move', 400, 'triangle');
    this.gameService.externalDiceRoll(diceValue, tokenId);
    this.pendingRoll = null;
  }

  // --- Sound Engine ---
  // Simple synthesizer since external internet MP3s often break
  playSound(type: string, freq = 440, waveType: OscillatorType = 'sine') {
    if (!this.audioCtx) return;
    try {
      const osc = this.audioCtx.createOscillator();
      const gainNode = this.audioCtx.createGain();
      
      osc.type = waveType;
      osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
      
      if (type === 'dice') {
        osc.frequency.setValueAtTime(150, this.audioCtx.currentTime);
        osc.frequency.linearRampToValueAtTime(300, this.audioCtx.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.1, this.audioCtx.currentTime);
        osc.start(); osc.stop(this.audioCtx.currentTime + 0.1);
      } 
      else if (type === 'move') {
        osc.frequency.setValueAtTime(500, this.audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, this.audioCtx.currentTime + 0.2);
        gainNode.gain.setValueAtTime(0.1, this.audioCtx.currentTime);
        osc.start(); osc.stop(this.audioCtx.currentTime + 0.2);
      }
      else if (type === 'error' || type === 'crash') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(200, this.audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(50, this.audioCtx.currentTime + 0.4);
        gainNode.gain.setValueAtTime(0.1, this.audioCtx.currentTime);
        osc.start(); osc.stop(this.audioCtx.currentTime + 0.4);
      }
      else if (type === 'tada' || type === 'coin' || type === 'cash') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(600, this.audioCtx.currentTime);
        osc.frequency.setValueAtTime(800, this.audioCtx.currentTime + 0.1);
        osc.frequency.setValueAtTime(1200, this.audioCtx.currentTime + 0.2);
        gainNode.gain.setValueAtTime(0.05, this.audioCtx.currentTime);
        osc.start(); osc.stop(this.audioCtx.currentTime + 0.3);
      } else {
        // generic
        gainNode.gain.setValueAtTime(0.1, this.audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.2);
        osc.start(); osc.stop(this.audioCtx.currentTime + 0.2);
      }

      osc.connect(gainNode);
      gainNode.connect(this.audioCtx.destination);
    } catch(e) {}
  }

  detectSoundTriggers(state: GameState) {
    const lastLog = state.logs[state.logs.length - 1];
    if (!lastLog) return;
    
    // Check if player landed on a cell requiring sound. Wait, we can just extract the cell from the board!
    // We check the player's last active token's current cell... Alternatively, parse string for words.
    // Easiest robust way: if log says "Landed on", or "Event [", grab title.
    if (lastLog.includes('ATTACK!')) {
      this.playSound('crash');
    } else if (lastLog.includes('Event [')) {
      // Find what cell this was implicitly by searching board title 
      // Example log: "Event [Lottery Win]: Won small lottery!"
      const titleMatch = lastLog.match(/Event \[([^\]]+)\]/);
      if (titleMatch && titleMatch[1]) {
        const cellInfo = this.boardCells.find(c => c.title === titleMatch[1]);
        if (cellInfo && cellInfo.sound) {
           this.playSound(cellInfo.sound);
        } else {
           this.playSound('generic', 440);
        }
      }
    } else if (lastLog.includes('WON The Real Life Steps Game')) {
       this.playSound('tada');
       setTimeout(() => this.playSound('tada'), 400);
       setTimeout(() => this.playSound('tada'), 800);
    }
  }

  // --- Excel Configs ---
  downloadRules() {
    this.gameService.downloadTemplate();
  }

  uploadRules(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.gameService.uploadConfig(file).then(() => {
        alert('Custom Board Rules & Media applied successfully!');
      }).catch(err => {
        alert('Failed to parse Excel file. Make sure it matches the downloaded template format.');
        console.error(err);
      });
      event.target.value = '';
    }
  }
}
