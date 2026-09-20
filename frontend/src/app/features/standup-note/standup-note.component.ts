import { Component, inject, CUSTOM_ELEMENTS_SCHEMA, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { StandupNoteService } from './standup-note.service';
import { StandupDashboardComponent } from './standup-dashboard/standup-dashboard.component';
import { StandupNotesComponent } from './standup-notes/standup-notes.component';
import { EmployeesComponent } from './employees/employees.component';
import { ProjectsComponent } from './projects/projects.component';
import { RemindersComponent } from './reminders/reminders.component';
import { ChecklistManagerComponent } from './checklist-manager/checklist-manager.component';
import { FeedbackManagerComponent } from './feedback-manager/feedback-manager.component';
import { OfficeCalendarComponent } from './office-calendar/office-calendar.component';
import { TasksComponent } from './tasks/tasks.component';
import { LeaveTrackingComponent } from './leave-tracking/leave-tracking.component';
import { ThemeService } from '../../core/services/theme.service';
import { KnowledgeBaseComponent } from './knowledge-base/knowledge-base.component';

type Tab =
  | 'dashboard'
  | 'notes'
  | 'employees'
  | 'projects'
  | 'reminders'
  | 'checklists'
  | 'feedback'
  | 'calendar'
  | 'tasks'
  | 'leave'
  | 'qa';

@Component({
  selector: 'app-standup-note',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    StandupDashboardComponent,
    StandupNotesComponent,
    EmployeesComponent,
    ProjectsComponent,
    RemindersComponent,
    ChecklistManagerComponent,
    FeedbackManagerComponent,
    OfficeCalendarComponent,
    TasksComponent,
    LeaveTrackingComponent,
    KnowledgeBaseComponent,
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <div class="app-shell" [class.sidebar-collapsed]="isSidebarCollapsed">
      <!-- Backdrop Overlay for Mobile Drawer Menu -->
      <div class="sidebar-backdrop" [class.open]="isMobileMenuOpen" (click)="isMobileMenuOpen = false"></div>

      <!-- Sidebar -->
      <aside class="sidebar" [class.open]="isMobileMenuOpen" [class.collapsed]="isSidebarCollapsed">
        <div class="sidebar-logo">
          <!-- Arc Reactor SVG for JARVIS theme -->
          <div class="arc-reactor-mini" *ngIf="themeSvc.isJarvis()" title="J.A.R.V.I.S. Core Active">
            <svg viewBox="0 0 40 40" width="28" height="28">
              <circle cx="20" cy="20" r="16" stroke="#00c8ff" stroke-width="1.5" fill="rgba(0, 200, 255, 0.12)" />
              <circle cx="20" cy="20" r="11" stroke="#00c8ff" stroke-width="1" stroke-dasharray="4,3" class="spin-hud" />
              <polygon points="20,7 24,15 32,15 26,20 28,28 20,23 12,28 14,20 8,15 16,15" fill="none" stroke="#00c8ff" stroke-width="0.8" opacity="0.6" />
              <circle cx="20" cy="20" r="5" fill="#00c8ff" class="core-glow" />
            </svg>
          </div>
          <span class="logo-icon" *ngIf="!themeSvc.isJarvis()">📋</span>
          <span class="logo-text" *ngIf="!isSidebarCollapsed">
            {{ themeSvc.isJarvis() ? 'J.A.R.V.I.S. HUD' : 'Standup Note' }}
          </span>
          <button
            class="collapse-btn"
            (click)="toggleSidebar()"
            [title]="isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'"
          >
            {{ isSidebarCollapsed ? '»' : '«' }}
          </button>
        </div>
        <nav class="sidebar-nav">
          <button
            *ngFor="let item of navItems"
            class="nav-item"
            [class.active]="activeTab === item.id"
            (click)="activeTab = item.id; isMobileMenuOpen = false"
            [title]="isSidebarCollapsed ? item.label : ''"
          >
            <span class="nav-icon">{{ getNavIcon(item) }}</span>
            <span class="nav-label" *ngIf="!isSidebarCollapsed">{{ item.label }}</span>
          </button>
        </nav>
        <div class="sidebar-footer">
          <a href="/" class="back-link">
            <span *ngIf="!isSidebarCollapsed">← Home</span>
            <span *ngIf="isSidebarCollapsed">←</span>
          </a>
        </div>
      </aside>

      <!-- Main content -->
      <div class="main-wrapper">
        <!-- J.A.R.V.I.S. Top HUD Header Banner -->
        <div class="jarvis-top-banner" *ngIf="themeSvc.isJarvis()">
          <div class="banner-left">
            <div class="helmet-icon-wrapper">
              <svg class="helmet-svg" viewBox="0 0 100 100" width="46" height="46">
                <circle cx="50" cy="50" r="44" stroke="#00c8ff" stroke-width="1.5" fill="none" opacity="0.35" />
                <circle cx="50" cy="50" r="36" stroke="#00c8ff" stroke-width="1.5" stroke-dasharray="6,4" fill="none" class="spin-hud" />
                <!-- Iron Man Mask Outline -->
                <path d="M30,32 L50,18 L70,32 L66,68 L50,82 L34,68 Z" fill="rgba(0, 200, 255, 0.12)" stroke="#00c8ff" stroke-width="2" />
                <polygon points="36,44 44,44 46,50 36,48" fill="#00c8ff" class="eye-glow" />
                <polygon points="64,44 56,44 54,50 64,48" fill="#00c8ff" class="eye-glow" />
                <circle cx="50" cy="62" r="5" fill="#00c8ff" class="core-glow" />
              </svg>
            </div>
            <div class="banner-info">
              <div class="banner-status-badge">
                <span class="status-dot"></span> SYSTEM ONLINE • STARK HUD v4.8
              </div>
              <div class="banner-title">J.A.R.V.I.S. STANDUP INTELLIGENCE</div>
              <div class="banner-quote">"At your service, boss. Daily standup telemetry and team metrics ready."</div>
            </div>
          </div>

          <div class="banner-right">
            <div class="telemetry-box">
              <div class="telemetry-item">
                <span class="label">MODULES</span>
                <span class="value text-cyan">11/11 ACTIVE</span>
              </div>
              <div class="telemetry-item">
                <span class="label">SYS TEMP</span>
                <span class="value text-green">36.5°C</span>
              </div>
              <div class="telemetry-item">
                <span class="label">NETWORK</span>
                <span class="value text-cyan">STARK-LINK</span>
              </div>
              <div class="telemetry-item">
                <span class="label">TIME</span>
                <span class="value text-gold">{{ currentTime }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Fixed Header -->
        <header class="app-header">
          <div class="header-title-wrapper">
            <button class="hamburger-btn" (click)="isMobileMenuOpen = !isMobileMenuOpen" aria-label="Toggle Navigation">
              ☰
            </button>
            <div class="header-title">
              <span class="header-icon">{{ getNavIcon(currentNav) }}</span>
              {{ currentNav?.label }}
            </div>
          </div>
          <div class="header-actions">
            <label class="btn btn-secondary" title="Import Excel">
              📥 <span class="btn-text">Import</span>
              <input type="file" accept=".xlsx,.xls" (change)="onImport($event)" hidden />
            </label>
            <button class="btn btn-secondary" (click)="svc.exportExcel()" title="Export Excel">
              📤 <span class="btn-text">Export</span>
            </button>
            <button
              class="btn btn-icon"
              (click)="themeSvc.toggle()"
              [title]="'Switch to ' + (themeSvc.theme() === 'dark' ? 'light' : 'dark') + ' mode'"
            >
              {{ themeSvc.theme() === 'dark' ? '☀️' : '🌙' }}
            </button>
          </div>
        </header>

        <!-- Tab Content -->
        <main class="page-content">
          <app-standup-dashboard *ngIf="activeTab === 'dashboard'"></app-standup-dashboard>
          <app-standup-notes *ngIf="activeTab === 'notes'"></app-standup-notes>
          <app-employees *ngIf="activeTab === 'employees'"></app-employees>
          <app-projects *ngIf="activeTab === 'projects'"></app-projects>
          <app-reminders *ngIf="activeTab === 'reminders'"></app-reminders>
          <app-checklist-manager *ngIf="activeTab === 'checklists'"></app-checklist-manager>
          <app-feedback-manager *ngIf="activeTab === 'feedback'"></app-feedback-manager>
          <app-office-calendar *ngIf="activeTab === 'calendar'"></app-office-calendar>
          <app-tasks *ngIf="activeTab === 'tasks'"></app-tasks>
          <app-leave-tracking *ngIf="activeTab === 'leave'"></app-leave-tracking>
          <app-knowledge-base *ngIf="activeTab === 'qa'"></app-knowledge-base>

          <!-- J.A.R.V.I.S. Bottom Operations & Holographic Globe Footer -->
          <div class="jarvis-bottom-banner" *ngIf="themeSvc.isJarvis()">
            <!-- Left: Rotating Holographic Globe SVG -->
            <div class="globe-container">
              <svg class="globe-svg" viewBox="0 0 120 120" width="76" height="76">
                <circle cx="60" cy="60" r="54" stroke="rgba(0, 200, 255, 0.25)" stroke-width="1" fill="none" />
                <circle cx="60" cy="60" r="46" stroke="rgba(0, 200, 255, 0.5)" stroke-width="1.5" stroke-dasharray="10,6" class="spin-hud-reverse" fill="none" />
                <ellipse cx="60" cy="60" rx="42" ry="18" stroke="#00c8ff" stroke-width="1" fill="none" opacity="0.7" />
                <ellipse cx="60" cy="60" rx="42" ry="32" stroke="#00c8ff" stroke-width="1" fill="none" opacity="0.4" />
                <ellipse cx="60" cy="60" rx="18" ry="42" stroke="#00c8ff" stroke-width="1" fill="none" opacity="0.7" />
                <line x1="18" y1="60" x2="102" y2="60" stroke="#00c8ff" stroke-width="1" opacity="0.6" />
                <line x1="60" y1="18" x2="60" y2="102" stroke="#00c8ff" stroke-width="1" opacity="0.6" />
                <circle cx="45" cy="48" r="3.5" fill="#00ff88" class="node-pulse" />
                <circle cx="75" cy="55" r="3.5" fill="#00c8ff" class="node-pulse" />
                <circle cx="60" cy="35" r="3" fill="#ffd000" class="node-pulse" />
                <circle cx="38" cy="70" r="3" fill="#00c8ff" class="node-pulse" />
              </svg>
              <div class="globe-label">GLOBAL OPS CONNECTED</div>
            </div>

            <!-- Center: Operations Summary -->
            <div class="ops-center">
              <div class="ops-title">GLOBAL OPERATIONS & TEAM TELEMETRY</div>
              <div class="ops-quote">"I am monitoring all active tasks, standup notes, and project milestones across all global sectors, sir."</div>
              <div class="ops-tags">
                <span class="tag">ENCRYPTION: AES-256</span>
                <span class="tag">LATENCY: 12ms</span>
                <span class="tag">SERVER: STARK-CORE-01</span>
              </div>
            </div>

            <!-- Right: Equalizer & Telemetry Spectrum -->
            <div class="ops-right">
              <div class="equalizer-title">AUDIO / HUD FREQUENCY</div>
              <div class="equalizer-bars">
                <div class="bar bar-1"></div>
                <div class="bar bar-2"></div>
                <div class="bar bar-3"></div>
                <div class="bar bar-4"></div>
                <div class="bar bar-5"></div>
                <div class="bar bar-6"></div>
                <div class="bar bar-7"></div>
                <div class="bar bar-8"></div>
              </div>
              <div class="system-health">
                <span>CPU <strong class="text-cyan">14%</strong></span>
                <span>RAM <strong class="text-cyan">2.4GB</strong></span>
                <span>SYNC <strong class="text-green">ONLINE</strong></span>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        height: 100vh;
      }

      .app-shell {
        display: flex;
        height: 100vh;
        background: var(--bg-primary);
        font-family: var(--font-family);
        --sidebar-w: 220px;
        --primary: var(--accent-primary);
        --primary-light: var(--accent-surface);
        --text: var(--text-primary);
        --text-muted: var(--text-secondary);
        --surface: var(--bg-secondary);
        --border: var(--border-color);
        --header-h: 60px;
        transition: background var(--transition-normal);
      }

      /* Collapsed sidebar styling */
      .app-shell.sidebar-collapsed {
        --sidebar-w: 68px;
      }

      /* Sidebar Backdrop */
      .sidebar-backdrop {
        display: none;
        position: fixed;
        inset: 0;
        background: rgba(15, 15, 26, 0.5);
        backdrop-filter: blur(4px);
        z-index: 90;
        opacity: 0;
        transition: opacity var(--transition-normal);
        pointer-events: none;
      }

      .sidebar-backdrop.open {
        opacity: 1;
        pointer-events: auto;
      }

      /* Sidebar */
      .sidebar {
        width: var(--sidebar-w);
        min-width: var(--sidebar-w);
        background: var(--surface);
        border-right: 1px solid var(--border);
        display: flex;
        flex-direction: column;
        z-index: 100;
        transition: transform var(--transition-normal), width var(--transition-normal), min-width var(--transition-normal);
      }
      .sidebar-logo {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.5rem 0.5rem;
        border-bottom: 1px solid var(--border);
        height: var(--header-h);
      }
      .logo-icon {
        font-size: 1.5rem;
      }
      .logo-text {
        font-weight: 700;
        font-size: 1rem;
        color: var(--primary);
      }

      .arc-reactor-mini {
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .collapse-btn {
        background: none;
        border: none;
        color: var(--text-muted);
        cursor: pointer;
        font-size: 1.25rem;
        padding: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-left: auto;
        border-radius: 6px;
        transition: background 0.2s, color 0.2s;
        width: 28px;
        height: 28px;
      }
      .collapse-btn:hover {
        background: var(--primary-light);
        color: var(--primary);
      }

      .sidebar.collapsed .sidebar-logo {
        justify-content: center;
        padding: 0.5rem;
      }
      .sidebar.collapsed .collapse-btn {
        margin: 0;
      }

      .sidebar-nav {
        flex: 1;
        padding: 0.5rem 0.5rem;
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
      }
      .nav-item {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.5rem 0.5rem;
        border: none;
        background: none;
        cursor: pointer;
        border-radius: 8px;
        color: var(--text-muted);
        font-size: 0.9rem;
        font-weight: 500;
        transition: all 0.15s;
        text-align: left;
        width: 100%;
      }
      .nav-item:hover {
        background: var(--primary-light);
        color: var(--primary);
      }
      .nav-item.active {
        background: var(--primary-light);
        color: var(--primary);
        font-weight: 600;
      }
      .nav-icon {
        font-size: 1.1rem;
      }

      .sidebar.collapsed .nav-item {
        justify-content: center;
        padding: 0.75rem 0.5rem;
      }

      .sidebar-footer {
        padding: 0.5rem;
        border-top: 1px solid var(--border);
        display: flex;
        justify-content: center;
      }
      .back-link {
        font-size: 0.8rem;
        color: var(--text-muted);
        text-decoration: none;
        width: 100%;
        text-align: center;
      }
      .back-link:hover {
        color: var(--primary);
      }

      /* ── Main wrapper ─────────────────────── */
      .main-wrapper {
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }

      /* ── J.A.R.V.I.S. Top HUD Banner ────────── */
      .jarvis-top-banner {
        background: linear-gradient(90deg, rgba(0, 20, 40, 0.95) 0%, rgba(2, 11, 24, 0.98) 50%, rgba(0, 30, 60, 0.95) 100%);
        border-bottom: 1px solid rgba(0, 200, 255, 0.35);
        box-shadow: 0 4px 20px rgba(0, 200, 255, 0.15);
        padding: 0.75rem 1.25rem;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        position: relative;
        z-index: 10;
      }

      .banner-left {
        display: flex;
        align-items: center;
        gap: 1rem;
      }

      .helmet-icon-wrapper {
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .banner-info {
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
      }

      .banner-status-badge {
        font-family: 'Orbitron', monospace, sans-serif;
        font-size: 0.65rem;
        color: #00c8ff;
        letter-spacing: 1px;
        display: flex;
        align-items: center;
        gap: 0.4rem;
        text-transform: uppercase;
      }

      .status-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #00ff88;
        box-shadow: 0 0 8px #00ff88;
        animation: jarvisPulse 1.5s infinite;
      }

      .banner-title {
        font-family: 'Orbitron', sans-serif;
        font-size: 1.05rem;
        font-weight: 700;
        color: #c8eeff;
        letter-spacing: 0.8px;
        text-shadow: 0 0 10px rgba(0, 200, 255, 0.5);
      }

      .banner-quote {
        font-size: 0.78rem;
        color: #5fb4d8;
        font-style: italic;
      }

      .banner-right {
        display: flex;
        align-items: center;
      }

      .telemetry-box {
        display: flex;
        gap: 1.25rem;
        background: rgba(0, 20, 40, 0.6);
        border: 1px solid rgba(0, 200, 255, 0.25);
        padding: 0.5rem 1rem;
        border-radius: 8px;
      }

      .telemetry-item {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
      }

      .telemetry-item .label {
        font-family: 'Orbitron', monospace;
        font-size: 0.58rem;
        color: #2d7a9a;
        letter-spacing: 0.5px;
      }

      .telemetry-item .value {
        font-family: 'Orbitron', monospace;
        font-size: 0.78rem;
        font-weight: 600;
      }

      .text-cyan { color: #00c8ff; }
      .text-green { color: #00ff88; }
      .text-gold { color: #ffd000; }

      /* ── J.A.R.V.I.S. Bottom Operations Banner ── */
      .jarvis-bottom-banner {
        background: linear-gradient(90deg, rgba(0, 15, 30, 0.95) 0%, rgba(2, 11, 24, 0.98) 50%, rgba(0, 20, 40, 0.95) 100%);
        border: 1px solid rgba(0, 200, 255, 0.3);
        border-radius: 10px;
        padding: 0.85rem 1.25rem;
        margin-top: 1.25rem;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1.25rem;
        box-shadow: 0 4px 20px rgba(0, 200, 255, 0.12);
      }

      .globe-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.3rem;
      }

      .globe-label {
        font-family: 'Orbitron', monospace;
        font-size: 0.55rem;
        color: #00c8ff;
        letter-spacing: 0.8px;
      }

      .ops-center {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 0.3rem;
      }

      .ops-title {
        font-family: 'Orbitron', sans-serif;
        font-size: 0.85rem;
        font-weight: 700;
        color: #c8eeff;
        letter-spacing: 0.5px;
      }

      .ops-quote {
        font-size: 0.75rem;
        color: #5fb4d8;
        font-style: italic;
      }

      .ops-tags {
        display: flex;
        gap: 0.6rem;
        margin-top: 0.2rem;
      }

      .ops-tags .tag {
        font-family: 'Orbitron', monospace;
        font-size: 0.6rem;
        background: rgba(0, 200, 255, 0.08);
        border: 1px solid rgba(0, 200, 255, 0.2);
        color: #00c8ff;
        padding: 0.15rem 0.4rem;
        border-radius: 4px;
      }

      .ops-right {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 0.4rem;
      }

      .equalizer-title {
        font-family: 'Orbitron', monospace;
        font-size: 0.58rem;
        color: #2d7a9a;
        letter-spacing: 0.5px;
      }

      .equalizer-bars {
        display: flex;
        align-items: flex-end;
        gap: 3px;
        height: 22px;
      }

      .equalizer-bars .bar {
        width: 4px;
        background: #00c8ff;
        border-radius: 2px;
        box-shadow: 0 0 6px rgba(0, 200, 255, 0.6);
      }

      .bar-1 { animation: eqBar 1.2s ease-in-out infinite alternate; height: 40%; }
      .bar-2 { animation: eqBar 0.9s ease-in-out infinite alternate; height: 75%; }
      .bar-3 { animation: eqBar 1.4s ease-in-out infinite alternate; height: 90%; }
      .bar-4 { animation: eqBar 0.8s ease-in-out infinite alternate; height: 50%; }
      .bar-5 { animation: eqBar 1.1s ease-in-out infinite alternate; height: 85%; }
      .bar-6 { animation: eqBar 1.3s ease-in-out infinite alternate; height: 60%; }
      .bar-7 { animation: eqBar 0.7s ease-in-out infinite alternate; height: 95%; }
      .bar-8 { animation: eqBar 1.0s ease-in-out infinite alternate; height: 45%; }

      @keyframes eqBar {
        0% { height: 20%; opacity: 0.5; }
        100% { height: 100%; opacity: 1; }
      }

      .system-health {
        display: flex;
        gap: 0.75rem;
        font-family: 'Orbitron', monospace;
        font-size: 0.65rem;
        color: #5fb4d8;
      }

      /* Animations */
      .spin-hud {
        animation: spinClockwise 12s linear infinite;
        transform-origin: center;
      }

      .spin-hud-reverse {
        animation: spinCounterClockwise 16s linear infinite;
        transform-origin: center;
      }

      .node-pulse {
        animation: jarvisPulse 2s infinite alternate;
      }

      .core-glow {
        animation: jarvisGlowCore 2s infinite alternate;
      }

      .eye-glow {
        animation: eyeFlicker 3s infinite alternate;
      }

      @keyframes spinClockwise {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }

      @keyframes spinCounterClockwise {
        from { transform: rotate(360deg); }
        to { transform: rotate(0deg); }
      }

      @keyframes jarvisGlowCore {
        from { fill: #00c8ff; filter: drop-shadow(0 0 2px #00c8ff); }
        to { fill: #ffffff; filter: drop-shadow(0 0 8px #00c8ff); }
      }

      @keyframes eyeFlicker {
        0%, 100% { fill: #00c8ff; opacity: 1; }
        50% { fill: #80e5ff; opacity: 0.7; }
      }

      /* ── Header ──────────────────────────── */
      .app-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        height: var(--header-h);
        padding: 0 0.5rem;
        background: var(--surface);
        border-bottom: 1px solid var(--border);
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
        position: sticky;
        top: 0;
        z-index: 5;
      }
      
      .header-title-wrapper {
        display: flex;
        align-items: center;
      }

      .hamburger-btn {
        display: none;
        background: none;
        border: none;
        font-size: 1.4rem;
        color: var(--text);
        cursor: pointer;
        padding: 6px;
        border-radius: 6px;
        margin-right: 0.5rem;
        line-height: 1;
      }
      
      .hamburger-btn:hover {
        background: var(--primary-light);
      }

      .header-title {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-weight: 700;
        font-size: 1.1rem;
        color: var(--text);
      }
      .header-icon {
        font-size: 1.3rem;
      }
      .header-actions {
        display: flex;
        align-items: center;
        gap: 0.75rem;
      }

      .btn {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        padding: 0.5rem 0.5rem;
        border-radius: 8px;
        font-size: 0.85rem;
        font-weight: 600;
        cursor: pointer;
        border: 1px solid transparent;
        transition: all 0.15s;
      }
      .btn-secondary {
        background: #f1f5f9;
        border-color: var(--border);
        color: var(--text-muted);
      }
      .btn-secondary:hover {
        background: var(--primary-light);
        color: var(--primary);
        border-color: var(--primary);
      }
      
      body.theme-dark .btn-secondary {
        background: var(--bg-input);
        color: var(--text-primary);
      }

      .btn-icon {
        background: none;
        border: none;
        font-size: 1.2rem;
        padding: 0.4rem;
        border-radius: 8px;
        cursor: pointer;
      }
      .btn-icon:hover {
        background: var(--primary-light);
      }

      /* ── Page Content ─────────────────────── */
      .page-content {
        flex: 1;
        overflow-y: auto;
        padding: 0.5rem;
      }

      /* Mobile styling overrides */
      @media (max-width: 768px) {
        .jarvis-top-banner {
          flex-direction: column;
          align-items: flex-start;
        }

        .telemetry-box {
          width: 100%;
          justify-content: space-between;
        }

        .jarvis-bottom-banner {
          flex-direction: column;
          align-items: flex-start;
        }

        .ops-right {
          align-items: flex-start;
          width: 100%;
        }

        .sidebar-backdrop {
          display: block;
        }
        
        .hamburger-btn {
          display: block;
        }

        .collapse-btn {
          display: none !important;
        }

        /* Force mobile drawer sidebar to remain 220px wide */
        .app-shell.sidebar-collapsed {
          --sidebar-w: 220px !important;
        }

        .sidebar.collapsed {
          width: 220px !important;
          min-width: 220px !important;
        }

        .sidebar.collapsed .logo-text,
        .sidebar.collapsed .nav-label,
        .sidebar.collapsed .back-link span {
          display: inline !important;
        }

        .sidebar.collapsed .nav-item {
          justify-content: flex-start !important;
          padding: 0.5rem 0.5rem !important;
        }

        .sidebar.collapsed .sidebar-logo {
          flex-direction: row !important;
          justify-content: flex-start !important;
          padding: 0.5rem 0.5rem !important;
        }

        .sidebar {
          position: fixed;
          top: 0;
          bottom: 0;
          left: 0;
          height: 100vh;
          width: 220px;
          min-width: 220px;
          transform: translateX(-100%);
          z-index: 100;
          box-shadow: var(--shadow-lg);
        }

        .sidebar.open {
          transform: translateX(0);
        }
      }

      @media (max-width: 576px) {
        .btn-text {
          display: none;
        }
        .btn-secondary {
          padding: 0.5rem 0.6rem;
        }
      }
    `,
  ],
})
export class StandupNoteComponent implements OnInit, OnDestroy {
  svc = inject(StandupNoteService);
  themeSvc = inject(ThemeService);
  activeTab: Tab = 'dashboard';
  isMobileMenuOpen = false;
  isSidebarCollapsed = localStorage.getItem('u2app.sidebarCollapsed') === 'true';

  currentTime = '';
  private timerId: any = null;

  navItems: { id: Tab; label: string; icon: string; jarvisIcon: string }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊', jarvisIcon: '⚡' },
    { id: 'notes', label: 'Standup Notes', icon: '📝', jarvisIcon: '📑' },
    { id: 'employees', label: 'Employees', icon: '👥', jarvisIcon: '🛡️' },
    { id: 'projects', label: 'Projects', icon: '🚀', jarvisIcon: '🎯' },
    { id: 'tasks', label: 'Tasks', icon: '📋', jarvisIcon: '💻' },
    { id: 'leave', label: 'Leave Tracking', icon: '🏖️', jarvisIcon: '🛰️' },
    { id: 'reminders', label: 'Reminders', icon: '🔔', jarvisIcon: '🔔' },
    { id: 'checklists', label: 'Checklists', icon: '✅', jarvisIcon: '⚙️' },
    { id: 'feedback', label: 'Feedback', icon: '💬', jarvisIcon: '💬' },
    { id: 'calendar', label: 'Office Calendar', icon: '📅', jarvisIcon: '📅' },
    { id: 'qa', label: 'Q&A / Knowledge Base', icon: '❓', jarvisIcon: '🤖' },
  ];

  ngOnInit() {
    this.updateTime();
    this.timerId = setInterval(() => this.updateTime(), 1000);
  }

  ngOnDestroy() {
    if (this.timerId) {
      clearInterval(this.timerId);
    }
  }

  private updateTime() {
    const now = new Date();
    this.currentTime = now.toLocaleTimeString();
  }

  getNavIcon(item?: { icon: string; jarvisIcon: string }) {
    if (!item) return '';
    return this.themeSvc.isJarvis() ? item.jarvisIcon : item.icon;
  }

  get currentNav() {
    return this.navItems.find((n) => n.id === this.activeTab);
  }

  toggleSidebar() {
    this.isSidebarCollapsed = !this.isSidebarCollapsed;
    localStorage.setItem('u2app.sidebarCollapsed', String(this.isSidebarCollapsed));
  }

  onImport(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) this.svc.importExcel(file);
  }
}

