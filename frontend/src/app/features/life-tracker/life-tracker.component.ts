import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterModule } from '@angular/router';
import { LifeTrackerService } from './life-tracker.service';

@Component({
  selector: 'app-life-tracker',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterModule],
  template: `
    <div class="life-tracker-layout">
      <header class="tracker-header glass-card">
        <div class="logo">🌱 LifeTracker</div>
        <nav class="tracker-nav">
          <a routerLink="dashboard" routerLinkActive="active">Dashboard</a>
          <a routerLink="Routines" routerLinkActive="active">Routine</a>
          <a routerLink="Expenses" routerLinkActive="active">Expenses</a>
          <a routerLink="Diet" routerLinkActive="active">Diet</a>
          <a routerLink="Fitness" routerLinkActive="active">Fitness</a>
          <a routerLink="MentalHealth" routerLinkActive="active">Mental Health</a>
          <a routerLink="Relationships" routerLinkActive="active">Relationships</a>
          <a routerLink="Investments" routerLinkActive="active">Investments</a>
          <a routerLink="calendar" routerLinkActive="active">Calendar</a>
        </nav>
        <div class="header-actions">
           <button class="btn btn-secondary" (click)="fileInput.click()">📥 Import</button>
           <input type="file" #fileInput hidden (change)="onUpload($event)" accept=".xlsx, .xls">
           <button class="btn btn-primary" (click)="service.exportExcel()">📤 Export</button>
        </div>
      </header>

      <main class="tracker-content">
        <router-outlet></router-outlet>
      </main>
    </div>
  `,
  styles: [`
    .life-tracker-layout { display: flex; flex-direction: column; height: 100vh; background: var(--bg-primary); }
    .tracker-header { height: 70px; display: flex; align-items: center; justify-content: space-between; padding: 0 2rem; border-bottom: 1px solid var(--border-color); }
    .logo { font-size: 1.5rem; font-weight: 800; color: var(--accent-primary); }
    .tracker-nav { display: flex; gap: 0.5rem; }
    .tracker-nav a { text-decoration: none; color: var(--text-secondary); font-size: 0.85rem; font-weight: 600; padding: 0.5rem 0.75rem; border-radius: 8px; transition: all 0.2s; }
    .tracker-nav a.active { color: var(--accent-primary); background: rgba(var(--accent-rgb), 0.1); }
    .tracker-content { flex: 1; overflow-y: auto; padding: 2rem; }
    .header-actions { display: flex; gap: 0.5rem; }
  `]
})
export class LifeTrackerComponent implements OnInit {
  service = inject(LifeTrackerService);

  ngOnInit() {}

  onUpload(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.service.importExcel(file).then(() => {
        alert('Data imported successfully!');
      }).catch(err => {
        alert('Error importing Excel: ' + err.message);
      });
    }
  }
}
