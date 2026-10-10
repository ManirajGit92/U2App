import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { WorkTrackerService } from './work-tracker.service';
import { AddWorkItemDrawerComponent } from './add-work-item-drawer.component';
import { WorkTask, WorkProject, ScheduleItem } from './work-tracker.models';

@Component({
  selector: 'app-work-tracker-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, AddWorkItemDrawerComponent],
  template: `
    <div class="wt-page-container">
      <div class="wt-main-layout">
        <!-- Main Dashboard Column -->
        <div class="wt-content-area">
          <!-- Subheader / Action Bar -->
          <header class="wt-header">
            <div class="header-titles">
              <span class="greeting-text">Good evening, Mani</span>
              <h1 class="main-title">Work Overview</h1>
              <p class="subtitle-text">
                Track your tasks, projects, meetings and productivity all in one place.
              </p>
            </div>

            <div class="header-controls">
              <!-- Month Filter -->
              <div class="select-pill-wrap">
                <i class="pi pi-calendar pill-icon"></i>
                <select
                  class="select-pill"
                  [ngModel]="service.selectedMonth()"
                  (ngModelChange)="service.selectedMonth.set($event)"
                  aria-label="Filter Month"
                >
                  <option value="2026-05">May 2026</option>
                  <option value="2026-04">April 2026</option>
                  <option value="2026-03">March 2026</option>
                </select>
                <i class="pi pi-chevron-down pill-chevron"></i>
              </div>

              <!-- Add Work Item Button -->
              <button
                type="button"
                class="btn-primary-pill"
                (click)="service.openAddDrawer()"
              >
                <i class="pi pi-plus"></i>
                <span>Add Work Item</span>
              </button>

              <!-- Customize Button -->
              <button
                type="button"
                class="btn-secondary-pill"
                (click)="showCustomizeModal.set(true)"
              >
                <i class="pi pi-cog"></i>
                <span>Customize</span>
              </button>
            </div>
          </header>

          <!-- ─── 1. TOP SUMMARY CARDS (6 CARDS) ─── -->
          <section class="summary-cards-grid-6" aria-label="Work Summary Cards">
            <!-- 1. Total Tasks -->
            <article class="kpi-card">
              <div class="kpi-left">
                <div class="kpi-icon-box bg-purple">
                  <i class="pi pi-list"></i>
                </div>
                <div class="kpi-info">
                  <span class="kpi-label">Total Tasks</span>
                  <strong class="kpi-amount">{{ service.totalTasks() }}</strong>
                  <span class="kpi-trend trend-up">
                    <i class="pi pi-arrow-up"></i> 20% <small>vs last week</small>
                  </span>
                </div>
              </div>
              <div class="kpi-sparkline">
                <svg viewBox="0 0 60 28" class="sparkline-svg">
                  <polyline
                    points="0,20 12,18 24,22 36,14 48,16 60,6"
                    fill="none"
                    stroke="#8b5cf6"
                    stroke-width="2.5"
                    stroke-linecap="round"
                  />
                </svg>
              </div>
            </article>

            <!-- 2. Completed with Donut -->
            <article class="kpi-card">
              <div class="kpi-left">
                <div class="kpi-icon-box bg-green">
                  <i class="pi pi-check"></i>
                </div>
                <div class="kpi-info">
                  <span class="kpi-label">Completed</span>
                  <strong class="kpi-amount">{{ service.completedTasks() }}</strong>
                  <span class="kpi-trend trend-up">
                    <i class="pi pi-caret-up"></i> 25% <small>vs last week</small>
                  </span>
                </div>
              </div>
              <div class="kpi-donut-mini">
                <svg viewBox="0 0 36 36" class="donut-mini-svg">
                  <path
                    class="donut-ring"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="#e2e8f0"
                    stroke-width="3.5"
                  />
                  <path
                    class="donut-segment"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="#10b981"
                    stroke-width="3.5"
                    [attr.stroke-dasharray]="service.completedPercent() + ', 100'"
                  />
                </svg>
                <span class="donut-pct-text">{{ service.completedPercent() }}%</span>
              </div>
            </article>

            <!-- 3. In Progress -->
            <article class="kpi-card">
              <div class="kpi-left">
                <div class="kpi-icon-box bg-blue">
                  <i class="pi pi-spinner"></i>
                </div>
                <div class="kpi-info">
                  <span class="kpi-label">In Progress</span>
                  <strong class="kpi-amount">{{ service.inProgressTasks() }}</strong>
                  <span class="kpi-trend trend-warning">
                    <i class="pi pi-caret-up"></i> 0% <small>vs last week</small>
                  </span>
                </div>
              </div>
              <div class="kpi-sparkline">
                <svg viewBox="0 0 60 28" class="sparkline-svg">
                  <polyline
                    points="0,16 15,20 30,12 45,18 60,10"
                    fill="none"
                    stroke="#f59e0b"
                    stroke-width="2.5"
                    stroke-linecap="round"
                  />
                </svg>
              </div>
            </article>

            <!-- 4. Overdue -->
            <article class="kpi-card">
              <div class="kpi-left">
                <div class="kpi-icon-box bg-red">
                  <i class="pi pi-exclamation-triangle"></i>
                </div>
                <div class="kpi-info">
                  <span class="kpi-label">Overdue</span>
                  <strong class="kpi-amount">{{ service.overdueTasks() }}</strong>
                  <span class="kpi-trend trend-down-red">
                    <i class="pi pi-arrow-down"></i> 50% <small>vs last week</small>
                  </span>
                </div>
              </div>
              <div class="kpi-sparkline">
                <svg viewBox="0 0 60 28" class="sparkline-svg">
                  <polyline
                    points="0,8 15,14 30,10 45,22 60,18"
                    fill="none"
                    stroke="#ef4444"
                    stroke-width="2.5"
                    stroke-linecap="round"
                  />
                </svg>
              </div>
            </article>

            <!-- 5. Total Projects -->
            <article class="kpi-card">
              <div class="kpi-left">
                <div class="kpi-icon-box bg-purple-soft">
                  <i class="pi pi-folder"></i>
                </div>
                <div class="kpi-info">
                  <span class="kpi-label">Total Projects</span>
                  <strong class="kpi-amount">{{ service.totalProjects() }}</strong>
                  <span class="kpi-subtext">
                    <i class="pi pi-arrow-up"></i> 2 new this month
                  </span>
                </div>
              </div>
            </article>

            <!-- 6. Hours Tracked -->
            <article class="kpi-card">
              <div class="kpi-left">
                <div class="kpi-icon-box bg-orange">
                  <i class="pi pi-clock"></i>
                </div>
                <div class="kpi-info">
                  <span class="kpi-label">Hours Tracked</span>
                  <strong class="kpi-amount">{{ service.totalHoursTracked() }}h</strong>
                  <span class="kpi-trend trend-up">
                    <i class="pi pi-arrow-up"></i> 12% <small>vs last week</small>
                  </span>
                </div>
              </div>
              <div class="kpi-sparkline">
                <svg viewBox="0 0 60 28" class="sparkline-svg">
                  <polyline
                    points="0,18 15,16 30,20 45,12 60,8"
                    fill="none"
                    stroke="#f97316"
                    stroke-width="2.5"
                    stroke-linecap="round"
                  />
                </svg>
              </div>
            </article>
          </section>

          <!-- ─── 2. SECOND ROW: ANALYTICS (3 CARDS) ─── -->
          <section class="analytics-row-3" aria-label="Task Analytics">
            <!-- 2.1 Task Status Donut -->
            <article class="chart-card">
              <header class="card-header">
                <h3>Task Status</h3>
                <select class="mini-select" aria-label="Period">
                  <option>This Week</option>
                  <option>This Month</option>
                </select>
              </header>

              <div class="donut-and-legend-layout">
                <div class="donut-visual-wrap">
                  <svg viewBox="0 0 100 100" class="donut-svg">
                    <!-- Completed (75%) -->
                    <circle
                      cx="50" cy="50" r="38"
                      fill="transparent" stroke="#10b981" stroke-width="12"
                      stroke-dasharray="179.1 238.8" stroke-dashoffset="0"
                    />
                    <!-- In Progress (17%) -->
                    <circle
                      cx="50" cy="50" r="38"
                      fill="transparent" stroke="#3b82f6" stroke-width="12"
                      stroke-dasharray="40.6 238.8" stroke-dashoffset="-179.1"
                    />
                    <!-- Not Started (8%) -->
                    <circle
                      cx="50" cy="50" r="38"
                      fill="transparent" stroke="#94a3b8" stroke-width="12"
                      stroke-dasharray="19.1 238.8" stroke-dashoffset="-219.7"
                    />
                    <!-- Overdue (8%) -->
                    <circle
                      cx="50" cy="50" r="38"
                      fill="transparent" stroke="#ef4444" stroke-width="12"
                      stroke-dasharray="19.1 238.8" stroke-dashoffset="-238.8"
                    />
                  </svg>
                  <div class="donut-center-info">
                    <strong>{{ service.totalTasks() }}</strong>
                    <small>Tasks</small>
                  </div>
                </div>

                <div class="legend-list-column">
                  <div *ngFor="let s of service.taskStatusBreakdown()" class="legend-row">
                    <div class="legend-left-col">
                      <span class="legend-color-dot" [style.background-color]="s.color"></span>
                      <span class="legend-name">{{ s.label }}</span>
                    </div>
                    <span class="legend-count">{{ s.count }}</span>
                    <strong class="legend-pct">{{ s.percentage }}%</strong>
                  </div>
                </div>
              </div>
            </article>

            <!-- 2.2 Work by Project Bar Chart -->
            <article class="chart-card">
              <header class="card-header">
                <h3>Work by Project</h3>
                <select class="mini-select" aria-label="Period">
                  <option>This Month</option>
                  <option>All Time</option>
                </select>
              </header>

              <div class="project-bar-chart-body">
                <div class="project-bars-container">
                  <div *ngFor="let p of service.workByProject()" class="p-bar-col">
                    <span class="p-bar-val">{{ p.count }}</span>
                    <div class="p-bar-track">
                      <div
                        class="p-bar-fill"
                        [style.height.%]="getProjectBarHeight(p.count)"
                        [style.background-color]="p.color"
                      ></div>
                    </div>
                    <span class="p-bar-label">{{ p.name }}</span>
                  </div>
                </div>
              </div>
            </article>

            <!-- 2.3 Time Tracking Donut -->
            <article class="chart-card">
              <header class="card-header">
                <h3>Time Tracking</h3>
                <select class="mini-select" aria-label="Period">
                  <option>This Week</option>
                  <option>Last Week</option>
                </select>
              </header>

              <div class="donut-and-legend-layout">
                <div class="donut-visual-wrap">
                  <svg viewBox="0 0 100 100" class="donut-svg">
                    <!-- Focused Work 69% -->
                    <circle
                      cx="50" cy="50" r="38"
                      fill="transparent" stroke="#3b82f6" stroke-width="12"
                      stroke-dasharray="164.8 238.8" stroke-dashoffset="0"
                    />
                    <!-- Meetings 19% -->
                    <circle
                      cx="50" cy="50" r="38"
                      fill="transparent" stroke="#8b5cf6" stroke-width="12"
                      stroke-dasharray="45.4 238.8" stroke-dashoffset="-164.8"
                    />
                    <!-- Documentation 9% -->
                    <circle
                      cx="50" cy="50" r="38"
                      fill="transparent" stroke="#f97316" stroke-width="12"
                      stroke-dasharray="21.5 238.8" stroke-dashoffset="-210.2"
                    />
                    <!-- Others 3% -->
                    <circle
                      cx="50" cy="50" r="38"
                      fill="transparent" stroke="#64748b" stroke-width="12"
                      stroke-dasharray="7.1 238.8" stroke-dashoffset="-231.7"
                    />
                  </svg>
                  <div class="donut-center-info">
                    <strong>{{ service.totalHoursTracked() }}h</strong>
                    <small>/ 40h</small>
                  </div>
                </div>

                <div class="legend-list-column">
                  <div *ngFor="let t of service.timeTrackingBreakdown()" class="legend-row">
                    <div class="legend-left-col">
                      <span class="legend-color-dot" [style.background-color]="t.color"></span>
                      <span class="legend-name">{{ t.category }}</span>
                    </div>
                    <span class="legend-count">{{ t.hours }}h</span>
                    <strong class="legend-pct">{{ t.percentage }}%</strong>
                  </div>
                </div>
              </div>
            </article>
          </section>

          <!-- ─── 3. THIRD ROW: TASKS, SCHEDULE & CALENDAR (3 CARDS) ─── -->
          <section class="analytics-row-3" aria-label="Tasks and Schedule Widgets">
            <!-- 3.1 Upcoming Tasks -->
            <article class="chart-card">
              <header class="card-header">
                <h3>Upcoming Tasks</h3>
                <button type="button" class="card-action-link" (click)="showAllTasksModal.set(true)">
                  View All
                </button>
              </header>

              <div class="tasks-widget-list">
                <div *ngFor="let task of service.upcomingTasks()" class="task-widget-item">
                  <label class="task-checkbox-wrap">
                    <input
                      type="checkbox"
                      [checked]="task.status === 'Completed'"
                      (change)="service.toggleTaskComplete(task.id)"
                    />
                    <span class="custom-checkbox"></span>
                  </label>

                  <div class="task-info-block">
                    <strong
                      class="task-title"
                      [class.completed]="task.status === 'Completed'"
                    >
                      {{ task.title }}
                    </strong>
                    <span class="task-project-sub">{{ task.projectName }}</span>
                  </div>

                  <span class="priority-badge" [class]="task.priority.toLowerCase()">
                    {{ task.priority }}
                  </span>

                  <span
                    class="due-date-pill"
                    [class.due-today]="task.dueDateLabel === 'Today'"
                    [class.due-tomorrow]="task.dueDateLabel === 'Tomorrow'"
                  >
                    {{ task.dueDateLabel || 'May 31' }}
                  </span>

                  <div class="assignee-avatar" title="Mani">
                    <span>M</span>
                  </div>
                </div>
              </div>
            </article>

            <!-- 3.2 Today's Schedule -->
            <article class="chart-card">
              <header class="card-header">
                <div class="header-with-sub">
                  <h3>Today's Schedule</h3>
                  <small class="schedule-date-sub">Fri, May 31, 2026</small>
                </div>
                <button type="button" class="card-action-link" (click)="showScheduleModal.set(true)">
                  View All
                </button>
              </header>

              <div class="schedule-timeline">
                <div
                  *ngFor="let s of service.todaySchedule()"
                  class="schedule-slot"
                  [style.border-left-color]="s.color"
                >
                  <span class="slot-time" [style.color]="s.color">
                    {{ s.timeStart }} - {{ s.timeEnd }}
                  </span>
                  <div class="slot-content">
                    <div class="slot-text">
                      <strong>{{ s.title }}</strong>
                      <small>{{ s.subtitle }}</small>
                    </div>
                    <div class="slot-icon" [style.color]="s.color">
                      <i [class]="s.icon"></i>
                    </div>
                  </div>
                </div>
              </div>
            </article>

            <!-- 3.3 Calendar Widget -->
            <article class="chart-card">
              <header class="card-header">
                <h3>Calendar</h3>
                <div class="cal-nav-row">
                  <span class="cal-month-name">May 2026</span>
                  <button type="button" class="btn-cal-arrow" aria-label="Previous month">
                    <i class="pi pi-chevron-left"></i>
                  </button>
                  <button type="button" class="btn-cal-arrow" aria-label="Next month">
                    <i class="pi pi-chevron-right"></i>
                  </button>
                </div>
              </header>

              <div class="calendar-widget-body">
                <!-- Days of week -->
                <div class="cal-days-header">
                  <span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>
                </div>

                <!-- Calendar grid -->
                <div class="cal-days-grid">
                  <!-- Prev month tail: 27, 28, 29, 30 -->
                  <div class="cal-cell muted"><span>27</span></div>
                  <div class="cal-cell muted"><span>28</span></div>
                  <div class="cal-cell muted"><span>29</span></div>
                  <div class="cal-cell muted"><span>30</span></div>

                  <!-- Days 1 - 31 -->
                  <div
                    *ngFor="let day of calendarDays"
                    class="cal-cell"
                    [class.selected]="day === 31"
                    (click)="selectedCalendarDay = day"
                  >
                    <span>{{ day }}</span>
                    <!-- Indicators -->
                    <div class="cal-dots" *ngIf="hasCalendarDots(day)">
                      <span class="dot-task" *ngIf="day % 4 === 0 || day === 31"></span>
                      <span class="dot-meeting" *ngIf="day % 5 === 0 || day === 31"></span>
                      <span class="dot-deadline" *ngIf="day % 7 === 0 || day === 31"></span>
                    </div>
                  </div>

                  <!-- Next month head: 1, 2, 3 -->
                  <div class="cal-cell muted"><span>1</span></div>
                  <div class="cal-cell muted"><span>2</span></div>
                  <div class="cal-cell muted"><span>3</span></div>
                </div>

                <!-- Calendar Legend -->
                <div class="cal-legend-footer">
                  <span><i class="dot-task"></i> Task</span>
                  <span><i class="dot-meeting"></i> Meeting</span>
                  <span><i class="dot-deadline"></i> Deadline</span>
                  <span><i class="dot-event"></i> Event</span>
                </div>
              </div>
            </article>
          </section>

          <!-- ─── 4. FOURTH ROW: RECENT ACTIVITY, PROJECTS & PRODUCTIVITY (3 CARDS) ─── -->
          <section class="analytics-row-3" aria-label="Projects and Productivity Widgets">
            <!-- 4.1 Recent Activity -->
            <article class="chart-card">
              <header class="card-header">
                <h3>Recent Activity</h3>
              </header>

              <div class="activity-list">
                <div *ngFor="let a of service.recentActivity()" class="activity-item">
                  <div class="activity-icon-box" [style.background-color]="a.color + '15'" [style.color]="a.color">
                    <i [class]="a.icon"></i>
                  </div>
                  <div class="activity-text">
                    <p>
                      {{ a.actionText }} <strong>{{ a.targetTitle }}</strong>
                    </p>
                  </div>
                  <span class="activity-time">{{ a.timeAgo }}</span>
                </div>
              </div>
            </article>

            <!-- 4.2 Project Progress -->
            <article class="chart-card">
              <header class="card-header">
                <h3>Project Progress</h3>
                <button type="button" class="card-action-link" (click)="showProjectsModal.set(true)">
                  View All
                </button>
              </header>

              <div class="project-progress-list">
                <div *ngFor="let p of service.projectProgressList()" class="proj-progress-row">
                  <div class="proj-name-col">
                    <i [class]="p.icon" [style.color]="p.color"></i>
                    <span class="p-name">{{ p.name }}</span>
                  </div>
                  <div class="proj-bar-track">
                    <div
                      class="proj-bar-fill"
                      [style.width.%]="p.progress"
                      [style.background-color]="p.color"
                    ></div>
                  </div>
                  <span class="proj-pct-val">{{ p.progress }}%</span>
                  <small class="proj-fraction-sub">{{ p.completedTasks }}/{{ p.totalTasks }} tasks</small>
                </div>
              </div>
            </article>

            <!-- 4.3 Productivity Insights -->
            <article class="chart-card">
              <header class="card-header">
                <h3>Productivity Insights</h3>
                <select class="mini-select" aria-label="Period">
                  <option>This Week</option>
                  <option>This Month</option>
                </select>
              </header>

              <div class="productivity-grid-4">
                <div *ngFor="let item of service.productivityMetrics()" class="prod-metric-box">
                  <div class="prod-top-row">
                    <div class="prod-icon" [style.background-color]="item.color + '15'" [style.color]="item.color">
                      <i [class]="item.icon"></i>
                    </div>
                    <span
                      class="prod-trend"
                      [class.positive]="item.trendPositive"
                      [class.negative]="!item.trendPositive"
                    >
                      <i [class]="item.trendPositive ? 'pi pi-arrow-up' : 'pi pi-arrow-down'"></i>
                      {{ item.trend }}
                    </span>
                  </div>
                  <span class="prod-label">{{ item.title }}</span>
                  <strong class="prod-val">{{ item.value }}</strong>
                </div>
              </div>
            </article>
          </section>
        </div>

        <!-- Right Side Drawer Matching Screenshot -->
        <app-add-work-item-drawer></app-add-work-item-drawer>
      </div>

      <!-- ─── MODALS ─── -->
      <!-- 1. All Tasks Modal -->
      <div class="modal-backdrop" *ngIf="showAllTasksModal()" (click)="closeModals()">
        <div class="modal-dialog modal-lg" (click)="$event.stopPropagation()">
          <header class="modal-header">
            <h2>All Work Tasks</h2>
            <button type="button" class="btn-close" (click)="closeModals()">
              <i class="pi pi-times"></i>
            </button>
          </header>
          <div class="modal-body">
            <div class="modal-toolbar">
              <input
                type="text"
                placeholder="Search tasks..."
                [(ngModel)]="taskFilterQuery"
                class="form-control filter-input"
              />
              <select [(ngModel)]="taskPriorityFilter" class="form-control filter-select">
                <option value="all">All Priorities</option>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Urgent">Urgent</option>
              </select>
            </div>
            <div class="modal-table-wrap">
              <table class="modal-table">
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Task Title</th>
                    <th>Project</th>
                    <th>Priority</th>
                    <th>Due Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let t of filteredTasksList()">
                    <td>
                      <input
                        type="checkbox"
                        [checked]="t.status === 'Completed'"
                        (change)="service.toggleTaskComplete(t.id)"
                      />
                    </td>
                    <td><strong>{{ t.title }}</strong></td>
                    <td>{{ t.projectName }}</td>
                    <td>
                      <span class="priority-badge" [class]="t.priority.toLowerCase()">
                        {{ t.priority }}
                      </span>
                    </td>
                    <td>{{ t.dueDate }}</td>
                    <td>
                      <button type="button" class="icon-btn edit" (click)="editTask(t)">
                        <i class="pi pi-pencil"></i>
                      </button>
                      <button type="button" class="icon-btn delete" (click)="service.deleteTask(t.id)">
                        <i class="pi pi-trash"></i>
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <!-- 2. Customize Modal -->
      <div class="modal-backdrop" *ngIf="showCustomizeModal()" (click)="closeModals()">
        <div class="modal-dialog" (click)="$event.stopPropagation()">
          <header class="modal-header">
            <h2>Customize Work Tracker</h2>
            <button type="button" class="btn-close" (click)="closeModals()">
              <i class="pi pi-times"></i>
            </button>
          </header>
          <div class="modal-body">
            <p>Configure visible widgets and default work tracking settings:</p>
            <div class="custom-toggle-list">
              <label class="custom-check-row">
                <input type="checkbox" checked /> Task Status Donut Chart
              </label>
              <label class="custom-check-row">
                <input type="checkbox" checked /> Work by Project Bar Chart
              </label>
              <label class="custom-check-row">
                <input type="checkbox" checked /> Time Tracking Breakdown
              </label>
              <label class="custom-check-row">
                <input type="checkbox" checked /> Interactive Month Calendar
              </label>
              <label class="custom-check-row">
                <input type="checkbox" checked /> Productivity Insights
              </label>
            </div>
            <button type="button" class="btn-primary-pill mt-3 w-100" (click)="closeModals()">
              Save Preferences
            </button>
          </div>
        </div>
      </div>

      <!-- 3. Projects Modal -->
      <div class="modal-backdrop" *ngIf="showProjectsModal()" (click)="closeModals()">
        <div class="modal-dialog modal-lg" (click)="$event.stopPropagation()">
          <header class="modal-header">
            <h2>Projects Directory</h2>
            <button type="button" class="btn-close" (click)="closeModals()">
              <i class="pi pi-times"></i>
            </button>
          </header>
          <div class="modal-body">
            <div class="projects-grid">
              <div *ngFor="let p of service.projects()" class="project-detail-card">
                <div class="proj-card-top">
                  <i [class]="p.icon" [style.color]="p.color"></i>
                  <strong>{{ p.name }}</strong>
                </div>
                <div class="proj-card-stats">
                  <span>{{ p.completedTasks }} of {{ p.totalTasks }} tasks completed</span>
                  <strong>{{ p.progress }}%</strong>
                </div>
                <div class="proj-card-bar">
                  <div
                    class="proj-card-fill"
                    [style.width.%]="p.progress"
                    [style.background-color]="p.color"
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 4. Schedule Modal -->
      <div class="modal-backdrop" *ngIf="showScheduleModal()" (click)="closeModals()">
        <div class="modal-dialog" (click)="$event.stopPropagation()">
          <header class="modal-header">
            <h2>All Schedule & Meetings</h2>
            <button type="button" class="btn-close" (click)="closeModals()">
              <i class="pi pi-times"></i>
            </button>
          </header>
          <div class="modal-body">
            <div class="schedule-timeline">
              <div
                *ngFor="let s of service.schedules()"
                class="schedule-slot"
                [style.border-left-color]="s.color"
              >
                <span class="slot-time" [style.color]="s.color">
                  {{ s.timeStart }} - {{ s.timeEnd }}
                </span>
                <div class="slot-content">
                  <div class="slot-text">
                    <strong>{{ s.title }}</strong>
                    <small>{{ s.subtitle }}</small>
                  </div>
                  <div class="slot-icon" [style.color]="s.color">
                    <i [class]="s.icon"></i>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
        color: #0f172a;
        --border-light: rgba(226, 232, 240, 0.8);
      }

      .wt-page-container {
        padding: 20px 24px 48px;
        max-width: 1680px;
        margin: 0 auto;
      }

      .wt-main-layout {
        display: flex;
        gap: 24px;
        align-items: flex-start;
      }

      .wt-content-area {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 22px;
      }

      /* ─── Header ─── */
      .wt-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 16px;
      }

      .greeting-text {
        font-size: 0.85rem;
        color: #64748b;
        font-weight: 500;
        display: block;
      }

      .main-title {
        font-size: 1.65rem;
        font-weight: 800;
        letter-spacing: -0.5px;
        color: #0f172a;
        margin: 2px 0;
      }

      .subtitle-text {
        font-size: 0.88rem;
        color: #64748b;
        margin: 0;
      }

      .header-controls {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .select-pill-wrap {
        position: relative;
        display: inline-flex;
        align-items: center;
      }

      .pill-icon {
        position: absolute;
        left: 14px;
        color: #64748b;
        font-size: 0.9rem;
        pointer-events: none;
      }

      .pill-chevron {
        position: absolute;
        right: 14px;
        color: #64748b;
        font-size: 0.75rem;
        pointer-events: none;
      }

      .select-pill {
        appearance: none;
        height: 42px;
        padding: 0 34px 0 38px;
        background: #ffffff;
        border: 1px solid var(--border-light);
        border-radius: 24px;
        font-size: 0.88rem;
        font-weight: 600;
        color: #0f172a;
        cursor: pointer;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.02);
      }

      .btn-primary-pill {
        height: 42px;
        padding: 0 20px;
        background: #2563eb;
        color: #ffffff;
        border: none;
        border-radius: 24px;
        font-size: 0.9rem;
        font-weight: 600;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        box-shadow: 0 4px 14px rgba(37, 99, 235, 0.28);
        transition: all 0.2s ease;
      }

      .btn-primary-pill:hover {
        background: #1d4ed8;
        transform: translateY(-1px);
      }

      .btn-secondary-pill {
        height: 42px;
        padding: 0 18px;
        background: #ffffff;
        color: #334155;
        border: 1px solid var(--border-light);
        border-radius: 24px;
        font-size: 0.9rem;
        font-weight: 600;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.02);
        transition: all 0.2s ease;
      }

      .btn-secondary-pill:hover {
        background: #f8fafc;
        border-color: #cbd5e1;
      }

      /* ─── 1. Summary Cards (6 Cards) ─── */
      .summary-cards-grid-6 {
        display: grid;
        grid-template-columns: repeat(6, 1fr);
        gap: 14px;
      }

      .kpi-card {
        background: #ffffff;
        border-radius: 18px;
        padding: 16px 18px;
        border: 1px solid var(--border-light);
        box-shadow: 0 4px 18px rgba(0, 0, 0, 0.02);
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }

      .kpi-left {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .kpi-icon-box {
        width: 44px;
        height: 44px;
        border-radius: 14px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 1.15rem;
        color: #ffffff;
        flex-shrink: 0;
      }

      .bg-purple { background: #8b5cf6; }
      .bg-green { background: #10b981; }
      .bg-blue { background: #3b82f6; }
      .bg-red { background: #ef4444; }
      .bg-purple-soft { background: #6366f1; }
      .bg-orange { background: #f97316; }

      .kpi-info {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .kpi-label {
        font-size: 0.75rem;
        font-weight: 500;
        color: #64748b;
        white-space: nowrap;
      }

      .kpi-amount {
        font-size: 1.35rem;
        font-weight: 800;
        color: #0f172a;
        line-height: 1.1;
      }

      .kpi-trend {
        font-size: 0.72rem;
        font-weight: 600;
        display: inline-flex;
        align-items: center;
        gap: 3px;
        margin-top: 2px;
        white-space: nowrap;
      }

      .kpi-subtext {
        font-size: 0.7rem;
        color: #3b82f6;
        font-weight: 600;
        margin-top: 2px;
        white-space: nowrap;
      }

      .trend-up { color: #10b981; }
      .trend-warning { color: #f59e0b; }
      .trend-down-red { color: #ef4444; }

      .kpi-sparkline {
        display: flex;
        align-items: center;
      }

      .sparkline-svg {
        width: 58px;
        height: 28px;
        overflow: visible;
      }

      /* Donut Mini in KPI card */
      .kpi-donut-mini {
        position: relative;
        width: 38px;
        height: 38px;
        flex-shrink: 0;
      }

      .donut-mini-svg {
        transform: rotate(-90deg);
        width: 100%;
        height: 100%;
      }

      .donut-pct-text {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.65rem;
        font-weight: 800;
        color: #0f172a;
      }

      /* ─── 2 & 3 & 4. 3-Column Analytics Rows ─── */
      .analytics-row-3 {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 18px;
      }

      .chart-card {
        background: #ffffff;
        border-radius: 18px;
        padding: 20px;
        border: 1px solid var(--border-light);
        box-shadow: 0 4px 18px rgba(0, 0, 0, 0.02);
        display: flex;
        flex-direction: column;
        gap: 14px;
      }

      .card-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .header-with-sub {
        display: flex;
        flex-direction: column;
      }

      .schedule-date-sub {
        font-size: 0.72rem;
        color: #64748b;
      }

      .card-header h3 {
        font-size: 0.98rem;
        font-weight: 700;
        color: #0f172a;
        margin: 0;
      }

      .mini-select {
        appearance: none;
        background: transparent;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 4px 24px 4px 10px;
        font-size: 0.78rem;
        font-weight: 600;
        color: #64748b;
        cursor: pointer;
        background-image: url('data:image/svg+xml;utf8,<svg fill="%2364748b" height="12" viewBox="0 0 24 24" width="12" xmlns="http://www.w3.org/2000/svg"><path d="M7 10l5 5 5-5z"/></svg>');
        background-repeat: no-repeat;
        background-position: right 8px center;
      }

      .card-action-link {
        background: transparent;
        border: none;
        color: #2563eb;
        font-size: 0.85rem;
        font-weight: 600;
        cursor: pointer;
      }

      .card-action-link:hover { text-decoration: underline; }

      /* Donut layout */
      .donut-and-legend-layout {
        display: grid;
        grid-template-columns: 120px 1fr;
        gap: 16px;
        align-items: center;
      }

      .donut-visual-wrap {
        position: relative;
        width: 120px;
        height: 120px;
      }

      .donut-svg {
        transform: rotate(-90deg);
        width: 100%;
        height: 100%;
      }

      .donut-center-info {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
      }

      .donut-center-info strong {
        font-size: 1rem;
        color: #0f172a;
        line-height: 1.1;
      }

      .donut-center-info small {
        font-size: 0.7rem;
        color: #64748b;
      }

      .legend-list-column {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .legend-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 0.78rem;
      }

      .legend-left-col {
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .legend-color-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        flex-shrink: 0;
      }

      .legend-name { color: #475569; font-weight: 500; }
      .legend-count { color: #0f172a; font-weight: 700; margin-left: auto; margin-right: 12px; }
      .legend-pct { color: #64748b; font-weight: 600; }

      /* Project Bar Chart */
      .project-bar-chart-body {
        height: 140px;
        display: flex;
        align-items: flex-end;
        padding-top: 10px;
      }

      .project-bars-container {
        display: flex;
        width: 100%;
        justify-content: space-between;
        align-items: flex-end;
        height: 100%;
        border-bottom: 1px solid #f1f5f9;
        padding-bottom: 4px;
      }

      .p-bar-col {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        flex: 1;
      }

      .p-bar-val {
        font-size: 0.72rem;
        font-weight: 700;
        color: #0f172a;
      }

      .p-bar-fill {
        width: 22px;
        border-radius: 6px 6px 0 0;
        transition: height 0.3s ease;
      }

      .p-bar-label {
        font-size: 0.68rem;
        color: #64748b;
        max-width: 60px;
        text-align: center;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      /* Upcoming Tasks List */
      .tasks-widget-list {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .task-widget-item {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 6px 0;
        border-bottom: 1px solid #f8fafc;
      }

      .task-checkbox-wrap {
        display: inline-flex;
        cursor: pointer;
      }

      .task-checkbox-wrap input {
        width: 16px;
        height: 16px;
        accent-color: #2563eb;
        cursor: pointer;
      }

      .task-info-block {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
      }

      .task-title {
        font-size: 0.8rem;
        color: #0f172a;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .task-title.completed {
        text-decoration: line-through;
        color: #94a3b8;
      }

      .task-project-sub {
        font-size: 0.68rem;
        color: #64748b;
      }

      .priority-badge {
        font-size: 0.68rem;
        font-weight: 700;
        padding: 2px 8px;
        border-radius: 12px;
        white-space: nowrap;
      }

      .priority-badge.high { background: #fdf2f8; color: #ec4899; }
      .priority-badge.medium { background: #fefce8; color: #ca8a04; }
      .priority-badge.low { background: #ecfdf5; color: #10b981; }
      .priority-badge.urgent { background: #fef2f2; color: #ef4444; }

      .due-date-pill {
        font-size: 0.72rem;
        font-weight: 600;
        color: #64748b;
        white-space: nowrap;
      }

      .due-date-pill.due-today { color: #ef4444; font-weight: 700; }
      .due-date-pill.due-tomorrow { color: #3b82f6; font-weight: 600; }

      .assignee-avatar {
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background: #3b82f6;
        color: #ffffff;
        font-size: 0.7rem;
        font-weight: 700;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      /* Today's Schedule */
      .schedule-timeline {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .schedule-slot {
        border-left: 3.5px solid #3b82f6;
        padding-left: 10px;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .slot-time {
        font-size: 0.68rem;
        font-weight: 700;
      }

      .slot-content {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .slot-text strong {
        font-size: 0.8rem;
        color: #0f172a;
        display: block;
      }

      .slot-text small {
        font-size: 0.68rem;
        color: #64748b;
      }

      .slot-icon {
        font-size: 0.95rem;
      }

      /* Calendar widget */
      .cal-nav-row {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .cal-month-name {
        font-size: 0.82rem;
        font-weight: 700;
        color: #0f172a;
      }

      .btn-cal-arrow {
        background: transparent;
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        width: 22px;
        height: 22px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: #64748b;
        cursor: pointer;
        font-size: 0.65rem;
      }

      .cal-days-header {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        text-align: center;
        font-size: 0.7rem;
        color: #94a3b8;
        font-weight: 600;
        margin-bottom: 6px;
      }

      .cal-days-grid {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 4px;
        text-align: center;
      }

      .cal-cell {
        aspect-ratio: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        font-size: 0.75rem;
        color: #0f172a;
        font-weight: 600;
        border-radius: 50%;
        cursor: pointer;
        position: relative;
        transition: all 0.2s ease;
      }

      .cal-cell.muted {
        color: #cbd5e1;
        cursor: default;
      }

      .cal-cell.selected {
        background: #2563eb;
        color: #ffffff;
      }

      .cal-dots {
        position: absolute;
        bottom: 2px;
        display: flex;
        gap: 2px;
      }

      .dot-task {
        width: 3.5px;
        height: 3.5px;
        border-radius: 50%;
        background: #3b82f6;
        display: inline-block;
      }

      .dot-meeting {
        width: 3.5px;
        height: 3.5px;
        border-radius: 50%;
        background: #10b981;
        display: inline-block;
      }

      .dot-deadline {
        width: 3.5px;
        height: 3.5px;
        border-radius: 50%;
        background: #ef4444;
        display: inline-block;
      }

      .dot-event {
        width: 3.5px;
        height: 3.5px;
        border-radius: 50%;
        background: #8b5cf6;
        display: inline-block;
      }

      .cal-legend-footer {
        display: flex;
        justify-content: space-around;
        font-size: 0.68rem;
        color: #64748b;
        margin-top: 10px;
        padding-top: 8px;
        border-top: 1px solid #f1f5f9;
      }

      .cal-legend-footer span {
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }

      /* Recent Activity */
      .activity-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .activity-item {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 0.78rem;
      }

      .activity-icon-box {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 0.85rem;
        flex-shrink: 0;
      }

      .activity-text {
        flex: 1;
        color: #334155;
      }

      .activity-text p {
        margin: 0;
      }

      .activity-time {
        font-size: 0.7rem;
        color: #94a3b8;
        white-space: nowrap;
      }

      /* Project Progress list */
      .project-progress-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .proj-progress-row {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 0.78rem;
      }

      .proj-name-col {
        display: flex;
        align-items: center;
        gap: 6px;
        width: 140px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .p-name {
        font-weight: 600;
        color: #0f172a;
      }

      .proj-bar-track {
        flex: 1;
        height: 6px;
        background: #f1f5f9;
        border-radius: 4px;
        overflow: hidden;
      }

      .proj-bar-fill {
        height: 100%;
        border-radius: 4px;
        transition: width 0.3s ease;
      }

      .proj-pct-val {
        font-weight: 700;
        color: #0f172a;
        width: 35px;
        text-align: right;
      }

      .proj-fraction-sub {
        font-size: 0.68rem;
        color: #64748b;
        width: 65px;
        text-align: right;
      }

      /* Productivity Insights */
      .productivity-grid-4 {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
      }

      .prod-metric-box {
        background: #f8fafc;
        border-radius: 12px;
        padding: 12px;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .prod-top-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .prod-icon {
        width: 32px;
        height: 32px;
        border-radius: 8px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 0.95rem;
      }

      .prod-trend {
        font-size: 0.72rem;
        font-weight: 700;
        display: inline-flex;
        align-items: center;
        gap: 2px;
      }

      .prod-trend.positive { color: #10b981; }
      .prod-trend.negative { color: #ef4444; }

      .prod-label {
        font-size: 0.72rem;
        color: #64748b;
      }

      .prod-val {
        font-size: 1.15rem;
        font-weight: 800;
        color: #0f172a;
      }

      /* ─── MODALS ─── */
      .modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(15, 23, 42, 0.45);
        backdrop-filter: blur(4px);
        z-index: 1100;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
      }

      .modal-dialog {
        background: #ffffff;
        border-radius: 20px;
        width: 100%;
        max-width: 580px;
        max-height: 90vh;
        overflow-y: auto;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
      }

      .modal-dialog.modal-lg {
        max-width: 900px;
      }

      .modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 18px 24px;
        border-bottom: 1px solid #f1f5f9;
      }

      .modal-header h2 {
        font-size: 1.15rem;
        font-weight: 700;
        margin: 0;
        color: #0f172a;
      }

      .modal-body {
        padding: 20px 24px;
      }

      .btn-close {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        border: 1px solid #e2e8f0;
        background: #f8fafc;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        color: #64748b;
      }

      .modal-toolbar {
        display: flex;
        gap: 12px;
        margin-bottom: 16px;
      }

      .filter-input { flex: 1; }
      .filter-select { width: 160px; }

      .modal-table-wrap {
        max-height: 480px;
        overflow-y: auto;
      }

      .modal-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.85rem;
      }

      .modal-table th {
        background: #f8fafc;
        padding: 8px 12px;
        text-align: left;
        color: #64748b;
        font-weight: 600;
      }

      .modal-table td {
        padding: 10px 12px;
        border-bottom: 1px solid #f1f5f9;
      }

      .icon-btn {
        background: transparent;
        border: none;
        padding: 4px 6px;
        cursor: pointer;
        border-radius: 6px;
        color: #64748b;
      }

      .icon-btn.edit:hover { color: #2563eb; }
      .icon-btn.delete:hover { color: #ef4444; }

      /* Projects grid */
      .projects-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 16px;
      }

      .project-detail-card {
        background: #f8fafc;
        border-radius: 12px;
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .proj-card-top {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 1rem;
      }

      .proj-card-stats {
        display: flex;
        justify-content: space-between;
        font-size: 0.82rem;
        color: #64748b;
      }

      .proj-card-bar {
        height: 6px;
        background: #e2e8f0;
        border-radius: 4px;
        overflow: hidden;
      }

      .proj-card-fill {
        height: 100%;
      }

      /* Custom toggle list */
      .custom-toggle-list {
        display: flex;
        flex-direction: column;
        gap: 10px;
        margin: 16px 0;
      }

      .custom-check-row {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 0.88rem;
        color: #334155;
        cursor: pointer;
      }

      .w-100 { width: 100%; }
      .mt-3 { margin-top: 14px; }

      /* Responsive */
      @media (max-width: 1380px) {
        .summary-cards-grid-6 {
          grid-template-columns: repeat(3, 1fr);
        }
      }

      @media (max-width: 1200px) {
        .wt-main-layout {
          flex-direction: column;
        }

        .analytics-row-3 {
          grid-template-columns: 1fr;
        }
      }

      @media (max-width: 768px) {
        .summary-cards-grid-6 {
          grid-template-columns: repeat(2, 1fr);
        }

        .wt-page-container {
          padding: 12px 12px 32px;
        }

        .header-controls {
          width: 100%;
        }

        .btn-primary-pill,
        .btn-secondary-pill,
        .select-pill-wrap {
          flex: 1;
        }
      }
    `,
  ],
})
export class WorkTrackerDashboardComponent implements OnInit {
  service = inject(WorkTrackerService);
  route = inject(ActivatedRoute);

  // Modals state
  showAllTasksModal = signal(false);
  showCustomizeModal = signal(false);
  showProjectsModal = signal(false);
  showScheduleModal = signal(false);

  // Calendar
  calendarDays = Array.from({ length: 31 }, (_, i) => i + 1);
  selectedCalendarDay = 31;

  // Filter in modal
  taskFilterQuery = '';
  taskPriorityFilter = 'all';

  ngOnInit(): void {
    this.route.url.subscribe((segments) => {
      const path = segments[0]?.path;
      if (path === 'my-tasks') {
        this.showAllTasksModal.set(true);
      } else if (path === 'projects') {
        this.showProjectsModal.set(true);
      } else if (path === 'meetings') {
        this.showScheduleModal.set(true);
      } else if (path === 'settings') {
        this.showCustomizeModal.set(true);
      }
    });
  }

  getProjectBarHeight(count: number): number {
    return Math.min(Math.round((count / 14) * 100), 100);
  }

  hasCalendarDots(day: number): boolean {
    return day % 3 === 0 || day % 4 === 0 || day === 31;
  }

  filteredTasksList(): WorkTask[] {
    let list = this.service.tasks();
    if (this.taskPriorityFilter !== 'all') {
      list = list.filter((t) => t.priority === this.taskPriorityFilter);
    }
    const q = this.taskFilterQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.projectName.toLowerCase().includes(q)
      );
    }
    return list;
  }

  editTask(task: WorkTask): void {
    this.closeModals();
    this.service.openAddDrawer(task);
  }

  closeModals(): void {
    this.showAllTasksModal.set(false);
    this.showCustomizeModal.set(false);
    this.showProjectsModal.set(false);
    this.showScheduleModal.set(false);
  }
}
