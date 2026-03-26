import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import * as XLSX from 'xlsx';

export interface GameQuestion {
  no: number;
  contentUrl: string;
  contentType: 'image' | 'gif' | 'video' | 'youtube' | 'url';
  timer: number;
  points: number;
  breakAfterWin?: number;
  hint?: string;
  answer?: string; // only sent to frontend during reveal/paused status
}

export interface SmsLogEntry {
  phone: string;
  name: string;
  message: string;
  time: string;
  correct: boolean;
}

export interface Winner {
  name: string;
  phone: string;
  points: number;
  message: string;
}

export interface GameState {
  status: 'idle' | 'playing' | 'paused' | 'break' | 'finished';
  currentIndex: number;
  totalQuestions: number;
  currentQuestion: GameQuestion | null;
  timerRemaining: number;
  breakRemaining: number;
  scores: Record<string, number>;
  smsLog: SmsLogEntry[];
  winner: Winner | null;
}

@Injectable({ providedIn: 'root' })
export class OfficeFunService {
  private readonly BASE = 'http://localhost:3000';
  private socket: any = null;

  private stateSubject = new BehaviorSubject<GameState>({
    status: 'idle', currentIndex: -1, totalQuestions: 0,
    currentQuestion: null, timerRemaining: 0, breakRemaining: 0,
    scores: {}, smsLog: [], winner: null,
  });

  private timerSubject     = new BehaviorSubject<{ remaining: number; total: number }>({ remaining: 0, total: 0 });
  private winnerSubject    = new BehaviorSubject<Winner | null>(null);
  private smsSubject       = new BehaviorSubject<SmsLogEntry[]>([]);
  private connectedSubject = new BehaviorSubject<boolean>(false);
  private configSubject    = new BehaviorSubject<{ questions: number; players: number } | null>(null);

  state$     = this.stateSubject.asObservable();
  timer$     = this.timerSubject.asObservable();
  winner$    = this.winnerSubject.asObservable();
  smsLog$    = this.smsSubject.asObservable();
  connected$ = this.connectedSubject.asObservable();
  config$    = this.configSubject.asObservable();

  constructor(private http: HttpClient) {}

  // ── WebSocket ────────────────────────────────────────────────────────────────
  connect() {
    if (this.socket) return;

    // Dynamically import socket.io-client to avoid SSR issues
    import('socket.io-client').then(({ io }) => {
      this.socket = io(this.BASE, { transports: ['websocket', 'polling'] });

      this.socket.on('connect', () => {
        this.connectedSubject.next(true);
        console.log('[Socket] Connected');
      });

      this.socket.on('disconnect', () => {
        this.connectedSubject.next(false);
        console.log('[Socket] Disconnected');
      });

      this.socket.on('game_state', (state: GameState) => {
        this.stateSubject.next(state);
        this.smsSubject.next(state.smsLog || []);
      });

      this.socket.on('timer', (data: { remaining: number; total: number }) => {
        this.timerSubject.next(data);
      });

      this.socket.on('winner', (data: { winner: Winner; scores: Record<string, number> }) => {
        this.winnerSubject.next(data.winner);
        const cur = this.stateSubject.value;
        this.stateSubject.next({ ...cur, scores: data.scores, winner: data.winner });
      });

      this.socket.on('sms_received', (entry: SmsLogEntry) => {
        const cur = this.smsSubject.value;
        this.smsSubject.next([...cur, entry].slice(-50));
      });

      this.socket.on('game_reset', () => {
        this.winnerSubject.next(null);
        this.smsSubject.next([]);
      });

      this.socket.on('config_loaded', (data: { questionCount: number; phonebookCount: number }) => {
        this.configSubject.next({ questions: data.questionCount, players: data.phonebookCount });
      });

      this.socket.on('game_over', () => {
        this.winnerSubject.next(null);
      });
    }).catch(() => {
      console.error('[Socket] socket.io-client not installed. Run: npm install socket.io-client');
    });
  }

  disconnect() {
    if (this.socket) { this.socket.disconnect(); this.socket = null; }
    this.connectedSubject.next(false);
  }

  // ── REST API ──────────────────────────────────────────────────────────────────
  control(action: 'start' | 'next' | 'pause' | 'resume' | 'reset', skipBreak: boolean = false) {
    return this.http.post(`${this.BASE}/api/game/control`, { action, skipBreak });
  }

  uploadConfig(file: File) {
    const fd = new FormData();
    fd.append('file', file);
    return this.http.post(`${this.BASE}/api/game/upload-config`, fd);
  }

  downloadTemplate() {
    const wb = XLSX.utils.book_new();

    const questions = [
      { 'No': 1, 'ContentURL': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/18/Dog_Breeds.jpg/640px-Dog_Breeds.jpg', 'ContentType': 'image', 'Answer': 'Dog',          'Timer(s)': 60, 'Points': 10, 'BreakAfterWin(s)': 5, 'Hint': "Man's best friend 🐾" },
      { 'No': 2, 'ContentURL': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/32/Eiffel_Tower_from_Champ_de_Mars%2C_20_October_2010.jpg/640px-Eiffel_Tower_from_Champ_de_Mars%2C_20_October_2010.jpg', 'ContentType': 'image', 'Answer': 'Eiffel Tower',  'Timer(s)': 60, 'Points': 15, 'BreakAfterWin(s)': 5, 'Hint': 'Famous landmark in France 🗼' },
      { 'No': 3, 'ContentURL': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/Camponotus_flavomarginatus_ant.jpg/640px-Camponotus_flavomarginatus_ant.jpg', 'ContentType': 'image', 'Answer': 'Ant',          'Timer(s)': 45, 'Points': 10, 'BreakAfterWin(s)': 5, 'Hint': 'Tiny insect 🐜' },
      { 'No': 4, 'ContentURL': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/41/Sunflower_from_Silesia2.jpg/640px-Sunflower_from_Silesia2.jpg',                          'ContentType': 'image', 'Answer': 'Sunflower',     'Timer(s)': 45, 'Points': 10, 'BreakAfterWin(s)': 5, 'Hint': 'It always faces the ☀️' },
      { 'No': 5, 'ContentURL': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3b/Cat03.jpg/640px-Cat03.jpg',                                                              'ContentType': 'image', 'Answer': 'Cat',          'Timer(s)': 30, 'Points': 5,  'BreakAfterWin(s)': 5, 'Hint': 'Says meow 🐱' },
    ];
    const phonebook = [
      { 'Phone': '+911234567890', 'PlayerName': 'Alice' },
      { 'Phone': '+910987654321', 'PlayerName': 'Bob' },
    ];

    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(questions), 'Questions');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(phonebook), 'Phonebook');
    XLSX.writeFile(wb, 'GameConfig_Template.xlsx');
  }

  exportScores(scores: Record<string, number>) {
    const rows = Object.entries(scores)
      .sort(([, a], [, b]) => b - a)
      .map(([name, score], i) => ({ Rank: i + 1, Player: name, Score: score }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.length ? rows : [{ Rank: 1, Player: 'No scores yet', Score: 0 }]), 'Leaderboard');
    XLSX.writeFile(wb, 'GameLeaderboard.xlsx');
  }

  mockSms(phone: string, message: string) {
    return this.http.post(`${this.BASE}/api/sms/mock`, { phone, message });
  }

  checkHealth() {
    return this.http.get<{ ok: boolean; provider: string }>(`${this.BASE}/api/health`);
  }
}
