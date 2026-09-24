import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DashboardComponent } from './dashboard/dashboard.component';
import { DataManagerComponent } from './data-manager/data-manager.component';
import { ThemeService } from '../../core/services/theme.service';
import { WorkTrackerService } from './work-tracker.service';

@Component({
  selector: 'app-work-tracker',
  standalone: true,
  imports: [CommonModule, DashboardComponent, DataManagerComponent],
  template: `
    <div class="work-tracker-container" [class.jarvis-mode]="themeService.isJarvis()">
      
      <!-- J.A.R.V.I.S Futuristic Header -->
      <nav *ngIf="themeService.isJarvis()" class="tracker-nav jarvis-nav">
        <div class="jarvis-brand">
          <div class="hud-target-icon">
            <svg viewBox="0 0 40 40" class="target-svg">
              <circle cx="20" cy="20" r="17" stroke="#00c8ff" stroke-width="1.5" fill="none" opacity="0.6"/>
              <circle cx="20" cy="20" r="11" stroke="#00c8ff" stroke-width="1" stroke-dasharray="4 2" fill="none"/>
              <circle cx="20" cy="20" r="4" fill="#00c8ff"/>
              <line x1="20" y1="0" x2="20" y2="40" stroke="#00c8ff" stroke-width="1.5" opacity="0.7"/>
              <line x1="0" y1="20" x2="40" y2="20" stroke="#00c8ff" stroke-width="1.5" opacity="0.7"/>
            </svg>
          </div>
          <h1 class="jarvis-title">WORK TRACKER</h1>
        </div>

        <div class="jarvis-quote-card">
          <div class="quote-content">
            <span class="quote-text">"DATA TODAY, PRODUCTIVITY TOMORROW."</span>
            <span class="quote-author">- J.A.R.V.I.S</span>
          </div>
          <div class="ironman-helmet">
            <svg viewBox="0 0 50 60" class="helmet-svg">
              <!-- Crown / Forehead -->
              <path d="M12,14 L25,4 L38,14 L36,24 L14,24 Z" fill="rgba(0, 200, 255, 0.15)" stroke="#00c8ff" stroke-width="1.2"/>
              <!-- Cheeks & Faceplate boundary -->
              <path d="M10,22 L14,42 L25,54 L36,42 L40,22 L36,24 L25,18 L14,24 Z" fill="rgba(0, 30, 60, 0.7)" stroke="#00c8ff" stroke-width="1.5"/>
              <!-- Brow Line -->
              <path d="M13,26 L25,30 L37,26" fill="none" stroke="#00c8ff" stroke-width="1.5"/>
              <!-- Glowing Eyes -->
              <polygon points="15,31 22,32 21,34 16,34" fill="#00ffff" class="eye-glow"/>
              <polygon points="35,31 28,32 29,34 34,34" fill="#00ffff" class="eye-glow"/>
              <!-- Mouth Grid lines -->
              <line x1="20" y1="44" x2="30" y2="44" stroke="#00c8ff" stroke-width="1"/>
              <line x1="22" y1="48" x2="28" y2="48" stroke="#00c8ff" stroke-width="1"/>
            </svg>
          </div>
        </div>

        <div class="jarvis-nav-actions">
          <div class="tabs jarvis-tabs">
            <button 
              [class.active]="activeTab === 'dashboard'" 
              (click)="activeTab = 'dashboard'">
              Dashboard
            </button>
            <button 
              [class.active]="activeTab === 'data'" 
              (click)="activeTab = 'data'">
              Data Manager
            </button>
          </div>
          <div class="expand-collapse-group">
            <button class="btn-hud-sm" (click)="expandAll()">Expand All</button>
            <button class="btn-hud-sm" (click)="collapseAll()">Collapse All</button>
          </div>
        </div>
      </nav>

      <!-- Default Header -->
      <nav *ngIf="!themeService.isJarvis()" class="tracker-nav default-nav">
        <h1>Work Tracker</h1>
        <div class="tabs">
          <button 
            [class.active]="activeTab === 'dashboard'" 
            (click)="activeTab = 'dashboard'">
            Dashboard
          </button>
          <button 
            [class.active]="activeTab === 'data'" 
            (click)="activeTab = 'data'">
            Data Manager
          </button>
        </div>
      </nav>

      <div class="tracker-content">
        <app-dashboard *ngIf="activeTab === 'dashboard'"></app-dashboard>
        <app-data-manager *ngIf="activeTab === 'data'"></app-data-manager>
      </div>
    </div>
  `,
  styles: [`
    .work-tracker-container {
      padding: 0.75rem;
      min-height: 100vh;
      background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
      font-family: 'Inter', 'Segoe UI', sans-serif;
      transition: background 0.3s ease;
    }

    /* ── Default Nav Styling ── */
    .default-nav {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
      background: rgba(255, 255, 255, 0.7);
      backdrop-filter: blur(10px);
      padding: 0.75rem 1.25rem;
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(31, 38, 135, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.18);
    }

    .default-nav h1 {
      margin: 0;
      color: #2c3e50;
      font-weight: 700;
      font-size: 1.8rem;
    }

    .default-nav .tabs {
      display: flex;
      gap: 0.75rem;
    }

    .default-nav button {
      padding: 0.5rem 1rem;
      border: none;
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.5);
      color: #5b6a7a;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
      font-size: 0.95rem;
    }

    .default-nav button:hover {
      background: rgba(255, 255, 255, 0.8);
      transform: translateY(-2px);
    }

    .default-nav button.active {
      background: #4a90e2;
      color: white;
      box-shadow: 0 4px 15px rgba(74, 144, 226, 0.3);
    }

    /* ── J.A.R.V.I.S. Theme Nav & Layout ── */
    .work-tracker-container.jarvis-mode {
      background: radial-gradient(ellipse at 50% 10%, rgba(0, 150, 255, 0.08) 0%, transparent 60%),
                  radial-gradient(ellipse at 80% 80%, rgba(0, 200, 255, 0.04) 0%, transparent 50%),
                  #020b18 !important;
      color: #c8eeff;
      font-family: 'Orbitron', 'Inter', sans-serif;
    }

    .jarvis-nav {
      display: grid;
      grid-template-columns: auto 1fr auto;
      align-items: center;
      gap: 1.5rem;
      margin-bottom: 1rem;
      background: rgba(4, 20, 38, 0.85);
      backdrop-filter: blur(16px);
      padding: 0.75rem 1.25rem;
      border-radius: 12px;
      border: 1px solid rgba(0, 200, 255, 0.35);
      box-shadow: 0 0 25px rgba(0, 200, 255, 0.15), inset 0 0 15px rgba(0, 200, 255, 0.05);
      position: relative;
    }

    .jarvis-nav::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 2px;
      background: linear-gradient(90deg, transparent 0%, #00c8ff 50%, transparent 100%);
      box-shadow: 0 0 10px #00c8ff;
    }

    .jarvis-brand {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .hud-target-icon {
      width: 38px;
      height: 38px;
      flex-shrink: 0;
    }

    .target-svg {
      width: 100%;
      height: 100%;
      filter: drop-shadow(0 0 6px rgba(0, 200, 255, 0.7));
    }

    .jarvis-title {
      margin: 0;
      font-family: 'Orbitron', sans-serif;
      font-weight: 800;
      font-size: 1.5rem;
      letter-spacing: 1.5px;
      color: #00c8ff;
      text-shadow: 0 0 12px rgba(0, 200, 255, 0.6);
      white-space: nowrap;
    }

    .jarvis-quote-card {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 1rem;
      padding: 0.35rem 1rem;
      background: rgba(0, 20, 40, 0.5);
      border: 1px solid rgba(0, 200, 255, 0.2);
      border-radius: 8px;
      max-width: 480px;
      margin-left: auto;
    }

    .quote-content {
      display: flex;
      flex-direction: column;
      text-align: right;
    }

    .quote-text {
      font-size: 0.75rem;
      font-style: italic;
      color: #a0e4ff;
      letter-spacing: 0.5px;
      font-family: 'Inter', sans-serif;
    }

    .quote-author {
      font-size: 0.7rem;
      color: #00c8ff;
      font-weight: 700;
      letter-spacing: 1px;
      margin-top: 2px;
    }

    .ironman-helmet {
      width: 32px;
      height: 38px;
      flex-shrink: 0;
    }

    .helmet-svg {
      width: 100%;
      height: 100%;
      filter: drop-shadow(0 0 8px rgba(0, 200, 255, 0.5));
    }

    .eye-glow {
      filter: drop-shadow(0 0 4px #00ffff);
      animation: pulseGlow 2s ease-in-out infinite alternate;
    }

    @keyframes pulseGlow {
      from { opacity: 0.7; }
      to { opacity: 1; filter: drop-shadow(0 0 8px #00ffff); }
    }

    .jarvis-nav-actions {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 0.5rem;
    }

    .jarvis-tabs {
      display: flex;
      gap: 0.5rem;
    }

    .jarvis-tabs button {
      padding: 0.4rem 1rem;
      border: 1px solid rgba(0, 200, 255, 0.35);
      border-radius: 6px;
      background: rgba(0, 25, 50, 0.7);
      color: #5fb4d8;
      font-family: 'Orbitron', sans-serif;
      font-weight: 700;
      font-size: 0.8rem;
      letter-spacing: 0.5px;
      cursor: pointer;
      transition: all 0.25s ease;
      text-transform: uppercase;
    }

    .jarvis-tabs button:hover {
      background: rgba(0, 200, 255, 0.15);
      color: #00c8ff;
      border-color: #00c8ff;
      box-shadow: 0 0 10px rgba(0, 200, 255, 0.3);
    }

    .jarvis-tabs button.active {
      background: linear-gradient(135deg, rgba(0, 200, 255, 0.25) 0%, rgba(0, 100, 200, 0.35) 100%);
      color: #ffffff;
      border-color: #00c8ff;
      box-shadow: 0 0 15px rgba(0, 200, 255, 0.5), inset 0 0 8px rgba(0, 200, 255, 0.3);
      text-shadow: 0 0 6px #00c8ff;
    }

    .expand-collapse-group {
      display: flex;
      gap: 0.5rem;
    }

    .btn-hud-sm {
      padding: 0.25rem 0.65rem;
      border: 1px solid rgba(0, 200, 255, 0.25);
      border-radius: 4px;
      background: rgba(0, 15, 30, 0.6);
      color: #5fb4d8;
      font-family: 'Orbitron', sans-serif;
      font-size: 0.7rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .btn-hud-sm:hover {
      border-color: #00c8ff;
      color: #00c8ff;
      background: rgba(0, 200, 255, 0.12);
      box-shadow: 0 0 8px rgba(0, 200, 255, 0.25);
    }

    .tracker-content {
      animation: fadeIn 0.4s ease-out;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @media (max-width: 900px) {
      .jarvis-nav {
        grid-template-columns: 1fr;
        gap: 1rem;
        justify-items: center;
      }

      .jarvis-quote-card {
        margin: 0 auto;
        width: 100%;
        justify-content: center;
      }

      .jarvis-nav-actions {
        align-items: center;
        width: 100%;
      }

      .jarvis-tabs {
        width: 100%;
        justify-content: center;
      }

      .jarvis-tabs button {
        flex: 1;
        text-align: center;
      }
    }
  `]
})
export class WorkTrackerComponent {
  themeService = inject(ThemeService);
  workTrackerService = inject(WorkTrackerService);

  activeTab: 'dashboard' | 'data' = 'dashboard';

  expandAll(): void {
    this.workTrackerService.expandAllSections();
  }

  collapseAll(): void {
    this.workTrackerService.collapseAllSections();
  }
}

