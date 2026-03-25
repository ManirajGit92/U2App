import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DashboardComponent } from './dashboard/dashboard.component';
import { DataManagerComponent } from './data-manager/data-manager.component';

@Component({
  selector: 'app-work-tracker',
  standalone: true,
  imports: [CommonModule, DashboardComponent, DataManagerComponent],
  template: `
    <div class="work-tracker-container">
      <nav class="tracker-nav">
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
      padding: 2rem;
      min-height: 100vh;
      background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
      font-family: 'Inter', 'Segoe UI', sans-serif;
    }
    
    .tracker-nav {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2rem;
      background: rgba(255, 255, 255, 0.7);
      backdrop-filter: blur(10px);
      padding: 1rem 2rem;
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(31, 38, 135, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.18);
    }

    h1 {
      margin: 0;
      color: #2c3e50;
      font-weight: 700;
      font-size: 1.8rem;
    }

    .tabs {
      display: flex;
      gap: 1rem;
    }

    button {
      padding: 0.8rem 1.5rem;
      border: none;
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.5);
      color: #5b6a7a;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
      font-size: 1rem;
    }

    button:hover {
      background: rgba(255, 255, 255, 0.8);
      transform: translateY(-2px);
    }

    button.active {
      background: #4a90e2;
      color: white;
      box-shadow: 0 4px 15px rgba(74, 144, 226, 0.3);
    }

    .tracker-content {
      animation: fadeIn 0.5s ease-out;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `]
})
export class WorkTrackerComponent {
  activeTab: 'dashboard' | 'data' = 'dashboard';
}
