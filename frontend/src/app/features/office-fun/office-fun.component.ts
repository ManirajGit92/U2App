import { Component, inject, OnDestroy, OnInit, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameState, OfficeFunService } from './office-fun.service';
import { GameScreenComponent } from './game-screen/game-screen.component';
import { AdminComponent } from './admin/admin.component';
import { LeaderboardComponent } from './leaderboard/leaderboard.component';
import { ThemeService } from '../../core/services/theme.service';

type View = 'game' | 'admin' | 'leaderboard';

@Component({
  selector: 'app-office-fun',
  standalone: true,
  imports: [CommonModule, GameScreenComponent, AdminComponent, LeaderboardComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <div class="office-fun-shell">
      <!-- Header -->
      <header class="of-header">
        <div class="of-logo">🎮 <span>Office Fun</span></div>

        <nav class="of-nav">
          <button *ngFor="let v of views" class="nav-tab" [class.active]="activeView === v.id" (click)="activeView = v.id">
            {{ v.icon }} {{ v.label }}
          </button>
        </nav>

        <div class="of-header-right">
          <!-- Connection status -->
          <div class="conn-dot" [class.connected]="connected$ | async" [title]="(connected$ | async) ? 'Server Connected' : 'Server Offline'"></div>
          <span class="conn-label">{{ (connected$ | async) ? 'Live' : 'Offline' }}</span>

          <!-- Status badge -->
          <span class="status-badge" [ngClass]="'status-' + (gameState$ | async)?.status">
            {{ ((gameState$ | async)?.status || 'idle') | uppercase }}
          </span>

          <!-- Theme -->
          <button class="icon-btn" (click)="themeSvc.toggle()" [title]="'Switch to ' + (themeSvc.theme() === 'dark' ? 'light' : 'dark') + ' mode'">
            {{ themeSvc.theme() === 'dark' ? '☀️' : '🌙' }}
          </button>
          
          <!-- Home -->
          <a href="/" class="icon-btn" title="Home">🏠</a>
        </div>
      </header>

      <!-- Content -->
      <main class="of-content">
        <app-game-screen *ngIf="activeView === 'game'"></app-game-screen>
        <app-admin *ngIf="activeView === 'admin'"></app-admin>
        <app-leaderboard *ngIf="activeView === 'leaderboard'"></app-leaderboard>
      </main>
    </div>
  `,
  styles: [`
    :host { display: block; height: 100vh; }

    .office-fun-shell {
      display: flex; flex-direction: column; height: 100vh;
      background: var(--bg-primary);
      font-family: var(--font-family);
      --primary: var(--accent-primary);
      --primary-glow: var(--accent-surface);
      --accent: var(--accent-secondary);
      --surface: var(--bg-secondary);
      --surface2: var(--bg-tertiary);
      --border: var(--border-color);
      --text: var(--text-primary);
      --text-muted: var(--text-secondary);
      --success: var(--success);
      --danger: var(--danger);
      transition: background var(--transition-normal);
    }

    /* Header */
    .of-header {
      display: flex; align-items: center; gap: 1.5rem;
      padding: 0 1.5rem; height: 60px;
      background: var(--surface); border-bottom: 1px solid var(--border);
      position: sticky; top: 0; z-index: 50;
      box-shadow: var(--shadow-md);
    }
    .of-logo { display: flex; align-items: center; gap: 0.5rem; font-weight: 800; font-size: 1.1rem; color: var(--primary); white-space: nowrap; }
    .of-logo span { background: linear-gradient(135deg, var(--primary), var(--accent)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }

    .of-nav { display: flex; gap: 0.25rem; flex: 1; }
    .nav-tab {
      padding: 0.5rem 1.1rem; border: none; background: none;
      border-radius: 8px; cursor: pointer; font-size: 0.88rem; font-weight: 600;
      color: var(--text-muted); transition: all 0.15s;
    }
    .nav-tab:hover { background: var(--border); color: var(--text); }
    .nav-tab.active { background: var(--primary); color: white; }

    .of-header-right { display: flex; align-items: center; gap: 0.75rem; margin-left: auto; }
    .conn-dot { width: 10px; height: 10px; border-radius: 50%; background: var(--danger); transition: background 0.3s; }
    .conn-dot.connected { background: var(--success); box-shadow: 0 0 6px var(--success); animation: pulse 2s infinite; }
    .conn-label { font-size: 0.78rem; font-weight: 600; color: var(--text-muted); }

    .status-badge { padding: 0.25rem 0.7rem; border-radius: 20px; font-size: 0.72rem; font-weight: 700; letter-spacing: 0.05em; }
    .status-idle     { background: rgba(100,116,139,0.2); color: var(--text-muted); }
    .status-playing  { background: rgba(16,185,129,0.2); color: var(--success); }
    .status-paused   { background: rgba(245,158,11,0.2); color: var(--accent); }
    .status-break    { background: rgba(99,102,241,0.2); color: #818cf8; }
    .status-finished { background: rgba(239,68,68,0.2); color: var(--danger); }

    .icon-btn { background: none; border: none; font-size: 1.2rem; cursor: pointer; border-radius: 8px; padding: 0.4rem; color: var(--text-muted); text-decoration: none; transition: all 0.15s; }
    .icon-btn:hover { background: var(--border); color: var(--text); }

    .of-content { flex: 1; overflow: hidden; display: flex; flex-direction: column; }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.6; }
    }
  `]
})
export class OfficeFunComponent implements OnInit, OnDestroy {
  svc = inject(OfficeFunService);
  themeSvc = inject(ThemeService);
  activeView: View = 'game';

  gameState$ = this.svc.state$;
  connected$ = this.svc.connected$;

  views = [
    { id: 'game' as View, label: 'Game Screen', icon: '🎯' },
    { id: 'admin' as View, label: 'Admin', icon: '⚙️' },
    { id: 'leaderboard' as View, label: 'Leaderboard', icon: '🏆' },
  ];

  ngOnInit() { this.svc.connect(); }
  ngOnDestroy() { this.svc.disconnect(); }
}

