import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WorkTrackerService, DeveloperStatus, ReleaseTrack } from '../work-tracker.service';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="dashboard-grid">
      <!-- Developer Status Widget -->
      <div class="glass-card dev-widget">
        <h2>Developer Weekly Status</h2>
        <div class="dev-list">
          <div class="dev-item" *ngFor="let dev of developers$ | async">
            <div class="dev-info">
              <div class="avatar">{{ dev.name.charAt(0) }}</div>
              <div>
                <h4>{{ dev.name }}</h4>
                <span class="status-badge" [ngClass]="dev.status | lowercase">{{ dev.status }}</span>
              </div>
            </div>
            <div class="progress-section">
              <div class="progress-text">
                <span>{{ dev.tasksCompleted }} / {{ dev.totalTasks }} Tasks</span>
                <span>{{ getPercentage(dev.tasksCompleted, dev.totalTasks) | number:'1.0-0' }}%</span>
              </div>
              <div class="progress-bar-bg">
                <div class="progress-bar-fill" [style.width.%]="getPercentage(dev.tasksCompleted, dev.totalTasks)"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Release Tracking Widget -->
      <div class="glass-card release-widget">
        <h2>Product Release Tracks</h2>
        <div class="release-timeline">
          <div class="release-item" *ngFor="let release of releases$ | async">
            <div class="release-header">
              <h4>{{ release.feature }}</h4>
              <span class="stage-badge" [attr.data-stage]="release.stage | lowercase">{{ release.stage }}</span>
            </div>
            <div class="mini-chart">
              <svg viewBox="0 0 36 36" class="circular-chart" [ngClass]="getStrokeColorClass(release.progress)">
                <path class="circle-bg"
                  d="M18 2.0845
                    a 15.9155 15.9155 0 0 1 0 31.831
                    a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path class="circle"
                  [attr.stroke-dasharray]="release.progress + ', 100'"
                  d="M18 2.0845
                    a 15.9155 15.9155 0 0 1 0 31.831
                    a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <text x="18" y="20.35" class="percentage">{{ release.progress }}%</text>
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dashboard-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
      gap: 2rem;
    }

    .glass-card {
      background: rgba(255, 255, 255, 0.4);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border-radius: 20px;
      padding: 2rem;
      border: 1px solid rgba(255, 255, 255, 0.3);
      box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.1);
      transition: transform 0.3s ease, box-shadow 0.3s ease;
    }
    .glass-card:hover {
      transform: translateY(-5px);
      box-shadow: 0 12px 40px 0 rgba(31, 38, 135, 0.15);
    }
    
    h2 {
      margin-top: 0;
      margin-bottom: 2rem;
      color: #1a202c;
      font-size: 1.5rem;
      border-bottom: 2px solid rgba(0,0,0,0.05);
      padding-bottom: 1rem;
    }

    /* Dev Widget */
    .dev-list {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }
    .dev-item {
      display: flex;
      flex-direction: column;
      gap: 0.8rem;
    }
    .dev-info {
      display: flex;
      align-items: center;
      gap: 1rem;
    }
    .avatar {
      width: 45px;
      height: 45px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: bold;
      font-size: 1.2rem;
    }
    .dev-info h4 {
      margin: 0 0 0.3rem 0;
      color: #2d3748;
    }
    .status-badge {
      font-size: 0.75rem;
      padding: 0.2rem 0.6rem;
      border-radius: 12px;
      font-weight: 600;
      text-transform: uppercase;
    }
    .status-badge.on, .status-badge.ahead { background: #c6f6d5; color: #22543d; }
    .status-badge.blocked { background: #fed7d7; color: #822727; }
    .status-badge.behind { background: #feebc8; color: #7b341e; }

    .progress-section {
      width: 100%;
    }
    .progress-text {
      display: flex;
      justify-content: space-between;
      font-size: 0.85rem;
      color: #4a5568;
      margin-bottom: 0.4rem;
    }
    .progress-bar-bg {
      height: 8px;
      background: rgba(0,0,0,0.05);
      border-radius: 4px;
      overflow: hidden;
    }
    .progress-bar-fill {
      height: 100%;
      background: linear-gradient(90deg, #4facfe 0%, #00f2fe 100%);
      border-radius: 4px;
      transition: width 1s ease-in-out;
    }

    /* Release Widget */
    .release-timeline {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }
    .release-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem;
      background: rgba(255,255,255,0.5);
      border-radius: 12px;
    }
    .release-header h4 {
      margin: 0 0 0.5rem 0;
      color: #2d3748;
    }
    .stage-badge {
      font-size: 0.75rem;
      padding: 0.2rem 0.6rem;
      border-radius: 6px;
      font-weight: 600;
      border: 1px solid currentColor;
    }
    [data-stage="development"] { color: #805ad5; }
    [data-stage="testing"] { color: #d69e2e; }
    [data-stage="staging"] { color: #3182ce; }
    [data-stage="released"] { color: #38a169; }

    /* Circular Chart */
    .mini-chart {
      width: 60px;
      height: 60px;
    }
    .circular-chart {
      display: block;
      margin: 0 auto;
      max-width: 80%;
      max-height: 250px;
    }
    .circle-bg {
      fill: none;
      stroke: #eee;
      stroke-width: 3.8;
    }
    .circle {
      fill: none;
      stroke-width: 2.8;
      stroke-linecap: round;
      animation: progress 1s ease-out forwards;
    }
    .percentage {
      fill: #4a5568;
      font-size: 0.5em;
      text-anchor: middle;
      font-weight: bold;
    }
    .stroke-red .circle { stroke: #fc8181; }
    .stroke-orange .circle { stroke: #f6ad55; }
    .stroke-blue .circle { stroke: #63b3ed; }
    .stroke-green .circle { stroke: #68d391; }

    @keyframes progress {
      0% {
        stroke-dasharray: 0 100;
      }
    }
  `]
})
export class DashboardComponent {
  workTrackerService = inject(WorkTrackerService);

  developers$: Observable<DeveloperStatus[]> = this.workTrackerService.data$.pipe(
    map(data => data.developerStatuses)
  );

  releases$: Observable<ReleaseTrack[]> = this.workTrackerService.data$.pipe(
    map(data => data.releaseTracks)
  );

  getPercentage(completed: number, total: number): number {
    if (!total) return 0;
    return Math.min(Math.round((completed / total) * 100), 100);
  }

  getStrokeColorClass(progress: number): string {
    if (progress < 25) return 'stroke-red';
    if (progress < 60) return 'stroke-orange';
    if (progress < 90) return 'stroke-blue';
    return 'stroke-green';
  }
}
