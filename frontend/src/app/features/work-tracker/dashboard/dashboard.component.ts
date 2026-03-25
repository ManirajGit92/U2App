import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WorkTrackerService, DeveloperTask, ReleaseTrack } from '../work-tracker.service';
import { BehaviorSubject, combineLatest, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="dashboard-container">
      
      <!-- Filters Section -->
      <div class="glass-card filters-section">
        <h3>Task Data Filters</h3>
        <div class="filters-grid">
          <div class="filter-group">
            <label>Resource Name</label>
            <select (change)="onFilterChange('resource', $event)">
              <option value="">All Resources</option>
              <option *ngFor="let res of uniqueResources$ | async" [value]="res">{{ res }}</option>
            </select>
          </div>
          <div class="filter-group">
            <label>Project Name</label>
            <select (change)="onFilterChange('project', $event)">
              <option value="">All Projects</option>
              <option *ngFor="let proj of uniqueProjects$ | async" [value]="proj">{{ proj }}</option>
            </select>
          </div>
          <div class="filter-group">
            <label>Task Status</label>
            <select (change)="onFilterChange('status', $event)">
              <option value="">All Statuses</option>
              <option *ngFor="let stat of uniqueStatuses$ | async" [value]="stat">{{ stat }}</option>
            </select>
          </div>
          <div class="filter-group">
            <label>Task Priority</label>
            <select (change)="onFilterChange('priority', $event)">
              <option value="">All Priorities</option>
              <option *ngFor="let prio of uniquePriorities$ | async" [value]="prio">{{ prio }}</option>
            </select>
          </div>
        </div>

        <h3 class="margin-top-section">Release Data Filters</h3>
        <div class="filters-grid">
          <div class="filter-group">
            <label>Category</label>
            <select (change)="onRelFilterChange('category', $event)">
              <option value="">All Categories</option>
              <option *ngFor="let cat of uniqueRelCategories$ | async" [value]="cat">{{ cat }}</option>
            </select>
          </div>
          <div class="filter-group">
            <label>Release Status</label>
            <select (change)="onRelFilterChange('status', $event)">
              <option value="">All Statuses</option>
              <option *ngFor="let stat of uniqueRelStatuses$ | async" [value]="stat">{{ stat }}</option>
            </select>
          </div>
          <div class="filter-group">
            <label>Priority</label>
            <select (change)="onRelFilterChange('priority', $event)">
              <option value="">All Priorities</option>
              <option *ngFor="let prio of uniqueRelPriorities$ | async" [value]="prio">{{ prio }}</option>
            </select>
          </div>
          <div class="filter-group">
            <label>Assigned To</label>
            <select (change)="onRelFilterChange('assigned', $event)">
              <option value="">All Assignees</option>
              <option *ngFor="let assign of uniqueRelAssigned$ | async" [value]="assign">{{ assign }}</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Widgets Section -->
      <div class="dashboard-grid">
        <!-- Developer Status Widget -->
        <div class="glass-card dev-widget">
          <h2>Developer Status (Filtered)</h2>
          <div class="dev-list">
            <div class="dev-item" *ngFor="let dev of developers$ | async">
              <div class="dev-info">
                <div class="avatar">{{ dev.name.charAt(0) }}</div>
                <div>
                  <h4>{{ dev.name }}</h4>
                  <span class="status-badge" [ngClass]="dev.status.replace(' ', '') | lowercase">{{ dev.status }}</span>
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
            <div *ngIf="(developers$ | async)?.length === 0" class="empty-state">
              No tasks match the filters
            </div>
          </div>
        </div>

        <!-- Release Tracking Widget -->
        <div class="glass-card release-widget">
          <h2>Product Release Tracks</h2>
          <div class="release-timeline">
            <div class="release-item" *ngFor="let release of filteredReleases$ | async">
              <div class="release-header">
                <h4>{{ release.title }}</h4>
                <span class="stage-badge" [attr.data-stage]="release.status | lowercase">{{ release.status }}</span>
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
            <div *ngIf="(filteredReleases$ | async)?.length === 0" class="empty-state">
              No releases match the filters
            </div>
          </div>
        </div>
      </div>

      <!-- Data Table Section (Developer Tasks) -->
      <div class="glass-card table-section">
        <h2>Developer Tasks Data</h2>
        <div class="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Task ID</th>
                <th>Week</th>
                <th>Resource</th>
                <th>Project</th>
                <th>Module</th>
                <th>Title</th>
                <th>Type</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Size</th>
                <th>Progress</th>
                <th>Start Date</th>
                <th>Due Date</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let task of filteredTasks$ | async">
                <td>{{ task.taskId }}</td>
                <td>{{ task.week }}</td>
                <td><strong>{{ task.resourceName }}</strong></td>
                <td>{{ task.projectName }}</td>
                <td>{{ task.module }}</td>
                <td>{{ task.taskTitle }}</td>
                <td><span class="type-tag">{{ task.taskType }}</span></td>
                <td><span class="status-tag" [ngClass]="task.status.replace(' ', '') | lowercase">{{ task.status }}</span></td>
                <td><span class="priority-tag" [ngClass]="task.priority | lowercase">{{ task.priority }}</span></td>
                <td>{{ task.size }}</td>
                <td>
                  <div class="progress-cell">
                    <div class="bar-bg"><div class="bar-fill" [style.width.%]="task.progress"></div></div>
                    <span>{{ task.progress }}%</span>
                  </div>
                </td>
                <td>{{ task.startDate | date:'shortDate' }}</td>
                <td>{{ task.dueDate | date:'shortDate' }}</td>
              </tr>
              <tr *ngIf="(filteredTasks$ | async)?.length === 0">
                <td colspan="13" class="text-center">No task records found.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Data Table Section (Release Tracks) -->
      <div class="glass-card table-section">
        <h2>Release Tracks Data</h2>
        <div class="table-responsive">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Title</th>
                <th>Category</th>
                <th>Module</th>
                <th>Priority</th>
                <th>Status</th>
                <th>PRD Status</th>
                <th>Assigned To</th>
                <th>Progress</th>
                <th>Target Date</th>
                <th>Completed Date</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let release of filteredReleases$ | async">
                <td>{{ release.id }}</td>
                <td><strong>{{ release.title }}</strong></td>
                <td>{{ release.category }}</td>
                <td>{{ release.module }}</td>
                <td><span class="priority-tag" [ngClass]="release.priority | lowercase">{{ release.priority }}</span></td>
                <td><span class="stage-badge" [attr.data-stage]="release.status | lowercase">{{ release.status }}</span></td>
                <td><span class="type-tag">{{ release.prdStatus }}</span></td>
                <td>{{ release.assignedTo }}</td>
                <td>
                  <div class="progress-cell">
                    <div class="bar-bg"><div class="bar-fill" [style.width.%]="release.progress"></div></div>
                    <span>{{ release.progress }}%</span>
                  </div>
                </td>
                <td>{{ release.targetDate | date:'shortDate' }}</td>
                <td>{{ release.completedDate | date:'shortDate' }}</td>
              </tr>
              <tr *ngIf="(filteredReleases$ | async)?.length === 0">
                <td colspan="11" class="text-center">No release records found.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>
  `,
  styles: [`
    .dashboard-container {
      display: flex;
      flex-direction: column;
      gap: 2rem;
    }

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
      box-shadow: 0 12px 40px 0 rgba(31, 38, 135, 0.15);
    }
    
    h2, h3 {
      margin-top: 0;
      color: #1a202c;
      border-bottom: 2px solid rgba(0,0,0,0.05);
    }
    h2 {
      margin-bottom: 2rem;
      font-size: 1.5rem;
      padding-bottom: 1rem;
    }
    h3 {
      font-size: 1.2rem;
      margin-bottom: 1.2rem;
      padding-bottom: 0.8rem;
    }
    .margin-top-section {
      margin-top: 2rem;
    }

    /* Filters Section */
    .filters-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1.5rem;
    }
    .filter-group {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .filter-group label {
      font-size: 0.85rem;
      font-weight: 600;
      color: #4a5568;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .filter-group select {
      padding: 0.8rem 1rem;
      border-radius: 8px;
      border: 1px solid rgba(0,0,0,0.1);
      background: rgba(255,255,255,0.7);
      font-family: inherit;
      color: #2d3748;
      font-weight: 500;
      outline: none;
      transition: border-color 0.3s, background 0.3s;
    }
    .filter-group select:focus {
      border-color: #4facfe;
      background: #fff;
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
      flex-shrink: 0;
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
      white-space: nowrap;
    }
    .status-badge.ontrack { background: #c6f6d5; color: #22543d; }
    .status-badge.blocked { background: #fed7d7; color: #822727; }
    .status-badge.behind { background: #feebc8; color: #7b341e; }
    .status-badge.ahead { background: #c6f6d5; color: #22543d; }

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
    .empty-state {
      text-align: center;
      padding: 2rem;
      color: #718096;
      font-style: italic;
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
      white-space: nowrap;
    }
    [data-stage="development"] { color: #805ad5; }
    [data-stage="testing"] { color: #d69e2e; }
    [data-stage="staging"] { color: #3182ce; }
    [data-stage="released"] { color: #38a169; }

    /* Circular Chart */
    .mini-chart { width: 60px; height: 60px; flex-shrink: 0; }
    .circular-chart { display: block; margin: 0 auto; max-width: 80%; max-height: 250px; }
    .circle-bg { fill: none; stroke: rgba(0,0,0,0.05); stroke-width: 3.8; }
    .circle { fill: none; stroke-width: 2.8; stroke-linecap: round; animation: progress 1s ease-out forwards; }
    .percentage { fill: #4a5568; font-size: 0.5em; text-anchor: middle; font-weight: bold; }
    .stroke-red .circle { stroke: #fc8181; }
    .stroke-orange .circle { stroke: #f6ad55; }
    .stroke-blue .circle { stroke: #63b3ed; }
    .stroke-green .circle { stroke: #68d391; }

    /* Table Section */
    .table-responsive {
      overflow-x: auto;
      border-radius: 12px;
      box-shadow: 0 0 0 1px rgba(0,0,0,0.05);
    }
    table {
      width: 100%;
      border-collapse: collapse;
      white-space: nowrap;
      background: rgba(255,255,255,0.5);
    }
    th {
      background: rgba(0,0,0,0.03);
      padding: 1rem;
      text-align: left;
      font-size: 0.85rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #4a5568;
      font-weight: 600;
      border-bottom: 2px solid rgba(0,0,0,0.05);
    }
    td {
      padding: 1rem;
      color: #2d3748;
      border-bottom: 1px solid rgba(0,0,0,0.05);
      font-size: 0.9rem;
    }
    tbody tr:hover {
      background: rgba(255,255,255,0.8);
    }
    .text-center { text-align: center; color: #718096; font-style: italic; padding: 2rem; }

    /* Tags inside table */
    .type-tag, .status-tag, .priority-tag {
      padding: 0.2rem 0.6rem;
      border-radius: 6px;
      font-size: 0.75rem;
      font-weight: 600;
    }
    .type-tag { background: #edf2f7; color: #4a5568; }
    
    .status-tag.completed, .status-tag.released { background: #c6f6d5; color: #22543d; }
    .status-tag.inprogress { background: #feebc8; color: #7b341e; }
    .status-tag.blocked { background: #fed7d7; color: #822727; }

    .priority-tag.critical, .priority-tag.high { color: #e53e3e; background: #fed7d7; }
    .priority-tag.medium { color: #dd6b20; background: #feebc8; }
    .priority-tag.low { color: #319795; background: #e6fffa; }

    .progress-cell {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .bar-bg {
      width: 60px;
      height: 6px;
      background: rgba(0,0,0,0.1);
      border-radius: 3px;
      overflow: hidden;
      flex-shrink: 0;
    }
    .bar-fill {
      height: 100%;
      background: #4facfe;
      border-radius: 3px;
    }

    @keyframes progress {
      0% { stroke-dasharray: 0 100; }
    }
  `]
})
export class DashboardComponent {
  workTrackerService = inject(WorkTrackerService);

  allTasks$: Observable<DeveloperTask[]> = this.workTrackerService.data$.pipe(
    map(data => data.developerTasks)
  );

  allReleases$: Observable<ReleaseTrack[]> = this.workTrackerService.data$.pipe(
    map(data => data.releaseTracks)
  );

  // Task Filters State
  filterResource = new BehaviorSubject<string>('');
  filterProject = new BehaviorSubject<string>('');
  filterStatus = new BehaviorSubject<string>('');
  filterPriority = new BehaviorSubject<string>('');

  // Release Filters State
  relFilterCategory = new BehaviorSubject<string>('');
  relFilterStatus = new BehaviorSubject<string>('');
  relFilterPriority = new BehaviorSubject<string>('');
  relFilterAssigned = new BehaviorSubject<string>('');

  // Task Dropdown options
  uniqueResources$: Observable<string[]> = this.allTasks$.pipe(
    map(tasks => [...new Set(tasks.map(t => t.resourceName).filter(Boolean))].sort())
  );
  uniqueProjects$: Observable<string[]> = this.allTasks$.pipe(
    map(tasks => [...new Set(tasks.map(t => t.projectName).filter(Boolean))].sort())
  );
  uniqueStatuses$: Observable<string[]> = this.allTasks$.pipe(
    map(tasks => [...new Set(tasks.map(t => t.status).filter(Boolean))].sort())
  );
  uniquePriorities$: Observable<string[]> = this.allTasks$.pipe(
    map(tasks => [...new Set(tasks.map(t => t.priority).filter(Boolean))].sort())
  );

  // Release Dropdown options
  uniqueRelCategories$: Observable<string[]> = this.allReleases$.pipe(
    map(rels => [...new Set(rels.map(r => r.category).filter(Boolean))].sort())
  );
  uniqueRelStatuses$: Observable<string[]> = this.allReleases$.pipe(
    map(rels => [...new Set(rels.map(r => r.status).filter(Boolean))].sort())
  );
  uniqueRelPriorities$: Observable<string[]> = this.allReleases$.pipe(
    map(rels => [...new Set(rels.map(r => r.priority).filter(Boolean))].sort())
  );
  uniqueRelAssigned$: Observable<string[]> = this.allReleases$.pipe(
    map(rels => [...new Set(rels.map(r => r.assignedTo).filter(Boolean))].sort())
  );

  // Filtered tasks logic
  filteredTasks$: Observable<DeveloperTask[]> = combineLatest([
    this.allTasks$,
    this.filterResource,
    this.filterProject,
    this.filterStatus,
    this.filterPriority
  ]).pipe(
    map(([tasks, resource, project, status, priority]) => {
      return tasks.filter(t => {
        const passRes = !resource || t.resourceName === resource;
        const passProj = !project || t.projectName === project;
        const passStat = !status || t.status === status;
        const passPrio = !priority || t.priority === priority;
        return passRes && passProj && passStat && passPrio;
      });
    })
  );

  // Filtered releases logic
  filteredReleases$: Observable<ReleaseTrack[]> = combineLatest([
    this.allReleases$,
    this.relFilterCategory,
    this.relFilterStatus,
    this.relFilterPriority,
    this.relFilterAssigned
  ]).pipe(
    map(([releases, category, status, priority, assigned]) => {
      return releases.filter(r => {
        const passCat = !category || r.category === category;
        const passStat = !status || r.status === status;
        const passPrio = !priority || r.priority === priority;
        const passAssign = !assigned || r.assignedTo === assigned;
        return passCat && passStat && passPrio && passAssign;
      });
    })
  );

  // Derived Developer statuses based on filtered Tasks
  developers$: Observable<any[]> = this.filteredTasks$.pipe(
    map(tasks => {
      const devMap = new Map<string, any>();
      
      tasks.forEach(task => {
        const name = task.resourceName || 'Unassigned';
        if (!devMap.has(name)) {
          devMap.set(name, { name, status: 'On Track', tasksCompleted: 0, totalTasks: 0, hasBlocker: false });
        }
        
        const devEntry = devMap.get(name);
        devEntry.totalTasks++;
        
        if (task.status === 'Completed' || task.progress === 100) {
          devEntry.tasksCompleted++;
        }
        if (task.status === 'Blocked') {
          devEntry.hasBlocker = true;
        }
      });
      
      // Compute final status label for each developer based on their tasks
      return Array.from(devMap.values()).map(dev => {
        if (dev.hasBlocker) {
          dev.status = 'Blocked';
        } else if (dev.totalTasks > 0 && dev.tasksCompleted === dev.totalTasks) {
          dev.status = 'Ahead';
        } else {
          dev.status = 'On Track';
        }
        return dev;
      });
    })
  );

  onFilterChange(filterType: string, event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    switch (filterType) {
      case 'resource': this.filterResource.next(value); break;
      case 'project': this.filterProject.next(value); break;
      case 'status': this.filterStatus.next(value); break;
      case 'priority': this.filterPriority.next(value); break;
    }
  }

  onRelFilterChange(filterType: string, event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    switch (filterType) {
      case 'category': this.relFilterCategory.next(value); break;
      case 'status': this.relFilterStatus.next(value); break;
      case 'priority': this.relFilterPriority.next(value); break;
      case 'assigned': this.relFilterAssigned.next(value); break;
    }
  }

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
