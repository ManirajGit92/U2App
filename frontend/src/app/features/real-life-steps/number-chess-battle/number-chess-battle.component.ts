import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { NumberChessBattleService, GameState, ChessPiece } from './number-chess-battle.service';
import { Observable, Subscription } from 'rxjs';

@Component({
  selector: 'app-number-chess-battle',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="game-container">
      <div class="header-section">
        <div class="header-titles">
          <h1>♟ Number Chess Battle</h1>
          <p>A strategic board game combining chess mechanics with mathematics.</p>
        </div>
        <div class="header-actions">
          <a class="btn-outline" routerLink="/real-life-steps">Back to Real Life Steps</a>
          <button
            class="btn-outline"
            (click)="resetGame()"
            [disabled]="!(gameState$ | async)?.isStarted"
          >
            New Game
          </button>
        </div>
      </div>

      <!-- Game Setup -->
      <div class="glass-card setup-card" *ngIf="!(gameState$ | async)?.isStarted">
        <h2>Game Setup</h2>
        <div class="setup-grid">
          <div class="form-group">
            <label>Game Mode</label>
            <select [(ngModel)]="gameMode">
              <option value="local">Local 2 Player</option>
              <option value="single">vs AI</option>
              <option value="online">Online</option>
            </select>
          </div>
          <div class="form-group" *ngIf="gameMode === 'single'">
            <label>AI Difficulty</label>
            <select [(ngModel)]="difficulty">
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
        </div>

        <div class="rules-section">
          <h3>Quick Rules</h3>
          <ul class="rules-list">
            <li>
              <strong>Movement:</strong> Each piece moves exactly as many squares as its value
            </li>
            <li><strong>Forward Straight Attack:</strong> Addition (3 + 4 = 7)</li>
            <li><strong>Forward Diagonal Attack:</strong> Multiplication (2 × 4 = 8)</li>
            <li><strong>Backward Straight Move:</strong> Subtraction (7 - 3 = 4)</li>
            <li><strong>Backward Diagonal Move:</strong> Division (8 ÷ 2 = 4)</li>
            <li><strong>Win Condition:</strong> Capture enemy King (9)</li>
          </ul>
        </div>

        <button class="btn-primary mt-4" (click)="startGame()">Start Game</button>
      </div>

      <!-- Main Game Area -->
      <div class="main-game" *ngIf="gameState$ | async as state">
        <ng-container *ngIf="state.isStarted">
          <!-- Board -->
          <div class="board-section">
            <div class="board-container">
              <!-- Winner -->
              <div class="winner-overlay" *ngIf="state.winner">
                <div class="winner-card">
                  <h2>🎉 {{ state.winner === 'blue' ? 'Blue' : 'Red' }} Wins! 🎉</h2>
                  <button class="btn-primary" (click)="resetGame()">Play Again</button>
                </div>
              </div>

              <!-- Chess Board -->
              <div class="chess-board">
                <div
                  *ngFor="let piece of state.board; let i = index; trackBy: trackByIndex"
                  class="board-row"
                >
                  <div
                    *ngFor="let cell of piece; let j = index; trackBy: trackByIndex"
                    class="board-cell"
                    [ngClass]="getCellClass(i, j, state)"
                    (click)="onCellClick(i, j, state)"
                  >
                    <div class="cell-coords">{{ getCoords(i, j) }}</div>

                    <!-- Piece -->
                    <div
                      *ngIf="cell"
                      class="piece"
                      [ngClass]="[cell.team, { selected: state.selectedPiece?.id === cell.id }]"
                      [title]="'Value: ' + cell.value + ' | Team: ' + cell.team"
                    >
                      <div class="piece-number">{{ cell.value }}</div>
                      <div class="piece-glow"></div>
                    </div>

                    <!-- Move Indicator -->
                    <div
                      *ngIf="
                        state.validMoves.some((m) => m.row === i && m.col === j && m.type === 'move')
                      "
                      class="move-indicator"
                    >
                      •
                    </div>

                    <!-- Capture Indicator -->
                    <div
                      *ngIf="
                        state.validMoves.some((m) => m.row === i && m.col === j && m.type === 'capture')
                      "
                      class="capture-indicator"
                    >
                      ✕
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Side Controls -->
            <div class="side-controls">
              <!-- Current Turn -->
              <div class="glass-card">
                <h3>Current Turn</h3>
                <div class="turn-display" [ngClass]="state.currentTeam">
                  {{ state.currentTeam === 'blue' ? '🔵 Blue' : '🔴 Red' }}
                </div>
              </div>

              <!-- Selected Piece Info -->
              <div class="glass-card" *ngIf="state.selectedPiece as piece">
                <h3>Selected Piece</h3>
                <div class="piece-info">
                  <div class="info-row">
                    <span>Value:</span>
                    <strong>{{ piece.value }}</strong>
                  </div>
                  <div class="info-row">
                    <span>Position:</span>
                    <strong>{{ getCoords(piece.row, piece.col) }}</strong>
                  </div>
                  <div class="info-row">
                    <span>Valid Moves:</span>
                    <strong>{{ state.validMoves.length }}</strong>
                  </div>
                </div>
              </div>

              <!-- Game Stats -->
              <div class="glass-card">
                <h3>Game Stats</h3>
                <div class="stats">
                  <div class="stat-row">
                    <span>🔵 Blue Pieces:</span>
                    <strong>{{ state.bluePieces.filter((p) => !p.captured).length }}/16</strong>
                  </div>
                  <div class="stat-row">
                    <span>🔴 Red Pieces:</span>
                    <strong>{{ state.redPieces.filter((p) => !p.captured).length }}/16</strong>
                  </div>
                  <div class="stat-row">
                    <span>Moves:</span>
                    <strong>{{ state.moveHistory.length }}</strong>
                  </div>
                </div>
              </div>

              <!-- Move History -->
              <div class="glass-card moves-card">
                <h3>Move History</h3>
                <div class="moves-list">
                  <div
                    *ngFor="let move of state.moveHistory.slice().reverse().slice(0, 8)"
                    class="move-item"
                  >
                    {{ move }}
                  </div>
                  <div *ngIf="state.moveHistory.length === 0" class="no-moves">No moves yet</div>
                </div>
              </div>
            </div>
          </div>
        </ng-container>
      </div>
    </div>
  `,
  styles: [
    `
      .game-container {
        padding: 1.5rem;
        min-height: 100vh;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        font-family: 'Inter', sans-serif;
      }

      .header-section {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 1.5rem;
        padding: 1.5rem;
        margin-bottom: 1.5rem;
        border-radius: 12px;
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.2);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
      }

      .header-titles h1 {
        margin: 0;
        font-size: 28px;
        color: white;
        text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
      }

      .header-titles p {
        margin: 0.5rem 0 0;
        color: rgba(255, 255, 255, 0.8);
        font-size: 14px;
      }

      .header-actions {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
      }

      .btn-primary,
      .btn-outline {
        padding: 10px 16px;
        border-radius: 8px;
        font-weight: 700;
        cursor: pointer;
        transition: all 200ms ease;
        border: 1px solid transparent;
        background: transparent;
        text-decoration: none;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        white-space: nowrap;
      }

      .btn-primary {
        background: linear-gradient(135deg, #667eea, #764ba2);
        color: white;
        box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
      }

      .btn-primary:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6);
      }

      .btn-outline {
        border-color: rgba(255, 255, 255, 0.3);
        color: white;
        background: rgba(255, 255, 255, 0.1);
      }

      .btn-outline:hover {
        border-color: rgba(255, 255, 255, 0.6);
        background: rgba(255, 255, 255, 0.2);
      }

      .btn-outline[disabled] {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .glass-card {
        padding: 1.5rem;
        border-radius: 12px;
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.2);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        color: white;
      }

      .setup-card {
        max-width: 600px;
        margin: 0 auto 2rem;
      }

      .setup-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 1rem;
        margin-bottom: 1.5rem;
      }

      .form-group {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }

      .form-group label {
        font-weight: 700;
        font-size: 12px;
        text-transform: uppercase;
        color: rgba(255, 255, 255, 0.8);
      }

      .form-group input,
      .form-group select {
        padding: 10px;
        border-radius: 6px;
        border: 1px solid rgba(255, 255, 255, 0.3);
        background: rgba(0, 0, 0, 0.2);
        color: white;
      }

      .form-group input:focus,
      .form-group select:focus {
        outline: none;
        border-color: rgba(102, 126, 234, 0.8);
        background: rgba(0, 0, 0, 0.3);
      }

      .rules-section {
        margin: 1.5rem 0;
        padding: 1rem;
        border-radius: 8px;
        background: rgba(0, 0, 0, 0.2);
      }

      .rules-section h3 {
        margin-top: 0;
        color: rgba(255, 255, 255, 0.9);
      }

      .rules-list {
        margin: 0;
        padding-left: 1.5rem;
        color: rgba(255, 255, 255, 0.8);
        font-size: 13px;
        line-height: 1.6;
      }

      .rules-list li {
        margin-bottom: 0.5rem;
      }

      .mt-4 {
        margin-top: 1.5rem;
      }

      .main-game {
        animation: fadeIn 0.3s ease;
      }

      @keyframes fadeIn {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }

      .board-section {
        display: grid;
        grid-template-columns: 1fr 300px;
        gap: 1.5rem;
      }

      .board-container {
        position: relative;
      }

      .winner-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(0, 0, 0, 0.7);
        border-radius: 12px;
        z-index: 100;
        backdrop-filter: blur(5px);
      }

      .winner-card {
        background: linear-gradient(135deg, #667eea, #764ba2);
        padding: 2rem;
        border-radius: 12px;
        text-align: center;
        color: white;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      }

      .winner-card h2 {
        margin: 0 0 1rem;
        font-size: 28px;
      }

      .chess-board {
        display: inline-grid;
        grid-template-columns: repeat(8, 1fr);
        gap: 0;
        border-radius: 12px;
        overflow: hidden;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
      }

      .board-row {
        display: contents;
      }

      .board-cell {
        width: 60px;
        height: 60px;
        position: relative;
        cursor: pointer;
        transition: all 200ms ease;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 1px solid rgba(0, 0, 0, 0.1);
      }

      .board-cell:nth-child(odd) {
        background: rgba(200, 200, 220, 0.6);
      }

      .board-cell:nth-child(even) {
        background: rgba(100, 100, 120, 0.6);
      }

      .board-cell.valid-move {
        background: rgba(100, 200, 100, 0.5) !important;
      }

      .board-cell.valid-capture {
        background: rgba(200, 100, 100, 0.5) !important;
      }

      .board-cell:hover {
        transform: scale(1.05);
      }

      .cell-coords {
        position: absolute;
        top: 2px;
        left: 2px;
        font-size: 8px;
        color: rgba(0, 0, 0, 0.3);
        font-weight: 700;
      }

      .piece {
        position: relative;
        width: 50px;
        height: 50px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 900;
        font-size: 20px;
        cursor: pointer;
        transition: all 200ms ease;
        border: 2px solid rgba(255, 255, 255, 0.4);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      }

      .piece.blue {
        background: linear-gradient(135deg, #4a90e2, #357abd);
        color: white;
      }

      .piece.red {
        background: linear-gradient(135deg, #e24a4a, #bd3535);
        color: white;
      }

      .piece.selected {
        transform: scale(1.15);
        box-shadow: 0 0 20px rgba(102, 126, 234, 0.8);
      }

      .piece-number {
        z-index: 2;
        position: relative;
      }

      .piece-glow {
        position: absolute;
        top: -4px;
        left: -4px;
        right: -4px;
        bottom: -4px;
        border-radius: 50%;
        background: radial-gradient(circle, rgba(255, 255, 255, 0.3), transparent);
      }

      .move-indicator {
        position: absolute;
        width: 12px;
        height: 12px;
        background: rgba(100, 200, 100, 0.7);
        border-radius: 50%;
        font-size: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: rgba(50, 100, 50, 0.8);
      }

      .capture-indicator {
        position: absolute;
        width: 20px;
        height: 20px;
        background: rgba(200, 100, 100, 0.7);
        border-radius: 50%;
        font-size: 14px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: rgba(100, 50, 50, 0.8);
      }

      .side-controls {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }

      .side-controls .glass-card {
        margin: 0;
      }

      .side-controls h3 {
        margin-top: 0;
        margin-bottom: 0.75rem;
        font-size: 14px;
        text-transform: uppercase;
        color: rgba(255, 255, 255, 0.9);
      }

      .turn-display {
        padding: 1rem;
        border-radius: 6px;
        text-align: center;
        font-size: 18px;
        font-weight: 700;
        background: rgba(0, 0, 0, 0.2);
      }

      .turn-display.blue {
        color: #4a90e2;
        border: 2px solid #4a90e2;
      }

      .turn-display.red {
        color: #e24a4a;
        border: 2px solid #e24a4a;
      }

      .piece-info,
      .stats {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }

      .info-row,
      .stat-row {
        display: flex;
        justify-content: space-between;
        padding: 0.5rem;
        border-radius: 4px;
        background: rgba(0, 0, 0, 0.2);
        font-size: 13px;
      }

      .moves-card {
        flex: 1 1 auto;
      }

      .moves-list {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        max-height: 300px;
        overflow-y: auto;
      }

      .move-item {
        padding: 0.5rem;
        border-radius: 4px;
        background: rgba(0, 0, 0, 0.2);
        font-size: 12px;
        color: rgba(255, 255, 255, 0.8);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .no-moves {
        text-align: center;
        color: rgba(255, 255, 255, 0.5);
        padding: 1rem;
      }

      @media (max-width: 1024px) {
        .board-section {
          grid-template-columns: 1fr;
        }

        .side-controls {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        }
      }

      @media (max-width: 768px) {
        .game-container {
          padding: 0.75rem;
        }

        .header-section {
          flex-direction: column;
          text-align: center;
        }

        .header-titles h1 {
          font-size: 20px;
        }

        .board-cell {
          width: 45px;
          height: 45px;
        }

        .piece {
          width: 40px;
          height: 40px;
          font-size: 16px;
        }
      }
    `,
  ],
})
export class NumberChessBattleComponent implements OnInit, OnDestroy {
  gameState$: Observable<GameState>;
  gameMode: 'single' | 'local' | 'online' = 'local';
  difficulty: 'easy' | 'medium' | 'hard' = 'medium';
  private subscription?: Subscription;

  constructor(private service: NumberChessBattleService) {
    this.gameState$ = this.service.gameState$;
  }

  ngOnInit(): void {
    // Initialize if needed
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  startGame(): void {
    this.service.startGame(this.gameMode, this.difficulty);
  }

  resetGame(): void {
    this.service.resetGame();
  }

  onCellClick(row: number, col: number, state: GameState): void {
    if (state.winner) return;

    const cell = state.board[row][col];

    // If clicking on own piece
    if (cell && cell.team === state.currentTeam) {
      this.service.selectPiece(cell);
      return;
    }

    // If a piece is selected, try to move
    if (state.selectedPiece) {
      const validMove = state.validMoves.find((m) => m.row === row && m.col === col);
      if (validMove) {
        this.service.movePiece(state.selectedPiece.row, state.selectedPiece.col, row, col);
      }
    }
  }

  getCellClass(row: number, col: number, state: GameState): string {
    const classes = [];

    // Check if this is a valid move
    if (state.validMoves.some((m) => m.row === row && m.col === col && m.type === 'move')) {
      classes.push('valid-move');
    }

    // Check if this is a valid capture
    if (state.validMoves.some((m) => m.row === row && m.col === col && m.type === 'capture')) {
      classes.push('valid-capture');
    }

    return classes.join(' ');
  }

  getCoords(row: number, col: number): string {
    const files = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    return files[col] + (8 - row);
  }

  trackByIndex(index: number): number {
    return index;
  }
}
