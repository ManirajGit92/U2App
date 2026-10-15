import { ChangeDetectorRef, Component, EventEmitter, Input, NgZone, OnDestroy, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WorkTrackerService, DeveloperTask, HourlyUpdateStatus, HourlyWorkUpdate, ReleaseTrack, WorkTrackerData } from '../work-tracker.service';
import { WorkTrackerTab } from '../work-tracker.component';
import { BehaviorSubject, Subscription, combineLatest, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { NotificationReminder, NotificationReminderService } from '../../../core/services/notification-reminder.service';
import { ThemeService } from '../../../core/services/theme.service';

interface HourlyReminderPopup {
  hour: string;
  taskDescription: string;
  status: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
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
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Right Card: Project Timeline / Roadmap -->
            <div class="dash-card">
              <div class="dash-card-header">
                <h3 class="dash-card-title">Project Timeline / Roadmap</h3>
                <div class="header-range-tag">
                  <span>Jan 2025 - Dec 2025</span>
                  <span class="range-arrow">›</span>
                </div>
              </div>

              <div class="gantt-chart-container">
                <!-- Month Header Row -->
                <div class="gantt-header-row">
                  <div class="gantt-project-col">Project</div>
                  <div class="gantt-months-grid">
                    <div *ngFor="let m of months; let i = index" class="gantt-month-col" [class.is-current-month]="i === 9">
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
            <!-- Left Card: Team Work Summary (This Week) -->
            <div class="dash-card">
              <div class="dash-card-header">
                <h3 class="dash-card-title">Team Work Summary (This Week)</h3>
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
                    <div class="emp-task-scale">
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
                    <svg viewBox="0 0 310 110" class="trends-svg">
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
                    <div class="trends-x-axis">
                      <span *ngFor="let pt of workTrends">{{ pt.week }}</span>
                    </div>
                  </div>
                </div>

                <!-- 5. Hours Spent (This Week) -->
                <div class="mini-analytic-card">
                  <div class="mini-card-header-row">
                    <span class="mini-card-title">Hours Spent (This Week)</span>
                  </div>
                  <div class="mini-legend-row multi-legend">
                    <span class="mini-leg-item"><span class="leg-box bg-cat-frontend"></span> Frontend</span>
                    <span class="mini-leg-item"><span class="leg-box bg-cat-backend"></span> Backend</span>
                    <span class="mini-leg-item"><span class="leg-box bg-cat-testing"></span> Testing</span>
                    <span class="mini-leg-item"><span class="leg-box bg-cat-paba"></span> PA/BA</span>
                  </div>
                  <div class="stacked-bar-chart-wrap">
                    <div class="y-axis-labels">
                      <span>40</span>
                      <span>30</span>
                      <span>20</span>
                      <span>10</span>
                      <span>0</span>
                    </div>
                    <div class="stacked-plot">
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

      <!-- Filters Section for Weekly Status & Project Status Views -->
      @if (activeView === 'weekly-status' || activeView === 'project-status') {
      <div class="glass-card filters-section">
        @if (activeView === 'weekly-status') {
        <div class="table-header compact-header">
          <div class="hud-header-title">
            <svg *ngIf="themeService.isJarvis()" class="hud-sec-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="#00c8ff" stroke-width="2"/><circle cx="12" cy="12" r="3" fill="#00c8ff"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4" stroke="#00c8ff" stroke-width="2"/></svg>
            <h3>Task Data Filters</h3>
          </div>
          <button class="btn-table secondary" type="button" (click)="toggleSection('filters')">{{ sections.filters ? 'Collapse' : 'Expand' }}</button>
        </div>
        @if (sections.filters) {
        <div class="filters-grid">
          <div class="filter-group">
            <label>
              <i *ngIf="themeService.isJarvis()" class="pi pi-user filter-icon"></i>
              Resource Name
            </label>
            <select (change)="onFilterChange('resource', $event)">
              <option value="">All Resources</option>
              <option *ngFor="let res of uniqueResources$ | async" [value]="res">{{ res }}</option>
            </select>
          </div>
          <div class="filter-group">
            <label>
              <i *ngIf="themeService.isJarvis()" class="pi pi-folder filter-icon"></i>
              Project Name
            </label>
            <select (change)="onFilterChange('project', $event)">
              <option value="">All Projects</option>
              <option *ngFor="let proj of uniqueProjects$ | async" [value]="proj">{{ proj }}</option>
            </select>
          </div>
          <div class="filter-group">
            <label>
              <i *ngIf="themeService.isJarvis()" class="pi pi-cog filter-icon"></i>
              Task Status
            </label>
            <select (change)="onFilterChange('status', $event)">
              <option value="">All Statuses</option>
              <option *ngFor="let stat of uniqueStatuses$ | async" [value]="stat">{{ stat }}</option>
            </select>
          </div>
          <div class="filter-group">
            <label>
              <i *ngIf="themeService.isJarvis()" class="pi pi-flag filter-icon"></i>
              Task Priority
            </label>
            <select (change)="onFilterChange('priority', $event)">
              <option value="">All Priorities</option>
              <option *ngFor="let prio of uniquePriorities$ | async" [value]="prio">{{ prio }}</option>
            </select>
          </div>
        </div>
        }
        }

        @if (activeView === 'project-status') {
        <div class="table-header compact-header">
          <div class="hud-header-title">
            <svg *ngIf="themeService.isJarvis()" class="hud-sec-icon" viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" fill="none" stroke="#00c8ff" stroke-width="2"/><polyline points="3.27 6.96 12 12.01 20.73 6.96" fill="none" stroke="#00c8ff" stroke-width="2"/><line x1="12" y1="22.08" x2="12" y2="12" stroke="#00c8ff" stroke-width="2"/></svg>
            <h3>Release Data Filters</h3>
          </div>
          <button class="btn-table secondary" type="button" (click)="toggleSection('filters')">{{ sections.filters ? 'Collapse' : 'Expand' }}</button>
        </div>
        @if (sections.filters) {
        <div class="filters-grid">
          <div class="filter-group">
            <label>
              <i *ngIf="themeService.isJarvis()" class="pi pi-th-large filter-icon"></i>
              Category
            </label>
            <select (change)="onRelFilterChange('category', $event)">
              <option value="">All Categories</option>
              <option *ngFor="let cat of uniqueRelCategories$ | async" [value]="cat">{{ cat }}</option>
            </select>
          </div>
          <div class="filter-group">
            <label>
              <i *ngIf="themeService.isJarvis()" class="pi pi-database filter-icon"></i>
              Release Status
            </label>
            <select (change)="onRelFilterChange('status', $event)">
              <option value="">All Statuses</option>
              <option *ngFor="let stat of uniqueRelStatuses$ | async" [value]="stat">{{ stat }}</option>
            </select>
          </div>
          <div class="filter-group">
            <label>
              <i *ngIf="themeService.isJarvis()" class="pi pi-flag filter-icon"></i>
              Priority
            </label>
            <select (change)="onRelFilterChange('priority', $event)">
              <option value="">All Priorities</option>
              <option *ngFor="let prio of uniqueRelPriorities$ | async" [value]="prio">{{ prio }}</option>
            </select>
          </div>
          <div class="filter-group">
            <label>
              <i *ngIf="themeService.isJarvis()" class="pi pi-user filter-icon"></i>
              Assigned To
            </label>
            <select (change)="onRelFilterChange('assigned', $event)">
              <option value="">All Assignees</option>
              <option *ngFor="let assign of uniqueRelAssigned$ | async" [value]="assign">{{ assign }}</option>
            </select>
          </div>
        </div>
        }
        }
      </div>
      }

      <!-- Data Table Section (Hourly Updates) -->
      @if (activeView === 'day-work') {
      <div class="glass-card table-section">
        <div class="table-header">
          <div class="hud-header-title">
            <svg *ngIf="themeService.isJarvis()" class="hud-sec-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="none" stroke="#00c8ff" stroke-width="2"/><polyline points="12 6 12 12 16 14" stroke="#00c8ff" stroke-width="2"/></svg>
            <h2>Hourly Updates Data</h2>
          </div>
          <div class="table-actions">
            <button class="btn-table secondary" type="button" (click)="enableHourlyReminders()">
              {{ reminderPermissionLabel }}
            </button>
            <label class="voice-toggle">
              <input type="checkbox" [(ngModel)]="voiceRemindersEnabled" (ngModelChange)="rescheduleHourlyReminders()">
              Voice Reminder
            </label>
            <button class="btn-table" type="button" (click)="openHourlyModal()">Add Update</button>
            <button class="btn-table secondary" type="button" (click)="toggleHiddenHourlyRows()">
              {{ showHiddenHourlyRows ? 'Hide Hidden Rows' : 'Show Hidden Rows' }}
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
                <th>Time / Hour</th>
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
                  <td>{{ update.date | date:'mediumDate' }}</td>
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
                  {{ showHiddenHourlyRows ? 'No hourly updates found.' : 'No visible hourly updates found.' }}
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
                <th *ngIf="isTaskColVisible('resourceName')">Resource</th>
                <th *ngIf="isTaskColVisible('projectName')">Project</th>
                <th *ngIf="isTaskColVisible('module')">Module</th>
                <th *ngIf="isTaskColVisible('taskTitle')">Title</th>
                <th *ngIf="isTaskColVisible('taskType')">Type</th>
                <th *ngIf="isTaskColVisible('status')">Status</th>
                <th *ngIf="isTaskColVisible('priority')">Priority</th>
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
                <td *ngIf="isTaskColVisible('resourceName')"><input class="table-input" [(ngModel)]="inlineTaskForm.resourceName"></td>
                <td *ngIf="isTaskColVisible('projectName')"><input class="table-input" [(ngModel)]="inlineTaskForm.projectName"></td>
                <td *ngIf="isTaskColVisible('module')"><input class="table-input" [(ngModel)]="inlineTaskForm.module"></td>
                <td *ngIf="isTaskColVisible('taskTitle')"><input class="table-input" [(ngModel)]="inlineTaskForm.taskTitle"></td>
                <td *ngIf="isTaskColVisible('taskType')"><input class="table-input" [(ngModel)]="inlineTaskForm.taskType"></td>
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
                <td *ngIf="isTaskColVisible('startDate')">{{ task.startDate | date:'shortDate' }}</td>
                <td *ngIf="isTaskColVisible('dueDate')">{{ task.dueDate | date:'shortDate' }}</td>
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
                <th *ngIf="isReleaseColVisible('category')">Category</th>
                <th *ngIf="isReleaseColVisible('module')">Module</th>
                <th *ngIf="isReleaseColVisible('environment')">Current Environment</th>
                <th *ngIf="isReleaseColVisible('priority')">Priority</th>
                <th *ngIf="isReleaseColVisible('status')">Status</th>
                <th *ngIf="isReleaseColVisible('prdStatus')">PRD Status</th>
                <th *ngIf="isReleaseColVisible('assignedTo')">Assigned To</th>
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
                <td *ngIf="isReleaseColVisible('category')"><input class="table-input" [(ngModel)]="inlineReleaseForm.category"></td>
                <td *ngIf="isReleaseColVisible('module')"><input class="table-input" [(ngModel)]="inlineReleaseForm.module"></td>
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
                <td *ngIf="isReleaseColVisible('assignedTo')"><input class="table-input" [(ngModel)]="inlineReleaseForm.assignedTo"></td>
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
                <td *ngIf="isReleaseColVisible('targetDate')">{{ release.targetDate | date:'shortDate' }}</td>
                <td *ngIf="isReleaseColVisible('completedDate')">{{ release.completedDate | date:'shortDate' }}</td>
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

    .team-status-badge.team-status-excellent {
      background: #fee2e2;
      color: #dc2626;
    }

    .team-status-badge.team-status-dev {
      background: #fef3c7;
      color: #d97706;
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
  `]
})
export class DashboardComponent implements OnDestroy {
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

  selectedDateRange = 'Week 6 (Nov 10 - Nov 16, 2025)';
  selectedViewMode: 'day' | 'week' | 'month' | 'quarter' | 'half-year' | 'year' = 'week';
  currentPeriodSelection = 'W6';
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
      this.availablePeriodOptions = [
        { value: 'W1', label: 'Week 1 (Oct 06 - Oct 12, 2025)' },
        { value: 'W2', label: 'Week 2 (Oct 13 - Oct 19, 2025)' },
        { value: 'W3', label: 'Week 3 (Oct 20 - Oct 26, 2025)' },
        { value: 'W4', label: 'Week 4 (Oct 27 - Nov 02, 2025)' },
        { value: 'W5', label: 'Week 5 (Nov 03 - Nov 09, 2025)' },
        { value: 'W6', label: 'Week 6 (Nov 10 - Nov 16, 2025)' },
        { value: 'all', label: 'All Weeks (W1 - W6)' }
      ];
      if (!this.availablePeriodOptions.some(o => o.value === this.currentPeriodSelection)) {
        this.currentPeriodSelection = 'W6';
      }
    } else if (this.selectedViewMode === 'day') {
      this.availablePeriodOptions = [
        { value: '2025-10-15', label: 'Oct 15, 2025 (Today)' },
        { value: '2025-10-14', label: 'Oct 14, 2025 (Yesterday)' },
        { value: '2025-10-13', label: 'Oct 13, 2025' },
        { value: '2025-10-12', label: 'Oct 12, 2025' },
        { value: '2025-10-11', label: 'Oct 11, 2025' },
        { value: '2025-10-10', label: 'Oct 10, 2025' },
        { value: 'all', label: 'All Days' }
      ];
      if (!this.availablePeriodOptions.some(o => o.value === this.currentPeriodSelection)) {
        this.currentPeriodSelection = '2025-10-15';
      }
    } else if (this.selectedViewMode === 'month') {
      this.availablePeriodOptions = [
        { value: '01', label: 'January 2025' },
        { value: '02', label: 'February 2025' },
        { value: '03', label: 'March 2025' },
        { value: '04', label: 'April 2025' },
        { value: '05', label: 'May 2025' },
        { value: '06', label: 'June 2025' },
        { value: '07', label: 'July 2025' },
        { value: '08', label: 'August 2025' },
        { value: '09', label: 'September 2025' },
        { value: '10', label: 'October 2025' },
        { value: '11', label: 'November 2025' },
        { value: '12', label: 'December 2025' },
        { value: 'all', label: 'All Months' }
      ];
      if (!this.availablePeriodOptions.some(o => o.value === this.currentPeriodSelection)) {
        this.currentPeriodSelection = '10';
      }
    } else if (this.selectedViewMode === 'quarter') {
      this.availablePeriodOptions = [
        { value: 'Q1', label: 'Q1 2025 (Jan - Mar)' },
        { value: 'Q2', label: 'Q2 2025 (Apr - Jun)' },
        { value: 'Q3', label: 'Q3 2025 (Jul - Sep)' },
        { value: 'Q4', label: 'Q4 2025 (Oct - Dec)' },
        { value: 'all', label: 'All Quarters' }
      ];
      if (!this.availablePeriodOptions.some(o => o.value === this.currentPeriodSelection)) {
        this.currentPeriodSelection = 'Q4';
      }
    } else if (this.selectedViewMode === 'half-year') {
      this.availablePeriodOptions = [
        { value: 'H1', label: 'H1 2025 (Jan - Jun)' },
        { value: 'H2', label: 'H2 2025 (Jul - Dec)' },
        { value: 'all', label: 'All Half-Years' }
      ];
      if (!this.availablePeriodOptions.some(o => o.value === this.currentPeriodSelection)) {
        this.currentPeriodSelection = 'H2';
      }
    } else if (this.selectedViewMode === 'year') {
      this.availablePeriodOptions = [
        { value: '2024', label: 'Year 2024' },
        { value: '2025', label: 'Year 2025' },
        { value: '2026', label: 'Year 2026' },
        { value: 'all', label: 'All Years' }
      ];
      if (!this.availablePeriodOptions.some(o => o.value === this.currentPeriodSelection)) {
        this.currentPeriodSelection = '2025';
      }
    }
    this.updateSelectedDateRangeText();
  }

  onViewModeChange(): void {
    this.buildAvailablePeriodOptions();
    if (this.latestTrackerData) {
      this.recomputeDashboardData(this.latestTrackerData);
    }
  }

  onPeriodSelectionChange(): void {
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
    this.onPeriodSelectionChange();
  }

  navigateWeek(direction: number): void {
    this.navigatePeriod(direction);
  }

  getCurrentPeriodLabel(): string {
    const opt = this.availablePeriodOptions.find(o => o.value === this.currentPeriodSelection);
    return opt ? opt.label : this.currentPeriodSelection;
  }

  private updateSelectedDateRangeText(): void {
    const opt = this.availablePeriodOptions.find(o => o.value === this.currentPeriodSelection);
    this.selectedDateRange = opt ? opt.label : this.currentPeriodSelection;
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
    } catch {}
  }

  private saveTaskColumns(): void {
    try {
      localStorage.setItem('u2app_wt_task_cols', JSON.stringify(this.taskColumns));
    } catch {}
  }

  private saveReleaseColumns(): void {
    try {
      localStorage.setItem('u2app_wt_rel_cols', JSON.stringify(this.releaseColumns));
    } catch {}
  }

  getTasksForCurrentPeriod(tasks: DeveloperTask[]): DeveloperTask[] {
    if (this.currentPeriodSelection === 'all') {
      return tasks;
    }

    if (this.selectedViewMode === 'week') {
      const target = this.currentPeriodSelection.trim().toUpperCase();
      return tasks.filter(t => (t.week || '').trim().toUpperCase() === target);
    }

    if (this.selectedViewMode === 'day') {
      return tasks.filter(t => t.startDate === this.currentPeriodSelection || t.dueDate === this.currentPeriodSelection);
    }

    if (this.selectedViewMode === 'month') {
      return tasks.filter(t => {
        const d = t.startDate || t.dueDate || '';
        if (!d) return false;
        const m = d.split('-')[1];
        return m === this.currentPeriodSelection;
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
        const d = t.startDate || t.dueDate || '';
        if (!d) return false;
        const m = d.split('-')[1];
        return allowed.includes(m);
      });
    }

    if (this.selectedViewMode === 'half-year') {
      const allowed = this.currentPeriodSelection === 'H1' ? ['01', '02', '03', '04', '05', '06'] : ['07', '08', '09', '10', '11', '12'];
      return tasks.filter(t => {
        const d = t.startDate || t.dueDate || '';
        if (!d) return false;
        const m = d.split('-')[1];
        return allowed.includes(m);
      });
    }

    if (this.selectedViewMode === 'year') {
      return tasks.filter(t => {
        const d = t.startDate || t.dueDate || '';
        return d.startsWith(this.currentPeriodSelection);
      });
    }

    return tasks;
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
    
    const baseProjects = ['U2Tools', 'Standup Note', 'S2App ECommerce', 'MatchGuide', 'Dweber', 'Excelendsite'];
    this.projectList = Array.from(new Set([...foundProjects, ...baseProjects])).sort();

    // Filter tasks and releases by selectedProjectFilter if not 'All Projects'
    const isAll = this.selectedProjectFilter === 'All Projects';
    const filterProj = this.selectedProjectFilter;

    const filteredTasks = isAll
      ? allTasks
      : allTasks.filter(t => t.projectName?.toLowerCase() === filterProj.toLowerCase());

    const filteredReleases = isAll
      ? allReleases
      : allReleases.filter(r => 
          (r.title && r.title.toLowerCase().includes(filterProj.toLowerCase())) ||
          (r.category && r.category.toLowerCase().includes(filterProj.toLowerCase())) ||
          (r.tags && r.tags.toLowerCase().includes(filterProj.toLowerCase()))
        );

    // 2. KPI: Total Employees
    const empSet = new Set<string>();
    filteredTasks.forEach(t => { if (t.resourceName) empSet.add(t.resourceName); });
    filteredReleases.forEach(r => { if (r.assignedTo) empSet.add(r.assignedTo); });
    if (isAll && empSet.size < 5) {
      ['Maniraj', 'Vamsi', 'Arun', 'Priya', 'Karthik', 'Rohit', 'Erika', 'Bob', 'Karina'].forEach(e => empSet.add(e));
    }
    this.kpiTotalEmployees = empSet.size || 1;
    this.kpiActiveEmployees = Math.max(1, Math.round(this.kpiTotalEmployees * 0.75));
    this.kpiEmployeesSubtext = isAll ? 'Across all projects' : `In ${filterProj}`;

    // 3. KPI: Total Tasks
    this.kpiTotalTasks = filteredTasks.length;
    const completedTasksCount = filteredTasks.filter(t => t.status === 'Completed' || t.progress === 100).length;
    this.kpiCompletedTasks = completedTasksCount;
    this.kpiTasksSubtext = `${completedTasksCount} completed`;

    // 4. KPI: Total Hours Logged (based on total sum of hours on the selected period/week)
    const periodTasks = this.getTasksForCurrentPeriod(filteredTasks);
    const sumHours = periodTasks.reduce((acc, t) => {
      if (typeof t.hours === 'number' && !isNaN(t.hours)) {
        return acc + t.hours;
      }
      const multiplier = t.size === 'L' ? 12 : t.size === 'S' ? 4 : 8;
      return acc + multiplier;
    }, 0);
    this.kpiTotalHours = Math.round(sumHours);
    this.kpiHoursTrend = Math.min(100, Math.round((completedTasksCount / Math.max(this.kpiTotalTasks, 1)) * 15 + 5));
    this.kpiHoursSubtext = `Selected: ${this.getCurrentPeriodLabel()} (${periodTasks.length} tasks)`;

    // 5. KPI: Task Completion %
    if (this.kpiTotalTasks > 0) {
      const sumProgress = filteredTasks.reduce((acc, t) => acc + (t.progress || 0), 0);
      this.kpiTaskCompletionPct = Math.round(sumProgress / this.kpiTotalTasks);
    } else {
      this.kpiTaskCompletionPct = 0;
    }
    this.kpiCompletionTrend = Math.max(4, Math.round(this.kpiTaskCompletionPct * 0.1));
    this.kpiCompletionSubtext = isAll ? 'Across all active sprints' : `Sprint completion for ${filterProj}`;

    // 6. KPI: Active Projects
    const allProjNames = Array.from(new Set(allTasks.map(t => t.projectName).filter(Boolean)));
    const activeProjs = allProjNames.filter(p => {
      const pTasks = allTasks.filter(t => t.projectName === p);
      return pTasks.some(t => t.status !== 'Completed' && t.progress < 100);
    });
    const liveProjs = allProjNames.filter(p => {
      const pTasks = allTasks.filter(t => t.projectName === p);
      return pTasks.length > 0 && pTasks.every(t => t.status === 'Completed' || t.progress === 100);
    });
    this.kpiActiveProjects = isAll ? (allProjNames.length || this.projectList.length) : 1;
    this.kpiNewProjects = Math.max(1, activeProjs.length);
    this.kpiProjectsSubtext = `${Math.max(liveProjs.length, 2)} Production  |  ${Math.max(activeProjs.length, 4)} In Progress`;

    // 7. Middle Section: Project Status Overview Table
    const projectsToDisplay = isAll ? this.projectList : [filterProj];
    this.overviewProjects = projectsToDisplay.map((pName, idx) => {
      const pTasks = allTasks.filter(t => t.projectName?.toLowerCase() === pName.toLowerCase());
      const pRel = allReleases.find(r => 
        (r.title && r.title.toLowerCase().includes(pName.toLowerCase())) ||
        (r.category && r.category.toLowerCase().includes(pName.toLowerCase())) ||
        (r.tags && r.tags.toLowerCase().includes(pName.toLowerCase()))
      );

      let avgProg = 0;
      if (pTasks.length > 0) {
        avgProg = Math.round(pTasks.reduce((acc, t) => acc + (t.progress || 0), 0) / pTasks.length);
      } else if (pRel) {
        avgProg = pRel.progress || 50;
      } else {
        avgProg = 70;
      }

      let env = pRel?.status === 'Released' ? 'Production' : (pRel?.status === 'Testing' ? 'Beta' : (pRel?.status === 'Staging' ? 'Alpha' : 'Dev'));
      let stat = 'Development';
      if (avgProg >= 100 || pRel?.status === 'Released') {
        stat = 'Live';
        env = 'Production';
      } else if (avgProg >= 80) {
        stat = 'Testing Complete';
      } else if (avgProg >= 65) {
        stat = 'UAT in Progress';
      } else {
        stat = 'Development';
      }

      const timeline = pRel ? `${pRel.createdDate?.substring(0, 7) || 'Jan 2025'} - ${pRel.targetDate?.substring(0, 7) || 'Dec 2025'}` : 'Jan 2025 - Dec 2025';

      return {
        id: idx + 1,
        name: pName,
        timeline,
        environment: env,
        status: stat,
        progress: avgProg
      };
    });

    // 8. Project Timeline / Roadmap (Gantt Chart)
    const colorCycle = ['blue', 'orange', 'green', 'purple', 'pink', 'teal'];
    this.roadmapProjects = projectsToDisplay.map((pName, idx) => {
      const pOverview = this.overviewProjects.find(p => p.name === pName);
      const prog = pOverview ? pOverview.progress : 60;

      const devPct = Math.min(Math.max(Math.round(prog * 0.4), 25), 50);
      const testPct = Math.min(Math.max(Math.round(prog * 0.35), 20), 40);
      const uatPct = Math.max(10, 100 - devPct - testPct);

      return {
        name: pName,
        leftPct: (idx * 5.5) % 25,
        widthPct: Math.min(100, Math.max(50, 100 - ((idx * 6) % 35))),
        colorClass: colorCycle[idx % colorCycle.length],
        segments: [
          { label: 'Dev', widthPct: devPct },
          { label: 'Testing', widthPct: testPct },
          { label: 'UAT', widthPct: uatPct }
        ]
      };
    });

    // 9. Team Work Summary (This Week)
    const teamMemberNames = Array.from(empSet);
    this.teamSummary = teamMemberNames.map(name => {
      const memberTasks = filteredTasks.filter(t => t.resourceName === name);
      const tasksWorked = memberTasks.length > 0 ? memberTasks.length : (isAll ? 3 : 1);
      const completed = memberTasks.filter(t => t.status === 'Completed' || t.progress === 100).length;
      const compPct = memberTasks.length > 0 ? Math.round((completed / memberTasks.length) * 100) : 75;
      const hours = memberTasks.reduce((acc, t) => acc + (t.size === 'L' ? 8 : t.size === 'S' ? 4 : 6), 0) || (tasksWorked * 5);

      let role = 'Software Engineer';
      const sample = memberTasks[0];
      if (sample) {
        const str = `${sample.taskType} ${sample.module} ${sample.tags}`.toLowerCase();
        if (str.includes('front') || str.includes('ui') || str.includes('angular')) role = 'Frontend';
        else if (str.includes('back') || str.includes('api') || str.includes('sql') || str.includes('db')) role = 'Backend';
        else if (str.includes('test') || str.includes('qa') || str.includes('playwright')) role = 'Testing';
        else if (str.includes('arch') || str.includes('core')) role = 'Technical Architect';
        else if (str.includes('paba') || str.includes('analytics') || str.includes('spec')) role = 'PA/BA';
        else if (str.includes('k8s') || str.includes('devops') || str.includes('cloud')) role = 'DevOps';
      } else {
        if (name === 'Maniraj' || name === 'Rohit') role = 'Frontend';
        else if (name === 'Arun' || name === 'Karina') role = 'Backend';
        else if (name === 'Vamsi') role = 'Technical Architect';
        else if (name === 'Priya' || name === 'Bob') role = 'Testing';
        else if (name === 'Karthik' || name === 'Erika') role = 'PA/BA';
      }

      let status = 'On Track';
      if (memberTasks.some(t => t.status === 'Blocked')) status = 'Development';
      else if (compPct >= 85) status = 'Excellent';
      else if (compPct >= 60) status = 'On Track';
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

    // 10. Work Analytics:
    // Chart 1: Weekly Task Completion
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const dayCounts = [0, 0, 0, 0, 0, 0, 0];
    filteredTasks.forEach((t, i) => {
      dayCounts[i % 7] += (t.status === 'Completed' || t.progress >= 70) ? 6 : 3;
    });
    const maxDayVal = Math.max(...dayCounts, 10);
    this.weeklyCompletionDays = dayNames.map((day, i) => ({
      day,
      val: Math.max(dayCounts[i], 12 + ((i * 5) % 20)),
      heightPct: Math.min(100, Math.round((Math.max(dayCounts[i], 12 + ((i * 5) % 20)) / Math.max(maxDayVal, 40)) * 100))
    }));

    // Chart 2: Project Completion
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

    // Chart 3: Employee Task Completion
    const maxEmpTasks = Math.max(...this.teamSummary.map(m => m.tasksWorked), 5);
    this.employeeTaskCompletions = this.teamSummary.slice(0, 6).map(m => ({
      name: m.name,
      count: m.tasksWorked,
      widthPct: Math.min(100, Math.round((m.tasksWorked / maxEmpTasks) * 100))
    }));

    // Chart 4: Work Trends (Tasks Completed vs Assigned across W1-W6)
    const weeks = ['W1', 'W2', 'W3', 'W4', 'W5', 'W6'];
    const trendPts: Array<{ week: string; completed: number; assigned: number; x: number; y: number; assignedY: number }> = [];
    weeks.forEach((w, idx) => {
      const wTasks = allTasks.filter(t => t.week === w);
      const assigned = Math.max(wTasks.length * 3, 22 + idx * 4);
      const completed = Math.max(wTasks.filter(t => t.status === 'Completed' || t.progress >= 80).length * 4, 18 + idx * 5);
      
      const x = 20 + idx * 52;
      const y = Math.max(20, Math.min(95, 95 - (completed / 60) * 70));
      const assignedY = Math.max(20, Math.min(95, 95 - (assigned / 60) * 70));
      trendPts.push({ week: w, completed, assigned, x, y, assignedY });
    });
    this.workTrends = trendPts;
    this.workTrendsAssignedPath = trendPts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x + 12},${p.assignedY}`).join(' ');
    this.workTrendsCompletedPath = trendPts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x + 12},${p.y}`).join(' ');

    // Chart 5: Hours Spent Team
    this.hoursSpentTeam = this.teamSummary.slice(0, 6).map(m => {
      const tot = m.hoursSpent;
      let f = 0, b = 0, t = 0, p = 0;
      if (m.role.includes('Frontend')) { f = Math.round(tot * 0.65); b = Math.round(tot * 0.15); t = Math.round(tot * 0.1); p = Math.round(tot * 0.1); }
      else if (m.role.includes('Backend')) { b = Math.round(tot * 0.65); f = Math.round(tot * 0.1); t = Math.round(tot * 0.15); p = Math.round(tot * 0.1); }
      else if (m.role.includes('Testing')) { t = Math.round(tot * 0.65); f = Math.round(tot * 0.1); b = Math.round(tot * 0.15); p = Math.round(tot * 0.1); }
      else if (m.role.includes('Architect')) { b = Math.round(tot * 0.4); f = Math.round(tot * 0.3); t = Math.round(tot * 0.15); p = Math.round(tot * 0.15); }
      else { p = Math.round(tot * 0.65); f = Math.round(tot * 0.1); b = Math.round(tot * 0.15); t = Math.round(tot * 0.1); }
      return { name: m.name, total: tot, f, b, t, p };
    });
    this.maxHoursTeam = Math.max(...this.hoursSpentTeam.map(h => h.total), 40);

    // Chart 6: Monthly & Quarterly Completion
    this.monthlyCompletions = [
      { month: 'Jul', pct: 65, heightPct: 65 },
      { month: 'Aug', pct: 75, heightPct: 75 },
      { month: 'Sep', pct: 85, heightPct: 85 },
      { month: 'Oct', pct: this.kpiTaskCompletionPct, heightPct: this.kpiTaskCompletionPct }
    ];
    this.quarterlyCompletions = [
      { quarter: 'Q1', pct: 70, heightPct: 70 },
      { quarter: 'Q2', pct: 78, heightPct: 78 },
      { quarter: 'Q3', pct: 86, heightPct: 86 },
      { quarter: 'Q4', pct: Math.min(100, Math.round(this.kpiTaskCompletionPct * 1.05)), heightPct: Math.min(100, Math.round(this.kpiTaskCompletionPct * 1.05)) }
    ];
  }

  getStatusPillClass(status: string): string {
    const s = (status || '').toLowerCase();
    if (s.includes('uat')) return 'status-uat';
    if (s.includes('dev')) return 'status-dev';
    if (s.includes('live')) return 'status-live';
    if (s.includes('test')) return 'status-test';
    return 'status-dev';
  }

  getAvatarColorClass(name: string): string {
    const hash = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const colors = ['avatar-blue', 'avatar-purple', 'avatar-emerald', 'avatar-amber', 'avatar-rose', 'avatar-cyan'];
    return colors[hash % colors.length];
  }

  getTeamStatusClass(status: string): string {
    const s = (status || '').toLowerCase();
    if (s.includes('excellent')) return 'team-status-excellent';
    if (s.includes('development')) return 'team-status-dev';
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

  constructor() {
    this.buildAvailablePeriodOptions();
    this.loadColumnPreferences();
    this.updateReminderPermissionLabel();
    this.reminderSubscription.add(this.workTrackerService.data$.subscribe(data => {
      this.recomputeDashboardData(data);
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

  ngOnDestroy(): void {
    this.reminderSubscription.unsubscribe();
    this.cancelHourlyReminders();
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

  // Filtered tasks logic
  filteredTasks$: Observable<DeveloperTask[]> = combineLatest([
    this.visibleTasks$,
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
    this.visibleReleases$,
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
