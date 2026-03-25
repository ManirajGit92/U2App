import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import * as XLSX from 'xlsx';

export type EventType = 'Neutral' | 'Positive' | 'Negative' | 'SafeZone';
export type ActionType = 'None' | 'MoveForward' | 'MoveBackward' | 'GainMoney' | 'LoseMoney' | 'InvestMoney';

export interface CellConfig {
  position: number;
  title: string;
  description: string;
  eventType: EventType;
  actionType: ActionType;
  actionValue: number;
  image?: string;
  animation?: string;
  sound?: string;
}

export interface Token {
  id: string;
  position: number;
  isFinished: boolean;
}

export interface Player {
  id: string;
  name: string;
  color: string;
  money: number;
  investments: number;
  tokens: Token[];
}

export interface GameState {
  players: Player[];
  currentPlayerIndex: number;
  diceValue: number | null;
  logs: string[];
  winner: string | null;
  tokensPerPlayer: number;
  isStarted: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class RealLifeStepsService {
  private baseMoney = 1000;

  // Generate 1-100 default cells
  private defaultBoard: CellConfig[] = Array.from({ length: 101 }, (_, i) => ({
    position: i,
    title: i === 0 ? 'Start' : `Cell ${i}`,
    description: i === 0 ? 'Starting point' : 'Standard Path',
    eventType: 'Neutral',
    actionType: 'None',
    actionValue: 0,
    image: '',
    animation: '',
    sound: ''
  }));

  private boardSubject = new BehaviorSubject<CellConfig[]>([]);
  public board$ = this.boardSubject.asObservable();

  private stateSubject = new BehaviorSubject<GameState>({
    players: [],
    currentPlayerIndex: 0,
    diceValue: null,
    logs: [],
    winner: null,
    tokensPerPlayer: 1,
    isStarted: false
  });
  public state$ = this.stateSubject.asObservable();

  constructor() {
    this.setupDefaultBoard();
  }

  private setupDefaultBoard() {
    const board = [...this.defaultBoard];
    // Set Safe Zones
    [10, 25, 50, 75].forEach(pos => {
      board[pos] = { ...board[pos], title: 'Hospital (Safe Zone)', description: 'Safe from attacks here.', eventType: 'SafeZone', actionType: 'None', actionValue: 0, image: '🏥', animation: 'pulse', sound: 'safe' };
    });
    
    // Positive events
    board[15] = { position: 15, title: 'Lottery Win', description: 'Won small lottery!', eventType: 'Positive', actionType: 'GainMoney', actionValue: 500, image: '🎰', animation: 'bounce', sound: 'tada' };
    board[30] = { position: 30, title: 'Salary Increment', description: 'Advance 5 steps', eventType: 'Positive', actionType: 'MoveForward', actionValue: 5, image: '💼', animation: 'slide-up', sound: 'coin' };
    board[60] = { position: 60, title: 'Stock Profit', description: 'Gain 1000', eventType: 'Positive', actionType: 'GainMoney', actionValue: 1000, image: '📈', animation: 'pulse', sound: 'cash' };
    board[80] = { position: 80, title: 'Big Investment', description: 'Invest 500 for future returns', eventType: 'Positive', actionType: 'InvestMoney', actionValue: 500, image: '🏢', animation: 'zoom-in', sound: 'coin' };

    // Negative events
    board[12] = { position: 12, title: 'Theft', description: 'Got robbed. Lose 200', eventType: 'Negative', actionType: 'LoseMoney', actionValue: 200, image: '🥷', animation: 'shake', sound: 'error' };
    board[35] = { position: 35, title: 'Car Accident', description: 'Go back 4 steps', eventType: 'Negative', actionType: 'MoveBackward', actionValue: 4, image: '🚗', animation: 'shake', sound: 'crash' };
    board[65] = { position: 65, title: 'Health Issue', description: 'Medical bills. Lose 300', eventType: 'Negative', actionType: 'LoseMoney', actionValue: 300, image: '🤒', animation: 'fade-out', sound: 'error' };
    board[95] = { position: 95, title: 'Market Crash', description: 'Go back 10 steps', eventType: 'Negative', actionType: 'MoveBackward', actionValue: 10, image: '📉', animation: 'spin', sound: 'crash' };

    board[100] = { position: 100, title: 'Finish', description: 'Journey Complete', eventType: 'SafeZone', actionType: 'None', actionValue: 0, image: '🏆', animation: 'bounce', sound: 'tada' };
    
    this.boardSubject.next(board);
  }

  // Setup game with given config
  startGame(playerNames: string[], tokensPerPlayer: number) {
    const colors = ['#e53e3e', '#3182ce', '#38a169', '#d69e2e'];
    const players: Player[] = playerNames.map((name, idx) => ({
      id: `P${idx+1}`,
      name,
      color: colors[idx % colors.length],
      money: this.baseMoney,
      investments: 0,
      tokens: Array.from({ length: tokensPerPlayer }, (_, tIdx) => ({
        id: `T${tIdx+1}`,
        position: 0,
        isFinished: false
      }))
    }));

    this.stateSubject.next({
      players,
      currentPlayerIndex: 0,
      diceValue: null,
      logs: ['Game started! Waiting for first external dice roll.'],
      winner: null,
      tokensPerPlayer,
      isStarted: true
    });
  }

  // Hook for external system to inject dice rolls and specify which token to move
  externalDiceRoll(diceValue: number, tokenId: string) {
    const state = { ...this.stateSubject.value };
    if (state.winner || !state.isStarted) return;

    state.diceValue = diceValue;
    const player = state.players[state.currentPlayerIndex];
    const token = player.tokens.find(t => t.id === tokenId);

    if (!token || token.isFinished) {
      this.log(`Player ${player.name} tried to move invalid/finished token ${tokenId}. Turn skipped.`);
      this.nextTurn(state);
      return;
    }

    this.log(`[EXTERNAL] Rolled a ${diceValue} for ${player.name}'s Token ${tokenId}.`);

    this.moveToken(state, player, token, diceValue);
  }

  private moveToken(state: GameState, player: Player, token: Token, steps: number) {
    let newPos = token.position + steps;
    
    if (newPos > 100) {
      // Need exact roll to hit 100. Bounce back or just stay? Let's just clamp to 100 if we allow overflowing, or require exact.
      // Usually, it requires an exact roll or bounces back. We'll simply stay if overshoot for simplicity, or clamp. Let's clamp.
      newPos = 100;
    }
    
    token.position = newPos;
    this.log(`${player.name}'s Token ${token.id} landed on ${newPos}.`);

    if (newPos === 100) {
      token.isFinished = true;
      this.log(`${player.name}'s Token ${token.id} is FINISHED!`);
      this.checkWinCondition(state, player);
    } else {
      this.applyCellEffect(state, player, token);
      this.checkAttack(state, player, token);
    }

    if (!state.winner) {
      this.nextTurn(state);
    } else {
      this.stateSubject.next(state);
    }
  }

  private applyCellEffect(state: GameState, player: Player, token: Token) {
    const board = this.boardSubject.value;
    const cell = board[token.position];
    
    if (cell.eventType === 'Neutral' || cell.eventType === 'SafeZone') return;

    this.log(`Event [${cell.title}]: ${cell.description}`);
    
    switch (cell.actionType) {
      case 'GainMoney':
        player.money += cell.actionValue;
        this.log(`${player.name} gained ${cell.actionValue} money. Total: ${player.money}`);
        break;
      case 'LoseMoney':
        player.money = Math.max(0, player.money - cell.actionValue);
        this.log(`${player.name} lost ${cell.actionValue} money. Total: ${player.money}`);
        break;
      case 'InvestMoney':
        if (player.money >= cell.actionValue) {
          player.money -= cell.actionValue;
          player.investments += cell.actionValue * 1.5; // Arbitrary 50% ROI stored
          this.log(`${player.name} invested ${cell.actionValue}. Total Inv: ${player.investments}`);
        } else {
          this.log(`${player.name} didn't have enough money to invest ${cell.actionValue}.`);
        }
        break;
      case 'MoveForward':
        token.position = Math.min(100, token.position + cell.actionValue);
        this.log(`${player.name}'s Token escalated to ${token.position}!`);
        if (token.position === 100) {
          token.isFinished = true;
          this.checkWinCondition(state, player);
        }
        break;
      case 'MoveBackward':
        token.position = Math.max(0, token.position - cell.actionValue);
        this.log(`${player.name}'s Token demoted to ${token.position}.`);
        break;
    }
  }

  private checkAttack(state: GameState, attacker: Player, attackerToken: Token) {
    const board = this.boardSubject.value;
    const cell = board[attackerToken.position];
    
    if (cell.eventType === 'SafeZone') return;

    // Check if any other player's token is on the same spot
    state.players.forEach(victim => {
      if (victim.id === attacker.id) return; // Can't attack self
      
      victim.tokens.forEach(victimToken => {
        if (!victimToken.isFinished && victimToken.position === attackerToken.position && attackerToken.position > 0) {
          // Attack! Victim moves backward by the dice value the attacker just rolled
          const penalty = state.diceValue || 1;
          victimToken.position = Math.max(0, victimToken.position - penalty);
          this.log(`💥 ATTACK! ${attacker.name} attacked ${victim.name}'s Token ${victimToken.id}! Victim bumped back by ${penalty} steps to ${victimToken.position}.`);
        }
      });
    });
  }

  private checkWinCondition(state: GameState, player: Player) {
    if (player.tokens.every(t => t.isFinished)) {
      state.winner = player.name;
      this.log(`🏆 GAME OVER! ${player.name} has moved all tokens to 100 and WON The Real Life Steps Game!`);
    }
  }

  private nextTurn(state: GameState) {
    state.currentPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;
    const nextPlayer = state.players[state.currentPlayerIndex];
    this.log(`--- Next Turn: ${nextPlayer.name} ---`);
    this.stateSubject.next(state);
  }

  private log(msg: string) {
    const state = this.stateSubject.value;
    state.logs.push(msg);
    // Keep last 50 logs
    if (state.logs.length > 50) state.logs.shift();
  }

  // Excel Integration
  downloadTemplate() {
    const board = this.boardSubject.value;
    const sheetData = board.map(c => ({
      Position: c.position,
      Title: c.title,
      Description: c.description,
      EventType: c.eventType,
      ActionType: c.actionType,
      ActionValue: c.actionValue,
      Image: c.image || '',
      Animation: c.animation || '',
      Sound: c.sound || ''
    }));

    const ws = XLSX.utils.json_to_sheet(sheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Board Rules');
    XLSX.writeFile(wb, 'RealLifeSteps_Board_Template.xlsx');
  }

  uploadConfig(file: File): Promise<void> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const ws = workbook.Sheets[workbook.SheetNames[0]];
          const json: any[] = XLSX.utils.sheet_to_json(ws);

          const newBoard: CellConfig[] = this.boardSubject.value.map(cell => ({...cell}));

          json.forEach(row => {
            const pos = Number(row['Position']);
            if (!isNaN(pos) && pos >= 0 && pos <= 100) {
              newBoard[pos] = {
                position: pos,
                title: row['Title'] || `Cell ${pos}`,
                description: row['Description'] || '',
                eventType: (row['EventType'] as EventType) || 'Neutral',
                actionType: (row['ActionType'] as ActionType) || 'None',
                actionValue: Number(row['ActionValue']) || 0,
                image: row['Image'] || '',
                animation: row['Animation'] || '',
                sound: row['Sound'] || ''
              };
            }
          });

          this.boardSubject.next(newBoard);
          this.log('Successfully applied new custom board rules from Excel upload.');
          resolve();
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = (err) => reject(err);
      reader.readAsArrayBuffer(file);
    });
  }

  resetGame() {
    this.setupDefaultBoard();
    this.stateSubject.next({
      players: [],
      currentPlayerIndex: 0,
      diceValue: null,
      logs: [],
      winner: null,
      tokensPerPlayer: 1,
      isStarted: false
    });
  }
}
