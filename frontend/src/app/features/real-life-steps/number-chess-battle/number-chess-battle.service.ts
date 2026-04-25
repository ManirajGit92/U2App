import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface ChessPiece {
  id: string;
  value: number;
  row: number;
  col: number;
  team: 'blue' | 'red';
  captured: boolean;
}

export interface GameState {
  board: (ChessPiece | null)[][];
  bluePieces: ChessPiece[];
  redPieces: ChessPiece[];
  currentTeam: 'blue' | 'red';
  selectedPiece: ChessPiece | null;
  validMoves: { row: number; col: number; type: 'move' | 'capture' }[];
  isStarted: boolean;
  winner: 'blue' | 'red' | null;
  moveHistory: string[];
  gameMode: 'single' | 'local' | 'online';
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface MoveResult {
  success: boolean;
  message: string;
  resultValue?: number;
  animation?: 'addition' | 'multiplication' | 'subtraction' | 'division';
}

@Injectable({
  providedIn: 'root',
})
export class NumberChessBattleService {
  private gameStateSubject = new BehaviorSubject<GameState>(this.initializeGameState());
  gameState$: Observable<GameState> = this.gameStateSubject.asObservable();

  constructor() {}

  private initializeGameState(): GameState {
    const board = this.createBoard();
    const bluePieces = this.extractPieces(board, 'blue');
    const redPieces = this.extractPieces(board, 'red');

    return {
      board,
      bluePieces,
      redPieces,
      currentTeam: 'blue',
      selectedPiece: null,
      validMoves: [],
      isStarted: false,
      winner: null,
      moveHistory: [],
      gameMode: 'local',
      difficulty: 'medium',
    };
  }

  private createBoard(): (ChessPiece | null)[][] {
    const board: (ChessPiece | null)[][] = Array(8)
      .fill(null)
      .map(() => Array(8).fill(null));

    // Back row setup: 3, 5, 7, 9, 8, 6, 4, 2
    const backRowValues = [3, 5, 7, 9, 8, 6, 4, 2];
    for (let col = 0; col < 8; col++) {
      // Red team (top)
      board[0][col] = {
        id: `red-${backRowValues[col]}-${col}`,
        value: backRowValues[col],
        row: 0,
        col,
        team: 'red',
        captured: false,
      };

      // Blue team (bottom)
      board[7][col] = {
        id: `blue-${backRowValues[col]}-${col}`,
        value: backRowValues[col],
        row: 7,
        col,
        team: 'blue',
        captured: false,
      };
    }

    // Front row (pawns): 1, 0, 1, 0, 1, 0, 1, 0
    for (let col = 0; col < 8; col++) {
      const pawnValue = col % 2 === 0 ? 1 : 0;

      // Red pawns (row 1)
      board[1][col] = {
        id: `red-pawn-${pawnValue}-${col}`,
        value: pawnValue,
        row: 1,
        col,
        team: 'red',
        captured: false,
      };

      // Blue pawns (row 6)
      board[6][col] = {
        id: `blue-pawn-${pawnValue}-${col}`,
        value: pawnValue,
        row: 6,
        col,
        team: 'blue',
        captured: false,
      };
    }

    return board;
  }

  private extractPieces(board: (ChessPiece | null)[][], team: 'blue' | 'red'): ChessPiece[] {
    const pieces: ChessPiece[] = [];
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col];
        if (piece && piece.team === team) {
          pieces.push(piece);
        }
      }
    }
    return pieces;
  }

  startGame(gameMode: 'single' | 'local' | 'online', difficulty: 'easy' | 'medium' | 'hard'): void {
    const state = this.gameStateSubject.value;
    state.isStarted = true;
    state.gameMode = gameMode;
    state.difficulty = difficulty;
    this.gameStateSubject.next({ ...state });
  }

  selectPiece(piece: ChessPiece): void {
    const state = this.gameStateSubject.value;

    // Only select pieces from current team
    if (piece.team !== state.currentTeam) return;

    state.selectedPiece = piece;
    state.validMoves = this.calculateValidMoves(piece);
    this.gameStateSubject.next({ ...state });
  }

  private calculateValidMoves(
    piece: ChessPiece,
  ): { row: number; col: number; type: 'move' | 'capture' }[] {
    const moves: { row: number; col: number; type: 'move' | 'capture' }[] = [];
    const board = this.gameStateSubject.value.board;
    const moveDistance = piece.value;

    if (moveDistance === 0) return moves;

    // All 8 directions: N, NE, E, SE, S, SW, W, NW
    const directions = [
      { dr: -1, dc: 0, name: 'N' },
      { dr: -1, dc: 1, name: 'NE' },
      { dr: 0, dc: 1, name: 'E' },
      { dr: 1, dc: 1, name: 'SE' },
      { dr: 1, dc: 0, name: 'S' },
      { dr: 1, dc: -1, name: 'SW' },
      { dr: 0, dc: -1, name: 'W' },
      { dr: -1, dc: -1, name: 'NW' },
    ];

    for (const dir of directions) {
      for (let step = 1; step <= moveDistance; step++) {
        const newRow = piece.row + dir.dr * step;
        const newCol = piece.col + dir.dc * step;

        // Out of bounds
        if (newRow < 0 || newRow > 7 || newCol < 0 || newCol > 7) break;

        const targetPiece = board[newRow][newCol];

        if (!targetPiece) {
          // Empty square - valid move
          moves.push({ row: newRow, col: newCol, type: 'move' });
        } else {
          // Occupied square
          if (targetPiece.team !== piece.team) {
            // Enemy piece - can capture
            moves.push({ row: newRow, col: newCol, type: 'capture' });
          }
          // Can't move further in this direction
          break;
        }
      }
    }

    return moves;
  }

  movePiece(fromRow: number, fromCol: number, toRow: number, toCol: number): MoveResult {
    const state = this.gameStateSubject.value;
    const piece = state.board[fromRow][fromCol];

    if (!piece) return { success: false, message: 'No piece at source' };
    if (piece.team !== state.currentTeam) return { success: false, message: 'Not your piece' };

    const targetPiece = state.board[toRow][toCol];
    const moveDistance = Math.abs(toRow - fromRow) + Math.abs(toCol - fromCol);

    if (moveDistance > piece.value && !this.isKnight(piece)) {
      return { success: false, message: `${piece.value} can only move ${piece.value} squares` };
    }

    let result: MoveResult = { success: true, message: '' };

    if (targetPiece && targetPiece.team !== piece.team) {
      // Capture scenario
      const isForwardStraight = fromCol === toCol && toRow > fromRow;
      const isForwardDiagonal =
        Math.abs(fromCol - toCol) === Math.abs(fromRow - toRow) && toRow > fromRow;
      const isBackwardStraight = fromCol === toCol && toRow < fromRow;
      const isBackwardDiagonal =
        Math.abs(fromCol - toCol) === Math.abs(fromRow - toRow) && toRow < fromRow;

      if (isForwardStraight) {
        // Addition
        const newValue = piece.value + targetPiece.value;
        piece.value = Math.min(newValue, 99);
        result.animation = 'addition';
        result.resultValue = piece.value;
        result.message = `${piece.value - targetPiece.value} + ${targetPiece.value} = ${piece.value}`;
      } else if (isForwardDiagonal) {
        // Multiplication
        const newValue = piece.value * targetPiece.value;
        piece.value = Math.min(newValue, 99);
        result.animation = 'multiplication';
        result.resultValue = piece.value;
        result.message = `${piece.value / targetPiece.value} × ${targetPiece.value} = ${piece.value}`;
      } else if (isBackwardStraight) {
        // Subtraction
        const newValue = Math.max(piece.value - moveDistance, 0);
        piece.value = newValue;
        result.animation = 'subtraction';
        result.resultValue = piece.value;
        result.message = `${piece.value + moveDistance} - ${moveDistance} = ${piece.value}`;
      } else if (isBackwardDiagonal) {
        // Division
        const newValue = Math.max(Math.floor(piece.value / moveDistance), 0);
        piece.value = newValue;
        result.animation = 'division';
        result.resultValue = piece.value;
        result.message = `${piece.value * moveDistance} ÷ ${moveDistance} = ${piece.value}`;
      }

      // Remove captured piece
      targetPiece.captured = true;
      state.board[toRow][toCol] = null;

      // Remove from team pieces
      const teamPieces = targetPiece.team === 'blue' ? state.bluePieces : state.redPieces;
      const index = teamPieces.findIndex((p) => p.id === targetPiece.id);
      if (index > -1) teamPieces.splice(index, 1);
    } else if (targetPiece && targetPiece.team === piece.team) {
      return { success: false, message: 'Cannot capture own piece' };
    }

    // Move piece
    state.board[fromRow][fromCol] = null;
    piece.row = toRow;
    piece.col = toCol;
    state.board[toRow][toCol] = piece;

    // Update move history
    state.moveHistory.push(
      `${piece.value} moves from [${fromRow},${fromCol}] to [${toRow},${toCol}]`,
    );

    // Check win conditions
    this.checkWinCondition(state);

    // Switch turns
    state.currentTeam = state.currentTeam === 'blue' ? 'red' : 'blue';
    state.selectedPiece = null;
    state.validMoves = [];

    this.gameStateSubject.next({ ...state });
    return result;
  }

  private checkWinCondition(state: GameState): void {
    // Check if king (9) is captured
    const blueKing = state.bluePieces.find((p) => p.value === 9 && !p.captured);
    const redKing = state.redPieces.find((p) => p.value === 9 && !p.captured);

    if (!blueKing) {
      state.winner = 'red';
    } else if (!redKing) {
      state.winner = 'blue';
    }
  }

  private isKnight(piece: ChessPiece): boolean {
    return piece.value === 4 || piece.value === 5;
  }

  resetGame(): void {
    this.gameStateSubject.next(this.initializeGameState());
  }
}
