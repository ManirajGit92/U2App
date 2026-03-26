import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameQuestion, GameState, OfficeFunService, Winner } from '../office-fun.service';

@Component({
  selector: 'app-game-screen',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="game-screen">

      <!-- Winner Banner -->
      <div class="winner-banner" *ngIf="winner" [@winnerAnim]>
        <div class="winner-confetti">🎉🎊🏆🎊🎉</div>
        <div class="winner-title">WINNER!</div>
        <div class="winner-name">{{ winner.name }}</div>
        <div class="winner-answer">Answered: "{{ winner.message }}"</div>
        <div class="winner-points">+{{ (state?.currentQuestion)?.points ?? 10 }} pts</div>
      </div>

      <!-- Break Screen -->
      <div class="break-screen" *ngIf="state?.status === 'break' && !winner">
        <div class="break-icon">⏸️</div>
        <div class="break-text">Next question in...</div>
        <div class="break-count">{{ state?.breakRemaining }}</div>
      </div>

      <!-- Finished Screen -->
      <div class="finished-screen" *ngIf="state?.status === 'finished'">
        <div class="fin-icon">🏆</div>
        <div class="fin-title">Game Over!</div>
        <div class="fin-sub">Check the Leaderboard tab for final scores</div>
      </div>

      <!-- Idle Screen -->
      <div class="idle-screen" *ngIf="state?.status === 'idle'">
        <div class="idle-icon">🎮</div>
        <div class="idle-title">Office Fun Activity</div>
        <div class="idle-sub">Go to Admin tab to load questions and start the game</div>
        <div class="idle-hint">📲 Players send answers via SMS to win!</div>
      </div>

      <!-- Active Question -->
      <ng-container *ngIf="state?.status === 'playing' || state?.status === 'paused' || state?.status === 'break'">
        <div class="question-layout" *ngIf="state?.currentQuestion as q">
          <!-- Left: Question info + timer -->
          <div class="q-sidebar">
            <div class="q-number">Q{{ (state?.currentIndex ?? 0) + 1 }} / {{ state?.totalQuestions }}</div>
            <div class="q-points">{{ q.points }} pts</div>

            <!-- Timer Ring -->
            <div class="timer-ring-wrap">
              <svg class="timer-svg" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="52" fill="none" stroke="var(--border, #2d2d4e)" stroke-width="10"/>
                <circle cx="60" cy="60" r="52" fill="none"
                  [attr.stroke]="getTimerColor()"
                  stroke-width="10" stroke-linecap="round"
                  stroke-dasharray="326.7"
                  [attr.stroke-dashoffset]="getTimerOffset()"
                  transform="rotate(-90 60 60)"
                  style="transition: stroke-dashoffset 1s linear, stroke 0.3s;"/>
              </svg>
              <div class="timer-value">{{ timer.remaining }}</div>
            </div>

            <div class="q-hint" *ngIf="q.hint && state?.status === 'playing'">
              💡 {{ q.hint }}
            </div>

            <!-- Paused overlay -->
            <div class="paused-badge" *ngIf="state?.status === 'paused' && !winner">⌛ REVEALING...</div>
            
            <!-- Correct Answer Reveal -->
            <div class="reveal-box" *ngIf="(state?.status === 'paused' || state?.status === 'break') && q.answer">
              <div class="reveal-label">CORRECT ANSWER</div>
              <div class="reveal-value">{{ q.answer }}</div>
            </div>
          </div>

          <!-- Center: Media -->
          <div class="q-media-wrap">
            <!-- Time's Up Overlay -->
            <div class="times-up-overlay" *ngIf="state?.status === 'paused' && !winner && timer.remaining === 0">
              <div class="ts-icon">⏰</div>
              <div class="ts-text">TIME'S UP!</div>
              <div class="ts-sub">No one got it this time...</div>
            </div>

            <!-- Image / GIF -->
            <img *ngIf="q.contentType === 'image' || q.contentType === 'gif'"
              [src]="q.contentUrl" class="media-img" alt="Game content" (error)="onImgError($event)">
...

            <!-- Video -->
            <video *ngIf="q.contentType === 'video'"
              [src]="q.contentUrl" class="media-video" controls autoplay muted></video>

            <!-- YouTube -->
            <iframe *ngIf="q.contentType === 'youtube'"
              [src]="getSafeYoutubeUrl(q.contentUrl)"
              class="media-iframe" frameborder="0" allowfullscreen
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture">
            </iframe>

            <!-- URL / IFrame -->
            <iframe *ngIf="q.contentType === 'url'"
              [src]="getSafeUrl(q.contentUrl)"
              class="media-iframe" frameborder="0"></iframe>

            <!-- Fallback -->
            <div *ngIf="!q.contentUrl" class="media-placeholder">📷 Content URL not provided</div>
          </div>
        </div>
      </ng-container>
    </div>
  `,
  styles: [`
    .game-screen {
      flex: 1; display: flex; align-items: center; justify-content: center;
      background: var(--bg-primary); position: relative; overflow: hidden;
      min-height: 0;
    }

    /* Winner Banner */
    .winner-banner {
      position: absolute; inset: 0; display: flex; flex-direction: column;
      align-items: center; justify-content: center; z-index: 20;
      background: radial-gradient(ellipse at center, rgba(245,158,11,0.2) 0%, var(--bg-primary) 80%);
      animation: winnerIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    .winner-confetti { font-size: 3rem; letter-spacing: 0.5rem; animation: bounce 1s ease infinite; }
    .winner-title { font-size: 4rem; font-weight: 900; color: var(--accent-secondary); text-shadow: 0 0 30px rgba(245,158,11,0.5); letter-spacing: 0.1em; }
    .winner-name { font-size: 2.5rem; font-weight: 800; color: var(--text-primary); margin: 0.25rem 0; }
    .winner-answer { font-size: 1.2rem; color: var(--text-secondary); }
    .winner-points { font-size: 2rem; font-weight: 700; color: var(--success); margin-top: 0.5rem; }

    /* Break / Idle / Finished */
    .break-screen, .idle-screen, .finished-screen {
      display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1rem;
    }
    .break-icon, .idle-icon, .fin-icon { font-size: 5rem; }
    .break-text, .idle-title, .fin-title { font-size: 2.5rem; font-weight: 800; color: var(--text-primary); }
    .break-count { font-size: 6rem; font-weight: 900; color: var(--accent-primary); line-height: 1; animation: pulse 1s ease infinite; }
    .idle-sub, .fin-sub { font-size: 1rem; color: var(--text-secondary); }
    .idle-hint { background: var(--accent-surface); border: 1px solid var(--accent-primary); padding: 0.75rem 1.5rem; border-radius: 12px; color: var(--accent-primary); font-size: 0.95rem; }

    /* Question layout */
    .question-layout {
      display: flex; width: 100%; height: 100%; min-height: 0; gap: 0;
    }
    .q-sidebar {
      width: 180px; min-width: 180px; display: flex; flex-direction: column;
      align-items: center; justify-content: center; gap: 1rem;
      background: var(--bg-secondary); border-right: 1px solid var(--border-color);
      padding: 1.5rem 1rem;
    }
    .q-number { font-size: 0.9rem; font-weight: 700; color: var(--text-secondary); }
    .q-points { font-size: 1.5rem; font-weight: 800; color: var(--accent-secondary); }

    /* Timer Ring */
    .timer-ring-wrap { position: relative; width: 120px; height: 120px; }
    .timer-svg { width: 100%; height: 100%; }
    .timer-value {
      position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
      font-size: 2rem; font-weight: 900; color: var(--text-primary);
    }
    .q-hint { font-size: 0.78rem; color: var(--accent-primary); text-align: center; background: var(--accent-surface); padding: 0.5rem; border-radius: 8px; width: 100%; }
    .paused-badge { font-size: 0.85rem; font-weight: 700; color: var(--accent-secondary); background: rgba(245,158,11,0.15); padding: 0.35rem 0.75rem; border-radius: 8px; width: 100%; text-align: center; }

    .reveal-box {
      margin-top: auto; width: 100%; background: var(--success); border-radius: 12px; padding: 1rem;
      text-align: center; animation: slideUp 0.3s ease-out;
    }
    .reveal-label { font-size: 0.65rem; font-weight: 800; color: rgba(255,255,255,0.7); letter-spacing: 0.05em; margin-bottom: 0.25rem; }
    .reveal-value { font-size: 1.2rem; font-weight: 900; color: #fff; text-transform: uppercase; }

    .times-up-overlay {
      position: absolute; inset: 0; background: rgba(0,0,0,0.85); z-index: 5;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      animation: fadeIn 0.3s ease;
    }
    .ts-icon { font-size: 4rem; margin-bottom: 1rem; }
    .ts-text { font-size: 3rem; font-weight: 900; color: var(--danger); }
    .ts-sub { color: var(--text-secondary); font-size: 1.1rem; }

    /* Media */
    .q-media-wrap {
      flex: 1; display: flex; align-items: center; justify-content: center;
      overflow: hidden; background: #000; position: relative;
    }
    .media-img { max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 4px; }
    .media-video { width: 100%; height: 100%; object-fit: contain; }
    .media-iframe { width: 100%; height: 100%; border: none; }
    .media-placeholder { color: var(--text-muted, #64748b); font-size: 1.2rem; }

    @keyframes winnerIn { from { transform: scale(0.8); opacity: 0; } to { transform: scale(1); opacity: 1; } }
    @keyframes bounce { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
    @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.6; } }
    @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  `]
})
export class GameScreenComponent implements OnInit {
  svc = inject(OfficeFunService);
  state: GameState | null = null;
  winner: Winner | null = null;
  timer: { remaining: number; total: number } = { remaining: 0, total: 60 };

  private tickSnd = new Audio('https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3');
  private winSnd  = new Audio('https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3');
  private lossSnd = new Audio('https://assets.mixkit.co/active_storage/sfx/2572/2572-preview.mp3');

  ngOnInit() {
    this.svc.state$.subscribe(s => { 
      // Play loss sound if transition to paused without a winner
      if (this.state?.status === 'playing' && s.status === 'paused' && !s.winner) {
        this.lossSnd.play().catch(() => {});
      }
      this.state = s; 
    });

    this.svc.winner$.subscribe(w => {
      this.winner = w;
      if (w) {
        this.winSnd.play().catch(() => {});
        setTimeout(() => { if (this.winner === w) this.winner = null; }, 6000);
      }
    });

    this.svc.timer$.subscribe(t => {
      this.timer = t;
      // Ticking sound for last 5 seconds
      if (t.remaining > 0 && t.remaining <= 5 && this.state?.status === 'playing') {
        this.tickSnd.currentTime = 0;
        this.tickSnd.play().catch(() => {});
      }
    });
  }

  getTimerColor(): string {
    const pct = this.timer.total ? this.timer.remaining / this.timer.total : 1;
    if (pct > 0.5) return 'var(--success)';
    if (pct > 0.25) return 'var(--warning)';
    return 'var(--danger)';
  }
  getTimerOffset(): number {
    const circumference = 326.7;
    const pct = this.timer.total ? this.timer.remaining / this.timer.total : 1;
    return circumference * (1 - Math.max(0, Math.min(1, pct)));
  }

  getSafeYoutubeUrl(url: string): string {
    // Convert watch?v= to embed/
    const match = url.match(/(?:v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
    return match ? `https://www.youtube.com/embed/${match[1]}?autoplay=1` : url;
  }
  getSafeUrl(url: string): string { return url; }
  onImgError(e: Event) { (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><text y="100" font-size="60" text-anchor="middle" x="100">🖼️</text></svg>'; }
}
