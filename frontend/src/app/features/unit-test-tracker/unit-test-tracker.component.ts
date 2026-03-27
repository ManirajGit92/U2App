import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UnitTestService } from './unit-test.service';
import { DashboardComponent } from './dashboard/dashboard.component';
import { TestCasesComponent } from './test-cases/test-cases.component';
import { ExecutionComponent } from './execution/execution.component';
import { BugsComponent } from './bugs/bugs.component';

@Component({
  selector: 'app-unit-test-tracker',
  standalone: true,
  imports: [CommonModule, DashboardComponent, TestCasesComponent, ExecutionComponent, BugsComponent],
  template: `
    <div class="app-layout" [class.sidebar-hidden]="!isSidebarVisible">
      <!-- Sidebar Navigation -->
      <aside class="sidebar glass-panel">
        <div class="nav-branding">
          <span class="icon">🧪</span>
          <h2 *ngIf="isSidebarVisible">QA Tracker</h2>
        </div>
        
        <nav class="nav-links">
          <button [class.active]="activeTab === 'dashboard'" (click)="activeTab = 'dashboard'" [title]="'Dashboard'">
            <span class="btn-icon">📊</span>
            <span class="btn-text" *ngIf="isSidebarVisible">Dashboard</span>
          </button>
          <button [class.active]="activeTab === 'testcases'" (click)="activeTab = 'testcases'" [title]="'Test Cases'">
            <span class="btn-icon">📝</span>
            <span class="btn-text" *ngIf="isSidebarVisible">Test Cases</span>
          </button>
          <button [class.active]="activeTab === 'execution'" (click)="activeTab = 'execution'" [title]="'Execution'">
            <span class="btn-icon">⚙️</span>
            <span class="btn-text" *ngIf="isSidebarVisible">Execution</span>
          </button>
          <button [class.active]="activeTab === 'bugs'" (click)="activeTab = 'bugs'" [title]="'Bugs'">
            <span class="btn-icon">🐜</span>
            <span class="btn-text" *ngIf="isSidebarVisible">Bugs</span>
          </button>
        </nav>
      </aside>

      <!-- Main Content Area -->
      <main class="main-content">
        <!-- Header -->
        <header class="top-header glass-panel">
          <div class="header-left">
            <button class="sidebar-toggle" (click)="toggleSidebar()" [title]="isSidebarVisible ? 'Hide Sidebar' : 'Show Sidebar'">
              {{ isSidebarVisible ? '◀' : '▶' }}
            </button>
            <h1>{{ getTitle() }}</h1>
          </div>
          <div class="header-actions">
            <!-- Upload -->
            <input type="file" id="excelUpload" accept=".xlsx, .xls" (change)="onUpload($event)" #fileInput hidden>
            <button class="btn btn-secondary" (click)="fileInput.click()" [disabled]="isLoading">
              📥 Import Excel
            </button>
            <!-- Download -->
            <button class="btn btn-primary" (click)="onDownload()" [disabled]="isLoading">
              📤 Export DB
            </button>
          </div>
        </header>

        <!-- View Container -->
        <div class="view-container glass-panel">
          <app-dashboard *ngIf="activeTab === 'dashboard'"></app-dashboard>
          <app-test-cases *ngIf="activeTab === 'testcases'"></app-test-cases>
          <app-execution *ngIf="activeTab === 'execution'"></app-execution>
          <app-bugs *ngIf="activeTab === 'bugs'"></app-bugs>
        </div>
      </main>
    </div>
  `,
  styles: [`
    .app-layout {
      display: flex;
      height: 100vh;
      background: var(--bg-primary);
      font-family: var(--font-family);
      overflow: hidden;
      transition: background var(--transition-normal);
    }

    .glass-panel {
      background: var(--card-glass);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid var(--card-glass-border);
    }

    /* ─── Sidebar ─── */
    .sidebar {
      width: 250px;
      display: flex;
      flex-direction: column;
      border-right: 1px solid var(--border-color);
      z-index: 10;
      box-shadow: var(--shadow-sm);
      background: var(--bg-secondary);
      transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      overflow: hidden;
    }

    .sidebar-hidden .sidebar {
      width: 70px;
    }

    .nav-branding {
      padding: 1.5rem;
      display: flex;
      align-items: center;
      gap: 0.8rem;
      border-bottom: 1px solid var(--border-color);
      height: 70px;
      box-sizing: border-box;
    }

    .nav-branding .icon {
      font-size: 1.8rem;
      min-width: 30px;
      text-align: center;
    }

    .nav-branding h2 {
      margin: 0;
      font-size: 1.25rem;
      color: var(--text-primary);
      font-weight: 700;
      white-space: nowrap;
    }

    .nav-links {
      display: flex;
      flex-direction: column;
      padding: 0.75rem;
      gap: 0.5rem;
    }

    .nav-links button {
      padding: 0.85rem;
      border: none;
      background: transparent;
      text-align: left;
      border-radius: 8px;
      font-size: 0.95rem;
      font-weight: 500;
      color: var(--text-secondary);
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      gap: 1rem;
      width: 100%;
      overflow: hidden;
    }

    .sidebar-hidden .nav-links button {
      justify-content: center;
      padding: 0.85rem 0;
    }

    .btn-icon {
      font-size: 1.2rem;
      min-width: 24px;
      display: flex;
      justify-content: center;
    }

    .btn-text {
      white-space: nowrap;
    }

    .nav-links button:hover {
      background: var(--accent-surface);
      color: var(--accent-primary);
    }

    .nav-links button.active {
      background: var(--accent-primary);
      color: white;
      font-weight: 600;
      box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
    }

    /* ─── Main Content ─── */
    .main-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      height: 100vh;
      overflow: hidden;
      transition: margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .top-header {
      padding: 0.75rem 2rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid var(--border-color);
      background: var(--bg-secondary);
      z-index: 5;
      height: 70px;
      box-sizing: border-box;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 1.5rem;
    }

    .sidebar-toggle {
      background: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      width: 32px;
      height: 32px;
      border-radius: 6px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--text-secondary);
      transition: all 0.2s;
      font-size: 0.8rem;
    }

    .sidebar-toggle:hover {
      background: var(--accent-surface);
      color: var(--accent-primary);
      border-color: var(--accent-primary);
    }

    .header-left h1 {
      margin: 0;
      font-size: 1.4rem;
      color: var(--text-primary);
    }

    .header-actions {
      display: flex;
      gap: 1rem;
    }

    .btn {
      padding: 0.6rem 1.2rem;
      border: none;
      border-radius: 6px;
      font-weight: 600;
      font-size: 0.9rem;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .btn-primary {
      background: #10b981;
      color: white;
    }

    .btn-primary:not(:disabled):hover {
      background: #059669;
      transform: translateY(-1px);
      box-shadow: 0 4px 6px rgba(16, 185, 129, 0.3);
    }

    .btn-secondary {
      background: white;
      color: #4b5563;
      border: 1px solid #d1d5db;
    }

    .btn-secondary:not(:disabled):hover {
      background: #f9fafb;
      color: #111827;
      transform: translateY(-1px);
    }

    /* ─── View Container ─── */
    .view-container {
      flex: 1;
      margin: 1.5rem;
      border-radius: 12px;
      overflow-y: auto;
      padding: 1.5rem;
    }
  `]
})
export class UnitTestTrackerComponent {
  activeTab: 'dashboard' | 'testcases' | 'execution' | 'bugs' = 'dashboard';
  isLoading = false;
  isSidebarVisible = true;
  unitTestService = inject(UnitTestService);

  toggleSidebar() {
    this.isSidebarVisible = !this.isSidebarVisible;
  }

  getTitle(): string {
    switch (this.activeTab) {
      case 'dashboard': return 'QA Dashboard';
      case 'testcases': return 'Test Cases Management';
      case 'execution': return 'Test Execution & Status';
      case 'bugs': return 'Bug Tracking';
      default: return 'Unit Test Tracker';
    }
  }

  async onUpload(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.isLoading = true;
      try {
        await this.unitTestService.parseExcelFile(file);
        alert('Database successfully imported!');
      } catch (e) {
        alert('Failed to parse Excel file. Is it the correct format?');
      } finally {
        this.isLoading = false;
        event.target.value = ''; // Reset input
      }
    }
  }

  onDownload() {
    this.unitTestService.exportToExcel();
  }
}
