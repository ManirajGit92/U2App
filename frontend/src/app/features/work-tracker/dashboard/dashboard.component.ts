import { ChangeDetectorRef, Component, EventEmitter, Input, NgZone, OnChanges, OnDestroy, OnInit, Output, SimpleChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WorkTrackerService, DeveloperTask, HourlyUpdateStatus, HourlyWorkUpdate, ReleaseTrack, WorkTrackerData } from '../work-tracker.service';
import { WorkTrackerTab } from '../work-tracker.component';
import { BehaviorSubject, Subscription, combineLatest, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { NotificationReminder, NotificationReminderService } from '../../../core/services/notification-reminder.service';
import { ThemeService } from '../../../core/services/theme.service';
import { ColumnFilterComponent, ColumnFilterOption } from '../components/column-filter.component';
import { ComboboxComponent } from '../components/combobox.component';

interface HourlyReminderPopup {
  hour: string;
  taskDescription: string;
  status: string;
}

interface DayScheduleSlot {
  id: string;
  hour: string;
  taskTitle: string;
  taskDescription: string;
  projectName: string;
  status: 'Pending' | 'In Progress' | 'Completed';
  isLeave: boolean;
  isLunch: boolean;
  leaveType: 'none' | 'full' | 'half';
  date: string;
  durationHours?: number;
  trackingMode?: 'hourly' | 'day-wise' | 'actual-hours';
}

interface LeaveDayEntry {
  dayName: string;
  date: string;
  leaveType: 'none' | 'full' | 'half';
}

interface OverdueTaskItem {
  id: string;
  slotIds: string[];
  hour: string;
  taskTitle: string;
  taskDescription: string;
  projectName: string;
  date: string;
  newStatus: string;
  reason: string;
  projectChoice: 'same' | 'other';
  otherProjectName: string;
  continuedOnProject?: string;
  durationHours?: number;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, ColumnFilterComponent, ComboboxComponent],
  template: `
    <div class="dashboard-container">
      <!-- NEW DASHBOARD VIEW (Matching UI Screenshot) -->
      @if (activeView === 'dashboard') {
        <div class="dashboard-root-view">
          <!-- Top Sub-Header & Date/Project Filter Bar -->
          <div class="dash-top-bar" [class.jarvis-top-bar]="themeService.isJarvis()">
            <div class="dash-period-selector">
              <button class="dash-hamburger-btn" type="button" (click)="toggleSidebar.emit()" title="Toggle Sidebar">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="3" y1="6" x2="21" y2="6"></line>
                  <line x1="3" y1="12" x2="21" y2="12"></line>
                  <line x1="3" y1="18" x2="21" y2="18"></line>
                </svg>
              </button>
              
              <!-- Granularity Mode Selector -->
              <div class="period-mode-wrap">
                <select class="period-mode-select" [(ngModel)]="selectedViewMode" (ngModelChange)="onViewModeChange()" title="Select Granularity">
                  <option value="day">Day wise</option>
                  <option value="week">Week wise</option>
                  <option value="month">Month wise</option>
                  <option value="quarter">Quarterly</option>
                  <option value="half-year">Half-Yearly</option>
                  <option value="year">Yearly</option>
                </select>
                <span class="select-chevron">▼</span>
              </div>

              <!-- Previous Arrow -->
              <button class="nav-arrow-btn" type="button" (click)="navigatePeriod(-1)" [title]="'Previous ' + selectedViewMode">‹</button>

              <!-- Interactive Period Dropdown Pill -->
              <div class="date-range-pill-select-wrap">
                <svg class="pill-cal-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="16" y1="2" x2="16" y2="6"></line>
                  <line x1="8" y1="2" x2="8" y2="6"></line>
                  <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
                <select class="period-item-select" [(ngModel)]="currentPeriodSelection" (ngModelChange)="onPeriodSelectionChange()" title="Select Period">
                  <option *ngFor="let opt of availablePeriodOptions" [value]="opt.value">{{ opt.label }}</option>
                </select>
                <span class="dropdown-arrow">▼</span>
              </div>

              <!-- Next Arrow -->
              <button class="nav-arrow-btn" type="button" (click)="navigatePeriod(1)" [title]="'Next ' + selectedViewMode">›</button>
            </div>

            <div class="dash-top-actions">
              <div class="project-dropdown-wrap">
                <select [(ngModel)]="selectedProjectFilter" (ngModelChange)="onProjectFilterChanged()" class="project-select">
                  <option value="All Projects">All Projects</option>
                  <option *ngFor="let p of projectList" [value]="p">{{ p }}</option>
                </select>
                <span class="select-chevron">▼</span>
              </div>

              <div class="notif-bell-btn" title="Notifications">
                <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                </svg>
                <span class="notif-badge-dot"></span>
              </div>

              <button class="dash-theme-btn" type="button" (click)="themeService.toggle()" [title]="'Switch to ' + (themeService.theme() === 'dark' ? 'light' : 'dark') + ' mode'">
                {{ themeService.theme() === 'dark' ? '☀️' : '🌙' }}
              </button>

              <!-- DB Reset Button -->
              <button
                id="wt-db-reset-btn"
                class="dash-db-reset-btn"
                type="button"
                (click)="openResetConfirmDialog()"
                title="Reset all Work Tracker data (tasks, releases, hourly logs)"
                [disabled]="isResetting"
              >
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5">
                  <polyline points="1 4 1 10 7 10"/>
                  <path d="M3.51 15a9 9 0 1 0 .49-5.51"/>
                </svg>
                <span>DB Reset</span>
              </button>

              <div class="user-profile-badge">
                <div class="user-avatar-circle">M</div>
                <div class="user-meta">
                  <span class="user-name">Maniraj</span>
                  <span class="user-role">Admin</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Top Metric Summary Cards (5 KPI Cards Grid) -->
          <div class="kpi-grid">
            <!-- 1. Total Employees -->
            <div class="kpi-card kpi-blue">
              <div class="kpi-icon-wrap bg-blue-icon">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
              </div>
              <div class="kpi-body">
                <span class="kpi-label">Total Employees</span>
                <div class="kpi-val-row">
                  <span class="kpi-value">{{ kpiTotalEmployees }}</span>
                  <span class="kpi-trend text-green">▲ {{ kpiActiveEmployees }} active</span>
                </div>
                <span class="kpi-subtext">{{ kpiEmployeesSubtext }}</span>
              </div>
            </div>

            <!-- 2. Total Tasks -->
            <div class="kpi-card kpi-green">
              <div class="kpi-icon-wrap bg-green-icon">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <div class="kpi-body">
                <span class="kpi-label">Total Tasks</span>
                <div class="kpi-val-row">
                  <span class="kpi-value">{{ kpiTotalTasks }}</span>
                  <span class="kpi-trend text-green">▲ {{ kpiCompletedTasks }}</span>
                </div>
                <span class="kpi-subtext">Sprint Status ({{ kpiTasksSubtext }})</span>
              </div>
            </div>

            <!-- 3. Total Hours Logged -->
            <div class="kpi-card kpi-amber">
              <div class="kpi-icon-wrap bg-amber-icon">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
              </div>
              <div class="kpi-body">
                <span class="kpi-label">Total Hours Logged</span>
                <div class="kpi-val-row">
                  <span class="kpi-value">{{ kpiTotalHours }} hrs</span>
                  <span class="kpi-trend text-green">▲ {{ kpiHoursTrend }}%</span>
                </div>
                <span class="kpi-subtext">{{ kpiHoursSubtext }}</span>
              </div>
            </div>

            <!-- 4. Task Completion -->
            <div class="kpi-card kpi-purple">
              <div class="kpi-icon-wrap bg-purple-icon">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="16 9 10.5 15 8 12.5"/>
                </svg>
              </div>
              <div class="kpi-body">
                <span class="kpi-label">Task Completion</span>
                <div class="kpi-val-row">
                  <span class="kpi-value">{{ kpiTaskCompletionPct }}%</span>
                  <span class="kpi-trend text-green">▲ {{ kpiCompletionTrend }}%</span>
                </div>
                <span class="kpi-subtext">{{ kpiCompletionSubtext }}</span>
              </div>
            </div>

            <!-- 5. Active Projects -->
            <div class="kpi-card kpi-pink">
              <div class="kpi-icon-wrap bg-pink-icon">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
                </svg>
              </div>
              <div class="kpi-body">
                <span class="kpi-label">Active Projects</span>
                <div class="kpi-val-row">
                  <span class="kpi-value">{{ kpiActiveProjects }}</span>
                  <span class="kpi-trend text-green">▲ {{ kpiNewProjects }}</span>
                </div>
                <span class="kpi-subtext">{{ kpiProjectsSubtext }}</span>
              </div>
            </div>
          </div>

          <!-- Middle Section: 2 Columns (Project Status Overview + Project Timeline / Roadmap) -->
          <div class="dash-row-2col">
            <!-- Left Card: Project Status Overview -->
            <div class="dash-card">
              <div class="dash-card-header">
                <h3 class="dash-card-title">Project Status Overview</h3>
                <button class="dash-link-btn" type="button" (click)="onViewAllProjects()">View All</button>
              </div>
              <div class="table-responsive">
                <table class="dash-table">
                  <thead>
                    <tr>
                      <th style="width: 28px">#</th>
                      <th>Project Name</th>
                      <th>Timeline</th>
                      <th>Current Environment</th>
                      <th>Overall Status</th>
                      <th style="width: 140px">Progress</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let p of overviewProjects">
                      <td class="text-muted text-bold">{{ p.id }}</td>
                      <td class="project-name-cell">{{ p.name }}</td>
                      <td class="text-muted small-text">{{ p.timeline }}</td>
                      <td>
                        <span class="env-badge" [ngClass]="p.environment | lowercase">
                          <span class="badge-dot"></span> {{ p.environment }}
                        </span>
                      </td>
                      <td>
                        <span class="status-pill" [ngClass]="getStatusPillClass(p.status)">
                          {{ p.status }}
                        </span>
                      </td>
                      <td>
                        <div class="progress-wrap">
                          <div class="progress-val-text">{{ p.progress }}%</div>
                          <div class="progress-bar-track">
                            <div class="progress-bar-val" [style.width.%]="p.progress"></div>
                          </div>
                        </div>
                      </td>
                    </tr>
                    <tr *ngIf="overviewProjects.length === 0">
                      <td colspan="6" class="dash-empty-table-cell">
                        No project status records found. All Work Tracker data is in a clean state.
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Right Card: Project Timeline / Roadmap -->
            <div class="dash-card">
              <div class="dash-card-header">
                <h3 class="dash-card-title">Project Timeline / Roadmap</h3>
                <div class="header-range-tag">
                  <span>{{ selectedDateRange }}</span>
                  <span class="range-arrow">›</span>
                </div>
              </div>

              <div class="gantt-chart-container">
                <!-- Month Header Row -->
                <div class="gantt-header-row">
                  <div class="gantt-project-col">Project</div>
                  <div class="gantt-months-grid">
                    <div *ngFor="let m of months; let i = index" class="gantt-month-col" [class.is-current-month]="isMonthActive(i)">
                      {{ m }}
                    </div>
                  </div>
                </div>

                <!-- Gantt Body Rows -->
                <div class="gantt-body-wrap">
                  <!-- Today Indicator Line (Positioned over Oct, column index 9) -->
                  <div class="gantt-today-line">
                    <div class="today-tag">Today</div>
                    <div class="today-dashed-line"></div>
                  </div>

                  <div class="gantt-row" *ngFor="let p of roadmapProjects">
                    <div class="gantt-project-col text-bold">{{ p.name }}</div>
                    <div class="gantt-track-area">
                      <div class="gantt-bar" 
                           [style.left.%]="p.leftPct" 
                           [style.width.%]="p.widthPct"
                           [ngClass]="'gantt-bar-' + p.colorClass">
                        <div class="gantt-segment" *ngFor="let seg of p.segments" [style.width.%]="seg.widthPct">
                          <span class="seg-node">◇</span>
                          <span class="seg-text">{{ seg.label }}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div *ngIf="roadmapProjects.length === 0" class="dash-empty-chart-box">
                    <span>No project roadmap data available</span>
                  </div>
                </div>

                <!-- Legend Row -->
                <div class="gantt-legend">
                  <span class="legend-item"><span class="leg-dot bg-amber"></span> Dev</span>
                  <span class="legend-item"><span class="leg-dot bg-blue"></span> Testing</span>
                  <span class="legend-item"><span class="leg-dot bg-teal"></span> UAT</span>
                  <span class="legend-item"><span class="leg-dot bg-green"></span> Production</span>
                  <span class="legend-item"><span class="leg-diamond">◇</span> Milestone</span>
                  <span class="legend-item"><span class="leg-circle">○</span> Current Phase</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Bottom Section: 2 Columns (Team Work Summary + Work Analytics) -->
          <div class="dash-row-2col">
            <!-- Left Card: Team Work Summary -->
            <div class="dash-card">
              <div class="dash-card-header">
                <h3 class="dash-card-title">Team Work Summary ({{ getCurrentPeriodLabel() }})</h3>
                <button class="dash-link-btn" type="button" (click)="onViewDetailsTasks()">View Details</button>
              </div>
              <div class="table-responsive">
                <table class="dash-table">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Role</th>
                      <th class="text-center">Tasks Worked</th>
                      <th class="text-center">Hours Spent</th>
                      <th style="width: 140px">Task Completion</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let member of teamSummary">
                      <td>
                        <div class="team-emp-cell">
                          <div class="emp-avatar-sm" [ngClass]="getAvatarColorClass(member.name)">
                            <span class="avatar-icon-char">{{ member.avatar }}</span>
                          </div>
                          <span class="emp-name text-bold">{{ member.name }}</span>
                        </div>
                      </td>
                      <td class="text-muted small-text">{{ member.role }}</td>
                      <td class="text-center text-bold">{{ member.tasksWorked }}</td>
                      <td class="text-center text-muted">{{ member.hoursSpent }} hrs</td>
                      <td>
                        <div class="progress-wrap">
                          <div class="progress-bar-track member-progress">
                            <div class="progress-bar-val" [style.width.%]="member.taskCompletion"></div>
                          </div>
                          <div class="progress-val-text member-progress-text">{{ member.taskCompletion }}%</div>
                        </div>
                      </td>
                      <td>
                        <span class="team-status-badge" [ngClass]="getTeamStatusClass(member.status)">
                          <span class="badge-dot"></span>
                          {{ member.status }}
                        </span>
                      </td>
                    </tr>
                    <tr *ngIf="teamSummary.length === 0">
                      <td colspan="6" class="dash-empty-table-cell">
                        No team member records found. All Work Tracker data is in a clean state.
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Right Card: Work Analytics (Matching Screenshot 6 Sub-Charts) -->
            <div class="dash-card">
              <div class="dash-card-header">
                <h3 class="dash-card-title">Work Analytics</h3>
                <button class="dash-link-btn" type="button" (click)="onViewDetailsHourly()">View Details</button>
              </div>

              <!-- 6 Widgets in 2 rows x 3 columns Grid -->
              <div class="analytics-subgrid">
                <!-- 1. Weekly Task Completion -->
                <div class="mini-analytic-card">
                  <div class="mini-card-header-row">
                    <span class="mini-card-title">Weekly Task Completion</span>
                  </div>
                  <div class="mini-legend-row">
                    <span class="mini-leg-item"><span class="leg-bullet bg-primary-blue"></span> Completed</span>
                    <span class="mini-leg-item"><span class="leg-bullet bg-slate-300"></span> Pending</span>
                  </div>
                  <div class="chart-box-bars">
                    <div class="y-axis-labels">
                      <span>40</span>
                      <span>30</span>
                      <span>20</span>
                      <span>10</span>
                      <span>0</span>
                    </div>
                    <div class="bar-chart-plot">
                      <div class="bar-grid-line line-40"></div>
                      <div class="bar-grid-line line-30"></div>
                      <div class="bar-grid-line line-20"></div>
                      <div class="bar-grid-line line-10"></div>
                      <div class="bar-columns-flex">
                        <div class="day-bar-group" *ngFor="let item of weeklyCompletionDays">
                          <span class="bar-top-value">{{ item.val }}</span>
                          <div class="bar-fill-col" [style.height.%]="item.heightPct"></div>
                          <span class="bar-x-label">{{ item.day }}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- 2. Project Completion -->
                <div class="mini-analytic-card">
                  <div class="mini-card-header-row">
                    <span class="mini-card-title">Project Completion</span>
                  </div>
                  <div class="project-comp-list">
                    <div class="proj-comp-row" *ngFor="let p of projectCompletions">
                      <span class="proj-comp-name">{{ p.name }}</span>
                      <div class="proj-comp-track">
                        <div class="proj-comp-bar" [style.width.%]="p.pct" [style.background]="p.color"></div>
                      </div>
                      <span class="proj-comp-pct">{{ p.pct }}%</span>
                    </div>
                    <div *ngIf="projectCompletions.length === 0" class="dash-empty-chart-box">
                      <span>No project data available</span>
                    </div>
                  </div>
                </div>

                <!-- 3. Employee Task Completion -->
                <div class="mini-analytic-card">
                  <div class="mini-card-header-row">
                    <span class="mini-card-title">Employee Task Completion</span>
                  </div>
                  <div class="emp-task-list">
                    <div class="emp-task-row" *ngFor="let emp of employeeTaskCompletions">
                      <span class="emp-task-name">{{ emp.name }}</span>
                      <div class="emp-task-track">
                        <div class="emp-task-bar" [style.width.%]="emp.widthPct"></div>
                      </div>
                      <span class="emp-task-count">{{ emp.count }}</span>
                    </div>
                    <div *ngIf="employeeTaskCompletions.length === 0" class="dash-empty-chart-box">
                      <span>No employee data available</span>
                    </div>
                    <div class="emp-task-scale" *ngIf="employeeTaskCompletions.length > 0">
                      <span>0</span>
                      <span>2</span>
                      <span>4</span>
                      <span>6</span>
                      <span>8</span>
                    </div>
                  </div>
                </div>

                <!-- 4. Work Trends (Tasks Completed) -->
                <div class="mini-analytic-card">
                  <div class="mini-card-header-row">
                    <span class="mini-card-title">Work Trends (Tasks Completed)</span>
                  </div>
                  <div class="mini-legend-row">
                    <span class="mini-leg-item"><span class="leg-line-solid"></span> Tasks Completed</span>
                    <span class="mini-leg-item"><span class="leg-line-dashed"></span> Tasks Assigned</span>
                  </div>
                  <div class="trends-chart-wrap">
                    <div *ngIf="workTrends.length === 0" class="dash-empty-chart-box">
                      <span>No trend data available</span>
                    </div>
                    <svg *ngIf="workTrends.length > 0" viewBox="0 0 310 110" class="trends-svg">
                      <!-- Grid lines -->
                      <line x1="24" y1="20" x2="300" y2="20" stroke="#f1f5f9" stroke-width="1"/>
                      <line x1="24" y1="45" x2="300" y2="45" stroke="#f1f5f9" stroke-width="1"/>
                      <line x1="24" y1="70" x2="300" y2="70" stroke="#f1f5f9" stroke-width="1"/>
                      <line x1="24" y1="95" x2="300" y2="95" stroke="#f1f5f9" stroke-width="1"/>
                      <!-- Y Labels -->
                      <text x="12" y="24" font-size="8" fill="#94a3b8" text-anchor="end">60</text>
                      <text x="12" y="49" font-size="8" fill="#94a3b8" text-anchor="end">40</text>
                      <text x="12" y="74" font-size="8" fill="#94a3b8" text-anchor="end">20</text>
                      <text x="12" y="99" font-size="8" fill="#94a3b8" text-anchor="end">0</text>
                      <!-- Dashed Line (Tasks Assigned) -->
                      <path [attr.d]="workTrendsAssignedPath" 
                            fill="none" stroke="#93c5fd" stroke-width="1.8" stroke-dasharray="4,3"/>
                      <circle *ngFor="let pt of workTrends" [attr.cx]="pt.x + 12" [attr.cy]="pt.assignedY" r="3" fill="#93c5fd"/>
                      <!-- Solid Line (Tasks Completed) -->
                      <path [attr.d]="workTrendsCompletedPath" 
                            fill="none" stroke="#2563eb" stroke-width="2.2"/>
                      <!-- Nodes and Labels -->
                      <g *ngFor="let pt of workTrends">
                        <circle [attr.cx]="pt.x + 12" [attr.cy]="pt.y" r="3.5" fill="#2563eb" stroke="#ffffff" stroke-width="1.5"/>
                        <text [attr.cx]="pt.x + 12" [attr.cy]="pt.y - 7" [attr.x]="pt.x + 12" font-size="9" font-weight="700" fill="#1e293b" text-anchor="middle">
                          {{ pt.completed }}
                        </text>
                      </g>
                    </svg>
                    <div class="trends-x-axis" *ngIf="workTrends.length > 0">
                      <span *ngFor="let pt of workTrends">{{ pt.week }}</span>
                    </div>
                  </div>
                </div>

                <!-- 5. Hours Spent -->
                <div class="mini-analytic-card">
                  <div class="mini-card-header-row">
                    <span class="mini-card-title">Hours Spent ({{ getCurrentPeriodLabel() }})</span>
                  </div>
                  <div class="mini-legend-row multi-legend">
                    <span class="mini-leg-item"><span class="leg-box bg-cat-frontend"></span> Frontend</span>
                    <span class="mini-leg-item"><span class="leg-box bg-cat-backend"></span> Backend</span>
                    <span class="mini-leg-item"><span class="leg-box bg-cat-testing"></span> Testing</span>
                    <span class="mini-leg-item"><span class="leg-box bg-cat-paba"></span> PA/BA</span>
                  </div>
                  <div class="stacked-bar-chart-wrap">
                    <div *ngIf="hoursSpentTeam.length === 0" class="dash-empty-chart-box">
                      <span>No hours logged</span>
                    </div>
                    <div *ngIf="hoursSpentTeam.length > 0" class="y-axis-labels">
                      <span>40</span>
                      <span>30</span>
                      <span>20</span>
                      <span>10</span>
                      <span>0</span>
                    </div>
                    <div *ngIf="hoursSpentTeam.length > 0" class="stacked-plot">
                      <div class="bar-grid-line line-40"></div>
                      <div class="bar-grid-line line-30"></div>
                      <div class="bar-grid-line line-20"></div>
                      <div class="bar-grid-line line-10"></div>
                      <div class="stacked-columns-row">
                        <div class="stacked-col-group" *ngFor="let col of hoursSpentTeam">
                          <span class="bar-top-value">{{ col.total }}</span>
                          <div class="stacked-column-bar">
                            <div class="seg-bar seg-frontend" [style.height.%]="(col.f / maxHoursTeam) * 100"></div>
                            <div class="seg-bar seg-backend" [style.height.%]="(col.b / maxHoursTeam) * 100"></div>
                            <div class="seg-bar seg-testing" [style.height.%]="(col.t / maxHoursTeam) * 100"></div>
                            <div class="seg-bar seg-paba" [style.height.%]="(col.p / maxHoursTeam) * 100"></div>
                          </div>
                          <span class="bar-x-label truncate-name">{{ col.name }}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- 6. Monthly & Quarterly Completion -->
                <div class="mini-analytic-card">
                  <div class="mini-card-header-row">
                    <span class="mini-card-title">Monthly &amp; Quarterly Completion</span>
                  </div>
                  <div class="dual-bar-subcharts">
                    <!-- Monthly Sub-Chart -->
                    <div class="subchart-col">
                      <span class="subchart-title">Monthly Completion</span>
                      <div class="subchart-bars-flex">
                        <div class="sub-bar-item" *ngFor="let m of monthlyCompletions">
                          <span class="sub-bar-val">{{ m.pct }}%</span>
                          <div class="sub-bar-track">
                            <div class="sub-bar-fill fill-blue" [style.height.%]="m.heightPct"></div>
                          </div>
                          <span class="sub-bar-lbl">{{ m.month }}</span>
                        </div>
                      </div>
                    </div>
                    <!-- Quarterly Sub-Chart -->
                    <div class="subchart-col">
                      <span class="subchart-title">Quarterly Completion</span>
                      <div class="subchart-bars-flex">
                        <div class="sub-bar-item" *ngFor="let q of quarterlyCompletions">
                          <span class="sub-bar-val">{{ q.pct }}%</span>
                          <div class="sub-bar-track">
                            <div class="sub-bar-fill fill-green" [style.height.%]="q.heightPct"></div>
                          </div>
                          <span class="sub-bar-lbl">{{ q.quarter }}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      }


      <!-- YOUR DAY WORK TRACK (Comprehensive) -->
      @if (activeView === 'day-work') {
      <!-- Overdue Task Status Update Popup (Consolidated) -->
      @if (showOverdueTaskPopup) {
      <div class="modal-backdrop" role="presentation">
        <section class="modal-panel wide-modal overdue-modal-panel" role="dialog" aria-modal="true" aria-labelledby="overduePopupTitle" (click)="$event.stopPropagation()">
          <div class="modal-header overdue-modal-header">
            <div class="overdue-header-content">
              <div class="overdue-badge-pill">ACTION REQUIRED</div>
              <h2 id="overduePopupTitle">⏰ Overdue Tasks — Status Update Required</h2>
              <p class="overdue-subtitle">Resource: <strong>{{ dayWorkResource }}</strong> • Mode: <strong>{{ getTrackingModeLabel() }}</strong> • {{ overdueTaskItems.length }} task{{ overdueTaskItems.length > 1 ? 's' : '' }} need status update</p>
            </div>
          </div>

          <div class="overdue-popup-note">
            ℹ️ You have <strong>{{ overdueTaskItems.length }}</strong> scheduled task(s) in <strong>{{ getTrackingModeLabel() }}</strong> mode whose time has elapsed without being marked Completed.
            Please update the status for <em>each</em> task below. All tasks must be updated before you can proceed.
          </div>

          <!-- Reminder Frequency Controls -->
          <div class="overdue-freq-section">
            <div class="overdue-freq-header">
              <span class="freq-header-title">🔔 Reminder Frequency:</span>
              <span class="freq-header-sub">Controls when this overdue popup automatically prompts you</span>
            </div>
            <div class="overdue-freq-pills">
              <label class="freq-pill" [class.active]="overdueReminderFrequency === 'until-completed'">
                <input type="radio" name="overdueReminderFreq" [(ngModel)]="overdueReminderFrequency" (ngModelChange)="onOverdueFrequencyChange()" value="until-completed">
                <span class="freq-pill-title">Until Task Completed</span>
              </label>
              <label class="freq-pill" [class.active]="overdueReminderFrequency === 'every-hour'">
                <input type="radio" name="overdueReminderFreq" [(ngModel)]="overdueReminderFrequency" (ngModelChange)="onOverdueFrequencyChange()" value="every-hour">
                <span class="freq-pill-title">Every One Hour</span>
              </label>
              <label class="freq-pill" [class.active]="overdueReminderFrequency === 'daily-eod'">
                <input type="radio" name="overdueReminderFreq" [(ngModel)]="overdueReminderFrequency" (ngModelChange)="onOverdueFrequencyChange()" value="daily-eod">
                <span class="freq-pill-title">Daily at EOD</span>
              </label>
              <label class="freq-pill" [class.active]="overdueReminderFrequency === 'manual'">
                <input type="radio" name="overdueReminderFreq" [(ngModel)]="overdueReminderFrequency" (ngModelChange)="onOverdueFrequencyChange()" value="manual">
                <span class="freq-pill-title">Only on Button Click</span>
              </label>
            </div>
          </div>

          <div class="overdue-quick-actions">
            <button class="btn-quick-fill" type="button" (click)="quickMarkAllCompleted()">⚡ Quick-Set Remaining as Completed</button>
          </div>

          <!-- Alert banner if validation fails on submit -->
          <div class="overdue-popup-warning" *ngIf="overduePopupSubmitted && !isOverduePopupValid()">
            ⚠️ <strong>Update Incomplete:</strong> Please select a status for all tasks. For any task marked <em>"In Progress"</em>, the reason is mandatory and project choice must be specified.
          </div>

          <div class="overdue-tasks-scroll-container">
            <div *ngFor="let item of overdueTaskItems; let i = index" 
                 class="overdue-task-card" 
                 [class.card-invalid]="overduePopupSubmitted && !isItemValid(item)"
                 [class.card-valid]="isItemValid(item)">
              
              <div class="overdue-task-header">
                <span class="overdue-seq-badge">#{{ i + 1 }}</span>
                <span class="overdue-task-date">📅 {{ formatAppDate(item.date) }}</span>
                <span class="overdue-task-time">⏰ {{ item.hour }}</span>
                <span class="overdue-duration-badge" *ngIf="item.durationHours">{{ item.durationHours }}h</span>
                <span class="overdue-task-project">📁 {{ item.projectName || 'General' }}</span>
                <span class="overdue-task-title">{{ item.taskTitle }}</span>
                <span class="overdue-task-desc" *ngIf="item.taskDescription && item.taskDescription !== item.taskTitle">— {{ item.taskDescription }}</span>
                <span class="overdue-status-indicator" *ngIf="item.newStatus" [ngClass]="normalizeStatus(item.newStatus)">
                  {{ item.newStatus }}
                </span>
              </div>

              <div class="overdue-task-fields">
                <!-- Status Control (Required) -->
                <div class="overdue-field-group">
                  <label>Status <span class="req">*</span></label>
                  <select [(ngModel)]="item.newStatus" (ngModelChange)="onOverdueStatusChange(item)" class="overdue-select" [class.field-error]="overduePopupSubmitted && !item.newStatus">
                    <option value="">-- Select Status * --</option>
                    <option value="Completed">Completed</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Pending">Pending</option>
                  </select>
                  <span class="field-error-msg" *ngIf="overduePopupSubmitted && !item.newStatus">Status selection is mandatory</span>
                </div>

                <!-- If In Progress: Mandatory Reason + Project Choice -->
                @if (item.newStatus === 'In Progress') {
                <div class="overdue-inprogress-box">
                  <!-- Reason (Mandatory) -->
                  <div class="overdue-field-group modal-wide">
                    <label>Reason for In Progress <span class="req">* (Mandatory)</span></label>
                    <textarea rows="2" 
                              [(ngModel)]="item.reason" 
                              class="overdue-textarea"
                              [class.field-error]="overduePopupSubmitted && !item.reason.trim()"
                              placeholder="Please explain why this task is still in progress (e.g. dependency waiting, extra testing required)..."></textarea>
                    <span class="field-error-msg" *ngIf="overduePopupSubmitted && !item.reason.trim()">Reason is required for In Progress status</span>
                  </div>

                  <!-- Project Choice Control: Work in this project or other project -->
                  <div class="overdue-field-group modal-wide project-choice-group">
                    <label>Working Project Continuation <span class="req">*</span></label>
                    <div class="project-choice-radios">
                      <label class="choice-radio-label">
                        <input type="radio" [name]="'proj_choice_' + item.id" [(ngModel)]="item.projectChoice" value="same">
                        <span>Work in this project (<strong>{{ item.projectName || 'Current Project' }}</strong>)</span>
                      </label>
                      <label class="choice-radio-label">
                        <input type="radio" [name]="'proj_choice_' + item.id" [(ngModel)]="item.projectChoice" value="other">
                        <span>Work in other project</span>
                      </label>
                    </div>

                    <!-- If Other Project: Dropdown to pick which project -->
                    @if (item.projectChoice === 'other') {
                    <div class="other-project-select-wrap">
                      <label class="sub-label">Select Other Project <span class="req">*</span></label>
                      <select [(ngModel)]="item.otherProjectName" class="overdue-select" [class.field-error]="overduePopupSubmitted && !item.otherProjectName">
                        <option value="">-- Choose Other Project --</option>
                        <option *ngFor="let p of dayWorkProjectList" [value]="p">{{ p }}</option>
                      </select>
                      <span class="field-error-msg" *ngIf="overduePopupSubmitted && !item.otherProjectName">Please select which other project</span>
                    </div>
                    }
                  </div>
                </div>
                }
              </div>
            </div>
          </div>

          <div class="modal-actions overdue-modal-actions">
            <div class="overdue-modal-status-text">
              <span *ngIf="!isOverduePopupValid()" class="text-pending">
                ⚠️ {{ getInvalidItemCount() }} task(s) still require updates
              </span>
              <span *ngIf="isOverduePopupValid()" class="text-ready">
                ✅ All {{ overdueTaskItems.length }} task(s) ready to submit
              </span>
            </div>
            <div class="overdue-action-buttons">
              <button class="btn-table secondary overdue-cancel-btn" type="button" (click)="cancelOverduePopup()" title="Close popup without updating tasks">
                Cancel
              </button>
              <button class="btn-table overdue-submit-btn" type="button" (click)="submitOverduePopup()">
                Submit & Close
              </button>
            </div>
          </div>
        </section>
      </div>
      }

      <!-- Main Day Work Track Card -->
      <div class="glass-card day-work-card">
        <div class="table-header">
          <div class="hud-header-title">
            <svg *ngIf="themeService.isJarvis()" class="hud-sec-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="none" stroke="#00c8ff" stroke-width="2"/><polyline points="12 6 12 12 16 14" stroke="#00c8ff" stroke-width="2"/></svg>
            <h2>Your Day Work Track</h2>
          </div>
          <div class="table-actions">
            <button class="btn-table secondary" type="button" (click)="checkAndShowOverduePopup(true)" title="Check for overdue tasks">
              ⏰ Check Overdue
            </button>
            <button class="btn-table secondary" type="button" (click)="enableHourlyReminders()">
              {{ reminderPermissionLabel }}
            </button>
            <label class="voice-toggle">
              <input type="checkbox" [(ngModel)]="voiceRemindersEnabled" (ngModelChange)="rescheduleHourlyReminders()">
              Voice
            </label>
            <button class="btn-table" type="button" (click)="generateDaySchedule()" [disabled]="!dayWorkResource">Generate Schedule</button>
            <button class="btn-table secondary" type="button" (click)="openHourlyModal()">+ Manual Entry</button>
          </div>
        </div>

        <!-- Schedule Configuration Panel -->
        <div class="day-work-config">
          <!-- Work Tracking Mode Selector Pills -->
          <div class="tracking-mode-bar">
            <span class="tracking-mode-label">⚡ Work Tracking Mode:</span>
            <div class="tracking-mode-pills">
              <button type="button" class="mode-pill-btn" [class.active]="dayWorkTrackingMode === 'hourly'" (click)="setTrackingMode('hourly')" title="Split tasks into 1-hour slots with status updates for each hour">
                ⏱️ Hourly (1-Hour Slots)
              </button>
              <button type="button" class="mode-pill-btn" [class.active]="dayWorkTrackingMode === 'day-wise'" (click)="setTrackingMode('day-wise')" title="Allocate tasks based on 8-hour working days">
                📅 Day-wise (8 Hours)
              </button>
              <button type="button" class="mode-pill-btn" [class.active]="dayWorkTrackingMode === 'actual-hours'" (click)="setTrackingMode('actual-hours')" title="Allocate tasks according to exact hours defined in Weekly Status">
                🎯 Actual Hours
              </button>
            </div>
          </div>

          <div class="config-section-title">📋 Schedule Configuration</div>
          <div class="day-work-config-grid">
            <!-- Mode dropdown for direct selection -->
            <div class="config-field">
              <label>Tracking Mode <span class="req">*</span></label>
              <select [(ngModel)]="dayWorkTrackingMode" (ngModelChange)="onTrackingModeChange()" class="config-select">
                <option value="hourly">⏱️ Hourly (1-Hour Slots)</option>
                <option value="day-wise">📅 Day-wise (8 Hours)</option>
                <option value="actual-hours">🎯 Actual Hours (Weekly Status)</option>
              </select>
            </div>

            <!-- Resource Selector -->
            <div class="config-field">
              <label>Resource <span class="req">*</span></label>
              <select [(ngModel)]="dayWorkResource" (ngModelChange)="onDayWorkResourceChange()" class="config-select">
                <option value="">-- Select Resource --</option>
                <option *ngFor="let r of dayWorkResourceList" [value]="r">{{ r }}</option>
              </select>
            </div>

            <!-- Current Week Info (from weekly status) -->
            <div class="config-field" *ngIf="dayWorkCurrentWeekInfo">
              <label>Current Week</label>
              <div class="week-info-badge">{{ dayWorkCurrentWeekInfo }}</div>
            </div>

            <!-- Work Login Hours -->
            <div class="config-field">
              <label>Login Time</label>
              <input type="time" [(ngModel)]="dayWorkLoginTime" class="config-input">
            </div>

            <!-- Work Logoff Hours -->
            <div class="config-field">
              <label>Logoff Time</label>
              <input type="time" [(ngModel)]="dayWorkLogoffTime" class="config-input">
            </div>

            <!-- Total working hours per day -->
            <div class="config-field">
              <label>Working Hrs/Day</label>
              <input type="number" min="1" max="24" [(ngModel)]="dayWorkHoursPerDay" class="config-input small-input">
            </div>

            <!-- Lunch break duration (minutes) -->
            <div class="config-field">
              <label>Lunch Break (min)</label>
              <input type="number" min="0" max="120" [(ngModel)]="dayWorkLunchMinutes" class="config-input small-input">
            </div>
          </div>

          <!-- Leave Calendar -->
          <div class="leave-section" *ngIf="dayWorkResource">
            <div class="leave-section-title">🗓️ Mark Leave Days (current week)</div>
            <div class="leave-days-grid">
              <div class="leave-day-card" *ngFor="let ld of dayWorkLeaveDays">
                <div class="leave-day-name">{{ ld.dayName }}</div>
                <div class="leave-day-date">{{ formatAppDate(ld.date) }}</div>
                <div class="leave-options">
                  <label class="leave-radio">
                    <input type="radio" [name]="'leave_' + ld.date" [(ngModel)]="ld.leaveType" value="none">
                    <span>Work</span>
                  </label>
                  <label class="leave-radio">
                    <input type="radio" [name]="'leave_' + ld.date" [(ngModel)]="ld.leaveType" value="full">
                    <span>Full Leave</span>
                  </label>
                  <label class="leave-radio">
                    <input type="radio" [name]="'leave_' + ld.date" [(ngModel)]="ld.leaveType" value="half">
                    <span>Half Leave</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          <!-- Task List from current week weekly status -->
          <div class="current-week-tasks" *ngIf="dayWorkCurrentWeekTasks.length > 0">
            <div class="leave-section-title">📌 Tasks This Week ({{ dayWorkResource }})</div>
            <div class="week-tasks-list">
              <div class="week-task-chip" *ngFor="let t of dayWorkCurrentWeekTasks">
                <span class="chip-project">{{ t.projectName }}</span>
                <span class="chip-title">{{ t.taskTitle }}</span>
                <span class="chip-hours">{{ t.hours ?? 8 }}h</span>
                <span class="chip-status" [ngClass]="normalizeStatus(t.status)">{{ t.status }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Generated Day Schedule -->
        @if (dayScheduleSlots.length > 0) {
        <div class="day-schedule-section">
          <div class="day-schedule-header">
            <div class="schedule-header-left">
              <span class="leave-section-title">⏰ Generated Schedule</span>
              <span class="mode-active-badge">{{ getTrackingModeLabel() }}</span>
            </div>
            <div class="schedule-header-actions">
              <label class="toggle-switch-card" for="schedule-break-switch-top" title="Toggle Lunch Break and Half-Day Leave cards">
                <span class="switch-box">
                  <input id="schedule-break-switch-top" type="checkbox" [(ngModel)]="showBreaksAndLeaves" class="switch-input">
                  <span class="switch-slider"></span>
                </span>
                <span class="switch-label-text">Show Lunch & Half-Day Leave</span>
              </label>
              <div class="schedule-legend">
                <span class="sched-leg completed">Completed</span>
                <span class="sched-leg inprogress">In Progress</span>
                <span class="sched-leg pending">Pending</span>
              </div>
            </div>
          </div>
          <div class="schedule-slots-grid">
            <ng-container *ngFor="let slot of dayScheduleSlots">
            <div class="schedule-slot" *ngIf="showBreaksAndLeaves || (!slot.isLunch && !(slot.isLeave && slot.leaveType === 'half'))"
              [ngClass]="{'slot-completed': slot.status === 'Completed', 'slot-inprogress': slot.status === 'In Progress', 'slot-pending': slot.status === 'Pending', 'slot-leave': slot.isLeave, 'slot-lunch': slot.isLunch, 'slot-mode-daywise': slot.trackingMode === 'day-wise', 'slot-mode-actual': slot.trackingMode === 'actual-hours'}">
              <div class="slot-time">
                <div class="slot-time-content">
                  <span class="slot-date-text">📅 {{ formatAppDate(slot.date) }}</span>
                  <span class="slot-hour-text">{{ slot.hour }}</span>
                </div>
                <span class="slot-mode-tag" *ngIf="slot.durationHours">{{ slot.durationHours }}h</span>
              </div>
              <div class="slot-body">
                @if (slot.isLeave) {
                  <div class="slot-label leave-label">🌴 {{ slot.leaveType === 'half' ? 'Half Day Leave' : 'Full Day Leave' }}</div>
                } @else if (slot.isLunch) {
                  <div class="slot-label lunch-label">🍽️ Lunch Break</div>
                } @else {
                  @if (editingSlotId === slot.id) {
                    <input class="slot-title-input" [(ngModel)]="slot.taskTitle" placeholder="Task title...">
                    <input class="slot-project-input" [(ngModel)]="slot.projectName" list="projectOptions" placeholder="Project...">
                    <datalist id="projectOptions">
                      <option *ngFor="let p of dayWorkProjectList" [value]="p"></option>
                    </datalist>
                    <select class="slot-status-select" [(ngModel)]="slot.status">
                      <option value="Pending">Pending</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Completed">Completed</option>
                    </select>
                    <textarea class="slot-desc-area" rows="2" [(ngModel)]="slot.taskDescription" placeholder="Description..."></textarea>
                    <div class="slot-edit-actions">
                      <button class="row-button save" type="button" (click)="saveSlotEdit(slot)">Save</button>
                      <button class="row-button" type="button" (click)="editingSlotId = ''">Cancel</button>
                    </div>
                  } @else {
                    <div class="slot-title">{{ slot.taskTitle }}</div>
                    <div class="slot-project">{{ slot.projectName }}</div>
                    <div class="slot-desc">{{ slot.taskDescription }}</div>
                    <div class="slot-footer">
                      <span class="slot-status-badge" [ngClass]="normalizeStatus(slot.status)">{{ slot.status }}</span>
                      <button class="row-button" type="button" (click)="editingSlotId = slot.id" style="font-size:0.7rem;padding:2px 8px">Edit</button>
                      <button class="row-button save" type="button" (click)="saveSlotToHourlyUpdates(slot)" title="Save to hourly log">💾 Log</button>
                    </div>
                  }
                }
              </div>
            </div>
            </ng-container>
          </div>
        </div>

        <!-- Switch Control after Generated Schedule Section -->
        <div class="after-schedule-switch-bar">
          <label class="toggle-switch-card" for="schedule-break-switch-bottom">
            <span class="switch-box">
              <input id="schedule-break-switch-bottom" type="checkbox" [(ngModel)]="showBreaksAndLeaves" class="switch-input">
              <span class="switch-slider"></span>
            </span>
            <span class="switch-label-text">🍽️🌴 Show Lunch Break & Half-Day Leave Cards</span>
            <span class="switch-status-pill" [class.on]="showBreaksAndLeaves">{{ showBreaksAndLeaves ? 'ON' : 'OFF' }}</span>
          </label>
        </div>
        }
      </div>

      <!-- Hourly Updates Log Table (compact) -->
      <div class="glass-card table-section">
        <div class="table-header">
          <div class="hud-header-title">
            <h3 style="font-size:1rem">📋 Hourly Log</h3>
          </div>
          <div class="table-actions">
            <button class="btn-table secondary" type="button" (click)="toggleHiddenHourlyRows()">
              {{ showHiddenHourlyRows ? 'Hide Hidden' : 'Show Hidden' }}
            </button>
            <button class="btn-table secondary" type="button" (click)="toggleSection('hourly')">{{ sections.hourly ? 'Collapse' : 'Expand' }}</button>
          </div>
        </div>
        @if (sections.hourly) {
        <div class="table-responsive">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Date</th>
                <th>Time</th>
                <th>Task Description</th>
                <th>Status</th>
                <th>Visibility</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let update of visibleHourlyUpdates$ | async" [class.hidden-row]="!(update.isVisible ?? true)">
                @if (editingHourlyId === update.id) {
                  <td>{{ update.id }}</td>
                  <td><input class="table-input" type="date" [(ngModel)]="inlineHourlyForm.date"></td>
                  <td><input class="table-input" type="time" [(ngModel)]="inlineHourlyForm.hour"></td>
                  <td><textarea class="table-input table-textarea" rows="2" [(ngModel)]="inlineHourlyForm.taskDescription"></textarea></td>
                  <td>
                    <select class="table-input" [(ngModel)]="inlineHourlyForm.status">
                      <option *ngFor="let status of hourlyStatuses" [value]="status">{{ status }}</option>
                    </select>
                  </td>
                  <td>{{ update.isVisible ?? true ? 'Shown' : 'Hidden' }}</td>
                  <td>
                    <div class="inline-actions">
                      <button class="row-button save" type="button" (click)="saveInlineHourlyUpdate()">Save</button>
                      <button class="row-button" type="button" (click)="cancelInlineHourlyEdit()">Cancel</button>
                    </div>
                  </td>
                } @else {
                  <td>{{ update.id }}</td>
                  <td>{{ formatAppDate(update.date) }}</td>
                  <td>{{ update.hour }}</td>
                  <td class="description-cell">{{ update.taskDescription }}</td>
                  <td><span class="status-tag" [ngClass]="normalizeStatus(update.status)">{{ update.status }}</span></td>
                  <td>{{ update.isVisible ?? true ? 'Shown' : 'Hidden' }}</td>
                  <td>
                    <div class="inline-actions">
                      <button class="row-button" type="button" (click)="startInlineHourlyEdit(update)">Edit</button>
                      <button class="row-button" type="button" (click)="toggleHourlyVisibility(update.id)">
                        {{ update.isVisible ?? true ? 'Hide' : 'Show' }}
                      </button>
                      <button class="row-button danger" type="button" (click)="confirmDeleteHourly(update)">Delete</button>
                    </div>
                  </td>
                }
              </tr>
              <tr *ngIf="(visibleHourlyUpdates$ | async)?.length === 0">
                <td colspan="7" class="text-center">
                  {{ showHiddenHourlyRows ? 'No hourly updates found.' : 'No visible hourly updates found. Generate a schedule or add a manual entry.' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        }
      </div>
      }

      <!-- Data Table Section (Developer Tasks) -->
      @if (activeView === 'weekly-status') {
      <div class="glass-card table-section">
        <div class="table-header">
          <div class="hud-header-title">
            <svg *ngIf="themeService.isJarvis()" class="hud-sec-icon" viewBox="0 0 24 24"><polyline points="16 18 22 12 16 6" fill="none" stroke="#00c8ff" stroke-width="2"/><polyline points="8 6 2 12 8 18" fill="none" stroke="#00c8ff" stroke-width="2"/></svg>
            <h2>Developer Tasks Data</h2>
          </div>

          <!-- Week Navigation Toolbar on Weekly Status Screen -->
          <div class="week-nav-toolbar">
            <button class="week-nav-arrow-btn" type="button" (click)="navigateWeek(-1)" title="Previous Week">‹ Prev</button>
            <div class="week-nav-pill">
              <span class="week-pill-icon">📅</span>
              <span class="week-pill-text">{{ getCurrentPeriodLabel() }}</span>
            </div>
            <button class="week-nav-arrow-btn" type="button" (click)="navigateWeek(1)" title="Next Week">Next ›</button>
            <button *ngIf="currentPeriodSelection !== 'all'" class="week-nav-toggle-btn" type="button" (click)="onWeekNavSelect('all')" title="Show All Weeks">All Weeks</button>
            <button *ngIf="currentPeriodSelection === 'all'" class="week-nav-toggle-btn active" type="button" (click)="onWeekNavSelect('W2')" title="Show Current Week">Current Week</button>
          </div>

          <div class="table-actions">
            <!-- Column Visibility Picker -->
            <div class="col-picker-wrap">
              <button class="btn-table secondary" type="button" (click)="toggleTaskColPicker($event)" title="Choose Visible Columns">
                ⚙️ Columns
              </button>
              <div class="col-picker-dropdown" *ngIf="showTaskColPicker" (click)="$event.stopPropagation()">
                <div class="col-picker-header">
                  <span>Columns to Display</span>
                  <div class="col-picker-header-btns">
                    <button type="button" class="col-btn-mini" (click)="selectAllTaskColumns(true)">All</button>
                    <button type="button" class="col-btn-mini" (click)="resetTaskColumns()">Reset</button>
                  </div>
                </div>
                <div class="col-picker-list">
                  <label *ngFor="let col of taskColumnDefs" class="col-checkbox-label">
                    <input type="checkbox" [checked]="isTaskColVisible(col.key)" (change)="toggleTaskColumn(col.key)">
                    <span>{{ col.label }}</span>
                  </label>
                </div>
              </div>
            </div>

            <button class="btn-table" type="button" (click)="openTaskModal()">Add Task</button>
            <button class="btn-table secondary" type="button" (click)="toggleHiddenTaskRows()">
              {{ showHiddenTaskRows ? 'Hide Hidden Rows' : 'Show Hidden Rows' }}
            </button>
            <button class="btn-table secondary" *ngIf="hasAnyTaskFilter" type="button" (click)="clearAllTaskFilters()" title="Clear all column filters">
              ✕ Clear Filters
            </button>
            <button class="btn-table secondary" type="button" (click)="toggleSection('tasks')">{{ sections.tasks ? 'Collapse' : 'Expand' }}</button>
          </div>
        </div>
        @if (sections.tasks) {
        <div class="table-responsive">
          <table>
            <thead>
              <tr>
                <th *ngIf="isTaskColVisible('taskId')">Task ID</th>
                <th *ngIf="isTaskColVisible('week')">Week</th>
                <th *ngIf="isTaskColVisible('resourceName')" class="th-filterable">
                  Resource
                  <app-column-filter
                    columnLabel="Resource"
                    [options]="getTaskColOptions((rawTasks$ | async) || [], 'resourceName')"
                    [selectedValues]="activeTaskFilterResource"
                    (filterChange)="onTaskColFilterChange('resource', $event)"
                  ></app-column-filter>
                </th>
                <th *ngIf="isTaskColVisible('projectName')" class="th-filterable">
                  Project
                  <app-column-filter
                    columnLabel="Project"
                    [options]="getTaskColOptions((rawTasks$ | async) || [], 'projectName')"
                    [selectedValues]="activeTaskFilterProject"
                    (filterChange)="onTaskColFilterChange('project', $event)"
                  ></app-column-filter>
                </th>
                <th *ngIf="isTaskColVisible('module')" class="th-filterable">
                  Module
                  <app-column-filter
                    columnLabel="Module"
                    [options]="getTaskColOptions((rawTasks$ | async) || [], 'module')"
                    [selectedValues]="activeTaskFilterModule"
                    (filterChange)="onTaskColFilterChange('module', $event)"
                  ></app-column-filter>
                </th>
                <th *ngIf="isTaskColVisible('taskTitle')">Title</th>
                <th *ngIf="isTaskColVisible('taskType')" class="th-filterable">
                  Type
                  <app-column-filter
                    columnLabel="Task Type"
                    [options]="getTaskColOptions((rawTasks$ | async) || [], 'taskType')"
                    [selectedValues]="activeTaskFilterType"
                    (filterChange)="onTaskColFilterChange('taskType', $event)"
                  ></app-column-filter>
                </th>
                <th *ngIf="isTaskColVisible('status')" class="th-filterable">
                  Status
                  <app-column-filter
                    columnLabel="Status"
                    [options]="getTaskColOptions((rawTasks$ | async) || [], 'status')"
                    [selectedValues]="activeTaskFilterStatus"
                    (filterChange)="onTaskColFilterChange('status', $event)"
                  ></app-column-filter>
                </th>
                <th *ngIf="isTaskColVisible('priority')" class="th-filterable">
                  Priority
                  <app-column-filter
                    columnLabel="Priority"
                    [options]="getTaskColOptions((rawTasks$ | async) || [], 'priority')"
                    [selectedValues]="activeTaskFilterPriority"
                    (filterChange)="onTaskColFilterChange('priority', $event)"
                  ></app-column-filter>
                </th>
                <th *ngIf="isTaskColVisible('size')">Size</th>
                <th *ngIf="isTaskColVisible('hours')">Hours</th>
                <th *ngIf="isTaskColVisible('progress')">Progress</th>
                <th *ngIf="isTaskColVisible('startDate')">Start Date</th>
                <th *ngIf="isTaskColVisible('dueDate')">Due Date</th>
                <th *ngIf="isTaskColVisible('isVisible')">Visibility</th>
                <th *ngIf="isTaskColVisible('actions')">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let task of filteredTasks$ | async" [class.hidden-row]="!(task.isVisible ?? true)">
                @if (editingTaskId === task.taskId) {
                <td *ngIf="isTaskColVisible('taskId')">{{ task.taskId }}</td>
                <td *ngIf="isTaskColVisible('week')"><input class="table-input small-input" [(ngModel)]="inlineTaskForm.week"></td>
                <td *ngIf="isTaskColVisible('resourceName')">
                  <app-combobox
                    [options]="(uniqueResources$ | async) || []"
                    [(ngModel)]="inlineTaskForm.resourceName"
                    name="inlineResource"
                    placeholder="Resource name"
                  ></app-combobox>
                </td>
                <td *ngIf="isTaskColVisible('projectName')">
                  <app-combobox
                    [options]="(uniqueProjects$ | async) || []"
                    [(ngModel)]="inlineTaskForm.projectName"
                    name="inlineProject"
                    placeholder="Project name"
                  ></app-combobox>
                </td>
                <td *ngIf="isTaskColVisible('module')">
                  <app-combobox
                    [options]="getTaskFieldValues((rawTasks$ | async) || [], 'module')"
                    [(ngModel)]="inlineTaskForm.module"
                    name="inlineModule"
                    placeholder="Module"
                  ></app-combobox>
                </td>
                <td *ngIf="isTaskColVisible('taskTitle')"><input class="table-input" [(ngModel)]="inlineTaskForm.taskTitle"></td>
                <td *ngIf="isTaskColVisible('taskType')">
                  <app-combobox
                    [options]="getTaskFieldValues((rawTasks$ | async) || [], 'taskType')"
                    [(ngModel)]="inlineTaskForm.taskType"
                    name="inlineTaskType"
                    placeholder="Task type"
                  ></app-combobox>
                </td>
                <td *ngIf="isTaskColVisible('status')">
                  <select class="table-input" [(ngModel)]="inlineTaskForm.status">
                    <option *ngFor="let status of taskStatuses" [value]="status">{{ status }}</option>
                  </select>
                </td>
                <td *ngIf="isTaskColVisible('priority')">
                  <select class="table-input" [(ngModel)]="inlineTaskForm.priority">
                    <option *ngFor="let priority of priorities" [value]="priority">{{ priority }}</option>
                  </select>
                </td>
                <td *ngIf="isTaskColVisible('size')"><input class="table-input small-input" [(ngModel)]="inlineTaskForm.size"></td>
                <td *ngIf="isTaskColVisible('hours')"><input class="table-input small-input" type="number" min="0" max="999" [(ngModel)]="inlineTaskForm.hours"></td>
                <td *ngIf="isTaskColVisible('progress')"><input class="table-input small-input" type="number" min="0" max="100" [(ngModel)]="inlineTaskForm.progress"></td>
                <td *ngIf="isTaskColVisible('startDate')"><input class="table-input" type="date" [(ngModel)]="inlineTaskForm.startDate"></td>
                <td *ngIf="isTaskColVisible('dueDate')"><input class="table-input" type="date" [(ngModel)]="inlineTaskForm.dueDate"></td>
                <td *ngIf="isTaskColVisible('isVisible')">{{ task.isVisible ?? true ? 'Shown' : 'Hidden' }}</td>
                <td *ngIf="isTaskColVisible('actions')">
                  <div class="inline-actions">
                    <button class="row-button save" type="button" (click)="saveInlineTask()">Save</button>
                    <button class="row-button" type="button" (click)="cancelInlineTaskEdit()">Cancel</button>
                  </div>
                </td>
                } @else {
                <td *ngIf="isTaskColVisible('taskId')">{{ task.taskId }}</td>
                <td *ngIf="isTaskColVisible('week')">{{ task.week }}</td>
                <td *ngIf="isTaskColVisible('resourceName')"><strong>{{ task.resourceName }}</strong></td>
                <td *ngIf="isTaskColVisible('projectName')">{{ task.projectName }}</td>
                <td *ngIf="isTaskColVisible('module')">{{ task.module }}</td>
                <td *ngIf="isTaskColVisible('taskTitle')">{{ task.taskTitle }}</td>
                <td *ngIf="isTaskColVisible('taskType')"><span class="type-tag">{{ task.taskType }}</span></td>
                <td *ngIf="isTaskColVisible('status')"><span class="status-tag" [ngClass]="task.status.replace(' ', '') | lowercase">{{ task.status }}</span></td>
                <td *ngIf="isTaskColVisible('priority')"><span class="priority-tag" [ngClass]="task.priority | lowercase">{{ task.priority }}</span></td>
                <td *ngIf="isTaskColVisible('size')">{{ task.size }}</td>
                <td *ngIf="isTaskColVisible('hours')"><span class="hours-badge">{{ task.hours ?? 0 }} hrs</span></td>
                <td *ngIf="isTaskColVisible('progress')">
                  <div class="progress-cell">
                    <div class="bar-bg"><div class="bar-fill" [style.width.%]="task.progress"></div></div>
                    <span>{{ task.progress }}%</span>
                  </div>
                </td>
                <td *ngIf="isTaskColVisible('startDate')">{{ formatAppDate(task.startDate) }}</td>
                <td *ngIf="isTaskColVisible('dueDate')">{{ formatAppDate(task.dueDate) }}</td>
                <td *ngIf="isTaskColVisible('isVisible')">{{ task.isVisible ?? true ? 'Shown' : 'Hidden' }}</td>
                <td *ngIf="isTaskColVisible('actions')">
                  <div class="inline-actions">
                    <button class="row-button" type="button" (click)="startInlineTaskEdit(task)">Edit</button>
                    <button class="row-button" type="button" (click)="toggleTaskVisibility(task.taskId)">{{ task.isVisible ?? true ? 'Hide' : 'Show' }}</button>
                    <button class="row-button danger" type="button" (click)="confirmDeleteTask(task)">Delete</button>
                  </div>
                </td>
                }
              </tr>
              <tr *ngIf="(filteredTasks$ | async)?.length === 0">
                <td [attr.colspan]="getVisibleTaskColCount()" class="text-center">No task records found.</td>
              </tr>
            </tbody>
          </table>
        </div>
        }
      </div>
      }

      <!-- Data Table Section (Release Tracks) -->
      @if (activeView === 'project-status') {
      <div class="glass-card table-section">
        <div class="table-header">
          <div class="hud-header-title">
            <svg *ngIf="themeService.isJarvis()" class="hud-sec-icon" viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" fill="none" stroke="#00c8ff" stroke-width="2"/></svg>
            <h2>Release Tracks Data</h2>
          </div>
          <div class="table-actions">
            <!-- Column Visibility Picker -->
            <div class="col-picker-wrap">
              <button class="btn-table secondary" type="button" (click)="toggleReleaseColPicker($event)" title="Choose Visible Columns">
                ⚙️ Columns
              </button>
              <div class="col-picker-dropdown" *ngIf="showReleaseColPicker" (click)="$event.stopPropagation()">
                <div class="col-picker-header">
                  <span>Columns to Display</span>
                  <div class="col-picker-header-btns">
                    <button type="button" class="col-btn-mini" (click)="selectAllReleaseColumns(true)">All</button>
                    <button type="button" class="col-btn-mini" (click)="resetReleaseColumns()">Reset</button>
                  </div>
                </div>
                <div class="col-picker-list">
                  <label *ngFor="let col of releaseColumnDefs" class="col-checkbox-label">
                    <input type="checkbox" [checked]="isReleaseColVisible(col.key)" (change)="toggleReleaseColumn(col.key)">
                    <span>{{ col.label }}</span>
                  </label>
                </div>
              </div>
            </div>

            <button class="btn-table" type="button" (click)="openReleaseModal()">Add Release</button>
            <button class="btn-table secondary" type="button" (click)="toggleHiddenReleaseRows()">
              {{ showHiddenReleaseRows ? 'Hide Hidden Rows' : 'Show Hidden Rows' }}
            </button>
            <button class="btn-table secondary" *ngIf="hasAnyReleaseFilter" type="button" (click)="clearAllReleaseFilters()" title="Clear all column filters">
              ✕ Clear Filters
            </button>
            <button class="btn-table secondary" type="button" (click)="toggleSection('releases')">{{ sections.releases ? 'Collapse' : 'Expand' }}</button>
          </div>
        </div>
        @if (sections.releases) {
        <div class="table-responsive">
          <table>
            <thead>
              <tr>
                <th *ngIf="isReleaseColVisible('id')">ID</th>
                <th *ngIf="isReleaseColVisible('title')">Title</th>
                <th *ngIf="isReleaseColVisible('category')" class="th-filterable">
                  Category
                  <app-column-filter
                    columnLabel="Category"
                    [options]="getReleaseColOptions((rawReleases$ | async) || [], 'category')"
                    [selectedValues]="activeRelFilterCategory"
                    (filterChange)="onRelColFilterChange('category', $event)"
                  ></app-column-filter>
                </th>
                <th *ngIf="isReleaseColVisible('module')" class="th-filterable">
                  Module
                  <app-column-filter
                    columnLabel="Module"
                    [options]="getReleaseColOptions((rawReleases$ | async) || [], 'module')"
                    [selectedValues]="activeRelFilterModule"
                    (filterChange)="onRelColFilterChange('module', $event)"
                  ></app-column-filter>
                </th>
                <th *ngIf="isReleaseColVisible('environment')" class="th-filterable">
                  Current Environment
                  <app-column-filter
                    columnLabel="Environment"
                    [options]="getReleaseColOptions((rawReleases$ | async) || [], 'environment')"
                    [selectedValues]="activeRelFilterEnvironment"
                    (filterChange)="onRelColFilterChange('environment', $event)"
                  ></app-column-filter>
                </th>
                <th *ngIf="isReleaseColVisible('priority')" class="th-filterable">
                  Priority
                  <app-column-filter
                    columnLabel="Priority"
                    [options]="getReleaseColOptions((rawReleases$ | async) || [], 'priority')"
                    [selectedValues]="activeRelFilterPriority"
                    (filterChange)="onRelColFilterChange('priority', $event)"
                  ></app-column-filter>
                </th>
                <th *ngIf="isReleaseColVisible('status')" class="th-filterable">
                  Status
                  <app-column-filter
                    columnLabel="Status"
                    [options]="getReleaseColOptions((rawReleases$ | async) || [], 'status')"
                    [selectedValues]="activeRelFilterStatus"
                    (filterChange)="onRelColFilterChange('status', $event)"
                  ></app-column-filter>
                </th>
                <th *ngIf="isReleaseColVisible('prdStatus')" class="th-filterable">
                  PRD Status
                  <app-column-filter
                    columnLabel="PRD Status"
                    [options]="getReleaseColOptions((rawReleases$ | async) || [], 'prdStatus')"
                    [selectedValues]="activeRelFilterPrdStatus"
                    (filterChange)="onRelColFilterChange('prdStatus', $event)"
                  ></app-column-filter>
                </th>
                <th *ngIf="isReleaseColVisible('assignedTo')" class="th-filterable">
                  Assigned To
                  <app-column-filter
                    columnLabel="Assigned To"
                    [options]="getReleaseColOptions((rawReleases$ | async) || [], 'assignedTo')"
                    [selectedValues]="activeRelFilterAssigned"
                    (filterChange)="onRelColFilterChange('assigned', $event)"
                  ></app-column-filter>
                </th>
                <th *ngIf="isReleaseColVisible('progress')">Progress</th>
                <th *ngIf="isReleaseColVisible('targetDate')">Target Date</th>
                <th *ngIf="isReleaseColVisible('completedDate')">Completed Date</th>
                <th *ngIf="isReleaseColVisible('isVisible')">Visibility</th>
                <th *ngIf="isReleaseColVisible('actions')">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let release of filteredReleases$ | async" [class.hidden-row]="!(release.isVisible ?? true)">
                @if (editingReleaseId === release.id) {
                <td *ngIf="isReleaseColVisible('id')">{{ release.id }}</td>
                <td *ngIf="isReleaseColVisible('title')"><input class="table-input" [(ngModel)]="inlineReleaseForm.title"></td>
                <td *ngIf="isReleaseColVisible('category')">
                  <app-combobox
                    [options]="getReleaseFieldValues((rawReleases$ | async) || [], 'category')"
                    [(ngModel)]="inlineReleaseForm.category"
                    name="inlineRelCategory"
                    placeholder="Category"
                  ></app-combobox>
                </td>
                <td *ngIf="isReleaseColVisible('module')">
                  <app-combobox
                    [options]="getReleaseFieldValues((rawReleases$ | async) || [], 'module')"
                    [(ngModel)]="inlineReleaseForm.module"
                    name="inlineRelModule"
                    placeholder="Module"
                  ></app-combobox>
                </td>
                <td *ngIf="isReleaseColVisible('environment')">
                  <select class="table-input" [(ngModel)]="inlineReleaseForm.environment">
                    <option *ngFor="let env of environmentOptions" [value]="env">{{ env }}</option>
                  </select>
                </td>
                <td *ngIf="isReleaseColVisible('priority')">
                  <select class="table-input" [(ngModel)]="inlineReleaseForm.priority">
                    <option *ngFor="let priority of priorities" [value]="priority">{{ priority }}</option>
                  </select>
                </td>
                <td *ngIf="isReleaseColVisible('status')">
                  <select class="table-input" [(ngModel)]="inlineReleaseForm.status">
                    <option *ngFor="let status of releaseStatuses" [value]="status">{{ status }}</option>
                  </select>
                </td>
                <td *ngIf="isReleaseColVisible('prdStatus')">
                  <select class="table-input" [(ngModel)]="inlineReleaseForm.prdStatus">
                    <option *ngFor="let status of prdStatuses" [value]="status">{{ status }}</option>
                  </select>
                </td>
                <td *ngIf="isReleaseColVisible('assignedTo')">
                  <app-combobox
                    [options]="getReleaseFieldValues((rawReleases$ | async) || [], 'assignedTo')"
                    [(ngModel)]="inlineReleaseForm.assignedTo"
                    name="inlineRelAssigned"
                    placeholder="Assigned to"
                  ></app-combobox>
                </td>
                <td *ngIf="isReleaseColVisible('progress')"><input class="table-input small-input" type="number" min="0" max="100" [(ngModel)]="inlineReleaseForm.progress"></td>
                <td *ngIf="isReleaseColVisible('targetDate')"><input class="table-input" type="date" [(ngModel)]="inlineReleaseForm.targetDate"></td>
                <td *ngIf="isReleaseColVisible('completedDate')"><input class="table-input" type="date" [(ngModel)]="inlineReleaseForm.completedDate"></td>
                <td *ngIf="isReleaseColVisible('isVisible')">{{ release.isVisible ?? true ? 'Shown' : 'Hidden' }}</td>
                <td *ngIf="isReleaseColVisible('actions')">
                  <div class="inline-actions">
                    <button class="row-button save" type="button" (click)="saveInlineRelease()">Save</button>
                    <button class="row-button" type="button" (click)="cancelInlineReleaseEdit()">Cancel</button>
                  </div>
                </td>
                } @else {
                <td *ngIf="isReleaseColVisible('id')">{{ release.id }}</td>
                <td *ngIf="isReleaseColVisible('title')"><strong>{{ release.title }}</strong></td>
                <td *ngIf="isReleaseColVisible('category')">{{ release.category }}</td>
                <td *ngIf="isReleaseColVisible('module')">{{ release.module }}</td>
                <td *ngIf="isReleaseColVisible('environment')">
                  <span class="env-badge" [attr.data-env]="release.environment | lowercase">{{ release.environment || 'Dev' }}</span>
                </td>
                <td *ngIf="isReleaseColVisible('priority')"><span class="priority-tag" [ngClass]="release.priority | lowercase">{{ release.priority }}</span></td>
                <td *ngIf="isReleaseColVisible('status')"><span class="stage-badge" [attr.data-stage]="release.status | lowercase">{{ release.status }}</span></td>
                <td *ngIf="isReleaseColVisible('prdStatus')"><span class="type-tag">{{ release.prdStatus }}</span></td>
                <td *ngIf="isReleaseColVisible('assignedTo')">{{ release.assignedTo }}</td>
                <td *ngIf="isReleaseColVisible('progress')">
                  <div class="progress-cell">
                    <div class="bar-bg"><div class="bar-fill" [style.width.%]="release.progress"></div></div>
                    <span>{{ release.progress }}%</span>
                  </div>
                </td>
                <td *ngIf="isReleaseColVisible('targetDate')">{{ formatAppDate(release.targetDate) }}</td>
                <td *ngIf="isReleaseColVisible('completedDate')">{{ formatAppDate(release.completedDate) }}</td>
                <td *ngIf="isReleaseColVisible('isVisible')">{{ release.isVisible ?? true ? 'Shown' : 'Hidden' }}</td>
                <td *ngIf="isReleaseColVisible('actions')">
                  <div class="inline-actions">
                    <button class="row-button" type="button" (click)="startInlineReleaseEdit(release)">Edit</button>
                    <button class="row-button" type="button" (click)="toggleReleaseVisibility(release.id)">{{ release.isVisible ?? true ? 'Hide' : 'Show' }}</button>
                    <button class="row-button danger" type="button" (click)="confirmDeleteRelease(release)">Delete</button>
                  </div>
                </td>
                }
              </tr>
              <tr *ngIf="(filteredReleases$ | async)?.length === 0">
                <td [attr.colspan]="getVisibleReleaseColCount()" class="text-center">No release records found.</td>
              </tr>
            </tbody>
          </table>
        </div>
        }
      </div>
      }

      @if (showHourlyModal) {
        <div class="modal-backdrop" role="presentation" (click)="closeHourlyModal()">
          <section class="modal-panel" role="dialog" aria-modal="true" aria-labelledby="hourlyModalTitle" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h2 id="hourlyModalTitle">Add Hourly Update</h2>
              <button class="modal-close" type="button" (click)="closeHourlyModal()" aria-label="Close add hourly update popup">x</button>
            </div>

            <form class="modal-form" #hourlyModalForm="ngForm" (ngSubmit)="saveHourlyFromModal(hourlyModalForm.valid ?? false)">
              <label>
                Date
                <input type="date" name="newHourlyDate" [(ngModel)]="newHourlyForm.date" required>
              </label>
              <label>
                Time / Hour
                <input type="time" name="newHourlyHour" [(ngModel)]="newHourlyForm.hour" required>
              </label>
              <label>
                Status
                <select name="newHourlyStatus" [(ngModel)]="newHourlyForm.status" required>
                  <option *ngFor="let status of hourlyStatuses" [value]="status">{{ status }}</option>
                </select>
              </label>
              <label class="modal-wide">
                Task Description
                <textarea rows="4" name="newHourlyDescription" [(ngModel)]="newHourlyForm.taskDescription" required></textarea>
              </label>
              <p class="validation-message" *ngIf="modalSubmitted && !hourlyModalForm.valid">
                Date, time, task description, and status are required.
              </p>
              <div class="modal-actions">
                <button class="btn-table secondary" type="button" (click)="closeHourlyModal()">Cancel</button>
                <button class="btn-table" type="submit">Add Update</button>
              </div>
            </form>
          </section>
        </div>
      }

      @if (showTaskModal) {
        <div class="modal-backdrop" role="presentation" (click)="closeTaskModal()">
          <section class="modal-panel wide-modal" role="dialog" aria-modal="true" aria-labelledby="taskModalTitle" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h2 id="taskModalTitle">Add Developer Task</h2>
              <button class="modal-close" type="button" (click)="closeTaskModal()" aria-label="Close add task popup">x</button>
            </div>
            <form class="modal-form" #taskModalForm="ngForm" (ngSubmit)="saveTaskFromModal(taskModalForm.valid ?? false)">
              <label>Week <input name="newTaskWeek" [(ngModel)]="newTaskForm.week"></label>
              <label>Resource <input name="newTaskResource" [(ngModel)]="newTaskForm.resourceName" required></label>
              <label>Project <input name="newTaskProject" [(ngModel)]="newTaskForm.projectName" required></label>
              <label>Module <input name="newTaskModule" [(ngModel)]="newTaskForm.module" required></label>
              <label class="modal-wide">Title <input name="newTaskTitle" [(ngModel)]="newTaskForm.taskTitle" required></label>
              <label>Type <input name="newTaskType" [(ngModel)]="newTaskForm.taskType" required></label>
              <label>Status
                <select name="newTaskStatus" [(ngModel)]="newTaskForm.status" required>
                  <option *ngFor="let status of taskStatuses" [value]="status">{{ status }}</option>
                </select>
              </label>
              <label>Priority
                <select name="newTaskPriority" [(ngModel)]="newTaskForm.priority" required>
                  <option *ngFor="let priority of priorities" [value]="priority">{{ priority }}</option>
                </select>
              </label>
              <label>Size <input name="newTaskSize" [(ngModel)]="newTaskForm.size"></label>
              <label>Hours <input type="number" min="0" max="999" name="newTaskHours" [(ngModel)]="newTaskForm.hours"></label>
              <label>Progress <input type="number" min="0" max="100" name="newTaskProgress" [(ngModel)]="newTaskForm.progress" required></label>
              <label>Start Date <input type="date" name="newTaskStart" [(ngModel)]="newTaskForm.startDate" required></label>
              <label>Due Date <input type="date" name="newTaskDue" [(ngModel)]="newTaskForm.dueDate" required></label>
              <label class="modal-wide">Description <textarea rows="3" name="newTaskDescription" [(ngModel)]="newTaskForm.taskDescription" required></textarea></label>
              <p class="validation-message" *ngIf="modalSubmitted && !taskModalForm.valid">Fill the required task fields.</p>
              <div class="modal-actions">
                <button class="btn-table secondary" type="button" (click)="closeTaskModal()">Cancel</button>
                <button class="btn-table" type="submit">Add Task</button>
              </div>
            </form>
          </section>
        </div>
      }

      @if (showReleaseModal) {
        <div class="modal-backdrop" role="presentation" (click)="closeReleaseModal()">
          <section class="modal-panel wide-modal" role="dialog" aria-modal="true" aria-labelledby="releaseModalTitle" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h2 id="releaseModalTitle">Add Release Track</h2>
              <button class="modal-close" type="button" (click)="closeReleaseModal()" aria-label="Close add release popup">x</button>
            </div>
            <form class="modal-form" #releaseModalForm="ngForm" (ngSubmit)="saveReleaseFromModal(releaseModalForm.valid ?? false)">
              <label class="modal-wide">Title <input name="newReleaseTitle" [(ngModel)]="newReleaseForm.title" required></label>
              <label>Category <input name="newReleaseCategory" [(ngModel)]="newReleaseForm.category" required></label>
              <label>Module <input name="newReleaseModule" [(ngModel)]="newReleaseForm.module" required></label>
              <label>Current Environment
                <select name="newReleaseEnvironment" [(ngModel)]="newReleaseForm.environment" required>
                  <option *ngFor="let env of environmentOptions" [value]="env">{{ env }}</option>
                </select>
              </label>
              <label>Type <input name="newReleaseType" [(ngModel)]="newReleaseForm.type" required></label>
              <label>Priority
                <select name="newReleasePriority" [(ngModel)]="newReleaseForm.priority" required>
                  <option *ngFor="let priority of priorities" [value]="priority">{{ priority }}</option>
                </select>
              </label>
              <label>Status
                <select name="newReleaseStatus" [(ngModel)]="newReleaseForm.status" required>
                  <option *ngFor="let status of releaseStatuses" [value]="status">{{ status }}</option>
                </select>
              </label>
              <label>PRD Status
                <select name="newReleasePrdStatus" [(ngModel)]="newReleaseForm.prdStatus" required>
                  <option *ngFor="let status of prdStatuses" [value]="status">{{ status }}</option>
                </select>
              </label>
              <label>Assigned To <input name="newReleaseAssigned" [(ngModel)]="newReleaseForm.assignedTo" required></label>
              <label>Progress <input type="number" min="0" max="100" name="newReleaseProgress" [(ngModel)]="newReleaseForm.progress" required></label>
              <label>Target Date <input type="date" name="newReleaseTarget" [(ngModel)]="newReleaseForm.targetDate" required></label>
              <label>Completed Date <input type="date" name="newReleaseCompleted" [(ngModel)]="newReleaseForm.completedDate"></label>
              <label class="modal-wide">Remarks <textarea rows="3" name="newReleaseRemarks" [(ngModel)]="newReleaseForm.remarks"></textarea></label>
              <p class="validation-message" *ngIf="modalSubmitted && !releaseModalForm.valid">Fill the required release fields.</p>
              <div class="modal-actions">
                <button class="btn-table secondary" type="button" (click)="closeReleaseModal()">Cancel</button>
                <button class="btn-table" type="submit">Add Release</button>
              </div>
            </form>
          </section>
        </div>
      }

      @if (deleteCandidate) {
        <div class="modal-backdrop" role="presentation" (click)="cancelDelete()">
          <section class="modal-panel confirm-panel" role="dialog" aria-modal="true" aria-labelledby="deleteTitle" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h2 id="deleteTitle">Delete {{ getDeleteLabel() }}</h2>
              <button class="modal-close" type="button" (click)="cancelDelete()" aria-label="Close delete confirmation">x</button>
            </div>
            <p class="confirm-copy">
              Delete {{ getDeleteName() }}? This cannot be undone.
            </p>
            <div class="modal-actions">
              <button class="btn-table secondary" type="button" (click)="cancelDelete()">Cancel</button>
              <button class="btn-table danger" type="button" (click)="deleteConfirmed()">Delete</button>
            </div>
          </section>
        </div>
      }

      @if (activeHourlyReminderPopup) {
        <div class="reminder-popup-backdrop" role="presentation">
          <section class="reminder-popup" role="alertdialog" aria-modal="true" aria-labelledby="reminderPopupTitle">
            <div class="reminder-popup-header">
              <h2 id="reminderPopupTitle">Hourly Update Reminder</h2>
              <button class="modal-close" type="button" (click)="closeHourlyReminderPopup()" aria-label="Close reminder popup">x</button>
            </div>
            <div class="reminder-popup-body">
              <p class="reminder-time">{{ activeHourlyReminderPopup.hour }}</p>
              <div class="reminder-detail">
                <span>Task Description</span>
                <strong>{{ activeHourlyReminderPopup.taskDescription }}</strong>
              </div>
              <div class="reminder-detail">
                <span>Status</span>
                <strong>{{ activeHourlyReminderPopup.status }}</strong>
              </div>
            </div>
            <div class="modal-actions">
              <button class="btn-table" type="button" (click)="closeHourlyReminderPopup()">Close</button>
            </div>
          </section>
        </div>
      }

      <!-- ── DB RESET CONFIRMATION DIALOG ── -->
      @if (showResetConfirmDialog) {
      <div class="wt-reset-backdrop" role="presentation" (click)="cancelReset()">
        <section
          id="wt-reset-confirm-dialog"
          class="wt-reset-dialog"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="wtResetDialogTitle"
          (click)="$event.stopPropagation()"
        >
          <!-- Header -->
          <div class="wt-reset-dialog-header">
            <div class="wt-reset-icon-ring">
              <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
            <h2 id="wtResetDialogTitle" class="wt-reset-dialog-title">Reset Work Tracker Data?</h2>
            <button class="wt-reset-close-btn" type="button" (click)="cancelReset()" aria-label="Close">✕</button>
          </div>

          <!-- Warning body -->
          <div class="wt-reset-dialog-body">
            <div class="wt-reset-warning-banner">
              ⚠️ <strong>This action cannot be undone.</strong>
            </div>
            <p class="wt-reset-desc">This will permanently delete <strong>all Work Tracker data</strong> for your account, including:</p>
            <ul class="wt-reset-list">
              <li>📋 All developer tasks &amp; weekly status records</li>
              <li>🚀 All project / release track entries</li>
              <li>⏱️ All hourly work logs</li>
              <li>📅 Day Work schedules, leave days &amp; slot history</li>
              <li>🔔 Overdue-reminder and tracking-mode preferences</li>
            </ul>
            <p class="wt-reset-safe-note">
              ✅ <strong>Preserved:</strong> Application settings, your account, theme, and all other U2Tools module data.
            </p>

            <!-- Confirmation input -->
            <div class="wt-reset-confirm-input-wrap">
              <label class="wt-reset-confirm-label" for="wtResetConfirmInput">
                Type <strong>RESET</strong> to confirm:
              </label>
              <input
                id="wtResetConfirmInput"
                class="wt-reset-confirm-input"
                type="text"
                [(ngModel)]="resetConfirmText"
                placeholder="Type RESET here"
                autocomplete="off"
                [class.valid]="(resetConfirmText || '').trim().toUpperCase() === 'RESET'"
              />
            </div>

            <!-- Result message -->
            <div
              *ngIf="resetMessage"
              class="wt-reset-result-msg"
              [class.success]="resetMessageType === 'success'"
              [class.error]="resetMessageType === 'error'"
            >
              {{ resetMessage }}
            </div>
          </div>

          <!-- Footer actions -->
          <div class="wt-reset-dialog-footer">
            <button
              id="wt-reset-cancel-btn"
              class="wt-reset-cancel-btn"
              type="button"
              (click)="cancelReset()"
              [disabled]="isResetting"
            >
              Cancel
            </button>
            <button
              id="wt-reset-confirm-btn"
              class="wt-reset-confirm-btn"
              type="button"
              (click)="confirmReset()"
              [disabled]="isResetting || (resetConfirmText || '').trim().toUpperCase() !== 'RESET'"
            >
              <span *ngIf="!isResetting">🗑️ Delete All Data</span>
              <span *ngIf="isResetting">⏳ Resetting…</span>
            </button>
          </div>
        </section>
      </div>
      }

    </div>
  `,
  styles: [`
    .dashboard-container {
      display: flex;
      flex-direction: column;
      gap: 2rem;
    }

    .dashboard-controls {
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
      flex-wrap: wrap;
    }

    .section-shell {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .compact-header {
      margin-bottom: 0.5rem;
    }

    .dashboard-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
      gap: 2rem;
    }

    .chart-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 1.5rem;
    }

    .chart-card {
      min-height: 260px;
      padding: 0.5rem;
      background: rgba(255,255,255,0.45);
      border: 1px solid rgba(255,255,255,0.35);
      border-radius: 12px;
    }

    .chart-card h3 {
      margin-bottom: 0.5rem;
      font-size: 1rem;
    }

    .bar-chart {
      display: flex;
      align-items: end;
      gap: 1rem;
      min-height: 185px;
      overflow-x: auto;
      padding: 0.5rem;
    }

    .bar-item {
      display: grid;
      grid-template-rows: 1fr auto auto;
      justify-items: center;
      gap: 0.35rem;
      min-width: 52px;
      height: 175px;
      color: #4a5568;
      font-size: 0.78rem;
      font-weight: 700;
    }

    .bar-track {
      display: flex;
      align-items: flex-end;
      width: 28px;
      height: 120px;
      border-radius: 8px;
      background: rgba(0,0,0,0.06);
      overflow: hidden;
    }

    .bar-value {
      width: 100%;
      background: linear-gradient(180deg, #4facfe 0%, #00f2fe 100%);
      border-radius: 8px 8px 0 0;
      transition: height 0.4s ease;
    }

    .pie-layout {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      align-items: center;
      gap: 1.25rem;
      min-height: 180px;
    }

    .pie-chart {
      width: 132px;
      aspect-ratio: 1;
      border-radius: 50%;
      box-shadow: inset 0 0 0 18px rgba(255,255,255,0.5), 0 10px 28px rgba(31, 38, 135, 0.12);
    }

    .legend {
      display: grid;
      gap: 0.75rem;
    }

    .legend-item {
      display: grid;
      grid-template-columns: auto 1fr auto;
      align-items: center;
      gap: 0.65rem;
      color: #4a5568;
      font-size: 0.9rem;
    }

    .legend-dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
    }

    .line-chart {
      width: 100%;
      min-height: 190px;
    }

    .axis {
      stroke: rgba(74, 85, 104, 0.24);
      stroke-width: 2;
    }

    .trend-line {
      fill: none;
      stroke: #4facfe;
      stroke-width: 4;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .trend-point {
      fill: #667eea;
      stroke: white;
      stroke-width: 2;
    }

    .axis-label {
      fill: #718096;
      font-size: 10px;
      text-anchor: middle;
      font-weight: 700;
    }

    .empty-svg {
      fill: #718096;
      font-size: 13px;
      text-anchor: middle;
      font-style: italic;
    }

    .glass-card {
      background: rgba(255, 255, 255, 0.4);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border-radius: 20px;
      padding: 0.5rem;
      border: 1px solid rgba(255, 255, 255, 0.3);
      box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.1);
      transition: transform 0.3s ease, box-shadow 0.3s ease;
    }
    .glass-card:hover {
      box-shadow: 0 12px 40px 0 rgba(31, 38, 135, 0.15);
    }
    
    h2, h3 {
      margin-top: 0.5rem;
      color: #1a202c;
      border-bottom: 2px solid rgba(0,0,0,0.05);
    }
    h2 {
      margin-bottom: 0.5rem;
      font-size: 1.5rem;
      padding-bottom: 0.5rem;
    }
    h3 {
      font-size: 1.2rem;
      margin-bottom: 0.5rem;
      padding-bottom: 0.5rem;
    }
    .margin-top-section {
      margin-top: 0.5rem;
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
      padding: 0.5rem;
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
      margin: 0.5rem;
      color: #2d3748;
    }
    .status-badge {
      font-size: 0.75rem;
      padding: 0.5rem;
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
      margin-bottom: 0.5rem;
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
      padding: 0.5rem;
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
      padding: 0.5rem;
      background: rgba(255,255,255,0.5);
      border-radius: 12px;
    }
    .release-header h4 {
      margin: 0.5rem;
      color: #2d3748;
    }
    .stage-badge {
      font-size: 0.75rem;
      padding: 0.5rem;
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
    .circular-chart { display: block; margin: 0.5rem; max-width: 80%; max-height: 250px; }
    .circle-bg { fill: none; stroke: rgba(0,0,0,0.05); stroke-width: 3.8; }
    .circle { fill: none; stroke-width: 2.8; stroke-linecap: round; animation: progress 1s ease-out forwards; }
    .percentage { fill: #4a5568; font-size: 0.5em; text-anchor: middle; font-weight: bold; }
    .stroke-red .circle { stroke: #fc8181; }
    .stroke-orange .circle { stroke: #f6ad55; }
    .stroke-blue .circle { stroke: #63b3ed; }
    .stroke-green .circle { stroke: #68d391; }

    /* Table Section */
    .table-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
      margin-bottom: 0.5rem;
    }

    .table-actions, .inline-actions, .modal-actions {
      display: flex;
      gap: 0.6rem;
      flex-wrap: wrap;
    }

    .voice-toggle {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      margin: 0.5rem;
      color: #4a5568;
      font-size: 0.85rem;
      font-weight: 700;
      white-space: nowrap;
    }

    .btn-table, .row-button {
      border: none;
      border-radius: 8px;
      font-family: inherit;
      font-weight: 700;
      cursor: pointer;
      background: #4a90e2;
      color: white;
    }

    .btn-table {
      padding: 0.5rem;
    }

    .row-button {
      padding: 0.5rem;
      font-size: 0.78rem;
    }

    .btn-table:hover, .row-button:hover {
      transform: translateY(-1px);
    }

    .btn-table.secondary, .row-button:not(.danger):not(.save) {
      background: rgba(255,255,255,0.76);
      color: #2b6cb0;
      border: 1px solid rgba(74, 144, 226, 0.24);
    }

    .btn-table.danger, .row-button.danger {
      background: #e53e3e;
    }

    .row-button.save {
      background: #38a169;
    }

    .hidden-row {
      opacity: 0.62;
      background: rgba(237, 242, 247, 0.62);
    }

    .description-cell {
      min-width: 260px;
      max-width: 520px;
      white-space: normal;
    }

    .table-input {
      width: 100%;
      min-width: 140px;
      padding: 0.5rem;
      border: 1px solid rgba(0,0,0,0.12);
      border-radius: 8px;
      background: rgba(255,255,255,0.82);
      color: #2d3748;
      font: inherit;
    }

    .table-textarea {
      min-width: 260px;
      resize: vertical;
      white-space: normal;
    }

    .small-input {
      min-width: 82px;
    }

    .table-input:focus {
      border-color: #4facfe;
    }

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
      padding: 0.5rem;
      text-align: left;
      font-size: 0.85rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #4a5568;
      font-weight: 600;
      border-bottom: 2px solid rgba(0,0,0,0.05);
    }
    td {
      padding: 0.5rem;
      color: #2d3748;
      border-bottom: 1px solid rgba(0,0,0,0.05);
      font-size: 0.9rem;
    }
    tbody tr:hover {
      background: rgba(255,255,255,0.8);
    }
    .text-center { text-align: center; color: #718096; font-style: italic; padding: 0.5rem; }

    /* Tags inside table */
    .type-tag, .status-tag, .priority-tag {
      padding: 0.5rem;
      border-radius: 6px;
      font-size: 0.75rem;
      font-weight: 600;
    }
    .type-tag { background: #edf2f7; color: #4a5568; }
    
    .status-tag.completed, .status-tag.released { background: #c6f6d5; color: #22543d; }
    .status-tag.inprogress { background: #feebc8; color: #7b341e; }
    .status-tag.pending { background: #e6fffa; color: #285e61; }
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

    .modal-backdrop {
      position: fixed;
      inset: 0;
      z-index: 1200;
      display: grid;
      place-items: center;
      padding: 0.5rem;
      background: rgba(26, 32, 44, 0.34);
    }

    .modal-panel {
      width: min(640px, 100%);
      max-height: 90vh;
      overflow: auto;
      padding: 0.5rem;
      border: 1px solid rgba(255,255,255,0.35);
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.92);
    }

    .confirm-panel {
      width: min(480px, 100%);
    }

    .wide-modal {
      width: min(860px, 100%);
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      margin-bottom: 0.5rem;
    }

    .modal-header h2 {
      margin: 0.5rem;
      border-bottom: 0;
    }

    .modal-close {
      width: 36px;
      height: 36px;
      border: 1px solid rgba(74, 144, 226, 0.24);
      border-radius: 8px;
      background: rgba(255,255,255,0.8);
      color: #2b6cb0;
      cursor: pointer;
      font-weight: 800;
    }

    .modal-form {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 1rem;
    }

    .modal-form label {
      display: flex;
      flex-direction: column;
      gap: 0.45rem;
      color: #4a5568;
      font-size: 0.82rem;
      font-weight: 700;
    }

    .modal-form input,
    .modal-form select,
    .modal-form textarea {
      width: 100%;
      padding: 0.5rem;
      border: 1px solid rgba(0,0,0,0.12);
      border-radius: 8px;
      background: rgba(255,255,255,0.82);
      color: #2d3748;
      font: inherit;
    }

    .modal-form input:focus,
    .modal-form select:focus,
    .modal-form textarea:focus {
      border-color: #4facfe;
    }

    .modal-wide, .validation-message, .modal-actions {
      grid-column: 1 / -1;
    }

    .validation-message {
      margin: 0.5rem;
      color: #822727;
      font-weight: 700;
    }

    .confirm-copy {
      margin: 0.5rem;
      color: #4a5568;
    }

    .reminder-popup-backdrop {
      position: fixed;
      inset: 0;
      z-index: 1300;
      display: grid;
      place-items: center;
      padding: 0.5rem;
      background: rgba(26, 32, 44, 0.48);
    }

    .reminder-popup {
      width: min(520px, 100%);
      padding: 0.5rem;
      border: 1px solid rgba(255,255,255,0.45);
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.96);
      box-shadow: 0 18px 48px rgba(31, 38, 135, 0.22);
    }

    .reminder-popup-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      margin-bottom: 0.5rem;
    }

    .reminder-popup-header h2 {
      margin: 0.5rem;
      border-bottom: 0;
    }

    .reminder-popup-body {
      display: grid;
      gap: 0.5rem;
    }

    .reminder-time {
      margin: 0.5rem;
      color: #2b6cb0;
      font-size: 0.95rem;
      font-weight: 800;
    }

    .reminder-detail {
      display: grid;
      gap: 0.35rem;
      padding: 0.5rem;
      border-radius: 8px;
      background: rgba(237, 242, 247, 0.82);
      color: #2d3748;
    }

    .reminder-detail span {
      color: #718096;
      font-size: 0.76rem;
      font-weight: 800;
      text-transform: uppercase;
    }

    .reminder-detail strong {
      white-space: normal;
    }

    @keyframes progress {
      0% { stroke-dasharray: 0 100; }
    }

    @media (max-width: 720px) {
      .dashboard-grid {
        grid-template-columns: 1fr;
      }

      .pie-layout {
        grid-template-columns: 1fr;
        justify-items: center;
      }

      .table-header, .table-actions, .modal-actions {
        align-items: stretch;
        flex-direction: column;
      }

      .btn-table {
        width: 100%;
      }
    }

    /* ─── Dashboard Root View Styles Matching Screenshot ─── */
    .dashboard-root-view {
      display: flex;
      flex-direction: column;
      gap: 16px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #1e293b;
    }

    .dash-top-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
      background: transparent;
      padding: 2px 0;
    }

    .dash-period-selector {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .period-mode-wrap {
      position: relative;
      display: flex;
      align-items: center;
    }

    .period-mode-select {
      appearance: none;
      -webkit-appearance: none;
      padding: 6px 28px 6px 12px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      font-size: 0.84rem;
      font-weight: 700;
      color: #1e293b;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
      cursor: pointer;
      outline: none;
      transition: all 0.15s;
    }

    .period-mode-select:hover {
      background: #f8fafc;
      border-color: #cbd5e1;
    }

    .date-range-pill-select-wrap {
      position: relative;
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 2px 10px 2px 12px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
      transition: all 0.15s;
    }

    .date-range-pill-select-wrap:hover {
      background: #f8fafc;
      border-color: #cbd5e1;
    }

    .period-item-select {
      appearance: none;
      -webkit-appearance: none;
      padding: 5px 18px 5px 4px;
      background: transparent;
      border: none;
      font-size: 0.84rem;
      font-weight: 600;
      color: #1e293b;
      cursor: pointer;
      outline: none;
    }

    /* Column Visibility Picker styles */
    .col-picker-wrap {
      position: relative;
      display: inline-block;
    }

    .col-picker-dropdown {
      position: absolute;
      top: calc(100% + 6px);
      left: 0;
      z-index: 1000;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
      min-width: 200px;
      padding: 8px 0;
      animation: fadeIn 0.15s ease-out;
    }

    .col-picker-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 6px 12px;
      border-bottom: 1px solid #f1f5f9;
      font-size: 0.76rem;
      font-weight: 700;
      color: #475569;
    }

    .col-picker-header-btns {
      display: flex;
      gap: 4px;
    }

    .col-btn-mini {
      background: #f1f5f9;
      border: none;
      border-radius: 4px;
      font-size: 0.7rem;
      font-weight: 600;
      padding: 2px 6px;
      cursor: pointer;
      color: #3b82f6;
    }

    .col-btn-mini:hover {
      background: #e2e8f0;
    }

    .col-picker-list {
      max-height: 280px;
      overflow-y: auto;
      padding: 4px 0;
    }

    .col-checkbox-label {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 14px;
      font-size: 0.82rem;
      color: #334155;
      cursor: pointer;
      user-select: none;
      transition: background 0.12s;
    }

    .col-checkbox-label:hover {
      background: #f8fafc;
      color: #0f172a;
    }

    .col-checkbox-label input[type="checkbox"] {
      cursor: pointer;
      accent-color: #2563eb;
      width: 15px;
      height: 15px;
    }

    /* Hours badge */
    .hours-badge {
      display: inline-flex;
      align-items: center;
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 0.78rem;
      font-weight: 700;
      background: #fef3c7;
      color: #b45309;
      border: 1px solid rgba(245, 158, 11, 0.25);
    }

    /* Environment badge */
    .env-badge {
      display: inline-flex;
      align-items: center;
      padding: 3px 10px;
      border-radius: 12px;
      font-size: 0.74rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .env-badge[data-env="production"] { background: #dcfce7; color: #15803d; border: 1px solid rgba(22, 163, 74, 0.3); }
    .env-badge[data-env="beta"] { background: #dbeafe; color: #1d4ed8; border: 1px solid rgba(37, 99, 235, 0.3); }
    .env-badge[data-env="alpha"] { background: #f3e8ff; color: #7e22ce; border: 1px solid rgba(147, 51, 234, 0.3); }
    .env-badge[data-env="staging"] { background: #ffedd5; color: #c2410c; border: 1px solid rgba(234, 88, 12, 0.3); }
    .env-badge[data-env="dev"] { background: #f1f5f9; color: #475569; border: 1px solid rgba(100, 116, 139, 0.3); }

    .period-badge {
      padding: 6px 14px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      font-size: 0.84rem;
      font-weight: 600;
      color: #1e293b;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
    }

    .nav-arrow-btn {
      width: 32px;
      height: 32px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      font-size: 1.15rem;
      color: #475569;
      cursor: pointer;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
      transition: all 0.15s;
    }

    .nav-arrow-btn:hover {
      background: #f8fafc;
      border-color: #cbd5e1;
      color: #1e293b;
    }

    .date-range-pill {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 14px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      font-size: 0.84rem;
      font-weight: 600;
      color: #1e293b;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
      cursor: pointer;
    }

    .pill-cal-icon {
      color: #64748b;
    }

    .dropdown-arrow {
      font-size: 0.6rem;
      color: #94a3b8;
      margin-left: 2px;
    }

    .dash-top-actions {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .project-dropdown-wrap {
      position: relative;
      display: flex;
      align-items: center;
    }

    .project-select {
      appearance: none;
      -webkit-appearance: none;
      padding: 6px 32px 6px 14px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      font-size: 0.84rem;
      font-weight: 600;
      color: #1e293b;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
      cursor: pointer;
      outline: none;
    }

    .select-chevron {
      position: absolute;
      right: 10px;
      font-size: 0.6rem;
      color: #94a3b8;
      pointer-events: none;
    }

    .notif-bell-btn {
      position: relative;
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 50%;
      color: #64748b;
      cursor: pointer;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
      transition: background 0.15s;
    }

    .notif-bell-btn:hover {
      background: #f8fafc;
      color: #1e293b;
    }

    .notif-badge-dot {
      position: absolute;
      top: 6px;
      right: 7px;
      width: 8px;
      height: 8px;
      background: #ef4444;
      border: 2px solid #ffffff;
      border-radius: 50%;
    }

    .user-profile-badge {
      display: flex;
      align-items: center;
      gap: 10px;
      cursor: pointer;
    }

    .user-avatar-circle {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: #c084fc;
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 0.95rem;
      box-shadow: 0 1px 3px rgba(192, 132, 252, 0.4);
    }

    .user-meta {
      display: flex;
      flex-direction: column;
      line-height: 1.25;
    }

    .user-name {
      font-size: 0.88rem;
      font-weight: 700;
      color: #1e293b;
    }

    .user-role {
      font-size: 0.72rem;
      color: #64748b;
    }

    /* ─── Top KPI Cards Grid ─── */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 14px;
    }

    .kpi-card {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 16px 18px;
      border-radius: 14px;
      border: 1px solid transparent;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
      transition: transform 0.18s ease, box-shadow 0.18s ease;
    }

    .kpi-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
    }

    .kpi-blue {
      background: #edf6ff;
      border-color: #d0e6ff;
    }

    .kpi-green {
      background: #edf9f2;
      border-color: #c9eed8;
    }

    .kpi-amber {
      background: #fff8ec;
      border-color: #fee8cb;
    }

    .kpi-purple {
      background: #f6f0fd;
      border-color: #e6d7fb;
    }

    .kpi-pink {
      background: #fff0f3;
      border-color: #ffd6df;
    }

    .kpi-icon-wrap {
      width: 46px;
      height: 46px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ffffff;
      flex-shrink: 0;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12);
    }

    .bg-blue-icon { background: #2563eb; }
    .bg-green-icon { background: #16a34a; }
    .bg-amber-icon { background: #f59e0b; }
    .bg-purple-icon { background: #7c3aed; }
    .bg-pink-icon { background: #f43f5e; border-radius: 12px; }

    .kpi-body {
      display: flex;
      flex-direction: column;
      gap: 2px;
      flex: 1;
      min-width: 0;
    }

    .kpi-label {
      font-size: 0.8rem;
      font-weight: 600;
      color: #475569;
    }

    .kpi-val-row {
      display: flex;
      align-items: baseline;
      gap: 8px;
    }

    .kpi-value {
      font-size: 1.55rem;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.5px;
      line-height: 1.2;
    }

    .kpi-trend {
      font-size: 0.78rem;
      font-weight: 700;
    }

    .text-green { color: #16a34a; }

    .kpi-subtext {
      font-size: 0.72rem;
      color: #64748b;
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* ─── 2-Column Row Layout ─── */
    .dash-row-2col {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
    }

    .dash-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      padding: 16px 18px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    .dash-card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
      padding-bottom: 4px;
    }

    .dash-card-title {
      font-size: 0.98rem;
      font-weight: 700;
      color: #0f172a;
      margin: 0;
    }

    .dash-link-btn {
      background: none;
      border: none;
      font-size: 0.82rem;
      font-weight: 600;
      color: #2563eb;
      cursor: pointer;
      padding: 2px 6px;
      border-radius: 4px;
      transition: background 0.15s;
    }

    .dash-link-btn:hover {
      background: #eff6ff;
      text-decoration: underline;
    }

    .header-range-tag {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.82rem;
      font-weight: 600;
      color: #64748b;
    }

    .range-arrow {
      font-size: 1rem;
      color: #94a3b8;
    }

    /* ─── Tables ─── */
    .dash-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.8rem;
    }

    .dash-table th {
      text-align: left;
      padding: 8px 10px;
      font-size: 0.74rem;
      font-weight: 600;
      color: #64748b;
      border-bottom: 1px solid #e2e8f0;
      background: transparent;
      text-transform: none;
      letter-spacing: 0;
    }

    .dash-table td {
      padding: 8px 10px;
      border-bottom: 1px solid #f1f5f9;
      color: #1e293b;
      vertical-align: middle;
      font-size: 0.8rem;
    }

    .dash-table tbody tr:hover {
      background: #f8fafc;
    }

    .text-bold { font-weight: 700; }
    .text-muted { color: #64748b; }
    .small-text { font-size: 0.74rem; }
    .project-name-cell { font-weight: 700; color: #0f172a; font-size: 0.82rem; }

    .env-badge {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 3px 8px;
      border-radius: 12px;
      font-size: 0.72rem;
      font-weight: 600;
    }

    .env-badge.beta { background: #fee2e2; color: #dc2626; }
    .env-badge.dev { background: #e0f2fe; color: #0284c7; }
    .env-badge.production { background: #dcfce7; color: #16a34a; }
    .env-badge.alpha { background: #f3e8ff; color: #9333ea; }

    .badge-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: currentColor;
    }

    .status-pill {
      display: inline-block;
      padding: 3px 9px;
      border-radius: 12px;
      font-size: 0.72rem;
      font-weight: 600;
      white-space: nowrap;
    }

    .status-pill.status-uat { background: #dbeafe; color: #2563eb; }
    .status-pill.status-dev { background: #fef3c7; color: #d97706; }
    .status-pill.status-live { background: #dcfce7; color: #16a34a; }
    .status-pill.status-test { background: #d1fae5; color: #059669; }
    .status-pill.status-blocked { background: #fee2e2; color: #dc2626; }
    .status-pill.status-planned { background: #f1f5f9; color: #64748b; }

    .progress-wrap {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .progress-val-text {
      font-size: 0.75rem;
      font-weight: 700;
      color: #0f172a;
      min-width: 32px;
    }

    .progress-bar-track {
      flex: 1;
      height: 6px;
      background: #e2e8f0;
      border-radius: 3px;
      overflow: hidden;
      min-width: 60px;
    }

    .progress-bar-val {
      height: 100%;
      background: #3b82f6;
      border-radius: 3px;
    }

    /* ─── Gantt Roadmap ─── */
    .gantt-chart-container {
      display: flex;
      flex-direction: column;
      position: relative;
      flex: 1;
      min-height: 250px;
    }

    .gantt-header-row {
      display: flex;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 6px;
      font-size: 0.72rem;
      font-weight: 600;
      color: #64748b;
    }

    .gantt-project-col {
      width: 120px;
      min-width: 120px;
      font-size: 0.78rem;
    }

    .gantt-months-grid {
      display: grid;
      grid-template-columns: repeat(12, 1fr);
      flex: 1;
      text-align: center;
    }

    .gantt-month-col {
      padding: 0 2px;
    }

    .gantt-month-col.is-current-month {
      color: #ef4444;
      font-weight: 700;
    }

    .gantt-body-wrap {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 12px 0;
      flex: 1;
    }

    .gantt-today-line {
      position: absolute;
      left: calc(120px + (100% - 120px) * (9.5 / 12));
      top: 0;
      bottom: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      z-index: 10;
      pointer-events: none;
    }

    .today-tag {
      background: #ef4444;
      color: #ffffff;
      font-size: 0.65rem;
      font-weight: 700;
      padding: 1px 6px;
      border-radius: 4px;
      line-height: 1.2;
    }

    .today-dashed-line {
      flex: 1;
      width: 1.5px;
      background: #ef4444;
      margin-top: 2px;
    }

    .gantt-row {
      display: flex;
      align-items: center;
      height: 28px;
    }

    .gantt-track-area {
      flex: 1;
      position: relative;
      height: 20px;
      display: flex;
      align-items: center;
      background: #fafafa;
      border-radius: 10px;
    }

    .gantt-bar {
      position: absolute;
      height: 18px;
      border-radius: 9px;
      display: flex;
      align-items: center;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
    }

    .gantt-bar-blue { background: #3b82f6; }
    .gantt-bar-orange { background: #f97316; }
    .gantt-bar-green { background: #22c55e; }
    .gantt-bar-purple { background: #a855f7; }
    .gantt-bar-pink { background: #f43f5e; }
    .gantt-bar-teal { background: #06b6d4; }

    .gantt-segment {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 3px;
      height: 100%;
      border-right: 1px solid rgba(255, 255, 255, 0.3);
      color: #ffffff;
      font-size: 0.6rem;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      padding: 0 3px;
    }

    .seg-node {
      font-size: 0.55rem;
      opacity: 0.9;
    }

    .gantt-legend {
      display: flex;
      align-items: center;
      gap: 14px;
      flex-wrap: wrap;
      margin-top: auto;
      padding-top: 8px;
      border-top: 1px solid #f1f5f9;
      font-size: 0.72rem;
      color: #64748b;
    }

    .legend-item {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }

    .leg-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
    }

    .leg-dot.bg-amber { background: #f59e0b; }
    .leg-dot.bg-blue { background: #3b82f6; }
    .leg-dot.bg-teal { background: #06b6d4; }
    .leg-dot.bg-green { background: #22c55e; }
    .leg-diamond { color: #475569; font-size: 0.7rem; }
    .leg-circle { color: #475569; font-size: 0.7rem; }

    /* ─── Team Work Summary ─── */
    .team-emp-cell {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .emp-avatar-sm {
      width: 26px;
      height: 26px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.95rem;
      flex-shrink: 0;
      background: #e2e8f0;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
    }

    .emp-name {
      font-size: 0.82rem;
      color: #0f172a;
    }

    .member-progress {
      height: 8px;
      background: #e2e8f0;
    }

    .member-progress-text {
      min-width: 34px;
      text-align: right;
    }

    .team-status-badge {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 3px 9px;
      border-radius: 12px;
      font-size: 0.72rem;
      font-weight: 600;
      white-space: nowrap;
    }

    .team-status-badge.team-status-ontrack {
      background: #dcfce7;
      color: #16a34a;
    }

    .team-status-badge.team-status-completed {
      background: #dcfce7;
      color: #15803d;
    }

    .team-status-badge.team-status-excellent {
      background: #dbeafe;
      color: #2563eb;
    }

    .team-status-badge.team-status-blocked {
      background: #fee2e2;
      color: #dc2626;
    }

    .team-status-badge.team-status-dev {
      background: #fef3c7;
      color: #d97706;
    }

    .team-status-badge.team-status-notasks {
      background: #f1f5f9;
      color: #64748b;
    }

    /* ─── Work Analytics 2x3 Grid ─── */
    .analytics-subgrid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      flex: 1;
    }

    .mini-analytic-card {
      background: #ffffff;
      border: 1px solid #f1f5f9;
      border-radius: 10px;
      padding: 10px 12px;
      display: flex;
      flex-direction: column;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.02);
      min-height: 160px;
    }

    .mini-card-header-row {
      margin-bottom: 4px;
    }

    .mini-card-title {
      font-size: 0.78rem;
      font-weight: 700;
      color: #0f172a;
    }

    .mini-legend-row {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 0.65rem;
      color: #64748b;
      margin-bottom: 6px;
    }

    .mini-legend-row.multi-legend {
      gap: 6px;
      flex-wrap: wrap;
    }

    .mini-leg-item {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }

    .leg-bullet {
      width: 6px;
      height: 6px;
      border-radius: 50%;
    }

    .bg-primary-blue { background: #3b82f6; }
    .bg-slate-300 { background: #cbd5e1; }

    .leg-box {
      width: 8px;
      height: 8px;
      border-radius: 2px;
    }

    .bg-cat-frontend { background: #3b82f6; }
    .bg-cat-backend { background: #a855f7; }
    .bg-cat-testing { background: #10b981; }
    .bg-cat-paba { background: #f59e0b; }

    .leg-line-solid {
      width: 12px;
      height: 2px;
      background: #2563eb;
    }

    .leg-line-dashed {
      width: 12px;
      height: 2px;
      background: #93c5fd;
      border-top: 2px dashed #93c5fd;
    }

    /* Subchart 1: Weekly Task Completion Bars */
    .chart-box-bars {
      display: flex;
      gap: 6px;
      flex: 1;
      height: 110px;
      position: relative;
    }

    .y-axis-labels {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      font-size: 0.62rem;
      color: #94a3b8;
      width: 14px;
      text-align: right;
      padding-bottom: 16px;
    }

    .bar-chart-plot {
      flex: 1;
      position: relative;
      display: flex;
      flex-direction: column;
      height: 100%;
    }

    .bar-grid-line {
      position: absolute;
      left: 0;
      right: 0;
      height: 1px;
      background: #f1f5f9;
      pointer-events: none;
    }

    .line-40 { top: 0; }
    .line-30 { top: 25%; }
    .line-20 { top: 50%; }
    .line-10 { top: 75%; }

    .bar-columns-flex {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      flex: 1;
      padding-bottom: 16px;
      position: relative;
      z-index: 2;
    }

    .day-bar-group {
      display: flex;
      flex-direction: column;
      align-items: center;
      height: 100%;
      justify-content: flex-end;
      width: 12%;
    }

    .bar-top-value {
      font-size: 0.64rem;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 2px;
    }

    .bar-fill-col {
      width: 100%;
      background: #3b82f6;
      border-radius: 3px 3px 0 0;
      min-height: 4px;
      transition: height 0.3s ease;
    }

    .bar-x-label {
      position: absolute;
      bottom: 0;
      font-size: 0.62rem;
      color: #64748b;
    }

    /* Subchart 2: Project Completion */
    .project-comp-list {
      display: flex;
      flex-direction: column;
      gap: 7px;
      flex: 1;
      justify-content: center;
    }

    .proj-comp-row {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.68rem;
    }

    .proj-comp-name {
      width: 72px;
      font-weight: 600;
      color: #334155;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .proj-comp-track {
      flex: 1;
      height: 7px;
      background: #f1f5f9;
      border-radius: 4px;
      overflow: hidden;
    }

    .proj-comp-bar {
      height: 100%;
      border-radius: 4px;
    }

    .proj-comp-pct {
      width: 28px;
      text-align: right;
      font-weight: 700;
      color: #0f172a;
    }

    /* Subchart 3: Employee Task Completion */
    .emp-task-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
      flex: 1;
      justify-content: center;
    }

    .emp-task-row {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.68rem;
    }

    .emp-task-name {
      width: 50px;
      font-weight: 600;
      color: #334155;
      white-space: nowrap;
    }

    .emp-task-track {
      flex: 1;
      height: 7px;
      background: #f1f5f9;
      border-radius: 4px;
      overflow: hidden;
    }

    .emp-task-bar {
      height: 100%;
      background: #a855f7;
      border-radius: 4px;
    }

    .emp-task-count {
      width: 14px;
      text-align: right;
      font-weight: 700;
      color: #0f172a;
    }

    .emp-task-scale {
      display: flex;
      justify-content: space-between;
      margin-left: 56px;
      margin-right: 14px;
      font-size: 0.6rem;
      color: #94a3b8;
      border-top: 1px solid #f1f5f9;
      padding-top: 2px;
    }

    /* Subchart 4: Work Trends Line Chart */
    .trends-chart-wrap {
      display: flex;
      flex-direction: column;
      flex: 1;
      position: relative;
    }

    .trends-svg {
      width: 100%;
      height: 95px;
      overflow: visible;
    }

    .trends-x-axis {
      display: flex;
      justify-content: space-between;
      padding-left: 28px;
      padding-right: 8px;
      font-size: 0.62rem;
      color: #64748b;
    }

    /* Subchart 5: Hours Spent Stacked Bar Chart */
    .stacked-bar-chart-wrap {
      display: flex;
      gap: 6px;
      flex: 1;
      height: 110px;
      position: relative;
    }

    .stacked-plot {
      flex: 1;
      position: relative;
      display: flex;
      flex-direction: column;
      height: 100%;
    }

    .stacked-columns-row {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      flex: 1;
      padding-bottom: 16px;
      position: relative;
      z-index: 2;
    }

    .stacked-col-group {
      display: flex;
      flex-direction: column;
      align-items: center;
      height: 100%;
      justify-content: flex-end;
      width: 14%;
    }

    .stacked-column-bar {
      width: 100%;
      display: flex;
      flex-direction: column-reverse;
      border-radius: 3px 3px 0 0;
      overflow: hidden;
    }

    .seg-bar {
      width: 100%;
    }

    .seg-frontend { background: #3b82f6; }
    .seg-backend { background: #a855f7; }
    .seg-testing { background: #10b981; }
    .seg-paba { background: #f59e0b; }

    .truncate-name {
      max-width: 32px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* Subchart 6: Monthly & Quarterly Completion */
    .dual-bar-subcharts {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      flex: 1;
    }

    .subchart-col {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .subchart-title {
      font-size: 0.66rem;
      font-weight: 600;
      color: #64748b;
      text-align: center;
    }

    .subchart-bars-flex {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      flex: 1;
      padding-bottom: 14px;
      position: relative;
      height: 90px;
    }

    .sub-bar-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      height: 100%;
      justify-content: flex-end;
      width: 20%;
    }

    .sub-bar-val {
      font-size: 0.58rem;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 2px;
      white-space: nowrap;
    }

    .sub-bar-track {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: flex-end;
    }

    .sub-bar-fill {
      width: 100%;
      border-radius: 3px 3px 0 0;
      min-height: 4px;
    }

    .sub-bar-fill.fill-blue { background: #3b82f6; }
    .sub-bar-fill.fill-green { background: #10b981; }

    .sub-bar-lbl {
      position: absolute;
      bottom: 0;
      font-size: 0.6rem;
      color: #64748b;
    }

    /* ─── Dark Mode & Responsive Enhancements ─── */
    body.theme-dark .dash-card,
    body.theme-dark .mini-analytic-card,
    body.theme-dark .period-badge,
    body.theme-dark .nav-arrow-btn,
    body.theme-dark .date-range-pill,
    body.theme-dark .project-select,
    body.theme-dark .notif-bell-btn {
      background: var(--bg-surface, #1e293b);
      border-color: var(--border-color, #334155);
      color: var(--text-primary, #f8fafc);
    }

    body.theme-dark .dash-card-title,
    body.theme-dark .kpi-value,
    body.theme-dark .project-name-cell,
    body.theme-dark .emp-name,
    body.theme-dark .user-name,
    body.theme-dark .mini-card-title,
    body.theme-dark .bar-top-value,
    body.theme-dark .proj-comp-pct,
    body.theme-dark .emp-task-count,
    body.theme-dark .sub-bar-val {
      color: #f8fafc;
    }

    body.theme-dark .kpi-blue { background: rgba(37, 99, 235, 0.15); border-color: rgba(37, 99, 235, 0.3); }
    body.theme-dark .kpi-green { background: rgba(22, 163, 74, 0.15); border-color: rgba(22, 163, 74, 0.3); }
    body.theme-dark .kpi-amber { background: rgba(245, 158, 11, 0.15); border-color: rgba(245, 158, 11, 0.3); }
    body.theme-dark .kpi-purple { background: rgba(124, 58, 237, 0.15); border-color: rgba(124, 58, 237, 0.3); }
    body.theme-dark .kpi-pink { background: rgba(244, 63, 94, 0.15); border-color: rgba(244, 63, 94, 0.3); }

    @media (max-width: 1200px) {
      .kpi-grid {
        grid-template-columns: repeat(3, 1fr);
      }
      .dash-row-2col {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 768px) {
      .kpi-grid {
        grid-template-columns: 1fr;
      }
      .analytics-subgrid {
        grid-template-columns: 1fr;
      }
      .dash-top-bar {
        flex-direction: column;
        align-items: stretch;
      }
    }

    .dash-hamburger-btn {
      width: 32px;
      height: 32px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      color: #334155;
      cursor: pointer;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
      transition: all 0.15s;
    }

    .dash-hamburger-btn:hover {
      background: #f8fafc;
      border-color: #cbd5e1;
    }

    .dash-theme-btn {
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 50%;
      cursor: pointer;
      font-size: 1.1rem;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
      transition: background 0.15s;
    }

    .dash-theme-btn:hover {
      background: #f8fafc;
    }

    /* ── YOUR DAY WORK TRACK ── */
    .day-work-card { padding: 0; }
    .day-work-config { padding: 1rem 1.25rem; border-top: 1px solid #f1f5f9; }
    .tracking-mode-bar { display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.85rem; padding-bottom: 0.75rem; border-bottom: 1px dashed #e2e8f0; flex-wrap: wrap; }
    .tracking-mode-label { font-size: 0.82rem; font-weight: 700; color: #475569; }
    .tracking-mode-pills { display: flex; gap: 0.4rem; background: #f1f5f9; padding: 3px; border-radius: 10px; border: 1px solid #e2e8f0; }
    .mode-pill-btn { border: none; background: transparent; padding: 0.35rem 0.85rem; border-radius: 8px; font-size: 0.8rem; font-weight: 600; color: #64748b; cursor: pointer; transition: all 0.15s; }
    .mode-pill-btn:hover { color: #1e293b; background: rgba(255,255,255,0.7); }
    .mode-pill-btn.active { background: #3b82f6; color: #fff; font-weight: 700; box-shadow: 0 2px 6px rgba(59,130,246,0.35); }
    .config-section-title { font-size: 0.9rem; font-weight: 700; color: #374151; margin-bottom: 0.75rem; }
    .day-work-config-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 0.75rem; }
    .config-field { display: flex; flex-direction: column; gap: 0.3rem; }
    .config-field label { font-size: 0.78rem; font-weight: 600; color: #475569; }
    .config-select, .config-input { padding: 0.42rem 0.75rem; border: 1.5px solid #e2e8f0; border-radius: 8px; font-size: 0.84rem; color: #1e293b; background: #fff; outline: none; transition: border-color 0.15s; }
    .config-select:focus, .config-input:focus { border-color: #3b82f6; }
    .week-info-badge { display: inline-flex; align-items: center; padding: 0.38rem 0.75rem; background: linear-gradient(135deg, #dbeafe, #eff6ff); border: 1px solid #bfdbfe; border-radius: 8px; font-size: 0.8rem; font-weight: 600; color: #1d4ed8; }

    /* Week Navigation Toolbar on Weekly Status Screen */
    .week-nav-toolbar {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      background: #f1f5f9;
      padding: 3px 6px;
      border-radius: 10px;
      border: 1.5px solid #cbd5e1;
      box-shadow: 0 1px 3px rgba(0,0,0,0.04);
    }
    .week-nav-arrow-btn {
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 0.28rem 0.65rem;
      font-size: 0.78rem;
      font-weight: 700;
      color: #334155;
      cursor: pointer;
      transition: all 0.15s;
    }
    .week-nav-arrow-btn:hover {
      background: #e2e8f0;
      color: #0f172a;
      border-color: #94a3b8;
    }
    .week-nav-pill {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      padding: 0.22rem 0.6rem;
      background: #ffffff;
      border: 1px solid #bfdbfe;
      border-radius: 6px;
    }
    .week-pill-icon {
      font-size: 0.82rem;
    }
    .week-pill-text {
      font-size: 0.8rem;
      font-weight: 700;
      color: #1d4ed8;
      white-space: nowrap;
    }
    .week-nav-toggle-btn {
      background: transparent;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 0.28rem 0.6rem;
      font-size: 0.75rem;
      font-weight: 600;
      color: #475569;
      cursor: pointer;
      transition: all 0.15s;
    }
    .week-nav-toggle-btn:hover {
      background: #e2e8f0;
      color: #1e293b;
    }
    .week-nav-toggle-btn.active {
      background: #2563eb;
      color: #ffffff;
      border-color: #1d4ed8;
      font-weight: 700;
      box-shadow: 0 1px 4px rgba(37,99,235,0.3);
    }

    body.theme-dark .week-nav-toolbar {
      background: #1e293b;
      border-color: #475569;
    }
    body.theme-dark .week-nav-arrow-btn {
      background: #0f172a;
      border-color: #475569;
      color: #cbd5e1;
    }
    body.theme-dark .week-nav-pill {
      background: #0f172a;
      border-color: #1e40af;
    }
    body.theme-dark .week-pill-text {
      color: #60a5fa;
    }
    body.theme-dark .week-nav-toggle-btn {
      border-color: #475569;
      color: #94a3b8;
    }
    body.theme-dark .week-nav-toggle-btn.active {
      background: #2563eb;
      color: #ffffff;
    }
    .req { color: #ef4444; margin-left: 2px; }
    .leave-section { margin-top: 1rem; border-top: 1px dashed #e2e8f0; padding-top: 0.75rem; }
    .leave-section-title { font-size: 0.88rem; font-weight: 700; color: #374151; margin-bottom: 0.6rem; }
    .leave-days-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(115px, 1fr)); gap: 0.6rem; }
    .leave-day-card { background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 10px; padding: 0.6rem 0.75rem; display: flex; flex-direction: column; gap: 0.25rem; }
    .leave-day-name { font-size: 0.82rem; font-weight: 700; color: #1e293b; }
    .leave-day-date { font-size: 0.72rem; color: #64748b; margin-bottom: 0.25rem; }
    .leave-options { display: flex; flex-direction: column; gap: 0.2rem; }
    .leave-radio { display: flex; align-items: center; gap: 0.35rem; font-size: 0.75rem; color: #374151; cursor: pointer; }
    .leave-radio input[type="radio"] { accent-color: #3b82f6; }
    .current-week-tasks { margin-top: 0.75rem; border-top: 1px dashed #e2e8f0; padding-top: 0.75rem; }
    .week-tasks-list { display: flex; flex-wrap: wrap; gap: 0.5rem; }
    .week-task-chip { display: flex; align-items: center; gap: 0.4rem; background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 20px; padding: 0.3rem 0.7rem; font-size: 0.78rem; }
    .chip-project { font-weight: 700; color: #2563eb; }
    .chip-title { color: #334155; }
    .chip-hours { background: #fef3c7; color: #b45309; border-radius: 8px; padding: 1px 6px; font-weight: 700; font-size: 0.72rem; }
    .chip-status { border-radius: 8px; padding: 1px 7px; font-size: 0.7rem; font-weight: 700; }
    .day-schedule-section { padding: 1rem 1.25rem; border-top: 1px solid #f1f5f9; }
    .day-schedule-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.8rem; flex-wrap: wrap; gap: 0.75rem; }
    .schedule-header-left { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
    .schedule-header-actions { display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; }
    .mode-active-badge { font-size: 0.74rem; font-weight: 700; background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; border-radius: 20px; padding: 2px 10px; display: inline-flex; align-items: center; }
    .after-schedule-switch-bar { margin-top: 0.85rem; padding: 0.75rem 1.25rem; background: #f8fafc; border: 1.5px dashed #cbd5e1; border-radius: 12px; display: flex; align-items: center; justify-content: flex-start; }
    .toggle-switch-card { display: inline-flex; align-items: center; gap: 0.6rem; cursor: pointer; user-select: none; font-size: 0.82rem; font-weight: 600; color: #1e293b; }
    .switch-box { position: relative; display: inline-block; width: 38px; height: 22px; flex-shrink: 0; }
    .switch-box .switch-input { opacity: 0; width: 0; height: 0; position: absolute; }
    .switch-slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #cbd5e1; transition: .2s ease; border-radius: 22px; }
    .switch-slider:before { position: absolute; content: ""; height: 16px; width: 16px; left: 3px; bottom: 3px; background-color: white; transition: .2s ease; border-radius: 50%; box-shadow: 0 1px 3px rgba(0,0,0,0.25); }
    .switch-box .switch-input:checked + .switch-slider { background-color: #2563eb; }
    .switch-box .switch-input:checked + .switch-slider:before { transform: translateX(16px); }
    .switch-box .switch-input:focus-visible + .switch-slider { box-shadow: 0 0 0 2px #93c5fd; }
    .switch-label-text { font-size: 0.82rem; font-weight: 600; color: #334155; }
    .switch-status-pill { font-size: 0.7rem; font-weight: 700; padding: 1px 7px; border-radius: 12px; background: #e2e8f0; color: #64748b; margin-left: 0.25rem; }
    .switch-status-pill.on { background: #dbeafe; color: #1d4ed8; }
    body.theme-dark .after-schedule-switch-bar { background: #0f172a; border-color: #334155; }
    body.theme-dark .switch-label-text { color: #cbd5e1; }
    body.theme-dark .switch-slider { background-color: #475569; }
    body.theme-dark .switch-box .switch-input:checked + .switch-slider { background-color: #3b82f6; }
    body.theme-dark .switch-status-pill { background: #334155; color: #94a3b8; }
    body.theme-dark .switch-status-pill.on { background: #1e3a8a; color: #93c5fd; }
    .schedule-legend { display: flex; gap: 0.6rem; }
    .sched-leg { display: inline-flex; align-items: center; font-size: 0.72rem; font-weight: 700; padding: 2px 10px; border-radius: 20px; }
    .sched-leg.completed { background: #dcfce7; color: #15803d; }
    .sched-leg.inprogress { background: #dbeafe; color: #1d4ed8; }
    .sched-leg.pending { background: #f1f5f9; color: #475569; }
    .schedule-slots-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 0.75rem; }
    .schedule-slot { border: 1.5px solid #e2e8f0; border-radius: 12px; overflow: hidden; background: #fff; transition: box-shadow 0.15s, transform 0.15s; }
    .schedule-slot:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.08); transform: translateY(-2px); }
    .schedule-slot.slot-completed { border-color: #86efac; background: #f0fdf4; }
    .schedule-slot.slot-inprogress { border-color: #93c5fd; background: #eff6ff; }
    .schedule-slot.slot-pending { border-color: #e2e8f0; background: #f8fafc; }
    .schedule-slot.slot-leave { border-color: #fde68a; background: #fffbeb; }
    .schedule-slot.slot-lunch { border-color: #d1fae5; background: #ecfdf5; }
    .schedule-slot.slot-mode-daywise { border-left-width: 4px; border-left-color: #3b82f6; }
    .schedule-slot.slot-mode-actual { border-left-width: 4px; border-left-color: #10b981; }
    .slot-time { background: rgba(0,0,0,0.04); padding: 0.35rem 0.75rem; font-size: 0.78rem; font-weight: 700; color: #334155; border-bottom: 1px solid rgba(0,0,0,0.06); display: flex; align-items: center; justify-content: space-between; gap: 0.4rem; }
    .slot-time-content { display: flex; flex-direction: column; gap: 2px; }
    .slot-date-text { font-size: 0.72rem; font-weight: 700; color: #2563eb; letter-spacing: 0.2px; }
    .slot-hour-text { font-size: 0.76rem; font-weight: 600; color: #334155; }
    body.theme-dark .slot-time { background: rgba(255,255,255,0.04); border-bottom-color: rgba(255,255,255,0.08); }
    body.theme-dark .slot-date-text { color: #60a5fa; }
    body.theme-dark .slot-hour-text { color: #cbd5e1; }
    .slot-mode-tag { background: #fef3c7; color: #92400e; font-size: 0.68rem; font-weight: 800; border-radius: 6px; padding: 1px 6px; border: 1px solid #fde68a; }
    .overdue-duration-badge { background: #fef08a; color: #854d0e; font-size: 0.72rem; font-weight: 700; border-radius: 6px; padding: 1px 6px; margin-left: 4px; }
    .slot-body { padding: 0.5rem 0.75rem; }
    .slot-label { font-size: 0.85rem; font-weight: 600; padding: 0.4rem 0; text-align: center; }
    .leave-label { color: #b45309; }
    .lunch-label { color: #059669; }
    .slot-title { font-size: 0.83rem; font-weight: 700; color: #1e293b; margin-bottom: 0.2rem; }
    .slot-project { font-size: 0.74rem; font-weight: 600; color: #2563eb; margin-bottom: 0.2rem; }
    .slot-desc { font-size: 0.72rem; color: #64748b; margin-bottom: 0.35rem; line-height: 1.4; }
    .slot-footer { display: flex; align-items: center; justify-content: space-between; gap: 0.35rem; flex-wrap: wrap; margin-top: 0.35rem; }
    .slot-status-badge { font-size: 0.7rem; font-weight: 700; border-radius: 8px; padding: 2px 7px; }
    .slot-title-input, .slot-project-input, .slot-status-select, .slot-desc-area { width: 100%; padding: 0.32rem 0.5rem; border: 1.5px solid #cbd5e1; border-radius: 6px; font-size: 0.8rem; margin-bottom: 0.3rem; background: #fff; resize: vertical; outline: none; box-sizing: border-box; }
    .slot-edit-actions { display: flex; gap: 0.35rem; margin-top: 0.3rem; }
    .overdue-modal-panel { max-width: 820px; max-height: 88vh; display: flex; flex-direction: column; border-radius: 16px; overflow: hidden; box-shadow: 0 25px 60px rgba(0,0,0,0.35); }
    .overdue-modal-header { background: linear-gradient(135deg, #ef4444 0%, #ea580c 100%); color: #fff; padding: 1.1rem 1.4rem; border-radius: 16px 16px 0 0; flex-shrink: 0; }
    .overdue-header-content { display: flex; flex-direction: column; gap: 0.25rem; }
    .overdue-badge-pill { display: inline-block; align-self: flex-start; background: rgba(255,255,255,0.22); color: #fff; font-size: 0.65rem; font-weight: 800; padding: 2px 8px; border-radius: 10px; letter-spacing: 0.5px; }
    .overdue-modal-header h2 { color: #fff !important; margin: 0; font-size: 1.15rem; font-weight: 700; }
    .overdue-subtitle { font-size: 0.8rem; color: rgba(255,255,255,0.92); margin: 0; }
    .overdue-popup-note { padding: 0.75rem 1.25rem; background: #fff7ed; color: #9a3412; font-size: 0.82rem; border-bottom: 1px solid #fed7aa; flex-shrink: 0; }
    .overdue-quick-actions { display: flex; justify-content: flex-end; align-items: center; padding: 0.45rem 1.25rem; background: #fefce8; border-bottom: 1px solid #fef08a; flex-shrink: 0; }
    .btn-quick-fill { background: #fff; border: 1.5px solid #d97706; color: #b45309; border-radius: 6px; padding: 4px 12px; font-size: 0.76rem; font-weight: 700; cursor: pointer; transition: all 0.15s; }
    .btn-quick-fill:hover { background: #fef3c7; color: #92400e; }
    .overdue-popup-warning { padding: 0.65rem 1.25rem; background: #fef2f2; color: #b91c1c; font-size: 0.82rem; font-weight: 600; border-bottom: 1px solid #fecaca; flex-shrink: 0; }
    .overdue-tasks-scroll-container { flex: 1; min-height: 0; max-height: 55vh; overflow-y: auto; padding: 0.25rem 0; }
    .overdue-task-card { padding: 0.85rem 1.25rem; border-bottom: 1px solid #f1f5f9; transition: background 0.15s, border-left 0.15s; }
    .overdue-task-card.card-invalid { border-left: 4px solid #ef4444 !important; background: #fff8f8; }
    .overdue-task-card.card-valid { border-left: 4px solid #10b981 !important; background: #fafffb; }
    .overdue-seq-badge { background: #334155; color: #fff; border-radius: 50%; width: 22px; height: 22px; display: inline-flex; align-items: center; justify-content: center; font-size: 0.72rem; font-weight: 700; }
    .overdue-task-date { font-size: 0.75rem; color: #64748b; font-weight: 600; }
    .overdue-task-time { background: #ff6b35; color: #fff; border-radius: 6px; padding: 2px 8px; font-size: 0.76rem; font-weight: 700; }
    .overdue-task-project { background: #dbeafe; color: #1d4ed8; border-radius: 6px; padding: 2px 8px; font-size: 0.76rem; font-weight: 700; }
    .overdue-task-title { font-size: 0.85rem; font-weight: 700; color: #1e293b; }
    .overdue-task-desc { font-size: 0.82rem; color: #475569; font-weight: 500; margin-left: 4px; }
    .overdue-status-indicator { font-size: 0.72rem; font-weight: 700; padding: 2px 8px; border-radius: 10px; }
    .overdue-task-fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 0.75rem; margin-top: 0.4rem; }
    .overdue-select, .overdue-textarea { padding: 0.42rem 0.7rem; border: 1.5px solid #cbd5e1; border-radius: 8px; font-size: 0.84rem; background: #fff; outline: none; box-sizing: border-box; width: 100%; }
    .overdue-select:focus, .overdue-textarea:focus { border-color: #3b82f6; }
    .overdue-inprogress-box { grid-column: 1 / -1; background: #fff7ed; border: 1.5px dashed #fdba74; border-radius: 10px; padding: 0.75rem; display: flex; flex-direction: column; gap: 0.6rem; }
    .project-choice-group { display: flex; flex-direction: column; gap: 0.35rem; }
    .project-choice-radios { display: flex; gap: 1.25rem; flex-wrap: wrap; }
    .choice-radio-label { display: flex; align-items: center; gap: 0.35rem; font-size: 0.82rem; color: #374151; cursor: pointer; }
    .choice-radio-label input { accent-color: #ea580c; }
    .other-project-select-wrap { margin-top: 0.35rem; display: flex; flex-direction: column; gap: 0.25rem; }
    .sub-label { font-size: 0.75rem; font-weight: 600; color: #64748b; }
    .field-error { border-color: #ef4444 !important; background: #fff5f5; }
    .field-error-msg { font-size: 0.72rem; color: #ef4444; font-weight: 600; margin-top: 2px; }
    .overdue-modal-actions { display: flex; align-items: center; justify-content: space-between; padding: 0.85rem 1.4rem; border-top: 1px solid #e2e8f0; background: #f8fafc; border-radius: 0 0 16px 16px; flex-shrink: 0; }
    .overdue-modal-status-text { font-size: 0.82rem; font-weight: 600; }
    .text-pending { color: #b45309; }
    .text-ready { color: #15803d; }
    .overdue-freq-section { padding: 0.75rem 1.25rem; background: #f8fafc; border-bottom: 1px solid #e2e8f0; }
    .overdue-freq-header { display: flex; align-items: baseline; gap: 0.4rem; margin-bottom: 0.5rem; flex-wrap: wrap; }
    .freq-header-title { font-size: 0.82rem; font-weight: 700; color: #1e293b; }
    .freq-header-sub { font-size: 0.72rem; color: #64748b; }
    .overdue-freq-pills { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 0.5rem; }
    .freq-pill { display: flex; align-items: center; gap: 0.45rem; background: #fff; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 0.45rem 0.65rem; cursor: pointer; transition: all 0.15s; font-size: 0.78rem; font-weight: 600; color: #334155; }
    .freq-pill:hover { border-color: #94a3b8; background: #f1f5f9; }
    .freq-pill.active { border-color: #2563eb; background: #eff6ff; color: #1d4ed8; font-weight: 700; box-shadow: 0 1px 3px rgba(37,99,235,0.15); }
    .freq-pill input[type="radio"] { accent-color: #2563eb; }
    .freq-pill-title { font-size: 0.78rem; }
    .overdue-action-buttons { display: flex; align-items: center; gap: 0.6rem; }
    .overdue-cancel-btn { background: #f1f5f9; color: #475569; border: 1.5px solid #cbd5e1; font-weight: 600; padding: 0.55rem 1.25rem; border-radius: 8px; cursor: pointer; transition: all 0.15s; }
    .overdue-cancel-btn:hover { background: #e2e8f0; color: #1e293b; }
    .overdue-submit-btn { background: linear-gradient(135deg, #ef4444 0%, #ea580c 100%); color: #fff; font-weight: 700; padding: 0.55rem 1.5rem; border-radius: 8px; border: none; cursor: pointer; box-shadow: 0 4px 12px rgba(239,68,68,0.3); }
    .overdue-submit-btn:hover { filter: brightness(1.08); }

    /* ── DB RESET BUTTON ── */
    .dash-db-reset-btn {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      padding: 0.38rem 0.85rem;
      background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
      color: #fff;
      border: none;
      border-radius: 7px;
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.03em;
      cursor: pointer;
      transition: all 0.18s;
      box-shadow: 0 2px 8px rgba(220, 38, 38, 0.35);
      white-space: nowrap;
    }
    .dash-db-reset-btn:hover:not(:disabled) { filter: brightness(1.1); transform: translateY(-1px); box-shadow: 0 4px 14px rgba(220, 38, 38, 0.45); }
    .dash-db-reset-btn:active:not(:disabled) { transform: translateY(0); }
    .dash-db-reset-btn:disabled { opacity: 0.55; cursor: not-allowed; }

    /* Empty states */
    .dash-empty-table-cell {
      text-align: center;
      padding: 2.5rem 1rem !important;
      color: var(--text-muted, #94a3b8);
      font-size: 0.92rem;
      font-weight: 500;
    }
    .dash-empty-chart-box {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 110px;
      color: var(--text-muted, #94a3b8);
      font-size: 0.88rem;
      font-weight: 500;
      border-radius: 8px;
      background: rgba(148, 163, 184, 0.05);
      border: 1px dashed rgba(148, 163, 184, 0.2);
      margin: 0.5rem 0;
    }

    /* ── DB RESET CONFIRMATION DIALOG ── */
    .wt-reset-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.65);
      backdrop-filter: blur(4px);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
      animation: wtFadeIn 0.18s ease;
    }
    @keyframes wtFadeIn { from { opacity: 0; } to { opacity: 1; } }
    .wt-reset-dialog {
      background: #fff;
      border-radius: 18px;
      width: 100%;
      max-width: 500px;
      box-shadow: 0 24px 80px rgba(0, 0, 0, 0.35);
      overflow: hidden;
      animation: wtSlideUp 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    @keyframes wtSlideUp { from { opacity: 0; transform: translateY(24px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
    .wt-reset-dialog-header {
      display: flex;
      align-items: center;
      gap: 0.85rem;
      padding: 1.25rem 1.4rem 1rem;
      border-bottom: 1.5px solid #fee2e2;
      background: linear-gradient(135deg, #fff1f2 0%, #fff5f5 100%);
    }
    .wt-reset-icon-ring {
      width: 52px;
      height: 52px;
      border-radius: 50%;
      background: #fee2e2;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #dc2626;
      flex-shrink: 0;
    }
    .wt-reset-dialog-title {
      flex: 1;
      margin: 0;
      font-size: 1.15rem;
      font-weight: 800;
      color: #7f1d1d;
    }
    .wt-reset-close-btn {
      background: none;
      border: none;
      font-size: 1rem;
      color: #94a3b8;
      cursor: pointer;
      padding: 0.25rem;
      border-radius: 4px;
      line-height: 1;
      transition: color 0.15s;
    }
    .wt-reset-close-btn:hover { color: #334155; }
    .wt-reset-dialog-body { padding: 1.25rem 1.4rem; display: flex; flex-direction: column; gap: 0.85rem; }
    .wt-reset-warning-banner {
      background: #fef2f2;
      border: 1.5px solid #fca5a5;
      border-radius: 8px;
      padding: 0.65rem 0.9rem;
      font-size: 0.88rem;
      color: #991b1b;
    }
    .wt-reset-desc { font-size: 0.88rem; color: #374151; margin: 0; }
    .wt-reset-list {
      margin: 0;
      padding-left: 1.1rem;
      font-size: 0.85rem;
      color: #4b5563;
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }
    .wt-reset-safe-note {
      font-size: 0.83rem;
      color: #15803d;
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 7px;
      padding: 0.55rem 0.85rem;
      margin: 0;
    }
    .wt-reset-confirm-input-wrap { display: flex; flex-direction: column; gap: 0.35rem; }
    .wt-reset-confirm-label { font-size: 0.83rem; font-weight: 600; color: #374151; }
    .wt-reset-confirm-input {
      padding: 0.55rem 0.85rem;
      border: 2px solid #cbd5e1;
      border-radius: 8px;
      font-size: 0.88rem;
      font-family: monospace;
      letter-spacing: 0.08em;
      outline: none;
      transition: border-color 0.15s;
    }
    .wt-reset-confirm-input:focus { border-color: #3b82f6; }
    .wt-reset-confirm-input.valid { border-color: #16a34a; background: #f0fdf4; }
    .wt-reset-result-msg {
      padding: 0.55rem 0.85rem;
      border-radius: 8px;
      font-size: 0.85rem;
      font-weight: 600;
    }
    .wt-reset-result-msg.success { background: #dcfce7; color: #15803d; border: 1px solid #86efac; }
    .wt-reset-result-msg.error { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }
    .wt-reset-dialog-footer {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 0.7rem;
      padding: 1rem 1.4rem;
      border-top: 1px solid #f1f5f9;
      background: #f8fafc;
    }
    .wt-reset-cancel-btn {
      padding: 0.55rem 1.3rem;
      background: #f1f5f9;
      border: 1.5px solid #cbd5e1;
      border-radius: 8px;
      font-size: 0.85rem;
      font-weight: 600;
      color: #475569;
      cursor: pointer;
      transition: all 0.15s;
    }
    .wt-reset-cancel-btn:hover:not(:disabled) { background: #e2e8f0; color: #1e293b; }
    .wt-reset-cancel-btn:disabled { opacity: 0.55; cursor: not-allowed; }
    .wt-reset-confirm-btn {
      padding: 0.55rem 1.5rem;
      background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
      border: none;
      border-radius: 8px;
      font-size: 0.85rem;
      font-weight: 700;
      color: #fff;
      cursor: pointer;
      box-shadow: 0 3px 10px rgba(220, 38, 38, 0.3);
      transition: all 0.15s;
    }
    .wt-reset-confirm-btn:hover:not(:disabled) { filter: brightness(1.08); transform: translateY(-1px); }
    .wt-reset-confirm-btn:disabled { opacity: 0.45; cursor: not-allowed; }
    body.theme-dark .wt-reset-dialog { background: #1e293b; }
    body.theme-dark .wt-reset-dialog-header { background: rgba(127, 29, 29, 0.2); border-color: rgba(252, 165, 165, 0.2); }
    body.theme-dark .wt-reset-dialog-title { color: #fca5a5; }
    body.theme-dark .wt-reset-desc, body.theme-dark .wt-reset-list { color: #cbd5e1; }
    body.theme-dark .wt-reset-confirm-input { background: #0f172a; border-color: #475569; color: #e2e8f0; }
    body.theme-dark .wt-reset-dialog-footer { background: #0f172a; border-color: #334155; }
    body.theme-dark .wt-reset-cancel-btn { background: #1e293b; border-color: #475569; color: #94a3b8; }
  `]
})
export class DashboardComponent implements OnInit, OnDestroy, OnChanges {
  @Input() activeView: 'dashboard' | 'weekly-status' | 'project-status' | 'day-work' = 'dashboard';
  @Output() viewChange = new EventEmitter<WorkTrackerTab>();
  @Output() toggleSidebar = new EventEmitter<void>();

  // KPI Metrics (dynamic)
  kpiTotalEmployees = 12;
  kpiActiveEmployees = 2;
  kpiEmployeesSubtext = 'Across all projects';

  kpiTotalTasks = 48;
  kpiCompletedTasks = 6;
  kpiTasksSubtext = 'Total in project';

  kpiTotalHours = 320;
  kpiHoursTrend = 12;

  kpiTaskCompletionPct = 78;
  kpiCompletionTrend = 8;
  kpiCompletionSubtext = 'Across all active sprints';

  kpiActiveProjects = 6;
  kpiNewProjects = 1;
  kpiProjectsSubtext = '2 Production | 4 In Progress';

  // Dynamic SVG Trend Paths
  workTrendsAssignedPath = 'M 32,80 L 84,72 L 136,66 L 188,58 L 240,62 L 292,52';
  workTrendsCompletedPath = 'M 32,74 L 84,68 L 136,60 L 188,48 L 240,54 L 292,38';
  maxHoursTeam = 40;

  selectedDateRange = 'Week 2 (Oct/12/2026 - Oct/18/2026) [Current]';
  selectedViewMode: 'day' | 'week' | 'month' | 'quarter' | 'half-year' | 'year' = 'week';
  currentPeriodSelection = 'W2';
  weekPeriodOptions: Array<{ value: string; label: string }> = [
    { value: 'W1', label: 'Week 1 (Oct/05/2026 - Oct/11/2026)' },
    { value: 'W2', label: 'Week 2 (Oct/12/2026 - Oct/18/2026) [Current]' },
    { value: 'W3', label: 'Week 3 (Oct/19/2026 - Oct/25/2026)' },
    { value: 'all', label: 'All Weeks (W1 - W3)' }
  ];
  availablePeriodOptions: Array<{ value: string; label: string }> = [];
  kpiHoursSubtext = 'Live Task Telemetry';
  selectedProjectFilter = 'All Projects';
  projectList: string[] = ['U2Tools', 'Standup Note', 'S2App ECommerce', 'MatchGuide', 'Dweber', 'Excelendsite'];

  // Column definitions for Weekly Status (Developer Tasks)
  taskColumnDefs = [
    { key: 'taskId', label: 'Task ID' },
    { key: 'week', label: 'Week' },
    { key: 'resourceName', label: 'Resource' },
    { key: 'projectName', label: 'Project' },
    { key: 'module', label: 'Module' },
    { key: 'taskTitle', label: 'Title' },
    { key: 'taskType', label: 'Type' },
    { key: 'status', label: 'Status' },
    { key: 'priority', label: 'Priority' },
    { key: 'size', label: 'Size' },
    { key: 'hours', label: 'Hours' },
    { key: 'progress', label: 'Progress' },
    { key: 'startDate', label: 'Start Date' },
    { key: 'dueDate', label: 'Due Date' },
    { key: 'isVisible', label: 'Visibility' },
    { key: 'actions', label: 'Actions' }
  ];
  showTaskColPicker = false;
  taskColumns: Record<string, boolean> = {
    taskId: true,
    week: true,
    resourceName: true,
    projectName: true,
    module: true,
    taskTitle: true,
    taskType: true,
    status: true,
    priority: true,
    size: true,
    hours: true,
    progress: true,
    startDate: true,
    dueDate: true,
    isVisible: true,
    actions: true
  };

  // Column definitions for Project Status (Release Tracks)
  releaseColumnDefs = [
    { key: 'id', label: 'ID' },
    { key: 'title', label: 'Title' },
    { key: 'category', label: 'Category' },
    { key: 'module', label: 'Module' },
    { key: 'environment', label: 'Current Environment' },
    { key: 'priority', label: 'Priority' },
    { key: 'status', label: 'Status' },
    { key: 'prdStatus', label: 'PRD Status' },
    { key: 'assignedTo', label: 'Assigned To' },
    { key: 'progress', label: 'Progress' },
    { key: 'targetDate', label: 'Target Date' },
    { key: 'completedDate', label: 'Completed Date' },
    { key: 'isVisible', label: 'Visibility' },
    { key: 'actions', label: 'Actions' }
  ];
  showReleaseColPicker = false;
  releaseColumns: Record<string, boolean> = {
    id: true,
    title: true,
    category: true,
    module: true,
    environment: true,
    priority: true,
    status: true,
    prdStatus: true,
    assignedTo: true,
    progress: true,
    targetDate: true,
    completedDate: true,
    isVisible: true,
    actions: true
  };

  environmentOptions: string[] = ['Production', 'Beta', 'Alpha', 'Staging', 'Dev'];

  overviewProjects: Array<{ id: number; name: string; timeline: string; environment: string; status: string; progress: number }> = [];
  months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  roadmapProjects: Array<{ name: string; leftPct: number; widthPct: number; colorClass: string; segments: Array<{ label: string; widthPct: number }> }> = [];
  teamSummary: Array<{ name: string; role: string; tasksWorked: number; hoursSpent: number; taskCompletion: number; status: string; avatar: string }> = [];
  weeklyCompletionDays: Array<{ day: string; val: number; heightPct: number }> = [];
  projectCompletions: Array<{ name: string; pct: number; color: string }> = [];
  employeeTaskCompletions: Array<{ name: string; count: number; widthPct: number }> = [];
  workTrends: Array<{ week: string; completed: number; assigned: number; x: number; y: number; assignedY: number }> = [];
  hoursSpentTeam: Array<{ name: string; total: number; f: number; b: number; t: number; p: number }> = [];
  monthlyCompletions: Array<{ month: string; pct: number; heightPct: number }> = [];
  quarterlyCompletions: Array<{ quarter: string; pct: number; heightPct: number }> = [];

  private latestTrackerData: WorkTrackerData | null = null;

  buildAvailablePeriodOptions(): void {
    if (this.selectedViewMode === 'week') {
      this.availablePeriodOptions = [...this.weekPeriodOptions];
      if (!this.availablePeriodOptions.some(o => o.value === this.currentPeriodSelection)) {
        this.currentPeriodSelection = 'W2';
      }
    } else if (this.selectedViewMode === 'day') {
      this.availablePeriodOptions = [
        { value: '2026-10-15', label: 'Oct/15/2026 (Today)' },
        { value: '2026-10-14', label: 'Oct/14/2026 (Yesterday)' },
        { value: '2026-10-13', label: 'Oct/13/2026' },
        { value: '2026-10-12', label: 'Oct/12/2026 (W2 Start)' },
        { value: '2026-10-09', label: 'Oct/09/2026 (W1 Completed)' },
        { value: '2026-10-08', label: 'Oct/08/2026' },
        { value: '2026-10-07', label: 'Oct/07/2026' },
        { value: '2026-10-06', label: 'Oct/06/2026' },
        { value: '2026-10-05', label: 'Oct/05/2026 (W1 Start)' },
        { value: 'all', label: 'All Days' }
      ];
      if (!this.availablePeriodOptions.some(o => o.value === this.currentPeriodSelection)) {
        this.currentPeriodSelection = '2026-10-15';
      }
    } else if (this.selectedViewMode === 'month') {
      this.availablePeriodOptions = [
        { value: '01', label: 'January 2026' },
        { value: '02', label: 'February 2026' },
        { value: '03', label: 'March 2026' },
        { value: '04', label: 'April 2026' },
        { value: '05', label: 'May 2026' },
        { value: '06', label: 'June 2026' },
        { value: '07', label: 'July 2026' },
        { value: '08', label: 'August 2026' },
        { value: '09', label: 'September 2026' },
        { value: '10', label: 'October 2026' },
        { value: '11', label: 'November 2026' },
        { value: '12', label: 'December 2026' },
        { value: 'all', label: 'All Months' }
      ];
      if (!this.availablePeriodOptions.some(o => o.value === this.currentPeriodSelection)) {
        this.currentPeriodSelection = '10';
      }
    } else if (this.selectedViewMode === 'quarter') {
      this.availablePeriodOptions = [
        { value: 'Q1', label: 'Q1 2026 (Jan - Mar)' },
        { value: 'Q2', label: 'Q2 2026 (Apr - Jun)' },
        { value: 'Q3', label: 'Q3 2026 (Jul - Sep)' },
        { value: 'Q4', label: 'Q4 2026 (Oct - Dec)' },
        { value: 'all', label: 'All Quarters' }
      ];
      if (!this.availablePeriodOptions.some(o => o.value === this.currentPeriodSelection)) {
        this.currentPeriodSelection = 'Q4';
      }
    } else if (this.selectedViewMode === 'half-year') {
      this.availablePeriodOptions = [
        { value: 'H1', label: 'H1 2026 (Jan - Jun)' },
        { value: 'H2', label: 'H2 2026 (Jul - Dec)' },
        { value: 'all', label: 'All Half-Years' }
      ];
      if (!this.availablePeriodOptions.some(o => o.value === this.currentPeriodSelection)) {
        this.currentPeriodSelection = 'H2';
      }
    } else if (this.selectedViewMode === 'year') {
      this.availablePeriodOptions = [
        { value: '2025', label: 'Year 2025' },
        { value: '2026', label: 'Year 2026' },
        { value: '2027', label: 'Year 2027' },
        { value: 'all', label: 'All Years' }
      ];
      if (!this.availablePeriodOptions.some(o => o.value === this.currentPeriodSelection)) {
        this.currentPeriodSelection = '2026';
      }
    }
    this.updateSelectedDateRangeText();
  }

  onViewModeChange(): void {
    this.buildAvailablePeriodOptions();
    if (this.selectedViewMode === 'week') {
      this.filterWeek.next(this.currentPeriodSelection);
    } else if (this.currentPeriodSelection === 'all') {
      this.filterWeek.next('all');
    }
    if (this.latestTrackerData) {
      this.recomputeDashboardData(this.latestTrackerData);
    }
  }

  onPeriodSelectionChange(): void {
    this.updateSelectedDateRangeText();
    if (this.selectedViewMode === 'week') {
      this.filterWeek.next(this.currentPeriodSelection);
    } else if (this.currentPeriodSelection === 'all') {
      this.filterWeek.next('all');
    }
    if (this.latestTrackerData) {
      this.recomputeDashboardData(this.latestTrackerData);
    }
  }

  onWeekNavSelect(weekVal: string): void {
    this.currentPeriodSelection = weekVal;
    this.filterWeek.next(weekVal);
    this.updateSelectedDateRangeText();
    if (this.latestTrackerData) {
      this.recomputeDashboardData(this.latestTrackerData);
    }
  }

  navigatePeriod(direction: number): void {
    if (!this.availablePeriodOptions.length) {
      this.buildAvailablePeriodOptions();
    }
    const currentIndex = this.availablePeriodOptions.findIndex(o => o.value === this.currentPeriodSelection);
    let nextIndex = currentIndex + direction;
    if (nextIndex < 0) {
      nextIndex = this.availablePeriodOptions.length - 1;
    } else if (nextIndex >= this.availablePeriodOptions.length) {
      nextIndex = 0;
    }
    this.currentPeriodSelection = this.availablePeriodOptions[nextIndex].value;
    if (this.selectedViewMode === 'week') {
      this.filterWeek.next(this.currentPeriodSelection);
    } else if (this.currentPeriodSelection === 'all') {
      this.filterWeek.next('all');
    }
    this.onPeriodSelectionChange();
  }

  navigateWeek(direction: number): void {
    if (this.selectedViewMode === 'week') {
      const opts = this.weekPeriodOptions;
      const curIdx = opts.findIndex(o => o.value === this.currentPeriodSelection);
      let nextIdx = (curIdx >= 0 ? curIdx : 1) + direction;
      if (nextIdx < 0) nextIdx = opts.length - 1;
      else if (nextIdx >= opts.length) nextIdx = 0;
      this.onWeekNavSelect(opts[nextIdx].value);
    } else {
      this.navigatePeriod(direction);
    }
  }

  getCurrentPeriodLabel(): string {
    const opt = this.availablePeriodOptions.find(o => o.value === this.currentPeriodSelection) ||
      this.weekPeriodOptions.find(o => o.value === this.currentPeriodSelection);
    return opt ? opt.label : this.currentPeriodSelection;
  }

  private updateSelectedDateRangeText(): void {
    const opt = this.availablePeriodOptions.find(o => o.value === this.currentPeriodSelection) ||
      this.weekPeriodOptions.find(o => o.value === this.currentPeriodSelection);
    this.selectedDateRange = opt ? opt.label : this.currentPeriodSelection;
  }

  isMonthActive(monthIndex: number): boolean {
    if (this.selectedViewMode === 'month') {
      if (this.currentPeriodSelection === 'all') return true;
      return Number(this.currentPeriodSelection) - 1 === monthIndex;
    }
    if (this.selectedViewMode === 'quarter') {
      const q = this.currentPeriodSelection;
      if (q === 'Q1') return monthIndex >= 0 && monthIndex <= 2;
      if (q === 'Q2') return monthIndex >= 3 && monthIndex <= 5;
      if (q === 'Q3') return monthIndex >= 6 && monthIndex <= 8;
      if (q === 'Q4') return monthIndex >= 9 && monthIndex <= 11;
      return true;
    }
    if (this.selectedViewMode === 'half-year') {
      if (this.currentPeriodSelection === 'all') return true;
      return this.currentPeriodSelection === 'H1' ? monthIndex < 6 : monthIndex >= 6;
    }
    return monthIndex === 9; // Default to October
  }

  // Column Visibility Handlers
  isTaskColVisible(key: string): boolean {
    return this.taskColumns[key] ?? true;
  }

  isReleaseColVisible(key: string): boolean {
    return this.releaseColumns[key] ?? true;
  }

  toggleTaskColPicker(event?: Event): void {
    if (event) event.stopPropagation();
    this.showTaskColPicker = !this.showTaskColPicker;
    if (this.showTaskColPicker) this.showReleaseColPicker = false;
  }

  toggleReleaseColPicker(event?: Event): void {
    if (event) event.stopPropagation();
    this.showReleaseColPicker = !this.showReleaseColPicker;
    if (this.showReleaseColPicker) this.showTaskColPicker = false;
  }

  toggleTaskColumn(key: string): void {
    this.taskColumns[key] = !this.isTaskColVisible(key);
    this.saveTaskColumns();
  }

  toggleReleaseColumn(key: string): void {
    this.releaseColumns[key] = !this.isReleaseColVisible(key);
    this.saveReleaseColumns();
  }

  selectAllTaskColumns(val: boolean): void {
    this.taskColumnDefs.forEach(c => this.taskColumns[c.key] = val);
    this.saveTaskColumns();
  }

  selectAllReleaseColumns(val: boolean): void {
    this.releaseColumnDefs.forEach(c => this.releaseColumns[c.key] = val);
    this.saveReleaseColumns();
  }

  resetTaskColumns(): void {
    this.selectAllTaskColumns(true);
  }

  resetReleaseColumns(): void {
    this.selectAllReleaseColumns(true);
  }

  getVisibleTaskColCount(): number {
    return this.taskColumnDefs.filter(c => this.isTaskColVisible(c.key)).length;
  }

  getVisibleReleaseColCount(): number {
    return this.releaseColumnDefs.filter(c => this.isReleaseColVisible(c.key)).length;
  }

  private loadColumnPreferences(): void {
    try {
      const savedTaskCols = localStorage.getItem('u2app_wt_task_cols');
      if (savedTaskCols) Object.assign(this.taskColumns, JSON.parse(savedTaskCols));
      const savedRelCols = localStorage.getItem('u2app_wt_rel_cols');
      if (savedRelCols) Object.assign(this.releaseColumns, JSON.parse(savedRelCols));
    } catch { }
  }

  private saveTaskColumns(): void {
    try {
      localStorage.setItem('u2app_wt_task_cols', JSON.stringify(this.taskColumns));
    } catch { }
  }

  private saveReleaseColumns(): void {
    try {
      localStorage.setItem('u2app_wt_rel_cols', JSON.stringify(this.releaseColumns));
    } catch { }
  }

  getTasksForCurrentPeriod(tasks: DeveloperTask[]): DeveloperTask[] {
    if (!this.currentPeriodSelection || this.currentPeriodSelection === 'all') {
      return tasks;
    }

    if (this.selectedViewMode === 'week') {
      const target = this.currentPeriodSelection.trim().toUpperCase();
      const weekRanges: Record<string, { start: string; end: string }> = {
        'W1': { start: '2026-10-05', end: '2026-10-11' },
        'W2': { start: '2026-10-12', end: '2026-10-18' },
        'W3': { start: '2026-10-19', end: '2026-10-25' }
      };
      const range = weekRanges[target];
      return tasks.filter(t => {
        if ((t.week || '').trim().toUpperCase() === target) return true;
        if (range) {
          const s = t.startDate || t.dueDate || '';
          const e = t.dueDate || t.startDate || '';
          if (s && s <= range.end && e >= range.start) return true;
        }
        return false;
      });
    }

    if (this.selectedViewMode === 'day') {
      const targetDay = this.currentPeriodSelection;
      return tasks.filter(t => {
        if (t.startDate === targetDay || t.dueDate === targetDay || t.completedDate === targetDay) return true;
        if (t.startDate && t.dueDate && t.startDate <= targetDay && t.dueDate >= targetDay) return true;
        // Check week correlation for mock data days
        if (targetDay >= '2026-10-05' && targetDay <= '2026-10-11' && t.week === 'W1') return true;
        if (targetDay >= '2026-10-12' && targetDay <= '2026-10-18' && t.week === 'W2') return true;
        if (targetDay >= '2026-10-19' && targetDay <= '2026-10-25' && t.week === 'W3') return true;
        return false;
      });
    }

    if (this.selectedViewMode === 'month') {
      const targetMonth = this.currentPeriodSelection; // '01' - '12'
      return tasks.filter(t => {
        const s = t.startDate || '';
        const d = t.dueDate || '';
        const c = t.completedDate || '';
        if (s.split('-')[1] === targetMonth || d.split('-')[1] === targetMonth || c.split('-')[1] === targetMonth) return true;
        if (targetMonth === '10' && ['W1', 'W2', 'W3'].includes(t.week || '')) return true;
        return false;
      });
    }

    if (this.selectedViewMode === 'quarter') {
      const qMap: Record<string, string[]> = {
        'Q1': ['01', '02', '03'],
        'Q2': ['04', '05', '06'],
        'Q3': ['07', '08', '09'],
        'Q4': ['10', '11', '12']
      };
      const allowed = qMap[this.currentPeriodSelection] || [];
      return tasks.filter(t => {
        const s = t.startDate?.split('-')[1] || '';
        const d = t.dueDate?.split('-')[1] || '';
        const c = t.completedDate?.split('-')[1] || '';
        if (allowed.includes(s) || allowed.includes(d) || allowed.includes(c)) return true;
        if (this.currentPeriodSelection === 'Q4' && ['W1', 'W2', 'W3'].includes(t.week || '')) return true;
        return false;
      });
    }

    if (this.selectedViewMode === 'half-year') {
      const allowed = this.currentPeriodSelection === 'H1' ? ['01', '02', '03', '04', '05', '06'] : ['07', '08', '09', '10', '11', '12'];
      return tasks.filter(t => {
        const s = t.startDate?.split('-')[1] || '';
        const d = t.dueDate?.split('-')[1] || '';
        const c = t.completedDate?.split('-')[1] || '';
        if (allowed.includes(s) || allowed.includes(d) || allowed.includes(c)) return true;
        if (this.currentPeriodSelection === 'H2' && ['W1', 'W2', 'W3'].includes(t.week || '')) return true;
        return false;
      });
    }

    if (this.selectedViewMode === 'year') {
      const yr = this.currentPeriodSelection;
      return tasks.filter(t => {
        const s = t.startDate || '';
        const d = t.dueDate || '';
        if (s.startsWith(yr) || d.startsWith(yr) || yr === '2026') return true;
        return false;
      });
    }

    return tasks;
  }

  getReleasesForCurrentPeriod(releases: ReleaseTrack[]): ReleaseTrack[] {
    if (!this.currentPeriodSelection || this.currentPeriodSelection === 'all') {
      return releases;
    }

    if (this.selectedViewMode === 'week') {
      const weekRanges: Record<string, { start: string; end: string }> = {
        'W1': { start: '2026-10-05', end: '2026-10-11' },
        'W2': { start: '2026-10-12', end: '2026-10-18' },
        'W3': { start: '2026-10-19', end: '2026-10-25' }
      };
      const range = weekRanges[this.currentPeriodSelection.trim().toUpperCase()];
      if (!range) return releases;
      const matched = releases.filter(r => {
        const c = r.createdDate || '2026-01-01';
        const t = r.targetDate || '2026-12-31';
        return c <= range.end && t >= range.start;
      });
      return matched.length ? matched : releases;
    }

    if (this.selectedViewMode === 'day') {
      const day = this.currentPeriodSelection;
      const matched = releases.filter(r => {
        const c = r.createdDate || '2026-01-01';
        const t = r.targetDate || '2026-12-31';
        return c <= day && t >= day;
      });
      return matched.length ? matched : releases;
    }

    if (this.selectedViewMode === 'month') {
      const mStr = this.currentPeriodSelection;
      const matched = releases.filter(r => {
        const targetMonth = (r.targetDate || '').split('-')[1];
        const createdMonth = (r.createdDate || '').split('-')[1];
        return targetMonth === mStr || createdMonth === mStr || (r.createdDate && r.targetDate && r.createdDate <= `2026-${mStr}-28` && r.targetDate >= `2026-${mStr}-01`);
      });
      return matched.length ? matched : releases;
    }

    if (this.selectedViewMode === 'quarter') {
      const qMap: Record<string, string[]> = {
        'Q1': ['01', '02', '03'],
        'Q2': ['04', '05', '06'],
        'Q3': ['07', '08', '09'],
        'Q4': ['10', '11', '12']
      };
      const allowed = qMap[this.currentPeriodSelection] || [];
      const matched = releases.filter(r => {
        const m = (r.targetDate || r.createdDate || '').split('-')[1];
        return allowed.includes(m);
      });
      return matched.length ? matched : releases;
    }

    if (this.selectedViewMode === 'year') {
      const yr = this.currentPeriodSelection;
      const matched = releases.filter(r => (r.targetDate || '').startsWith(yr) || (r.createdDate || '').startsWith(yr) || yr === '2026');
      return matched.length ? matched : releases;
    }

    return releases;
  }

  onViewAllProjects(): void {
    this.viewChange.emit('project-status');
  }

  onViewDetailsTasks(): void {
    this.viewChange.emit('weekly-status');
  }

  onViewDetailsHourly(): void {
    this.viewChange.emit('day-work');
  }

  onProjectFilterChanged(): void {
    if (this.latestTrackerData) {
      this.recomputeDashboardData(this.latestTrackerData);
    }
  }

  recomputeDashboardData(data: WorkTrackerData): void {
    this.latestTrackerData = data;
    const allTasks = (data.developerTasks || []).filter(t => t.isVisible ?? true);
    const allReleases = (data.releaseTracks || []).filter(r => r.isVisible ?? true);
    const allHourly = (data.hourlyUpdates || []).filter(h => h.isVisible ?? true);

    if (!this.availablePeriodOptions.length) {
      this.buildAvailablePeriodOptions();
    }

    // 1. Update projectList from all tasks and releases
    const foundProjects = Array.from(new Set([
      ...allTasks.map(t => t.projectName),
      ...allReleases.map(r => r.category || r.module || '').filter(Boolean)
    ])).filter(p => p && p.trim() !== '').sort();

    this.projectList = foundProjects;
    if (this.projectList.length === 0 || !this.projectList.includes(this.selectedProjectFilter)) {
      this.selectedProjectFilter = 'All Projects';
    }

    // Filter tasks and releases by selectedProjectFilter if not 'All Projects'
    const isAll = this.selectedProjectFilter === 'All Projects';
    const filterProj = this.selectedProjectFilter;

    const projectTasks = isAll
      ? allTasks
      : allTasks.filter(t => t.projectName?.toLowerCase() === filterProj.toLowerCase());

    const projectReleases = isAll
      ? allReleases
      : allReleases.filter(r =>
        (r.title && r.title.toLowerCase().includes(filterProj.toLowerCase())) ||
        (r.category && r.category.toLowerCase().includes(filterProj.toLowerCase())) ||
        (r.tags && r.tags.toLowerCase().includes(filterProj.toLowerCase()))
      );

    // Apply period/date filter consistently across the whole dashboard
    const periodTasks = this.getTasksForCurrentPeriod(projectTasks);
    const periodReleases = this.getReleasesForCurrentPeriod(projectReleases);
    const periodLabel = this.getCurrentPeriodLabel();

    // 2. KPI: Total Employees (Active in the selected period)
    const empSet = new Set<string>();
    periodTasks.forEach(t => { if (t.resourceName) empSet.add(t.resourceName); });
    periodReleases.forEach(r => { if (r.assignedTo) empSet.add(r.assignedTo); });

    this.kpiTotalEmployees = empSet.size;
    const activeEmpSet = new Set<string>();
    periodTasks.filter(t => t.status !== 'Completed' && (t.progress || 0) < 100).forEach(t => {
      if (t.resourceName) activeEmpSet.add(t.resourceName);
    });
    this.kpiActiveEmployees = activeEmpSet.size;
    this.kpiEmployeesSubtext = periodTasks.length === 0 && periodReleases.length === 0
      ? 'No active employees'
      : (isAll ? `Active in ${periodLabel}` : `In ${filterProj} (${periodLabel})`);

    // 3. KPI: Total Tasks (Filtered by period & project)
    this.kpiTotalTasks = periodTasks.length;
    const completedTasksCount = periodTasks.filter(t => t.status === 'Completed' || t.progress === 100).length;
    const inProgressTasksCount = periodTasks.filter(t => t.status === 'In Progress' || ((t.progress || 0) > 0 && (t.progress || 0) < 100)).length;
    const pendingTasksCount = periodTasks.filter(t => t.status === 'Pending' || t.status === 'Blocked' || (t.progress || 0) === 0).length;
    this.kpiCompletedTasks = completedTasksCount;
    this.kpiTasksSubtext = this.kpiTotalTasks === 0
      ? '0 completed • 0 in progress • 0 pending'
      : `${completedTasksCount} completed • ${inProgressTasksCount} in progress • ${pendingTasksCount} pending`;

    // 4. KPI: Total Hours Logged (based on total sum of hours on the selected period)
    const sumHours = periodTasks.reduce((acc, t) => {
      if (typeof t.hours === 'number' && !isNaN(t.hours)) {
        return acc + t.hours;
      }
      const multiplier = t.size === 'L' ? 12 : t.size === 'S' ? 4 : 8;
      return acc + multiplier;
    }, 0);
    this.kpiTotalHours = Math.round(sumHours);
    this.kpiHoursTrend = this.kpiTotalTasks > 0
      ? Math.round((completedTasksCount / this.kpiTotalTasks) * 100)
      : 0;
    this.kpiHoursSubtext = this.kpiTotalTasks === 0
      ? 'No logged hours'
      : `Selected: ${periodLabel} (${periodTasks.length} tasks)`;

    // 5. KPI: Task Completion % (Filtered by period & project)
    if (this.kpiTotalTasks > 0) {
      const sumProgress = periodTasks.reduce((acc, t) => acc + (t.progress || 0), 0);
      this.kpiTaskCompletionPct = Math.round(sumProgress / this.kpiTotalTasks);
    } else {
      this.kpiTaskCompletionPct = 0;
    }
    this.kpiCompletionTrend = Math.round(this.kpiTaskCompletionPct * 0.1);
    this.kpiCompletionSubtext = this.kpiTotalTasks === 0
      ? '0% completed'
      : (isAll ? `Sprint completion for ${periodLabel}` : `${filterProj} (${periodLabel}) • ${completedTasksCount}/${this.kpiTotalTasks} completed`);

    // 6. KPI: Active Projects (Filtered by period)
    const periodProjNames = Array.from(new Set(periodTasks.map(t => t.projectName).filter(Boolean)));
    const activeProjs = periodProjNames.filter(p => {
      const pTasks = periodTasks.filter(t => t.projectName === p);
      return pTasks.some(t => t.status !== 'Completed' && (t.progress || 0) < 100);
    });
    const liveProjs = periodProjNames.filter(p => {
      const pTasks = periodTasks.filter(t => t.projectName === p);
      return pTasks.length > 0 && pTasks.every(t => t.status === 'Completed' || (t.progress || 0) === 100);
    });
    this.kpiActiveProjects = isAll ? periodProjNames.length : (periodProjNames.length > 0 ? 1 : 0);
    this.kpiNewProjects = activeProjs.length;
    this.kpiProjectsSubtext = `${liveProjs.length} Completed  |  ${activeProjs.length} In Progress`;

    // 7. Middle Section: Project Status Overview Table (Computed using period-filtered data)
    const projectsToDisplay = this.projectList.length > 0 ? (isAll ? this.projectList : [filterProj]) : [];
    this.overviewProjects = projectsToDisplay.map((pName, idx) => {
      const pTasks = periodTasks.filter(t => t.projectName?.toLowerCase() === pName.toLowerCase());
      const pRel = periodReleases.find(r =>
        (r.title && r.title.toLowerCase().includes(pName.toLowerCase())) ||
        (r.category && r.category.toLowerCase().includes(pName.toLowerCase())) ||
        (r.tags && r.tags.toLowerCase().includes(pName.toLowerCase()))
      );

      let avgProg = 0;
      let stat = 'No Tasks in Period';
      let env = 'Dev';

      if (pTasks.length > 0) {
        avgProg = Math.round(pTasks.reduce((acc, t) => acc + (t.progress || 0), 0) / pTasks.length);
        const allDone = pTasks.every(t => t.status === 'Completed' || t.progress === 100);
        const hasBlocked = pTasks.some(t => t.status === 'Blocked');
        if (allDone || avgProg === 100) {
          stat = 'Live';
          env = 'Production';
        } else if (hasBlocked) {
          stat = 'Blocked';
          env = 'Dev';
        } else if (avgProg >= 80) {
          stat = 'Testing Complete';
          env = 'Beta';
        } else if (avgProg >= 60) {
          stat = 'UAT in Progress';
          env = 'Alpha';
        } else if (avgProg > 0) {
          stat = 'Development';
          env = 'Dev';
        } else {
          stat = 'Planned';
          env = 'Dev';
        }
      } else if (pRel) {
        avgProg = pRel.progress || 0;
        env = pRel.environment || (pRel.status === 'Released' ? 'Production' : 'Beta');
        stat = pRel.status || 'Development';
      } else {
        avgProg = 0;
        stat = 'No Tasks in Period';
        env = 'Dev';
      }

      // Build period-specific timeline
      let timeline = 'No active tasks';
      if (pTasks.length > 0) {
        const starts = pTasks.map(t => t.startDate).filter(Boolean).sort();
        const dues = pTasks.map(t => t.dueDate || t.completedDate).filter(Boolean).sort();
        const startStr = starts[0] || '';
        const endStr = dues[dues.length - 1] || dues[0] || '';
        if (startStr && endStr) {
          timeline = `${this.formatAppDate(startStr)} – ${this.formatAppDate(endStr)}`;
        } else if (startStr) {
          timeline = `From ${this.formatAppDate(startStr)}`;
        } else {
          timeline = periodLabel;
        }
      } else if (pRel) {
        timeline = `${this.formatAppDate(pRel.createdDate || '2026-01-01')} – ${this.formatAppDate(pRel.targetDate || '2026-12-31')}`;
      }

      return {
        id: idx + 1,
        name: pName,
        timeline,
        environment: env,
        status: stat,
        progress: avgProg
      };
    });

    // If All Projects selected, sort projects with active tasks in this period first
    if (isAll && this.overviewProjects.length > 0) {
      this.overviewProjects.sort((a, b) => {
        const aHas = periodTasks.some(t => t.projectName?.toLowerCase() === a.name.toLowerCase());
        const bHas = periodTasks.some(t => t.projectName?.toLowerCase() === b.name.toLowerCase());
        if (aHas && !bHas) return -1;
        if (!aHas && bHas) return 1;
        return b.progress - a.progress;
      });
      this.overviewProjects.forEach((p, i) => p.id = i + 1);
    }

    // 8. Project Timeline / Roadmap (Gantt Chart - Reflects period project progress)
    const colorCycle = ['blue', 'orange', 'green', 'purple', 'pink', 'teal'];
    this.roadmapProjects = this.overviewProjects.map((p, idx) => {
      const prog = p.progress;
      const devPct = Math.min(Math.max(Math.round(prog * 0.4), prog > 0 ? 25 : 0), 50);
      const testPct = Math.min(Math.max(Math.round(prog * 0.35), prog > 50 ? 20 : 0), 40);
      const uatPct = prog > 0 ? Math.max(10, 100 - devPct - testPct) : 0;

      return {
        name: p.name,
        leftPct: (idx * 5.5) % 25,
        widthPct: prog > 0 ? Math.min(100, Math.max(40, 100 - ((idx * 6) % 35))) : 15,
        colorClass: colorCycle[idx % colorCycle.length],
        segments: prog > 0 ? [
          { label: 'Dev', widthPct: devPct },
          { label: 'Testing', widthPct: testPct },
          { label: 'UAT', widthPct: uatPct }
        ] : [
          { label: 'Planned', widthPct: 100 }
        ]
      };
    });

    // 9. Team Work Summary (Filtered by selected period)
    const teamMemberNames = Array.from(empSet);
    const membersToProcess = teamMemberNames;

    this.teamSummary = membersToProcess.map(name => {
      const memberTasks = periodTasks.filter(t => t.resourceName === name);
      const tasksWorked = memberTasks.length;
      const completed = memberTasks.filter(t => t.status === 'Completed' || t.progress === 100).length;
      const compPct = tasksWorked > 0 ? Math.round((completed / tasksWorked) * 100) : 0;
      const hours = memberTasks.reduce((acc, t) => {
        if (typeof t.hours === 'number' && !isNaN(t.hours)) return acc + t.hours;
        return acc + (t.size === 'L' ? 8 : t.size === 'S' ? 4 : 6);
      }, 0);

      let role = 'Software Engineer';
      const sample = memberTasks[0] || allTasks.find(t => t.resourceName === name);
      if (sample) {
        const str = `${sample.taskType} ${sample.module} ${sample.tags}`.toLowerCase();
        if (str.includes('front') || str.includes('ui') || str.includes('angular')) role = 'Frontend';
        else if (str.includes('back') || str.includes('api') || str.includes('sql') || str.includes('db')) role = 'Backend';
        else if (str.includes('test') || str.includes('qa') || str.includes('playwright')) role = 'Testing';
        else if (str.includes('arch') || str.includes('core')) role = 'Technical Architect';
        else if (str.includes('paba') || str.includes('analytics') || str.includes('spec')) role = 'PA/BA';
        else if (str.includes('k8s') || str.includes('devops') || str.includes('cloud')) role = 'DevOps';
      }

      let status = 'On Track';
      if (tasksWorked === 0) status = 'No Tasks';
      else if (memberTasks.some(t => t.status === 'Blocked')) status = 'Blocked';
      else if (compPct === 100) status = 'Completed';
      else if (compPct >= 80) status = 'Excellent';
      else if (compPct >= 50 || memberTasks.some(t => t.status === 'In Progress')) status = 'On Track';
      else status = 'Development';

      const avatarEmoji = role.includes('Frontend') ? '👨‍💻' : (role.includes('Backend') ? '🧑‍💻' : (role.includes('Architect') ? '👨‍💼' : (role.includes('Testing') ? '👩‍💻' : '👨‍💼')));

      return {
        name,
        role,
        tasksWorked,
        hoursSpent: hours,
        taskCompletion: compPct,
        status,
        avatar: avatarEmoji
      };
    });

    // Sort team summary: active contributors with tasks in period first
    if (this.teamSummary.length > 0) {
      this.teamSummary.sort((a, b) => b.tasksWorked - a.tasksWorked || b.hoursSpent - a.hoursSpent);
    }

    // 10. Work Analytics (6 charts calculated from filtered period data):
    // Chart 1: Weekly Task Completion (Day-by-day counts for period tasks)
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    if (periodTasks.length === 0) {
      this.weeklyCompletionDays = dayNames.map(day => ({
        day,
        val: 0,
        heightPct: 0
      }));
    } else {
      const dayCounts = [0, 0, 0, 0, 0, 0, 0];
      periodTasks.forEach(t => {
        const dateStr = t.completedDate || t.dueDate || t.startDate;
        if (dateStr) {
          const d = new Date(dateStr + 'T00:00:00');
          const dayIdx = (d.getDay() + 6) % 7; // Mon=0, Sun=6
          dayCounts[dayIdx] += (t.status === 'Completed' || (t.progress || 0) >= 80) ? 6 : (t.progress > 0 ? 4 : 2);
        } else {
          dayCounts[0] += 2;
        }
      });
      const maxDayVal = Math.max(...dayCounts, 10);
      this.weeklyCompletionDays = dayNames.map((day, i) => ({
        day,
        val: dayCounts[i],
        heightPct: Math.min(100, Math.round((dayCounts[i] / maxDayVal) * 100))
      }));
    }

    // Chart 2: Project Completion (Reflects current period progress)
    const projColors: Record<string, string> = {
      'U2Tools': '#3b82f6',
      'Standup Note': '#f97316',
      'S2App ECommerce': '#22c55e',
      'MatchGuide': '#a855f7',
      'Dweber': '#f43f5e',
      'Excelendsite': '#06b6d4'
    };
    this.projectCompletions = this.overviewProjects.map((p, idx) => ({
      name: p.name,
      pct: p.progress,
      color: projColors[p.name] || colorCycle[idx % colorCycle.length]
    }));

    // Chart 3: Employee Task Completion (Reflects tasks in this period)
    const activeTeam = this.teamSummary.filter(m => m.tasksWorked > 0);
    const displayTeam = activeTeam.length > 0 ? activeTeam : this.teamSummary;
    const maxEmpTasks = Math.max(...displayTeam.map(m => m.tasksWorked), 1);
    this.employeeTaskCompletions = displayTeam.slice(0, 6).map(m => ({
      name: m.name,
      count: m.tasksWorked,
      widthPct: Math.min(100, Math.round((m.tasksWorked / maxEmpTasks) * 100))
    }));

    // Chart 4: Work Trends (Tasks Completed vs Assigned across W1-W3 for filtered project)
    if (projectTasks.length === 0) {
      this.workTrends = [];
      this.workTrendsAssignedPath = '';
      this.workTrendsCompletedPath = '';
    } else {
      const weeks = ['W1', 'W2', 'W3'];
      const trendPts: Array<{ week: string; completed: number; assigned: number; x: number; y: number; assignedY: number }> = [];
      const maxTrendTasks = Math.max(...weeks.map(wk => projectTasks.filter(t => t.week === wk).length), 15);
      weeks.forEach((w, idx) => {
        const wTasks = projectTasks.filter(t => t.week === w);
        const assigned = wTasks.length;
        const completed = wTasks.filter(t => t.status === 'Completed' || (t.progress || 0) >= 80).length;

        const x = 32 + idx * 110;
        const y = Math.max(20, Math.min(95, 95 - (completed / maxTrendTasks) * 70));
        const assignedY = Math.max(20, Math.min(95, 95 - (assigned / maxTrendTasks) * 70));
        trendPts.push({ week: w, completed, assigned, x, y, assignedY });
      });
      this.workTrends = trendPts;
      this.workTrendsAssignedPath = trendPts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x + 12},${p.assignedY}`).join(' ');
      this.workTrendsCompletedPath = trendPts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x + 12},${p.y}`).join(' ');
    }

    // Chart 5: Hours Spent Team (Breakdown for period)
    this.hoursSpentTeam = displayTeam.slice(0, 6).map(m => {
      const tot = m.hoursSpent;
      let f = 0, b = 0, t = 0, p = 0;
      if (m.role.includes('Frontend')) { f = Math.round(tot * 0.65); b = Math.round(tot * 0.15); t = Math.round(tot * 0.1); p = Math.round(tot * 0.1); }
      else if (m.role.includes('Backend')) { b = Math.round(tot * 0.65); f = Math.round(tot * 0.1); t = Math.round(tot * 0.15); p = Math.round(tot * 0.1); }
      else if (m.role.includes('Testing')) { t = Math.round(tot * 0.65); f = Math.round(tot * 0.1); b = Math.round(tot * 0.15); p = Math.round(tot * 0.1); }
      else if (m.role.includes('Architect')) { b = Math.round(tot * 0.4); f = Math.round(tot * 0.3); t = Math.round(tot * 0.15); p = Math.round(tot * 0.15); }
      else { p = Math.round(tot * 0.65); f = Math.round(tot * 0.1); b = Math.round(tot * 0.15); t = Math.round(tot * 0.1); }
      return { name: m.name, total: tot, f, b, t, p };
    });
    this.maxHoursTeam = Math.max(...this.hoursSpentTeam.map(h => h.total), 0) || 1;

    // Chart 6: Monthly & Quarterly Completion (Reflects period task rates)
    if (projectTasks.length === 0) {
      this.monthlyCompletions = [
        { month: 'Jul', pct: 0, heightPct: 0 },
        { month: 'Aug', pct: 0, heightPct: 0 },
        { month: 'Sep', pct: 0, heightPct: 0 },
        { month: 'Oct', pct: 0, heightPct: 0 }
      ];
      this.quarterlyCompletions = [
        { quarter: 'Q1', pct: 0, heightPct: 0 },
        { quarter: 'Q2', pct: 0, heightPct: 0 },
        { quarter: 'Q3', pct: 0, heightPct: 0 },
        { quarter: 'Q4', pct: 0, heightPct: 0 }
      ];
    } else {
      const getMonthPct = (mStr: string) => {
        const mTasks = projectTasks.filter(t => (t.startDate || t.dueDate || '').split('-')[1] === mStr);
        if (mTasks.length === 0) return 0;
        return Math.round(mTasks.reduce((acc, t) => acc + (t.progress || 0), 0) / mTasks.length);
      };
      const octPct = getMonthPct('10') || this.kpiTaskCompletionPct;
      this.monthlyCompletions = [
        { month: 'Jul', pct: getMonthPct('07'), heightPct: getMonthPct('07') },
        { month: 'Aug', pct: getMonthPct('08'), heightPct: getMonthPct('08') },
        { month: 'Sep', pct: getMonthPct('09'), heightPct: getMonthPct('09') },
        { month: 'Oct', pct: octPct, heightPct: octPct }
      ];
      this.quarterlyCompletions = [
        { quarter: 'Q1', pct: 0, heightPct: 0 },
        { quarter: 'Q2', pct: 0, heightPct: 0 },
        { quarter: 'Q3', pct: 0, heightPct: 0 },
        { quarter: 'Q4', pct: Math.min(100, Math.round(octPct * 1.05)), heightPct: Math.min(100, Math.round(octPct * 1.05)) }
      ];
    }
  }

  getStatusPillClass(status: string): string {
    const s = (status || '').toLowerCase();
    if (s.includes('uat')) return 'status-uat';
    if (s.includes('blocked')) return 'status-blocked';
    if (s.includes('live') || s.includes('complete')) return 'status-live';
    if (s.includes('test')) return 'status-test';
    if (s.includes('dev')) return 'status-dev';
    if (s.includes('plan') || s.includes('no task')) return 'status-planned';
    return 'status-dev';
  }

  getAvatarColorClass(name: string): string {
    const hash = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const colors = ['avatar-blue', 'avatar-purple', 'avatar-emerald', 'avatar-amber', 'avatar-rose', 'avatar-cyan'];
    return colors[hash % colors.length];
  }

  getTeamStatusClass(status: string): string {
    const s = (status || '').toLowerCase();
    if (s.includes('complete')) return 'team-status-completed';
    if (s.includes('excellent')) return 'team-status-excellent';
    if (s.includes('blocked')) return 'team-status-blocked';
    if (s.includes('track')) return 'team-status-ontrack';
    if (s.includes('dev')) return 'team-status-dev';
    if (s.includes('no task')) return 'team-status-notasks';
    return 'team-status-ontrack';
  }
  workTrackerService = inject(WorkTrackerService);
  themeService = inject(ThemeService);
  private notificationReminderService = inject(NotificationReminderService);
  private changeDetectorRef = inject(ChangeDetectorRef);
  private ngZone = inject(NgZone);
  private reminderSubscription = new Subscription();
  private scheduledHourlyReminderIds: string[] = [];
  private hourlyReminderRows: HourlyWorkUpdate[] = [];
  private readonly alarmUrl = '/assets/audio/work-tracker-alarm.wav';
  hourlyRemindersEnabled = false;
  voiceRemindersEnabled = false;
  reminderPermissionLabel = 'Enable Reminders';
  activeHourlyReminderPopup: HourlyReminderPopup | null = null;

  rawTasks$: Observable<DeveloperTask[]> = this.workTrackerService.data$.pipe(
    map(data => data.developerTasks)
  );

  allTasks$: Observable<DeveloperTask[]> = this.rawTasks$.pipe(
    map(tasks => tasks.filter(task => task.isVisible ?? true))
  );

  rawReleases$: Observable<ReleaseTrack[]> = this.workTrackerService.data$.pipe(
    map(data => data.releaseTracks)
  );

  allReleases$: Observable<ReleaseTrack[]> = this.rawReleases$.pipe(
    map(releases => releases.filter(release => release.isVisible ?? true))
  );

  rawHourlyUpdates$: Observable<HourlyWorkUpdate[]> = this.workTrackerService.data$.pipe(
    map(data => data.hourlyUpdates)
  );

  allHourlyUpdates$: Observable<HourlyWorkUpdate[]> = this.rawHourlyUpdates$.pipe(
    map(updates => updates.filter(update => update.isVisible ?? true))
  );

  // Task Filters State (multi-select - arrays of selected values)
  filterResource = new BehaviorSubject<string[]>([]);
  filterProject = new BehaviorSubject<string[]>([]);
  filterStatus = new BehaviorSubject<string[]>([]);
  filterPriority = new BehaviorSubject<string[]>([]);
  filterWeek = new BehaviorSubject<string>('W2');
  filterModule = new BehaviorSubject<string[]>([]);
  filterTaskType = new BehaviorSubject<string[]>([]);

  // Release Filters State (multi-select)
  relFilterCategory = new BehaviorSubject<string[]>([]);
  relFilterStatus = new BehaviorSubject<string[]>([]);
  relFilterPriority = new BehaviorSubject<string[]>([]);
  relFilterAssigned = new BehaviorSubject<string[]>([]);
  relFilterModule = new BehaviorSubject<string[]>([]);
  relFilterEnvironment = new BehaviorSubject<string[]>([]);
  relFilterPrdStatus = new BehaviorSubject<string[]>([]);

  // Active filter values (bound to column-filter outputs)
  activeTaskFilterResource: string[] = [];
  activeTaskFilterProject: string[] = [];
  activeTaskFilterStatus: string[] = [];
  activeTaskFilterPriority: string[] = [];
  activeTaskFilterModule: string[] = [];
  activeTaskFilterType: string[] = [];
  activeRelFilterCategory: string[] = [];
  activeRelFilterStatus: string[] = [];
  activeRelFilterPriority: string[] = [];
  activeRelFilterAssigned: string[] = [];
  activeRelFilterModule: string[] = [];
  activeRelFilterEnvironment: string[] = [];
  activeRelFilterPrdStatus: string[] = [];
  private showHiddenHourlyRowsSubject = new BehaviorSubject<boolean>(false);
  private showHiddenTaskRowsSubject = new BehaviorSubject<boolean>(false);
  private showHiddenReleaseRowsSubject = new BehaviorSubject<boolean>(false);
  showHiddenHourlyRows = false;
  showHiddenTaskRows = false;
  showHiddenReleaseRows = false;
  showHourlyModal = false;
  showTaskModal = false;
  showReleaseModal = false;
  modalSubmitted = false;
  editingHourlyId = '';
  editingTaskId = '';
  editingReleaseId = '';
  deleteCandidate: { type: 'task'; item: DeveloperTask } | { type: 'release'; item: ReleaseTrack } | { type: 'hourly'; item: HourlyWorkUpdate } | null = null;
  hourlyStatuses: HourlyUpdateStatus[] = ['Completed', 'In Progress', 'Pending'];
  taskStatuses = ['Pending', 'In Progress', 'Blocked', 'Completed'];
  priorities = ['Low', 'Medium', 'High', 'Critical'];
  releaseStatuses = ['Development', 'Testing', 'Staging', 'Released'];
  prdStatuses = ['Draft', 'In Review', 'Approved'];
  sections = {
    filters: true,
    widgets: true,
    charts: true,
    hourly: true,
    tasks: true,
    releases: true
  };
  newHourlyForm: HourlyWorkUpdate = this.createEmptyHourlyUpdate();
  inlineHourlyForm: HourlyWorkUpdate = this.createEmptyHourlyUpdate();
  newTaskForm: DeveloperTask = this.createEmptyTask();
  inlineTaskForm: DeveloperTask = this.createEmptyTask();
  newReleaseForm: ReleaseTrack = this.createEmptyRelease();
  inlineReleaseForm: ReleaseTrack = this.createEmptyRelease();

  // ── YOUR DAY WORK TRACK state ──
  dayWorkTrackingMode: 'hourly' | 'day-wise' | 'actual-hours' = 'hourly';
  dayWorkResource = '';
  dayWorkResourceList: string[] = [];
  dayWorkLoginTime = '09:00';
  dayWorkLogoffTime = '18:00';
  dayWorkHoursPerDay = 8;
  dayWorkLunchMinutes = 60;
  dayWorkCurrentWeekInfo = '';
  dayWorkCurrentWeekTasks: DeveloperTask[] = [];
  dayWorkProjectList: string[] = [];
  dayWorkLeaveDays: LeaveDayEntry[] = [];
  dayScheduleSlots: DayScheduleSlot[] = [];
  editingSlotId = '';
  showBreaksAndLeaves = false;

  // Overdue popup state
  showOverdueTaskPopup = false;
  overdueTaskItems: OverdueTaskItem[] = [];
  overduePopupSubmitted = false;
  overdueReminderFrequency: 'until-completed' | 'every-hour' | 'daily-eod' | 'manual' = 'until-completed';
  lastOverduePopupDismissedTime = 0;
  lastOverduePopupDismissedDate = '';
  private overdueCheckIntervalId: any = null;

  private allTasksSnapshot: DeveloperTask[] = [];
  private previousDayWorkView = false;

  // ── DB Reset state ──
  showResetConfirmDialog = false;
  isResetting = false;
  resetConfirmText = '';
  resetMessage = '';
  resetMessageType: 'success' | 'error' = 'success';

  /** Open the DB reset confirmation dialog */
  openResetConfirmDialog(): void {
    this.resetConfirmText = '';
    this.resetMessage = '';
    this.showResetConfirmDialog = true;
  }

  /** Close the dialog without doing anything */
  cancelReset(): void {
    if (this.isResetting) return;
    this.showResetConfirmDialog = false;
    this.resetConfirmText = '';
    this.resetMessage = '';
  }

  /** Execute the full Work Tracker data reset */
  async confirmReset(): Promise<void> {
    const confirmation = (this.resetConfirmText || '').trim().toUpperCase();
    if (confirmation !== 'RESET' || this.isResetting) return;

    this.isResetting = true;
    this.resetMessage = '';

    try {
      // 1. Collect all known resource names from current task data & Day Work
      const knownResources = [...new Set([
        ...this.allTasksSnapshot.map(t => t.resourceName).filter(Boolean),
        ...this.dayWorkResourceList,
        this.dayWorkResource
      ])].filter(Boolean);

      // 2. Clear Work Tracker–specific localStorage keys.
      //    Only keys with the u2app.* Work Tracker prefixes are removed.
      //    Other U2Tools module keys are left untouched.
      const wtLocalKeys = [
        'u2app.dayWorkTrackingMode',
        'u2app.overdueReminderFrequency',
        'u2app.overdueLastDismissedTime',
        'u2app.overdueLastDismissedDate',
        'u2app.dayWorkResource',
        'u2app_wt_task_cols',
        'u2app_wt_rel_cols',
      ];
      // Per-resource keys
      knownResources.forEach(r => {
        wtLocalKeys.push(
          `u2app.dayWorkTrackingMode_${r}`,
          `u2app.overdueReminderFrequency_${r}`,
          `u2app.dayScheduleSlots_${r}`,
          `u2app.dayWorkLeaveDays_${r}`,
        );
      });
      // Also scan localStorage for any remaining dayScheduleSlots / leaveDays keys
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (
          key &&
          (
            key.startsWith('u2app.dayScheduleSlots_') ||
            key.startsWith('u2app.dayWorkLeaveDays_') ||
            key.startsWith('u2app.dayWorkTrackingMode_') ||
            key.startsWith('u2app.overdueReminderFrequency_')
          )
        ) {
          if (!wtLocalKeys.includes(key)) {
            wtLocalKeys.push(key);
          }
        }
      }
      wtLocalKeys.forEach(k => localStorage.removeItem(k));

      // 3. Reset component state for Day Work tab
      this.dayWorkResource = '';
      this.dayWorkCurrentWeekInfo = '';
      this.dayWorkCurrentWeekTasks = [];
      this.dayWorkLeaveDays = [];
      this.dayScheduleSlots = [];
      this.editingSlotId = '';
      this.allTasksSnapshot = [];
      this.dayWorkTrackingMode = 'hourly';
      this.dayWorkResourceList = [];
      this.dayWorkProjectList = [];
      this.overdueReminderFrequency = 'until-completed';
      this.lastOverduePopupDismissedTime = 0;
      this.lastOverduePopupDismissedDate = '';
      this.showOverdueTaskPopup = false;
      this.overdueTaskItems = [];

      // 4. Cancel any outstanding hourly reminders
      this.cancelHourlyReminders();

      // 5. Reset Weekly Status & Project Status filters and editing states
      this.clearAllTaskFilters();
      this.filterWeek.next('all');
      this.clearAllReleaseFilters();
      this.editingHourlyId = '';
      this.editingTaskId = '';
      this.editingReleaseId = '';
      this.showTaskModal = false;
      this.showReleaseModal = false;
      this.showHourlyModal = false;
      this.activeHourlyReminderPopup = null;

      // 6. Reset Dashboard project list & filters
      this.selectedProjectFilter = 'All Projects';
      this.projectList = [];

      // 7. Column prefs reset (clear cached columns)
      this.taskColumns = this.taskColumnDefs.reduce((acc, col) => ({ ...acc, [col.key]: true }), {});
      this.releaseColumns = this.releaseColumnDefs.reduce((acc, col) => ({ ...acc, [col.key]: true }), {});

      // 8. Delegate data wipe (BehaviorSubject + LocalStorage + Firestore) to the service
      await this.workTrackerService.resetAllData();

      // 9. Recompute dashboard to guarantee immediate empty state
      this.recomputeDashboardData({
        developerTasks: [],
        releaseTracks: [],
        hourlyUpdates: [],
        storageMode: 'local'
      });

      this.resetMessage = '✅ All Work Tracker data has been cleared successfully. The application is now in a clean state.';
      this.resetMessageType = 'success';

      // Auto-close the dialog after 2.5 s on success
      setTimeout(() => {
        this.showResetConfirmDialog = false;
        this.resetMessage = '';
        this.resetConfirmText = '';
      }, 2500);
    } catch (err) {
      console.error('DB Reset failed:', err);
      this.resetMessage = `❌ Reset failed: ${(err as Error)?.message ?? 'Unknown error'}. Please try again.`;
      this.resetMessageType = 'error';
    } finally {
      this.isResetting = false;
    }
  }

  onOverdueFrequencyChange(): void {
    localStorage.setItem('u2app.overdueReminderFrequency', this.overdueReminderFrequency);
    if (this.dayWorkResource) {
      localStorage.setItem(`u2app.overdueReminderFrequency_${this.dayWorkResource}`, this.overdueReminderFrequency);
    }
  }

  cancelOverduePopup(): void {
    this.showOverdueTaskPopup = false;
    this.overduePopupSubmitted = false;
    this.lastOverduePopupDismissedTime = Date.now();
    this.lastOverduePopupDismissedDate = this.formatLocalDate(new Date());
    localStorage.setItem('u2app.overdueLastDismissedTime', String(this.lastOverduePopupDismissedTime));
    localStorage.setItem('u2app.overdueLastDismissedDate', this.lastOverduePopupDismissedDate);
  }

  setTrackingMode(mode: 'hourly' | 'day-wise' | 'actual-hours'): void {
    if (this.dayWorkTrackingMode === mode) return;
    this.dayWorkTrackingMode = mode;
    this.onTrackingModeChange();
  }

  onTrackingModeChange(): void {
    localStorage.setItem('u2app.dayWorkTrackingMode', this.dayWorkTrackingMode);
    if (this.dayWorkResource) {
      this.generateDaySchedule();
    }
  }

  getTrackingModeLabel(): string {
    switch (this.dayWorkTrackingMode) {
      case 'day-wise': return 'Day-wise (8 Hours)';
      case 'actual-hours': return 'Actual Hours';
      default: return 'Hourly (1-Hour Slots)';
    }
  }

  constructor() {
    this.buildAvailablePeriodOptions();
    this.loadColumnPreferences();
    this.updateReminderPermissionLabel();
    this.reminderSubscription.add(this.workTrackerService.data$.subscribe(data => {
      this.recomputeDashboardData(data);
      // Refresh resource list whenever data changes
      this.allTasksSnapshot = data.developerTasks || [];
      this.refreshDayWorkResourceList();
      if (this.dayWorkResource) {
        this.onDayWorkResourceChange();
      }
    }));
    this.reminderSubscription.add(this.rawHourlyUpdates$.subscribe(updates => {
      this.hourlyReminderRows = updates;
      this.rescheduleHourlyReminders();
    }));
    this.reminderSubscription.add(this.notificationReminderService.reminderTriggered$.subscribe(reminder => {
      if (!reminder.id.startsWith('work-tracker-hourly-')) {
        return;
      }

      this.ngZone.run(() => {
        this.activeHourlyReminderPopup = {
          hour: reminder.metadata?.['hour'] ?? '',
          taskDescription: reminder.metadata?.['taskDescription'] ?? reminder.body,
          status: reminder.metadata?.['status'] ?? ''
        };
        this.changeDetectorRef.detectChanges();
      });
    }));

    this.reminderSubscription.add(this.workTrackerService.expandAll$.subscribe(() => this.expandAllSections()));
    this.reminderSubscription.add(this.workTrackerService.collapseAll$.subscribe(() => this.collapseAllSections()));
  }

  getReleaseIconType(release: ReleaseTrack): string {
    const cat = (release.category || '').toLowerCase();
    const mod = (release.module || '').toLowerCase();
    const title = (release.title || '').toLowerCase();
    if (cat.includes('auth') || mod.includes('auth') || title.includes('auth')) return 'shield';
    if (cat.includes('billing') || mod.includes('billing') || title.includes('payment')) return 'card';
    if (cat.includes('ui') || mod.includes('front') || title.includes('landing')) return 'display';
    return 'chart';
  }

  getReleaseColorClass(progress: number, status: string): string {
    const st = (status || '').toLowerCase();
    if (st === 'released' || progress === 100) return 'release-green';
    if (st === 'staging' || progress >= 80) return 'release-cyan';
    if (st === 'in review' || progress >= 50) return 'release-amber';
    return 'release-purple';
  }

  ngOnInit(): void {
    const savedMode = localStorage.getItem('u2app.dayWorkTrackingMode') as any;
    if (savedMode && ['hourly', 'day-wise', 'actual-hours'].includes(savedMode)) {
      this.dayWorkTrackingMode = savedMode;
    }
    const savedFreq = localStorage.getItem('u2app.overdueReminderFrequency') as any;
    if (savedFreq && ['until-completed', 'every-hour', 'daily-eod', 'manual'].includes(savedFreq)) {
      this.overdueReminderFrequency = savedFreq;
    }
    const savedDismissedTime = localStorage.getItem('u2app.overdueLastDismissedTime');
    if (savedDismissedTime) {
      this.lastOverduePopupDismissedTime = Number(savedDismissedTime) || 0;
    }
    const savedDismissedDate = localStorage.getItem('u2app.overdueLastDismissedDate');
    if (savedDismissedDate) {
      this.lastOverduePopupDismissedDate = savedDismissedDate;
    }

    const savedResource = localStorage.getItem('u2app.dayWorkResource');
    if (savedResource) {
      this.dayWorkResource = savedResource;
      this.loadSavedDaySchedule(savedResource);
    }
    if (this.activeView === 'day-work' && this.dayWorkResource) {
      setTimeout(() => this.checkAndShowOverduePopup(false), 250);
    }

    // Periodic check according to reminder frequency (every 30 seconds)
    this.overdueCheckIntervalId = setInterval(() => {
      if (this.activeView === 'day-work' && this.dayWorkResource && !this.showOverdueTaskPopup) {
        this.checkAndShowOverduePopup(false);
      }
    }, 30000);
  }

  ngOnChanges(changes: SimpleChanges): void {
    // When navigating TO day-work view, check for overdue tasks if resource is set
    if (this.activeView === 'day-work' && !this.previousDayWorkView && this.dayWorkResource) {
      this.checkAndShowOverduePopup(false);
    }
    this.previousDayWorkView = this.activeView === 'day-work';
    if (changes['activeView'] && this.activeView === 'day-work') {
      if (!this.dayWorkResource) {
        const savedResource = localStorage.getItem('u2app.dayWorkResource');
        if (savedResource) {
          this.dayWorkResource = savedResource;
          this.loadSavedDaySchedule(savedResource);
        }
      }
      if (this.dayWorkResource) {
        setTimeout(() => this.checkAndShowOverduePopup(false), 250);
      }
    }
  }

  ngOnDestroy(): void {
    this.reminderSubscription.unsubscribe();
    this.cancelHourlyReminders();
    if (this.overdueCheckIntervalId) {
      clearInterval(this.overdueCheckIntervalId);
      this.overdueCheckIntervalId = null;
    }
  }

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

  visibleHourlyUpdates$: Observable<HourlyWorkUpdate[]> = combineLatest([
    this.rawHourlyUpdates$,
    this.showHiddenHourlyRowsSubject
  ]).pipe(
    map(([updates, showHidden]) =>
      updates
        .filter(update => showHidden || (update.isVisible ?? true))
        .sort((a, b) => `${b.date} ${b.hour}`.localeCompare(`${a.date} ${a.hour}`))
    )
  );

  visibleTasks$: Observable<DeveloperTask[]> = combineLatest([
    this.rawTasks$,
    this.showHiddenTaskRowsSubject
  ]).pipe(
    map(([tasks, showHidden]) =>
      tasks.filter(task => showHidden || (task.isVisible ?? true))
    )
  );

  visibleReleases$: Observable<ReleaseTrack[]> = combineLatest([
    this.rawReleases$,
    this.showHiddenReleaseRowsSubject
  ]).pipe(
    map(([releases, showHidden]) =>
      releases.filter(release => showHidden || (release.isVisible ?? true))
    )
  );

  // Filtered tasks logic (multi-select array-based)
  filteredTasks$: Observable<DeveloperTask[]> = combineLatest([
    this.visibleTasks$,
    this.filterResource,
    this.filterProject,
    this.filterStatus,
    this.filterPriority,
    this.filterWeek,
    this.filterModule,
    this.filterTaskType
  ]).pipe(
    map(([tasks, resource, project, status, priority, week, module, taskType]) => {
      const passArr = (vals: string[], val: string) => !vals || vals.length === 0 || vals.includes(val);
      return tasks.filter(t => {
        const passRes = passArr(resource, t.resourceName);
        const passProj = passArr(project, t.projectName);
        const passStat = passArr(status, t.status);
        const passPrio = passArr(priority, t.priority);
        const passMod = passArr(module, t.module || '');
        const passType = passArr(taskType, t.taskType || '');
        const passWeek = !week || week === 'all' || (t.week || '').trim().toUpperCase() === week.trim().toUpperCase();
        return passRes && passProj && passStat && passPrio && passMod && passType && passWeek;
      });
    })
  );

  // Filtered releases logic (multi-select array-based)
  filteredReleases$: Observable<ReleaseTrack[]> = combineLatest([
    this.visibleReleases$,
    this.relFilterCategory,
    this.relFilterStatus,
    this.relFilterPriority,
    this.relFilterAssigned,
    this.relFilterModule,
    this.relFilterEnvironment,
    this.relFilterPrdStatus
  ]).pipe(
    map(([releases, category, status, priority, assigned, module, environment, prdStatus]) => {
      const passArr = (vals: string[], val: string) => !vals || vals.length === 0 || vals.includes(val);
      return releases.filter(r => {
        const passCat = passArr(category, r.category || '');
        const passStat = passArr(status, r.status || '');
        const passPrio = passArr(priority, r.priority || '');
        const passAssign = passArr(assigned, r.assignedTo || '');
        const passMod = passArr(module, r.module || '');
        const passEnv = passArr(environment, r.environment || '');
        const passPrd = passArr(prdStatus, r.prdStatus || '');
        return passCat && passStat && passPrio && passAssign && passMod && passEnv && passPrd;
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

  hoursPerDay$: Observable<{ label: string; count: number; percent: number }[]> = this.allHourlyUpdates$.pipe(
    map(updates => {
      const dayMap = new Map<string, number>();
      updates.forEach(update => {
        if (!update.date) {
          return;
        }
        dayMap.set(update.date, (dayMap.get(update.date) ?? 0) + 1);
      });
      const rows = Array.from(dayMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([label, count]) => ({ label, count, percent: 0 }));
      const max = Math.max(...rows.map(row => row.count), 1);
      return rows.map(row => ({ ...row, percent: Math.max((row.count / max) * 100, 8) }));
    })
  );

  statusDistribution$: Observable<{ label: string; count: number; color: string; percent: number }[]> = this.allHourlyUpdates$.pipe(
    map(updates => {
      const colors: Record<string, string> = {
        Completed: '#68d391',
        'In Progress': '#f6ad55',
        Pending: '#4facfe'
      };
      const total = updates.length || 1;
      return ['Completed', 'In Progress', 'Pending']
        .map(label => ({
          label,
          count: updates.filter(update => update.status === label).length,
          color: colors[label],
          percent: (updates.filter(update => update.status === label).length / total) * 100
        }))
        .filter(slice => slice.count > 0);
    })
  );

  productivityTrend$: Observable<{ points: { x: number; y: number; label: string }[]; pointString: string }> = this.allHourlyUpdates$.pipe(
    map(updates => {
      const dayMap = new Map<string, number>();
      updates
        .filter(update => update.status === 'Completed' && update.date)
        .forEach(update => dayMap.set(update.date, (dayMap.get(update.date) ?? 0) + 1));

      const rows = Array.from(dayMap.entries()).sort(([a], [b]) => a.localeCompare(b));
      const max = Math.max(...rows.map(([, count]) => count), 1);
      const width = 276;
      const minX = 24;
      const maxY = 146;
      const chartHeight = 112;
      const points = rows.map(([label, count], index) => {
        const x = rows.length === 1 ? minX + width / 2 : minX + (index / (rows.length - 1)) * width;
        const y = maxY - (count / max) * chartHeight;
        return { x, y, label };
      });
      return {
        points,
        pointString: points.map(point => `${point.x},${point.y}`).join(' ')
      };
    })
  );

  // ── Column-filter event handlers (called from app-column-filter outputs) ──

  onTaskColFilterChange(col: 'resource' | 'project' | 'status' | 'priority' | 'module' | 'taskType', values: string[]): void {
    switch (col) {
      case 'resource':  this.activeTaskFilterResource = values;  this.filterResource.next(values);  break;
      case 'project':   this.activeTaskFilterProject = values;   this.filterProject.next(values);   break;
      case 'status':    this.activeTaskFilterStatus = values;    this.filterStatus.next(values);    break;
      case 'priority':  this.activeTaskFilterPriority = values;  this.filterPriority.next(values);  break;
      case 'module':    this.activeTaskFilterModule = values;    this.filterModule.next(values);    break;
      case 'taskType':  this.activeTaskFilterType = values;      this.filterTaskType.next(values);  break;
    }
  }

  onRelColFilterChange(col: 'category' | 'status' | 'priority' | 'assigned' | 'module' | 'environment' | 'prdStatus', values: string[]): void {
    switch (col) {
      case 'category':    this.activeRelFilterCategory = values;    this.relFilterCategory.next(values);    break;
      case 'status':      this.activeRelFilterStatus = values;      this.relFilterStatus.next(values);      break;
      case 'priority':    this.activeRelFilterPriority = values;    this.relFilterPriority.next(values);    break;
      case 'assigned':    this.activeRelFilterAssigned = values;    this.relFilterAssigned.next(values);    break;
      case 'module':      this.activeRelFilterModule = values;      this.relFilterModule.next(values);      break;
      case 'environment': this.activeRelFilterEnvironment = values; this.relFilterEnvironment.next(values); break;
      case 'prdStatus':   this.activeRelFilterPrdStatus = values;   this.relFilterPrdStatus.next(values);   break;
    }
  }

  clearAllTaskFilters(): void {
    this.activeTaskFilterResource = []; this.filterResource.next([]);
    this.activeTaskFilterProject = [];  this.filterProject.next([]);
    this.activeTaskFilterStatus = [];   this.filterStatus.next([]);
    this.activeTaskFilterPriority = []; this.filterPriority.next([]);
    this.activeTaskFilterModule = [];   this.filterModule.next([]);
    this.activeTaskFilterType = [];     this.filterTaskType.next([]);
  }

  clearAllReleaseFilters(): void {
    this.activeRelFilterCategory = [];    this.relFilterCategory.next([]);
    this.activeRelFilterStatus = [];      this.relFilterStatus.next([]);
    this.activeRelFilterPriority = [];    this.relFilterPriority.next([]);
    this.activeRelFilterAssigned = [];    this.relFilterAssigned.next([]);
    this.activeRelFilterModule = [];      this.relFilterModule.next([]);
    this.activeRelFilterEnvironment = []; this.relFilterEnvironment.next([]);
    this.activeRelFilterPrdStatus = [];   this.relFilterPrdStatus.next([]);
  }

  // Legacy handler kept for compatibility (old filter card select elements)
  onFilterChange(filterType: string, event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    switch (filterType) {
      case 'resource': this.filterResource.next(value ? [value] : []); break;
      case 'project': this.filterProject.next(value ? [value] : []); break;
      case 'status': this.filterStatus.next(value ? [value] : []); break;
      case 'priority': this.filterPriority.next(value ? [value] : []); break;
      case 'week': this.onWeekNavSelect(value); break;
    }
  }

  onRelFilterChange(filterType: string, event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    switch (filterType) {
      case 'category': this.relFilterCategory.next(value ? [value] : []); break;
      case 'status': this.relFilterStatus.next(value ? [value] : []); break;
      case 'priority': this.relFilterPriority.next(value ? [value] : []); break;
      case 'assigned': this.relFilterAssigned.next(value ? [value] : []); break;
    }
  }

  // Helper: build ColumnFilterOption[] for a given set of task field values
  getTaskColOptions(tasks: DeveloperTask[], field: keyof DeveloperTask): ColumnFilterOption[] {
    const counts = new Map<string, number>();
    tasks.forEach(t => {
      const v = String((t[field] as any) ?? '').trim();
      if (v) counts.set(v, (counts.get(v) || 0) + 1);
    });
    return Array.from(counts.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([value, count]) => ({ value, label: value, count }));
  }

  getReleaseColOptions(releases: ReleaseTrack[], field: keyof ReleaseTrack): ColumnFilterOption[] {
    const counts = new Map<string, number>();
    releases.forEach(r => {
      const v = String((r[field] as any) ?? '').trim();
      if (v) counts.set(v, (counts.get(v) || 0) + 1);
    });
    return Array.from(counts.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([value, count]) => ({ value, label: value, count }));
  }

  /** Returns unique sorted string values for a task field — used to feed combobox [options] */
  getTaskFieldValues(tasks: DeveloperTask[], field: keyof DeveloperTask): string[] {
    return [...new Set(tasks.map(t => String((t[field] as any) ?? '').trim()).filter(Boolean))].sort();
  }

  /** Returns unique sorted string values for a release field — used to feed combobox [options] */
  getReleaseFieldValues(releases: ReleaseTrack[], field: keyof ReleaseTrack): string[] {
    return [...new Set(releases.map(r => String((r[field] as any) ?? '').trim()).filter(Boolean))].sort();
  }


  get hasAnyTaskFilter(): boolean {
    return this.activeTaskFilterResource.length > 0 ||
           this.activeTaskFilterProject.length > 0 ||
           this.activeTaskFilterStatus.length > 0 ||
           this.activeTaskFilterPriority.length > 0 ||
           this.activeTaskFilterModule.length > 0 ||
           this.activeTaskFilterType.length > 0;
  }

  get hasAnyReleaseFilter(): boolean {
    return this.activeRelFilterCategory.length > 0 ||
           this.activeRelFilterStatus.length > 0 ||
           this.activeRelFilterPriority.length > 0 ||
           this.activeRelFilterAssigned.length > 0 ||
           this.activeRelFilterModule.length > 0 ||
           this.activeRelFilterEnvironment.length > 0 ||
           this.activeRelFilterPrdStatus.length > 0;
  }



  async enableHourlyReminders(): Promise<void> {
    const alarmPreparation = this.notificationReminderService
      .prepareAlarm(this.alarmUrl)
      .catch(error => console.warn('Unable to prepare reminder alarm', error));
    const permission = await this.notificationReminderService.requestPermission();
    this.hourlyRemindersEnabled = permission === 'granted' || permission === 'unsupported';
    if (this.hourlyRemindersEnabled) {
      await alarmPreparation;
    }
    this.updateReminderPermissionLabel();
    this.rescheduleHourlyReminders();
  }

  rescheduleHourlyReminders(): void {
    this.cancelHourlyReminders();

    if (!this.hourlyRemindersEnabled) {
      return;
    }

    this.hourlyReminderRows
      .map(update => this.toHourlyReminder(update))
      .filter((reminder): reminder is NotificationReminder => Boolean(reminder))
      .forEach(reminder => {
        this.scheduledHourlyReminderIds.push(reminder.id);
        this.notificationReminderService.schedule(reminder);
      });
  }

  closeHourlyReminderPopup(): void {
    this.activeHourlyReminderPopup = null;
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

  getPieBackground(slices: { color: string; percent: number }[]): string {
    if (!slices.length) {
      return 'rgba(255,255,255,0.6)';
    }

    let start = 0;
    const segments = slices.map(slice => {
      const end = start + slice.percent;
      const segment = `${slice.color} ${start}% ${end}%`;
      start = end;
      return segment;
    });
    return `conic-gradient(${segments.join(', ')})`;
  }

  openHourlyModal(): void {
    this.newHourlyForm = this.createEmptyHourlyUpdate();
    this.modalSubmitted = false;
    this.showHourlyModal = true;
  }

  closeHourlyModal(): void {
    this.showHourlyModal = false;
    this.modalSubmitted = false;
  }

  saveHourlyFromModal(isValid: boolean): void {
    this.modalSubmitted = true;
    if (!isValid || !this.isHourlyUpdateValid(this.newHourlyForm)) {
      return;
    }

    this.workTrackerService.addHourlyUpdate({
      ...this.newHourlyForm,
      isVisible: true
    });
    this.closeHourlyModal();
  }

  startInlineHourlyEdit(update: HourlyWorkUpdate): void {
    this.editingHourlyId = update.id;
    this.inlineHourlyForm = { ...update };
  }

  saveInlineHourlyUpdate(): void {
    if (!this.editingHourlyId || !this.isHourlyUpdateValid(this.inlineHourlyForm)) {
      return;
    }

    this.workTrackerService.updateHourlyUpdate(this.editingHourlyId, {
      ...this.inlineHourlyForm,
      isVisible: this.inlineHourlyForm.isVisible ?? true
    });
    this.cancelInlineHourlyEdit();
  }

  cancelInlineHourlyEdit(): void {
    this.editingHourlyId = '';
    this.inlineHourlyForm = this.createEmptyHourlyUpdate();
  }

  confirmDeleteHourly(update: HourlyWorkUpdate): void {
    this.deleteCandidate = { type: 'hourly', item: update };
  }

  confirmDeleteTask(task: DeveloperTask): void {
    this.deleteCandidate = { type: 'task', item: task };
  }

  confirmDeleteRelease(release: ReleaseTrack): void {
    this.deleteCandidate = { type: 'release', item: release };
  }

  cancelDelete(): void {
    this.deleteCandidate = null;
  }

  deleteConfirmed(): void {
    if (!this.deleteCandidate) {
      return;
    }

    if (this.deleteCandidate.type === 'hourly') {
      this.workTrackerService.deleteHourlyUpdate(this.deleteCandidate.item.id);
      if (this.editingHourlyId === this.deleteCandidate.item.id) {
        this.cancelInlineHourlyEdit();
      }
    }

    if (this.deleteCandidate.type === 'task') {
      this.workTrackerService.deleteDeveloperTask(this.deleteCandidate.item.taskId);
      if (this.editingTaskId === this.deleteCandidate.item.taskId) {
        this.cancelInlineTaskEdit();
      }
    }

    if (this.deleteCandidate.type === 'release') {
      this.workTrackerService.deleteReleaseTrack(this.deleteCandidate.item.id);
      if (this.editingReleaseId === this.deleteCandidate.item.id) {
        this.cancelInlineReleaseEdit();
      }
    }
    this.deleteCandidate = null;
  }

  toggleHourlyVisibility(id: string): void {
    this.workTrackerService.toggleHourlyUpdateVisibility(id);
  }

  toggleHiddenHourlyRows(): void {
    this.showHiddenHourlyRows = !this.showHiddenHourlyRows;
    this.showHiddenHourlyRowsSubject.next(this.showHiddenHourlyRows);
  }

  openTaskModal(): void {
    this.newTaskForm = this.createEmptyTask();
    this.modalSubmitted = false;
    this.showTaskModal = true;
  }

  closeTaskModal(): void {
    this.showTaskModal = false;
    this.modalSubmitted = false;
  }

  saveTaskFromModal(isValid: boolean): void {
    this.modalSubmitted = true;
    if (!isValid || !this.isTaskValid(this.newTaskForm)) {
      return;
    }
    this.workTrackerService.addDeveloperTask({ ...this.newTaskForm, progress: this.clampProgress(this.newTaskForm.progress), isVisible: true });
    this.closeTaskModal();
  }

  startInlineTaskEdit(task: DeveloperTask): void {
    this.editingTaskId = task.taskId;
    this.inlineTaskForm = { ...task };
  }

  saveInlineTask(): void {
    if (!this.editingTaskId || !this.isTaskValid(this.inlineTaskForm)) {
      return;
    }
    this.workTrackerService.updateDeveloperTask(this.editingTaskId, {
      ...this.inlineTaskForm,
      progress: this.clampProgress(this.inlineTaskForm.progress),
      isVisible: this.inlineTaskForm.isVisible ?? true
    });
    this.cancelInlineTaskEdit();
  }

  cancelInlineTaskEdit(): void {
    this.editingTaskId = '';
    this.inlineTaskForm = this.createEmptyTask();
  }

  toggleTaskVisibility(taskId: string): void {
    this.workTrackerService.toggleDeveloperTaskVisibility(taskId);
  }

  toggleHiddenTaskRows(): void {
    this.showHiddenTaskRows = !this.showHiddenTaskRows;
    this.showHiddenTaskRowsSubject.next(this.showHiddenTaskRows);
  }

  openReleaseModal(): void {
    this.newReleaseForm = this.createEmptyRelease();
    this.modalSubmitted = false;
    this.showReleaseModal = true;
  }

  closeReleaseModal(): void {
    this.showReleaseModal = false;
    this.modalSubmitted = false;
  }

  saveReleaseFromModal(isValid: boolean): void {
    this.modalSubmitted = true;
    if (!isValid || !this.isReleaseValid(this.newReleaseForm)) {
      return;
    }
    this.workTrackerService.addReleaseTrack({ ...this.newReleaseForm, progress: this.clampProgress(this.newReleaseForm.progress), isVisible: true });
    this.closeReleaseModal();
  }

  startInlineReleaseEdit(release: ReleaseTrack): void {
    this.editingReleaseId = release.id;
    this.inlineReleaseForm = { ...release };
  }

  saveInlineRelease(): void {
    if (!this.editingReleaseId || !this.isReleaseValid(this.inlineReleaseForm)) {
      return;
    }
    this.workTrackerService.updateReleaseTrack(this.editingReleaseId, {
      ...this.inlineReleaseForm,
      progress: this.clampProgress(this.inlineReleaseForm.progress),
      isVisible: this.inlineReleaseForm.isVisible ?? true
    });
    this.cancelInlineReleaseEdit();
  }

  cancelInlineReleaseEdit(): void {
    this.editingReleaseId = '';
    this.inlineReleaseForm = this.createEmptyRelease();
  }

  toggleReleaseVisibility(id: string): void {
    this.workTrackerService.toggleReleaseTrackVisibility(id);
  }

  toggleHiddenReleaseRows(): void {
    this.showHiddenReleaseRows = !this.showHiddenReleaseRows;
    this.showHiddenReleaseRowsSubject.next(this.showHiddenReleaseRows);
  }

  toggleSection(section: keyof DashboardComponent['sections']): void {
    this.sections[section] = !this.sections[section];
  }

  expandAllSections(): void {
    Object.keys(this.sections).forEach(key => this.sections[key as keyof DashboardComponent['sections']] = true);
  }

  collapseAllSections(): void {
    Object.keys(this.sections).forEach(key => this.sections[key as keyof DashboardComponent['sections']] = false);
  }

  getDeleteLabel(): string {
    if (!this.deleteCandidate) return '';
    return this.deleteCandidate.type === 'hourly' ? 'Hourly Update' : this.deleteCandidate.type === 'task' ? 'Developer Task' : 'Release Track';
  }

  getDeleteName(): string {
    if (!this.deleteCandidate) return '';
    if (this.deleteCandidate.type === 'hourly') return this.deleteCandidate.item.id;
    if (this.deleteCandidate.type === 'task') return `${this.deleteCandidate.item.taskId} - ${this.deleteCandidate.item.taskTitle}`;
    return `${this.deleteCandidate.item.id} - ${this.deleteCandidate.item.title}`;
  }

  normalizeStatus(status: string): string {
    return status.toLowerCase().replace(/\s+/g, '');
  }

  private cancelHourlyReminders(): void {
    this.scheduledHourlyReminderIds.forEach(id => this.notificationReminderService.cancel(id));
    this.scheduledHourlyReminderIds = [];
  }

  private toHourlyReminder(update: HourlyWorkUpdate): NotificationReminder | null {
    if (!(update.isVisible ?? true)) {
      return null;
    }

    const triggerAt = this.getHourlyReminderDate(update);
    if (!triggerAt || triggerAt.getTime() <= Date.now()) {
      return null;
    }

    const body = [
      `Time: ${update.hour}`,
      `Task Description: ${update.taskDescription}`,
      `Status: ${update.status}`
    ].join('\n');
    return {
      id: `work-tracker-hourly-${update.id}`,
      title: 'Work Tracker Reminder',
      body,
      triggerAt,
      alarmUrl: this.alarmUrl,
      speechText: `Work tracker reminder. ${update.taskDescription}`,
      useSpeech: this.voiceRemindersEnabled,
      metadata: {
        hour: update.hour,
        taskDescription: update.taskDescription,
        status: update.status
      }
    };
  }

  private getHourlyReminderDate(update: HourlyWorkUpdate): Date | null {
    if (!update.date || !update.hour) {
      return null;
    }

    const triggerAt = new Date(`${update.date}T${update.hour}`);
    return Number.isNaN(triggerAt.getTime()) ? null : triggerAt;
  }

  private updateReminderPermissionLabel(): void {
    const permission = this.notificationReminderService.permission;
    if (permission === 'granted') {
      this.reminderPermissionLabel = 'Reminders Enabled';
      return;
    }

    if (permission === 'denied') {
      this.reminderPermissionLabel = 'Notifications Blocked';
      return;
    }

    if (permission === 'unsupported') {
      this.reminderPermissionLabel = 'Enable Alarm';
      return;
    }

    this.reminderPermissionLabel = 'Enable Reminders';
  }

  private isHourlyUpdateValid(update: HourlyWorkUpdate): boolean {
    return Boolean(update.date && update.hour && update.taskDescription.trim() && update.status);
  }

  private isTaskValid(task: DeveloperTask): boolean {
    return Boolean(task.resourceName.trim() && task.projectName.trim() && task.module.trim() && task.taskTitle.trim() && task.taskDescription.trim());
  }

  private isReleaseValid(release: ReleaseTrack): boolean {
    return Boolean(release.title.trim() && release.category.trim() && release.module.trim() && release.assignedTo.trim());
  }

  private clampProgress(value: number): number {
    return Math.min(Math.max(Number(value) || 0, 0), 100);
  }

  // ── DAY WORK TRACK helpers ──

  /** Rebuild the resource dropdown from weekly-status tasks */
  private refreshDayWorkResourceList(): void {
    const names = [...new Set(this.allTasksSnapshot.map(t => t.resourceName).filter(Boolean))].sort();
    this.dayWorkResourceList = names;
    this.dayWorkProjectList = [...new Set(this.allTasksSnapshot.map(t => t.projectName).filter(Boolean))].sort();
  }

  /** Format a Date object to YYYY-MM-DD in local time */
  private formatLocalDate(d: Date): string {
    const y = d.getFullYear();
    const m = this.pad(d.getMonth() + 1);
    const day = this.pad(d.getDate());
    return `${y}-${m}-${day}`;
  }

  /** Formats a date string or Date object consistently as MMM/DD/YYYY (e.g. Oct/15/2026) */
  formatAppDate(val: string | Date | null | undefined): string {
    if (!val) return '';
    let d: Date;
    if (val instanceof Date) {
      d = val;
    } else if (typeof val === 'string') {
      const trimmed = val.trim();
      if (!trimmed) return '';
      const match = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
      if (match) {
        const year = parseInt(match[1], 10);
        const month = parseInt(match[2], 10) - 1;
        const day = parseInt(match[3], 10);
        d = new Date(year, month, day);
      } else {
        d = new Date(trimmed);
      }
    } else {
      d = new Date(val);
    }
    if (isNaN(d.getTime())) return String(val);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthStr = months[d.getMonth()];
    const dayStr = this.pad(d.getDate());
    const yearStr = d.getFullYear();
    return `${monthStr}/${dayStr}/${yearStr}`;
  }

  /** Load previously saved schedule from localStorage for a resource */
  private loadSavedDaySchedule(resource: string): void {
    try {
      const savedMode = localStorage.getItem(`u2app.dayWorkTrackingMode_${resource}`) || localStorage.getItem('u2app.dayWorkTrackingMode');
      if (savedMode && ['hourly', 'day-wise', 'actual-hours'].includes(savedMode)) {
        this.dayWorkTrackingMode = savedMode as any;
      }
      const savedFreq = localStorage.getItem(`u2app.overdueReminderFrequency_${resource}`) || localStorage.getItem('u2app.overdueReminderFrequency');
      if (savedFreq && ['until-completed', 'every-hour', 'daily-eod', 'manual'].includes(savedFreq)) {
        this.overdueReminderFrequency = savedFreq as any;
      }
      const raw = localStorage.getItem(`u2app.dayScheduleSlots_${resource}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.dayScheduleSlots = parsed;
        }
      }
      const rawLeaves = localStorage.getItem(`u2app.dayWorkLeaveDays_${resource}`);
      if (rawLeaves) {
        const parsedLeaves = JSON.parse(rawLeaves);
        if (Array.isArray(parsedLeaves) && parsedLeaves.length > 0) {
          this.dayWorkLeaveDays = parsedLeaves;
        }
      }
    } catch (e) {
      console.warn('Error loading saved schedule from localStorage:', e);
    }
  }

  /** Save current schedule to localStorage */
  private persistDaySchedule(): void {
    if (!this.dayWorkResource) return;
    try {
      localStorage.setItem('u2app.dayWorkTrackingMode', this.dayWorkTrackingMode);
      localStorage.setItem(`u2app.dayWorkTrackingMode_${this.dayWorkResource}`, this.dayWorkTrackingMode);
      localStorage.setItem('u2app.overdueReminderFrequency', this.overdueReminderFrequency);
      localStorage.setItem(`u2app.overdueReminderFrequency_${this.dayWorkResource}`, this.overdueReminderFrequency);
      localStorage.setItem(`u2app.dayScheduleSlots_${this.dayWorkResource}`, JSON.stringify(this.dayScheduleSlots));
      localStorage.setItem(`u2app.dayWorkLeaveDays_${this.dayWorkResource}`, JSON.stringify(this.dayWorkLeaveDays));
    } catch (e) {
      console.warn('Error saving schedule to localStorage:', e);
    }
  }

  /** Get the current week's start/end dates (Mon-Fri) as ISO strings */
  private getCurrentWeekRange(): { start: string; end: string } {
    const now = new Date();
    const day = now.getDay(); // 0=Sun, 1=Mon...
    const diffToMon = day === 0 ? -6 : 1 - day;
    const mon = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMon);
    const fri = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 4);
    return { start: this.formatLocalDate(mon), end: this.formatLocalDate(fri) };
  }

  /** Build the 5 leave-day entries for the current week */
  private buildLeaveDays(): LeaveDayEntry[] {
    const { start } = this.getCurrentWeekRange();
    const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const days: LeaveDayEntry[] = [];
    const [y, m, d] = start.split('-').map(Number);
    const monDate = new Date(y, m - 1, d);
    for (let i = 0; i < 5; i++) {
      const cur = new Date(monDate.getFullYear(), monDate.getMonth(), monDate.getDate() + i);
      const iso = this.formatLocalDate(cur);
      days.push({ dayName: dayNames[i], date: iso, leaveType: 'none' });
    }
    return days;
  }

  /** Called when resource dropdown changes */
  onDayWorkResourceChange(): void {
    if (!this.dayWorkResource) {
      this.dayWorkCurrentWeekInfo = '';
      this.dayWorkCurrentWeekTasks = [];
      this.dayWorkLeaveDays = [];
      this.dayScheduleSlots = [];
      localStorage.removeItem('u2app.dayWorkResource');
      return;
    }

    localStorage.setItem('u2app.dayWorkResource', this.dayWorkResource);

    // Build or restore leave days
    this.dayWorkLeaveDays = this.buildLeaveDays();

    // Try restoring saved schedule
    this.loadSavedDaySchedule(this.dayWorkResource);

    // Filter tasks for this resource in the current week
    const { start, end } = this.getCurrentWeekRange();
    const startDate = new Date(start + 'T00:00:00');
    const endDate = new Date(end + 'T23:59:59');

    let matching = this.allTasksSnapshot.filter(t => {
      if (t.resourceName !== this.dayWorkResource) return false;
      if (!t.startDate && !t.dueDate) return false;
      const tStart = t.startDate ? new Date(t.startDate + 'T00:00:00') : null;
      const tEnd = t.dueDate ? new Date(t.dueDate + 'T23:59:59') : null;
      const startsBeforeWeekEnd = tStart ? tStart <= endDate : true;
      const endsAfterWeekStart = tEnd ? tEnd >= startDate : true;
      return startsBeforeWeekEnd && endsAfterWeekStart;
    });

    // Fallback: if no tasks overlap exact calendar week (e.g. mock data timeframe),
    // show tasks for this resource from current week period or active tasks
    if (matching.length === 0) {
      matching = this.allTasksSnapshot.filter(t => t.resourceName === this.dayWorkResource && (t.week === 'W2' || t.status !== 'Completed'));
      if (matching.length === 0) {
        matching = this.allTasksSnapshot.filter(t => t.resourceName === this.dayWorkResource);
      }
    }

    this.dayWorkCurrentWeekTasks = matching;

    // Format week info badge
    this.dayWorkCurrentWeekInfo = `${this.formatAppDate(start)} – ${this.formatAppDate(end)}`;

    // Check overdue tasks when resource changes
    setTimeout(() => this.checkAndShowOverduePopup(false), 150);
  }

  /** Generate schedule from config + tasks based on active tracking mode */
  generateDaySchedule(): void {
    if (!this.dayWorkResource) return;

    const slots: DayScheduleSlot[] = [];
    const { start } = this.getCurrentWeekRange();
    const [startY, startM, startD] = start.split('-').map(Number);
    const monDate = new Date(startY, startM - 1, startD);

    // Parse login/logoff times
    const [loginH, loginM] = this.dayWorkLoginTime.split(':').map(Number);
    const [logoffH, logoffM] = this.dayWorkLogoffTime.split(':').map(Number);
    const loginMinutes = loginH * 60 + loginM;
    const logoffMinutes = logoffH * 60 + logoffM;
    const hoursPerDay = Math.max(1, Math.min(24, Number(this.dayWorkHoursPerDay) || 8));

    // Queue tasks from current week with their hours
    interface TaskQueue { project: string; title: string; desc: string; hours: number; }
    const queue: TaskQueue[] = [];
    this.dayWorkCurrentWeekTasks.forEach(t => {
      const taskHrs = typeof t.hours === 'number' && t.hours > 0 ? t.hours : hoursPerDay;
      queue.push({
        project: t.projectName,
        title: t.taskTitle,
        desc: t.taskDescription || t.taskTitle,
        hours: taskHrs
      });
    });

    if (queue.length === 0) {
      queue.push({
        project: this.dayWorkProjectList[0] || 'General',
        title: 'Sprint Development Task',
        desc: 'General sprint development and feature updates',
        hours: hoursPerDay
      });
    }

    let queueIdx = 0;
    let remainingHoursInTask = queue[0].hours;
    let slotId = 1;
    let taskCounter = 1; // Generates task1, task2, task3... sequentially

    for (let dayOff = 0; dayOff < 5; dayOff++) {
      const dayDate = new Date(monDate.getFullYear(), monDate.getMonth(), monDate.getDate() + dayOff);
      const dateStr = this.formatLocalDate(dayDate);

      // Check leave for this day
      const leaveEntry = this.dayWorkLeaveDays.find(ld => ld.date === dateStr);
      const leaveType = leaveEntry?.leaveType ?? 'none';

      if (leaveType === 'full') {
        // Full day leave
        const hourLabel = `${this.pad(loginH)}:${this.pad(loginM)} – ${this.pad(logoffH)}:${this.pad(logoffM)}`;
        slots.push({
          id: `slot-${slotId++}`,
          hour: hourLabel,
          date: dateStr,
          taskTitle: 'Full Day Leave',
          taskDescription: 'On Leave (Full Day)',
          projectName: 'Leave',
          status: 'Pending',
          isLeave: true,
          isLunch: false,
          leaveType: 'full',
          durationHours: hoursPerDay,
          trackingMode: this.dayWorkTrackingMode
        });
        continue;
      }

      const halfLeave = leaveType === 'half';
      const halfHours = Math.floor(hoursPerDay / 2);
      let currentMinute = loginMinutes;

      // If half leave, the morning half is marked as Leave
      if (halfLeave) {
        const leaveEndMin = currentMinute + halfHours * 60;
        const leaveEndH = Math.floor(leaveEndMin / 60);
        const leaveEndM = leaveEndMin % 60;
        const leaveHourLabel = `${this.pad(loginH)}:${this.pad(loginM)} – ${this.pad(leaveEndH)}:${this.pad(leaveEndM)}`;
        slots.push({
          id: `slot-${slotId++}`,
          hour: leaveHourLabel,
          date: dateStr,
          taskTitle: 'Half Day Leave',
          taskDescription: 'On Leave (First Half)',
          projectName: 'Leave',
          status: 'Pending',
          isLeave: true,
          isLunch: false,
          leaveType: 'half',
          durationHours: halfHours,
          trackingMode: this.dayWorkTrackingMode
        });
        currentMinute = leaveEndMin;
      }

      // Working hours to schedule today
      const workHoursToday = halfLeave ? (hoursPerDay - halfHours) : hoursPerDay;

      // ── MODE 1: HOURLY (1-Hour Slots) ──
      if (this.dayWorkTrackingMode === 'hourly') {
        const morningHours = halfLeave ? 0 : Math.floor(workHoursToday / 2);
        const afternoonHours = workHoursToday - morningHours;

        // Morning 1-hour slots (before lunch)
        for (let h = 0; h < morningHours; h++) {
          const slotStartH = Math.floor(currentMinute / 60);
          const slotStartM = currentMinute % 60;
          const slotEndMin = currentMinute + 60;
          const slotEndH = Math.floor(slotEndMin / 60);
          const slotEndM = slotEndMin % 60;
          const hourLabel = `${this.pad(slotStartH)}:${this.pad(slotStartM)} – ${this.pad(slotEndH)}:${this.pad(slotEndM)}`;

          const cur = queue[queueIdx % queue.length];
          const taskTitle = `task${taskCounter++}`;
          const taskDesc = cur.title;
          const projectName = cur.project;

          remainingHoursInTask--;
          if (remainingHoursInTask <= 0) {
            queueIdx = (queueIdx + 1) % queue.length;
            remainingHoursInTask = queue[queueIdx % queue.length]?.hours ?? hoursPerDay;
          }

          slots.push({
            id: `slot-${slotId++}`,
            hour: hourLabel,
            date: dateStr,
            taskTitle,
            taskDescription: taskDesc,
            projectName,
            status: 'Pending',
            isLeave: false,
            isLunch: false,
            leaveType: 'none',
            durationHours: 1,
            trackingMode: 'hourly'
          });
          currentMinute += 60;
        }

        // Lunch break slot
        if (this.dayWorkLunchMinutes > 0 && !halfLeave) {
          const lunchEndMin = currentMinute + this.dayWorkLunchMinutes;
          const lunchStartH = Math.floor(currentMinute / 60);
          const lunchStartM = currentMinute % 60;
          const lunchEndH = Math.floor(lunchEndMin / 60);
          const lunchEndM = lunchEndMin % 60;
          const lunchLabel = `${this.pad(lunchStartH)}:${this.pad(lunchStartM)} – ${this.pad(lunchEndH)}:${this.pad(lunchEndM)}`;

          slots.push({
            id: `slot-${slotId++}`,
            hour: lunchLabel,
            date: dateStr,
            taskTitle: 'Lunch Break',
            taskDescription: 'Midday meal & rest break',
            projectName: 'Break',
            status: 'Pending',
            isLeave: false,
            isLunch: true,
            leaveType: 'none',
            durationHours: this.dayWorkLunchMinutes / 60,
            trackingMode: 'hourly'
          });
          currentMinute = lunchEndMin;
        }

        // Afternoon 1-hour slots (after lunch)
        for (let h = 0; h < afternoonHours; h++) {
          const slotStartH = Math.floor(currentMinute / 60);
          const slotStartM = currentMinute % 60;
          const slotEndMin = currentMinute + 60;
          const slotEndH = Math.floor(slotEndMin / 60);
          const slotEndM = slotEndMin % 60;
          const hourLabel = `${this.pad(slotStartH)}:${this.pad(slotStartM)} – ${this.pad(slotEndH)}:${this.pad(slotEndM)}`;

          const cur = queue[queueIdx % queue.length];
          const taskTitle = `task${taskCounter++}`;
          const taskDesc = cur.title;
          const projectName = cur.project;

          remainingHoursInTask--;
          if (remainingHoursInTask <= 0) {
            queueIdx = (queueIdx + 1) % queue.length;
            remainingHoursInTask = queue[queueIdx % queue.length]?.hours ?? hoursPerDay;
          }

          slots.push({
            id: `slot-${slotId++}`,
            hour: hourLabel,
            date: dateStr,
            taskTitle,
            taskDescription: taskDesc,
            projectName,
            status: 'Pending',
            isLeave: false,
            isLunch: false,
            leaveType: 'none',
            durationHours: 1,
            trackingMode: 'hourly'
          });
          currentMinute += 60;
        }

      // ── MODE 2: DAY-WISE (8 Hours Allocation) ──
      } else if (this.dayWorkTrackingMode === 'day-wise') {
        const cur = queue[queueIdx % queue.length];
        const taskTitle = `task${taskCounter++}`;
        const taskDesc = `${cur.title} — ${cur.desc}`;
        const projectName = cur.project;

        const dayStartH = Math.floor(currentMinute / 60);
        const dayStartM = currentMinute % 60;
        const dayEndMin = currentMinute + workHoursToday * 60 + (this.dayWorkLunchMinutes > 0 && !halfLeave ? this.dayWorkLunchMinutes : 0);
        const dayEndH = Math.floor(dayEndMin / 60);
        const dayEndM = dayEndMin % 60;
        const hourLabel = `${this.pad(dayStartH)}:${this.pad(dayStartM)} – ${this.pad(dayEndH)}:${this.pad(dayEndM)} (${workHoursToday} hrs)`;

        slots.push({
          id: `slot-${slotId++}`,
          hour: hourLabel,
          date: dateStr,
          taskTitle,
          taskDescription: taskDesc,
          projectName,
          status: 'Pending',
          isLeave: false,
          isLunch: false,
          leaveType: 'none',
          durationHours: workHoursToday,
          trackingMode: 'day-wise'
        });

        remainingHoursInTask -= workHoursToday;
        if (remainingHoursInTask <= 0) {
          queueIdx = (queueIdx + 1) % queue.length;
          remainingHoursInTask = queue[queueIdx % queue.length]?.hours ?? hoursPerDay;
        }

      // ── MODE 3: ACTUAL HOURS (Defined in Weekly Status Screen) ──
      } else if (this.dayWorkTrackingMode === 'actual-hours') {
        let availableMinutes = workHoursToday * 60;
        const morningMinutes = (!halfLeave && this.dayWorkLunchMinutes > 0) ? Math.floor(workHoursToday / 2) * 60 : availableMinutes;
        let elapsedToday = 0;
        let lunchInserted = false;

        while (availableMinutes > 0) {
          const cur = queue[queueIdx % queue.length];
          const taskRemainingMinutes = remainingHoursInTask * 60;

          // How much time to allocate in this block
          let blockMinutes = Math.min(taskRemainingMinutes, availableMinutes);

          // Check if lunch break should be inserted before or splitting this block
          if (!halfLeave && this.dayWorkLunchMinutes > 0 && !lunchInserted && elapsedToday >= morningMinutes) {
            const lunchStartH = Math.floor(currentMinute / 60);
            const lunchStartM = currentMinute % 60;
            const lunchEndMin = currentMinute + this.dayWorkLunchMinutes;
            const lunchEndH = Math.floor(lunchEndMin / 60);
            const lunchEndM = lunchEndMin % 60;
            const lunchLabel = `${this.pad(lunchStartH)}:${this.pad(lunchStartM)} – ${this.pad(lunchEndH)}:${this.pad(lunchEndM)}`;

            slots.push({
              id: `slot-${slotId++}`,
              hour: lunchLabel,
              date: dateStr,
              taskTitle: 'Lunch Break',
              taskDescription: 'Midday meal & rest break',
              projectName: 'Break',
              status: 'Pending',
              isLeave: false,
              isLunch: true,
              leaveType: 'none',
              durationHours: this.dayWorkLunchMinutes / 60,
              trackingMode: 'actual-hours'
            });
            currentMinute = lunchEndMin;
            lunchInserted = true;
          }

          if (!halfLeave && this.dayWorkLunchMinutes > 0 && !lunchInserted && (elapsedToday + blockMinutes > morningMinutes)) {
            blockMinutes = morningMinutes - elapsedToday;
          }

          if (blockMinutes <= 0 && !lunchInserted && this.dayWorkLunchMinutes > 0) {
            const lunchStartH = Math.floor(currentMinute / 60);
            const lunchStartM = currentMinute % 60;
            const lunchEndMin = currentMinute + this.dayWorkLunchMinutes;
            const lunchEndH = Math.floor(lunchEndMin / 60);
            const lunchEndM = lunchEndMin % 60;
            const lunchLabel = `${this.pad(lunchStartH)}:${this.pad(lunchStartM)} – ${this.pad(lunchEndH)}:${this.pad(lunchEndM)}`;

            slots.push({
              id: `slot-${slotId++}`,
              hour: lunchLabel,
              date: dateStr,
              taskTitle: 'Lunch Break',
              taskDescription: 'Midday meal & rest break',
              projectName: 'Break',
              status: 'Pending',
              isLeave: false,
              isLunch: true,
              leaveType: 'none',
              durationHours: this.dayWorkLunchMinutes / 60,
              trackingMode: 'actual-hours'
            });
            currentMinute = lunchEndMin;
            lunchInserted = true;
            continue;
          }

          const blockHours = Math.round((blockMinutes / 60) * 10) / 10;
          const slotStartH = Math.floor(currentMinute / 60);
          const slotStartM = currentMinute % 60;
          const slotEndMin = currentMinute + blockMinutes;
          const slotEndH = Math.floor(slotEndMin / 60);
          const slotEndM = slotEndMin % 60;
          const hourLabel = `${this.pad(slotStartH)}:${this.pad(slotStartM)} – ${this.pad(slotEndH)}:${this.pad(slotEndM)} (${blockHours} ${blockHours === 1 ? 'hr' : 'hrs'})`;

          const taskTitle = `task${taskCounter++}`;
          const taskDesc = `${cur.title} [Actual: ${cur.hours}h]`;
          const projectName = cur.project;

          slots.push({
            id: `slot-${slotId++}`,
            hour: hourLabel,
            date: dateStr,
            taskTitle,
            taskDescription: taskDesc,
            projectName,
            status: 'Pending',
            isLeave: false,
            isLunch: false,
            leaveType: 'none',
            durationHours: blockHours,
            trackingMode: 'actual-hours'
          });

          remainingHoursInTask -= blockHours;
          if (remainingHoursInTask <= 0.05) {
            queueIdx = (queueIdx + 1) % queue.length;
            remainingHoursInTask = queue[queueIdx % queue.length]?.hours ?? hoursPerDay;
          }

          availableMinutes -= blockMinutes;
          elapsedToday += blockMinutes;
          currentMinute = slotEndMin;
        }
      }
    }

    this.dayScheduleSlots = slots;
    this.persistDaySchedule();

    // Check overdue tasks for newly generated schedule
    setTimeout(() => this.checkAndShowOverduePopup(false), 150);
  }

  private pad(n: number): string {
    return n.toString().padStart(2, '0');
  }

  saveSlotEdit(slot: DayScheduleSlot): void {
    this.editingSlotId = '';
    this.persistDaySchedule();
  }

  saveSlotToHourlyUpdates(slot: DayScheduleSlot): void {
    const durTag = slot.durationHours ? ` [${slot.durationHours}h]` : '';
    this.workTrackerService.addHourlyUpdate({
      id: '',
      date: slot.date,
      hour: slot.hour,
      taskDescription: `[${slot.projectName}] ${slot.taskTitle}: ${slot.taskDescription}${durTag}`,
      status: slot.status as any,
      isVisible: true
    });
  }

  /** Check if any slots have passed their time and are not completed; tailored to active tracking mode and reminder frequency */
  checkAndShowOverduePopup(isManual: boolean = false): void {
    if (!this.dayWorkResource || this.dayScheduleSlots.length === 0) return;

    const now = new Date();
    const todayStr = this.formatLocalDate(now);
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const overdueSlots = this.dayScheduleSlots.filter(slot => {
      if (slot.isLeave || slot.isLunch) return false;
      if (slot.status === 'Completed') return false;

      // Slot on a previous day of current week is overdue
      if (slot.date < todayStr) {
        return true;
      }

      // Slot on today whose end time has passed
      if (slot.date === todayStr) {
        const parts = slot.hour.split(/[-–—]/).map(s => s.trim());
        if (parts.length >= 2) {
          const timeToken = parts[1].split(' ')[0];
          const [endH, endM] = timeToken.split(':').map(Number);
          if (!isNaN(endH) && !isNaN(endM)) {
            const slotEndMinutes = endH * 60 + endM;
            return slotEndMinutes <= currentMinutes;
          }
        }
      }

      return false;
    });

    if (overdueSlots.length === 0) {
      this.showOverdueTaskPopup = false;
      return;
    }

    // If not triggered manually by button click, respect reminder frequency setting
    if (!isManual) {
      if (this.overdueReminderFrequency === 'manual') {
        // Only on Button Click: Do not prompt automatically
        return;
      }

      if (this.overdueReminderFrequency === 'every-hour') {
        // Every One Hour: Display once every hour while overdue tasks remain
        const oneHourMs = 60 * 60 * 1000;
        if (this.lastOverduePopupDismissedTime && (Date.now() - this.lastOverduePopupDismissedTime < oneHourMs)) {
          return;
        }
      }

      if (this.overdueReminderFrequency === 'daily-eod') {
        // Daily at EOD: Display once at the end of each working day (logoff time)
        const [logoffH, logoffM] = (this.dayWorkLogoffTime || '18:00').split(':').map(Number);
        const logoffMinutes = (logoffH || 18) * 60 + (logoffM || 0);
        if (currentMinutes < logoffMinutes) {
          return;
        }
        if (this.lastOverduePopupDismissedDate === todayStr) {
          return;
        }
      }

      // 'until-completed': Continuously prompt whenever overdue tasks exist until completed
    }

    let items: OverdueTaskItem[] = [];

    // 1. Hourly: Split tasks into hourly slots and require a status update for every hour
    if (this.dayWorkTrackingMode === 'hourly') {
      items = overdueSlots.map(slot => ({
        id: `hourly-${slot.id}`,
        slotIds: [slot.id],
        hour: slot.hour,
        taskTitle: slot.taskTitle,
        taskDescription: slot.taskDescription || slot.taskTitle,
        projectName: slot.projectName,
        date: slot.date,
        newStatus: '',
        reason: '',
        projectChoice: 'same',
        otherProjectName: '',
        durationHours: 1
      }));
    // 2. Day-wise (8 Hours): Allocate tasks based on an 8-hour working day and track each task's status
    } else if (this.dayWorkTrackingMode === 'day-wise') {
      items = overdueSlots.map(slot => ({
        id: `daywise-${slot.id}`,
        slotIds: [slot.id],
        hour: slot.hour,
        taskTitle: slot.taskTitle,
        taskDescription: slot.taskDescription || slot.taskTitle,
        projectName: slot.projectName,
        date: slot.date,
        newStatus: '',
        reason: '',
        projectChoice: 'same',
        otherProjectName: '',
        durationHours: slot.durationHours || 8
      }));
    // 3. Actual Hours: Display and split tasks according to the exact hours defined in the Weekly Status screen, and collect status updates for each scheduled hour
    } else {
      items = overdueSlots.map(slot => ({
        id: `actual-${slot.id}`,
        slotIds: [slot.id],
        hour: slot.hour,
        taskTitle: slot.taskTitle,
        taskDescription: slot.taskDescription || slot.taskTitle,
        projectName: slot.projectName,
        date: slot.date,
        newStatus: '',
        reason: '',
        projectChoice: 'same',
        otherProjectName: '',
        durationHours: slot.durationHours
      }));
    }

    this.overdueTaskItems = items;
    this.overduePopupSubmitted = false;
    this.showOverdueTaskPopup = true;
  }

  quickMarkAllCompleted(): void {
    this.overdueTaskItems.forEach(item => {
      if (!item.newStatus) {
        item.newStatus = 'Completed';
      }
    });
  }

  onOverdueStatusChange(item: OverdueTaskItem): void {
    if (item.newStatus !== 'In Progress') {
      item.reason = '';
      item.projectChoice = 'same';
      item.otherProjectName = '';
    }
  }

  isItemValid(item: OverdueTaskItem): boolean {
    if (!item.newStatus) return false;
    if (item.newStatus === 'In Progress') {
      if (!item.reason || !item.reason.trim()) return false;
      if (item.projectChoice === 'other' && (!item.otherProjectName || !item.otherProjectName.trim())) return false;
    }
    return true;
  }

  isOverduePopupValid(): boolean {
    if (this.overdueTaskItems.length === 0) return true;
    return this.overdueTaskItems.every(item => this.isItemValid(item));
  }

  getInvalidItemCount(): number {
    return this.overdueTaskItems.filter(item => !this.isItemValid(item)).length;
  }

  submitOverduePopup(): void {
    this.overduePopupSubmitted = true;
    // Popup WILL NOT CLOSE if any item is invalid!
    if (!this.isOverduePopupValid()) {
      return;
    }

    // Apply all updates back to constituent schedule slots
    this.overdueTaskItems.forEach(item => {
      item.slotIds.forEach(slotId => {
        const slot = this.dayScheduleSlots.find(s => s.id === slotId);
        if (slot) {
          slot.status = item.newStatus as any;
          if (item.newStatus === 'In Progress' && item.reason) {
            const projNote = item.projectChoice === 'other' ? ` [Working on ${item.otherProjectName}]` : '';
            slot.taskDescription = `${item.taskDescription} (In Progress: ${item.reason}${projNote})`;
            if (item.projectChoice === 'other' && item.otherProjectName) {
              slot.projectName = item.otherProjectName;
            }
          }
          // Save update to hourly log
          this.saveSlotToHourlyUpdates(slot);
        }
      });
    });

    this.lastOverduePopupDismissedTime = Date.now();
    this.lastOverduePopupDismissedDate = this.formatLocalDate(new Date());
    localStorage.setItem('u2app.overdueLastDismissedTime', String(this.lastOverduePopupDismissedTime));
    localStorage.setItem('u2app.overdueLastDismissedDate', this.lastOverduePopupDismissedDate);

    this.persistDaySchedule();
    this.showOverdueTaskPopup = false;
    this.overdueTaskItems = [];
    this.overduePopupSubmitted = false;
  }

  private createEmptyTask(): DeveloperTask {
    return {
      taskId: '',
      week: '',
      resourceName: '',
      projectName: '',
      module: '',
      taskTitle: '',
      taskDescription: '',
      taskType: 'Feature',
      status: 'Pending',
      priority: 'Medium',
      size: 'M',
      hours: 0,
      startDate: '',
      dueDate: '',
      completedDate: '',
      progress: 0,
      tags: '',
      comments: '',
      isVisible: true
    };
  }

  private createEmptyRelease(): ReleaseTrack {
    return {
      id: '',
      title: '',
      category: '',
      module: '',
      environment: 'Dev',
      type: 'Feature',
      priority: 'Medium',
      status: 'Development',
      prdStatus: 'Draft',
      assignedTo: '',
      createdDate: '',
      targetDate: '',
      completedDate: '',
      progress: 0,
      remarks: '',
      sourceSheet: 'Dashboard',
      dependency: '',
      tags: '',
      isVisible: true
    };
  }

  private createEmptyHourlyUpdate(): HourlyWorkUpdate {
    return {
      id: '',
      date: '',
      hour: '',
      taskDescription: '',
      status: 'Pending',
      isVisible: true
    };
  }
}
