import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameState, OfficeFunService } from '../office-fun.service';

@Component({
  selector: 'app-leaderboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="leaderboard-page">
      <div class="lb-header">
        <div class="lb-title">🏆 Leaderboard</div>
        <div class="lb-subtitle" *ngIf="(state$ | async)?.status === 'finished'">Final Results!</div>
        <div class="lb-subtitle" *ngIf="(state$ | async)?.status !== 'finished'">Live Scores</div>
        <button class="btn btn-secondary" (click)="svc.exportScores(state?.scores || {})">⬇ Export Excel</button>
      </div>

      <!-- Game Over Celebration -->
      <div class="game-over-banner" *ngIf="(state$ | async)?.status === 'finished' && ranked.length > 0">
        <div class="go-emoji">🎉</div>
        <div class="go-text">Congratulations!</div>
        <div class="go-winner">👑 {{ ranked[0].name }} wins with {{ ranked[0].score }} points!</div>
      </div>

      <!-- Podium (top 3) -->
      <div class="podium-row" *ngIf="ranked.length >= 3">
        <!-- 2nd -->
        <div class="podium-slot p2">
          <div class="podium-avatar" style="background: linear-gradient(135deg,#64748b,#94a3b8)">
            {{ getInitials(ranked[1].name) }}
          </div>
          <div class="podium-name">{{ ranked[1].name }}</div>
          <div class="podium-score">{{ ranked[1].score }} pts</div>
          <div class="podium-block p2-block">2</div>
        </div>
        <!-- 1st -->
        <div class="podium-slot p1">
          <div class="crown">👑</div>
          <div class="podium-avatar" style="background: linear-gradient(135deg,#f59e0b,#fcd34d)">
            {{ getInitials(ranked[0].name) }}
          </div>
          <div class="podium-name first">{{ ranked[0].name }}</div>
          <div class="podium-score first">{{ ranked[0].score }} pts</div>
          <div class="podium-block p1-block">1</div>
        </div>
        <!-- 3rd -->
        <div class="podium-slot p3">
          <div class="podium-avatar" style="background: linear-gradient(135deg,#92400e,#d97706)">
            {{ getInitials(ranked[2].name) }}
          </div>
          <div class="podium-name">{{ ranked[2].name }}</div>
          <div class="podium-score">{{ ranked[2].score }} pts</div>
          <div class="podium-block p3-block">3</div>
        </div>
      </div>

      <!-- Full List -->
      <div class="scores-list">
        <div class="score-row" *ngFor="let entry of ranked; let i = index" [class.top1]="i === 0" [class.top3]="i < 3">
          <div class="rank">{{ i + 1 }}</div>
          <div class="player-avatar" [style.background]="getColor(i)">{{ getInitials(entry.name) }}</div>
          <div class="player-name">{{ entry.name }}</div>
          <div class="score-bar-wrap">
            <div class="score-bar" [style.width]="getBarWidth(entry.score) + '%'" [style.background]="getBarColor(i)"></div>
          </div>
          <div class="player-score">{{ entry.score }} pts</div>
        </div>
        <div class="empty-lb" *ngIf="ranked.length === 0">
          No scores yet. Start the game to see rankings!
        </div>
      </div>
    </div>
  `,
  styles: [`
    .leaderboard-page { flex: 1; overflow-y: auto; padding: 1.5rem; display: flex; flex-direction: column; gap: 1.5rem; }

    .lb-header { display: flex; align-items: center; gap: 1rem; }
    .lb-title { font-size: 1.5rem; font-weight: 800; color: var(--text-primary); flex: 1; }
    .lb-subtitle { font-size: 0.9rem; color: var(--text-secondary); margin-left: -0.5rem; }

    .btn { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.55rem 1rem; border-radius: 8px; font-size: 0.85rem; font-weight: 600; cursor: pointer; border: 1px solid transparent; transition: all 0.15s; }
    .btn-secondary { background: var(--accent-surface); border-color: var(--accent-primary); color: var(--accent-primary); }
    .btn-secondary:hover { opacity: 0.8; }

    /* Game Over */
    .game-over-banner {
      background: radial-gradient(ellipse at center, rgba(245,158,11,0.15), transparent);
      border: 1px solid var(--accent-secondary); border-radius: 16px; padding: 1.5rem;
      text-align: center; display: flex; flex-direction: column; align-items: center; gap: 0.5rem;
    }
    .go-emoji { font-size: 3rem; }
    .go-text { font-size: 1.3rem; font-weight: 700; color: var(--text-primary); }
    .go-winner { font-size: 1rem; color: var(--accent-secondary); font-weight: 600; }

    /* Podium */
    .podium-row { display: flex; justify-content: center; align-items: flex-end; gap: 1rem; padding: 1rem 0; }
    .podium-slot { display: flex; flex-direction: column; align-items: center; gap: 0.25rem; }
    .crown { font-size: 2rem; }
    .podium-avatar { width: 60px; height: 60px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; font-weight: 700; color: white; }
    .podium-name { font-size: 0.85rem; font-weight: 700; color: var(--text-primary); text-align: center; }
    .podium-name.first { font-size: 1rem; }
    .podium-score { font-size: 0.8rem; color: var(--text-secondary); }
    .podium-score.first { font-size: 0.95rem; color: var(--accent-secondary); font-weight: 700; }
    .podium-block { display: flex; align-items: center; justify-content: center; width: 70px; font-size: 1.5rem; font-weight: 900; color: white; border-radius: 8px 8px 0 0; }
    .p1-block { height: 90px; background: linear-gradient(180deg, #f59e0b, #d97706); }
    .p2-block { height: 65px; background: linear-gradient(180deg, #64748b, #475569); }
    .p3-block { height: 50px; background: linear-gradient(180deg, #92400e, #78350f); }

    /* Score list */
    .scores-list { display: flex; flex-direction: column; gap: 0.6rem; }
    .score-row {
      display: flex; align-items: center; gap: 1rem;
      background: var(--bg-secondary); border: 1px solid var(--border-color);
      border-radius: 12px; padding: 0.85rem 1.25rem; transition: border-color 0.15s;
    }
    .score-row.top3 { border-color: rgba(245,158,11,0.3); }
    .score-row.top1 { border-color: var(--accent-secondary); background: rgba(245,158,11,0.06); }
    .rank { font-size: 1rem; font-weight: 800; color: var(--text-secondary); width: 28px; text-align: center; }
    .player-avatar { width: 38px; height: 38px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.85rem; font-weight: 700; color: white; flex-shrink: 0; }
    .player-name { font-weight: 700; font-size: 0.95rem; color: var(--text-primary); min-width: 120px; }
    .score-bar-wrap { flex: 1; height: 10px; background: var(--bg-tertiary); border-radius: 5px; overflow: hidden; }
    .score-bar { height: 100%; border-radius: 5px; transition: width 0.8s ease; }
    .player-score { font-size: 1rem; font-weight: 800; color: var(--text-primary); min-width: 70px; text-align: right; }

    .empty-lb { text-align: center; padding: 3rem; color: var(--text-secondary); font-style: italic; }
  `]
})
export class LeaderboardComponent implements OnInit {
  svc = inject(OfficeFunService);
  state$ = this.svc.state$;
  state: any = null;
  ranked: { name: string; score: number }[] = [];

  private maxScore = 1;
  private readonly COLORS = ['#f59e0b', '#94a3b8', '#92400e', '#7c3aed', '#10b981', '#ef4444', '#3b82f6'];
  private readonly BAR_COLORS = [
    'linear-gradient(90deg,#f59e0b,#fcd34d)',
    'linear-gradient(90deg,#64748b,#94a3b8)',
    'linear-gradient(90deg,#92400e,#d97706)',
    'linear-gradient(90deg,#7c3aed,#a855f7)',
    'linear-gradient(90deg,#059669,#10b981)',
  ];

  ngOnInit() {
    this.svc.state$.subscribe((s: GameState) => {
      this.state = s;
      this.ranked = Object.entries(s.scores)
        .map(([name, score]) => ({ name, score }))
        .sort((a, b) => b.score - a.score);
      this.maxScore = this.ranked[0]?.score || 1;
    });
  }

  getInitials(name: string) { return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2); }
  getColor(i: number) { return this.COLORS[i % this.COLORS.length]; }
  getBarColor(i: number) { return this.BAR_COLORS[i % this.BAR_COLORS.length]; }
  getBarWidth(score: number) { return Math.max(2, Math.round((score / this.maxScore) * 100)); }
}
