import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WorkTrackerService, DeveloperTask, HourlyUpdateStatus, HourlyWorkUpdate, ReleaseTrack } from '../work-tracker.service';
import { BehaviorSubject, combineLatest, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="dashboard-container">
      <div class="dashboard-controls">
        <button class="btn-table secondary" type="button" (click)="expandAllSections()">Expand All</button>
        <button class="btn-table secondary" type="button" (click)="collapseAllSections()">Collapse All</button>
      </div>
      
      <!-- Filters Section -->
      <div class="glass-card filters-section">
        <div class="table-header compact-header">
          <h3>Task Data Filters</h3>
          <button class="btn-table secondary" type="button" (click)="toggleSection('filters')">{{ sections.filters ? 'Collapse' : 'Expand' }}</button>
        </div>
        @if (sections.filters) {
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
        }
      </div>

      <!-- Widgets Section -->
      <div class="section-shell">
        <div class="table-header">
          <h2>Dashboard Summary</h2>
          <button class="btn-table secondary" type="button" (click)="toggleSection('widgets')">{{ sections.widgets ? 'Collapse' : 'Expand' }}</button>
        </div>
      @if (sections.widgets) {
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
      }
      </div>

      <!-- Hourly Updates Charts -->
      <div class="glass-card hourly-analytics">
        <div class="table-header">
          <h2>Hourly Work Updates</h2>
          <button class="btn-table secondary" type="button" (click)="toggleSection('charts')">{{ sections.charts ? 'Collapse' : 'Expand' }}</button>
        </div>
        @if (sections.charts) {
        <div class="chart-grid">
          <div class="chart-card">
            <h3>Hours Worked Per Day</h3>
            <div class="bar-chart" *ngIf="hoursPerDay$ | async as bars">
              <div class="bar-item" *ngFor="let bar of bars">
                <div class="bar-track">
                  <div class="bar-value" [style.height.%]="bar.percent"></div>
                </div>
                <strong>{{ bar.count }}</strong>
                <span>{{ bar.label | date:'MMM d' }}</span>
              </div>
              <div class="empty-state" *ngIf="bars.length === 0">No hourly updates yet</div>
            </div>
          </div>

          <div class="chart-card">
            <h3>Status Distribution</h3>
            <div class="pie-layout" *ngIf="statusDistribution$ | async as slices">
              <div class="pie-chart" [style.background]="getPieBackground(slices)" aria-label="Hourly update status distribution"></div>
              <div class="legend">
                <div class="legend-item" *ngFor="let slice of slices">
                  <span class="legend-dot" [style.background]="slice.color"></span>
                  <span>{{ slice.label }}</span>
                  <strong>{{ slice.count }}</strong>
                </div>
                <div class="empty-state" *ngIf="slices.length === 0">No status data yet</div>
              </div>
            </div>
          </div>

          <div class="chart-card">
            <h3>Productivity Trend</h3>
            <svg class="line-chart" viewBox="0 0 320 180" role="img" aria-label="Productivity trend over time" *ngIf="productivityTrend$ | async as trend">
              <line x1="24" y1="146" x2="300" y2="146" class="axis"></line>
              <line x1="24" y1="24" x2="24" y2="146" class="axis"></line>
              <polyline *ngIf="trend.points.length > 1" [attr.points]="trend.pointString" class="trend-line"></polyline>
              <circle *ngFor="let point of trend.points" [attr.cx]="point.x" [attr.cy]="point.y" r="4" class="trend-point"></circle>
              <text *ngFor="let point of trend.points" [attr.x]="point.x" y="166" class="axis-label">{{ point.label | date:'M/d' }}</text>
              <text *ngIf="trend.points.length === 0" x="160" y="90" class="empty-svg">No trend data yet</text>
            </svg>
          </div>
        </div>
        }
      </div>

      <!-- Data Table Section (Hourly Updates) -->
      <div class="glass-card table-section">
        <div class="table-header">
          <h2>Hourly Updates Data</h2>
          <div class="table-actions">
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

      <!-- Data Table Section (Developer Tasks) -->
      <div class="glass-card table-section">
        <div class="table-header">
          <h2>Developer Tasks Data</h2>
          <div class="table-actions">
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
                <th>Visibility</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let task of filteredTasks$ | async" [class.hidden-row]="!(task.isVisible ?? true)">
                @if (editingTaskId === task.taskId) {
                <td>{{ task.taskId }}</td>
                <td><input class="table-input small-input" [(ngModel)]="inlineTaskForm.week"></td>
                <td><input class="table-input" [(ngModel)]="inlineTaskForm.resourceName"></td>
                <td><input class="table-input" [(ngModel)]="inlineTaskForm.projectName"></td>
                <td><input class="table-input" [(ngModel)]="inlineTaskForm.module"></td>
                <td><input class="table-input" [(ngModel)]="inlineTaskForm.taskTitle"></td>
                <td><input class="table-input" [(ngModel)]="inlineTaskForm.taskType"></td>
                <td>
                  <select class="table-input" [(ngModel)]="inlineTaskForm.status">
                    <option *ngFor="let status of taskStatuses" [value]="status">{{ status }}</option>
                  </select>
                </td>
                <td>
                  <select class="table-input" [(ngModel)]="inlineTaskForm.priority">
                    <option *ngFor="let priority of priorities" [value]="priority">{{ priority }}</option>
                  </select>
                </td>
                <td><input class="table-input small-input" [(ngModel)]="inlineTaskForm.size"></td>
                <td><input class="table-input small-input" type="number" min="0" max="100" [(ngModel)]="inlineTaskForm.progress"></td>
                <td><input class="table-input" type="date" [(ngModel)]="inlineTaskForm.startDate"></td>
                <td><input class="table-input" type="date" [(ngModel)]="inlineTaskForm.dueDate"></td>
                <td>{{ task.isVisible ?? true ? 'Shown' : 'Hidden' }}</td>
                <td>
                  <div class="inline-actions">
                    <button class="row-button save" type="button" (click)="saveInlineTask()">Save</button>
                    <button class="row-button" type="button" (click)="cancelInlineTaskEdit()">Cancel</button>
                  </div>
                </td>
                } @else {
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
                <td>{{ task.isVisible ?? true ? 'Shown' : 'Hidden' }}</td>
                <td>
                  <div class="inline-actions">
                    <button class="row-button" type="button" (click)="startInlineTaskEdit(task)">Edit</button>
                    <button class="row-button" type="button" (click)="toggleTaskVisibility(task.taskId)">{{ task.isVisible ?? true ? 'Hide' : 'Show' }}</button>
                    <button class="row-button danger" type="button" (click)="confirmDeleteTask(task)">Delete</button>
                  </div>
                </td>
                }
              </tr>
              <tr *ngIf="(filteredTasks$ | async)?.length === 0">
                <td colspan="15" class="text-center">No task records found.</td>
              </tr>
            </tbody>
          </table>
        </div>
        }
      </div>

      <!-- Data Table Section (Release Tracks) -->
      <div class="glass-card table-section">
        <div class="table-header">
          <h2>Release Tracks Data</h2>
          <div class="table-actions">
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
                <th>Visibility</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let release of filteredReleases$ | async" [class.hidden-row]="!(release.isVisible ?? true)">
                @if (editingReleaseId === release.id) {
                <td>{{ release.id }}</td>
                <td><input class="table-input" [(ngModel)]="inlineReleaseForm.title"></td>
                <td><input class="table-input" [(ngModel)]="inlineReleaseForm.category"></td>
                <td><input class="table-input" [(ngModel)]="inlineReleaseForm.module"></td>
                <td>
                  <select class="table-input" [(ngModel)]="inlineReleaseForm.priority">
                    <option *ngFor="let priority of priorities" [value]="priority">{{ priority }}</option>
                  </select>
                </td>
                <td>
                  <select class="table-input" [(ngModel)]="inlineReleaseForm.status">
                    <option *ngFor="let status of releaseStatuses" [value]="status">{{ status }}</option>
                  </select>
                </td>
                <td>
                  <select class="table-input" [(ngModel)]="inlineReleaseForm.prdStatus">
                    <option *ngFor="let status of prdStatuses" [value]="status">{{ status }}</option>
                  </select>
                </td>
                <td><input class="table-input" [(ngModel)]="inlineReleaseForm.assignedTo"></td>
                <td><input class="table-input small-input" type="number" min="0" max="100" [(ngModel)]="inlineReleaseForm.progress"></td>
                <td><input class="table-input" type="date" [(ngModel)]="inlineReleaseForm.targetDate"></td>
                <td><input class="table-input" type="date" [(ngModel)]="inlineReleaseForm.completedDate"></td>
                <td>{{ release.isVisible ?? true ? 'Shown' : 'Hidden' }}</td>
                <td>
                  <div class="inline-actions">
                    <button class="row-button save" type="button" (click)="saveInlineRelease()">Save</button>
                    <button class="row-button" type="button" (click)="cancelInlineReleaseEdit()">Cancel</button>
                  </div>
                </td>
                } @else {
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
                <td>{{ release.isVisible ?? true ? 'Shown' : 'Hidden' }}</td>
                <td>
                  <div class="inline-actions">
                    <button class="row-button" type="button" (click)="startInlineReleaseEdit(release)">Edit</button>
                    <button class="row-button" type="button" (click)="toggleReleaseVisibility(release.id)">{{ release.isVisible ?? true ? 'Hide' : 'Show' }}</button>
                    <button class="row-button danger" type="button" (click)="confirmDeleteRelease(release)">Delete</button>
                  </div>
                </td>
                }
              </tr>
              <tr *ngIf="(filteredReleases$ | async)?.length === 0">
                <td colspan="13" class="text-center">No release records found.</td>
              </tr>
            </tbody>
          </table>
        </div>
        }
      </div>

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
      margin-bottom: 1.2rem;
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
      padding: 1.25rem;
      background: rgba(255,255,255,0.45);
      border: 1px solid rgba(255,255,255,0.35);
      border-radius: 12px;
    }

    .chart-card h3 {
      margin-bottom: 1rem;
      font-size: 1rem;
    }

    .bar-chart {
      display: flex;
      align-items: end;
      gap: 1rem;
      min-height: 185px;
      overflow-x: auto;
      padding: 0.5rem 0.25rem 0;
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
    .table-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
      margin-bottom: 2rem;
    }

    .table-actions, .inline-actions, .modal-actions {
      display: flex;
      gap: 0.6rem;
      flex-wrap: wrap;
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
      padding: 0.75rem 1rem;
    }

    .row-button {
      padding: 0.48rem 0.7rem;
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
      padding: 0.65rem 0.75rem;
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
      padding: 1.5rem;
      background: rgba(26, 32, 44, 0.34);
    }

    .modal-panel {
      width: min(640px, 100%);
      max-height: 90vh;
      overflow: auto;
      padding: 1.5rem;
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
      margin-bottom: 1.25rem;
    }

    .modal-header h2 {
      margin: 0;
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
      padding: 0.78rem 0.9rem;
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
      margin: 0;
      color: #822727;
      font-weight: 700;
    }

    .confirm-copy {
      margin: 0 0 1.5rem;
      color: #4a5568;
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
  `]
})
export class DashboardComponent {
  workTrackerService = inject(WorkTrackerService);

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
