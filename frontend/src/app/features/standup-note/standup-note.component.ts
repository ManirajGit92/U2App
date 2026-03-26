import { Component, inject, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { StandupNoteService } from './standup-note.service';
import { StandupDashboardComponent } from './standup-dashboard/standup-dashboard.component';
import { StandupNotesComponent } from './standup-notes/standup-notes.component';
import { EmployeesComponent } from './employees/employees.component';
import { ProjectsComponent } from './projects/projects.component';
import { RemindersComponent } from './reminders/reminders.component';
import { ThemeService } from '../../core/services/theme.service';

type Tab = 'dashboard' | 'notes' | 'employees' | 'projects' | 'reminders';

@Component({
  selector: 'app-standup-note',
  standalone: true,
  imports: [CommonModule, RouterModule, StandupDashboardComponent, StandupNotesComponent, EmployeesComponent, ProjectsComponent, RemindersComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <div class="app-shell">
      <!-- Sidebar -->
      <aside class="sidebar">
        <div class="sidebar-logo">
          <span class="logo-icon">📋</span>
          <span class="logo-text">Standup Note</span>
        </div>
        <nav class="sidebar-nav">
          <button *ngFor="let item of navItems" class="nav-item" [class.active]="activeTab === item.id" (click)="activeTab = item.id">
            <span class="nav-icon">{{ item.icon }}</span>
            <span class="nav-label">{{ item.label }}</span>
          </button>
        </nav>
        <div class="sidebar-footer">
          <a href="/" class="back-link">← Home</a>
        </div>
      </aside>

      <!-- Main content -->
      <div class="main-wrapper">
        <!-- Fixed Header -->
        <header class="app-header">
          <div class="header-title">
            <span class="header-icon">{{ currentNav?.icon }}</span>
            {{ currentNav?.label }}
          </div>
          <div class="header-actions">
            <label class="btn btn-secondary" title="Import Excel">
              📥 Import
              <input type="file" accept=".xlsx,.xls" (change)="onImport($event)" hidden>
            </label>
            <button class="btn btn-secondary" (click)="svc.exportExcel()" title="Export Excel">📤 Export</button>
            <button class="btn btn-icon" (click)="themeSvc.toggle()" [title]="'Switch to ' + (themeSvc.theme() === 'dark' ? 'light' : 'dark') + ' mode'">
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
        </main>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; height: 100vh; }

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

    /* Sidebar */
    .sidebar {
      width: var(--sidebar-w);
      min-width: var(--sidebar-w);
      background: var(--surface);
      border-right: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      z-index: 10;
    }
    .sidebar-logo {
      display: flex; align-items: center; gap: 0.75rem;
      padding: 1.25rem 1rem;
      border-bottom: 1px solid var(--border);
    }
    .logo-icon { font-size: 1.5rem; }
    .logo-text { font-weight: 700; font-size: 1rem; color: var(--primary); }
    .sidebar-nav { flex: 1; padding: 1rem 0.5rem; display: flex; flex-direction: column; gap: 0.25rem; }
    .nav-item {
      display: flex; align-items: center; gap: 0.75rem;
      padding: 0.65rem 0.85rem;
      border: none; background: none; cursor: pointer;
      border-radius: 8px; color: var(--text-muted);
      font-size: 0.9rem; font-weight: 500;
      transition: all 0.15s; text-align: left; width: 100%;
    }
    .nav-item:hover { background: var(--primary-light); color: var(--primary); }
    .nav-item.active { background: var(--primary-light); color: var(--primary); font-weight: 600; }
    .nav-icon { font-size: 1.1rem; }
    .sidebar-footer { padding: 1rem; border-top: 1px solid var(--border); }
    .back-link { font-size: 0.8rem; color: var(--text-muted); text-decoration: none; }
    .back-link:hover { color: var(--primary); }

    /* ── Main wrapper ─────────────────────── */
    .main-wrapper { flex: 1; display: flex; flex-direction: column; overflow: hidden; }

    /* ── Header ──────────────────────────── */
    .app-header {
      display: flex; justify-content: space-between; align-items: center;
      height: var(--header-h); padding: 0 1.5rem;
      background: var(--surface); border-bottom: 1px solid var(--border);
      box-shadow: 0 1px 3px rgba(0,0,0,0.04);
      position: sticky; top: 0; z-index: 5;
    }
    .header-title { display: flex; align-items: center; gap: 0.5rem; font-weight: 700; font-size: 1.1rem; color: var(--text); }
    .header-icon { font-size: 1.3rem; }
    .header-actions { display: flex; align-items: center; gap: 0.75rem; }

    .btn {
      display: inline-flex; align-items: center; gap: 0.4rem;
      padding: 0.5rem 1rem; border-radius: 8px;
      font-size: 0.85rem; font-weight: 600; cursor: pointer;
      border: 1px solid transparent; transition: all 0.15s;
    }
    .btn-secondary { background: #f1f5f9; border-color: var(--border); color: var(--text-muted); }
    .btn-secondary:hover { background: var(--primary-light); color: var(--primary); border-color: var(--primary); }
    .btn-icon { background: none; border: none; font-size: 1.2rem; padding: 0.4rem; border-radius: 8px; cursor: pointer; }
    .btn-icon:hover { background: var(--primary-light); }

    /* ── Page Content ─────────────────────── */
    .page-content { flex: 1; overflow-y: auto; padding: 1.5rem; }
  `]
})
export class StandupNoteComponent {
  svc = inject(StandupNoteService);
  themeSvc = inject(ThemeService);
  activeTab: Tab = 'dashboard';

  navItems: { id: Tab; label: string; icon: string }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'notes', label: 'Standup Notes', icon: '📝' },
    { id: 'employees', label: 'Employees', icon: '👥' },
    { id: 'projects', label: 'Projects', icon: '🚀' },
    { id: 'reminders', label: 'Reminders', icon: '🔔' },
  ];

  get currentNav() { return this.navItems.find(n => n.id === this.activeTab); }

  onImport(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) this.svc.importExcel(file);
  }
}
