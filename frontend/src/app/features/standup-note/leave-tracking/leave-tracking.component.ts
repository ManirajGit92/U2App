import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  Employee,
  LeaveRecord,
  LeaveDuration,
  LeaveType,
  LeaveStatus,
  StandupNoteService,
} from '../standup-note.service';
import { Subscription } from 'rxjs';

type LeaveTab = 'dashboard' | 'records' | 'calendar';
type CalView = 'day' | 'week' | 'month' | 'year';

const LEAVE_COLORS: Record<LeaveType, string> = {
  planned: '#6366f1',
  unplanned: '#f59e0b',
  sick: '#ef4444',
  vacation: '#10b981',
  maternity: '#ec4899',
  wfh: '#06b6d4',
  'late-login': '#8b5cf6',
  'early-logoff': '#f97316',
  partial: '#64748b',
};

const LEAVE_LABELS: Record<LeaveType, string> = {
  planned: 'Planned',
  unplanned: 'Unplanned',
  sick: 'Sick',
  vacation: 'Vacation',
  maternity: 'Maternity',
  wfh: 'Work From Home',
  'late-login': 'Late Login',
  'early-logoff': 'Early Logoff',
  partial: 'Partial Hours',
};

const DURATION_LABELS: Record<LeaveDuration, string> = {
  'full-day': 'Full Day',
  'half-day-first': 'Half Day (First Half)',
  'half-day-second': 'Half Day (Second Half)',
};

@Component({
  selector: 'app-leave-tracking',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  template: `
    <div class="lv-page">
      <!-- Tab Header -->
      <div class="lv-tabs">
        <button class="lv-tab" [class.active]="activeTab === 'dashboard'" (click)="activeTab = 'dashboard'">
          <span>📊</span> Dashboard
        </button>
        <button class="lv-tab" [class.active]="activeTab === 'records'" (click)="activeTab = 'records'">
          <span>📋</span> Records
        </button>
        <button class="lv-tab" [class.active]="activeTab === 'calendar'" (click)="activeTab = 'calendar'">
          <span>📅</span> Calendar
        </button>
        <button class="btn btn-primary add-btn" (click)="openAdd()">+ Add Leave</button>
      </div>

      <!-- ══════════ DASHBOARD ══════════ -->
      <div *ngIf="activeTab === 'dashboard'" class="tab-content">
        <!-- Stat Cards -->
        <div class="stats-grid">
          <div class="stat-card" *ngFor="let s of dashboardStats">
            <div class="stat-icon" [style.background]="s.color + '22'" [style.color]="s.color">{{ s.icon }}</div>
            <div class="stat-body">
              <div class="stat-val">{{ s.value }}</div>
              <div class="stat-lbl">{{ s.label }}</div>
            </div>
          </div>
        </div>

        <div class="dash-grid">
          <!-- On Leave Today -->
          <div class="panel">
            <div class="panel-hdr"><h3>🏖️ On Leave Today</h3><span class="badge-count">{{ onLeaveToday.length }}</span></div>
            <div class="panel-body">
              <div *ngIf="onLeaveToday.length === 0" class="empty-state-sm">Nobody is on leave today 🎉</div>
              <div class="on-leave-item" *ngFor="let r of onLeaveToday">
                <div class="emp-avatar" [style.background]="getEmpColor(r.employeeId)">{{ getInitials(r.employeeId) }}</div>
                <div class="oli-info">
                  <div class="oli-name">{{ getEmpName(r.employeeId) }}</div>
                  <div class="oli-type">
                    <span class="lv-badge" [style.background]="getLeaveColor(r.leaveType) + '22'" [style.color]="getLeaveColor(r.leaveType)">
                      {{ getLeaveLabel(r.leaveType) }}
                    </span>
                    <span class="oli-dur">· {{ getDurationLabel(r.duration) }}</span>
                  </div>
                </div>
                <span class="status-dot" [class]="'status-' + r.status.toLowerCase()" [title]="r.status"></span>
              </div>
            </div>
          </div>

          <!-- Upcoming Leaves (next 7 days) -->
          <div class="panel">
            <div class="panel-hdr"><h3>📆 Upcoming Leaves (Next 7 Days)</h3><span class="badge-count">{{ upcomingLeaves.length }}</span></div>
            <div class="panel-body">
              <div *ngIf="upcomingLeaves.length === 0" class="empty-state-sm">No upcoming leaves scheduled.</div>
              <div class="upcoming-item" *ngFor="let r of upcomingLeaves">
                <div class="emp-avatar sm" [style.background]="getEmpColor(r.employeeId)">{{ getInitials(r.employeeId) }}</div>
                <div class="up-info">
                  <div class="up-name">{{ getEmpName(r.employeeId) }}</div>
                  <div class="up-meta">{{ r.fromDate === r.toDate ? r.fromDate : (r.fromDate + ' → ' + r.toDate) }} · {{ getLeaveLabel(r.leaveType) }}</div>
                </div>
                <span class="lv-badge sm" [style.background]="getLeaveColor(r.leaveType) + '22'" [style.color]="getLeaveColor(r.leaveType)">{{ getDaysFromNow(r.fromDate) }}d</span>
              </div>
            </div>
          </div>

          <!-- Leave Type Breakdown -->
          <div class="panel">
            <div class="panel-hdr"><h3>📈 Leave Breakdown</h3></div>
            <div class="panel-body">
              <div class="breakdown-row" *ngFor="let item of leaveBreakdown">
                <span class="bd-dot" [style.background]="item.color"></span>
                <span class="bd-label">{{ item.label }}</span>
                <div class="bd-bar-wrap">
                  <div class="bd-bar" [style.width]="item.pct + '%'" [style.background]="item.color"></div>
                </div>
                <span class="bd-count">{{ item.count }}</span>
              </div>
              <div *ngIf="leaveBreakdown.length === 0" class="empty-state-sm">No leave records yet.</div>
            </div>
          </div>

          <!-- Recent Leave Records -->
          <div class="panel">
            <div class="panel-hdr"><h3>🕐 Recent Leaves</h3></div>
            <div class="panel-body">
              <div *ngIf="recentLeaves.length === 0" class="empty-state-sm">No leave records found.</div>
              <div class="recent-item" *ngFor="let r of recentLeaves">
                <div class="ri-left">
                  <div class="emp-avatar sm" [style.background]="getEmpColor(r.employeeId)">{{ getInitials(r.employeeId) }}</div>
                  <div class="ri-info">
                    <div class="ri-name">{{ getEmpName(r.employeeId) }}</div>
                    <div class="ri-dates">{{ r.fromDate }} {{ r.fromDate !== r.toDate ? '→ ' + r.toDate : '' }}</div>
                  </div>
                </div>
                <div class="ri-right">
                  <span class="lv-badge sm" [style.background]="getLeaveColor(r.leaveType) + '22'" [style.color]="getLeaveColor(r.leaveType)">{{ getLeaveLabel(r.leaveType) }}</span>
                  <span class="status-pill" [class]="'status-pill-' + r.status.toLowerCase()">{{ r.status }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ══════════ RECORDS TABLE ══════════ -->
      <div *ngIf="activeTab === 'records'" class="tab-content">
        <!-- Filters toolbar -->
        <div class="filters-bar">
          <input type="text" class="input-f" placeholder="🔍 Search employee / reason..." [(ngModel)]="fSearch" (ngModelChange)="applyFilters()">
          <select class="input-f" [(ngModel)]="fEmployee" (ngModelChange)="applyFilters()">
            <option value="">All Employees</option>
            <option *ngFor="let e of employees" [value]="e.id">{{ e.name }}</option>
          </select>
          <select class="input-f" [(ngModel)]="fType" (ngModelChange)="applyFilters()">
            <option value="">All Types</option>
            <option *ngFor="let t of leaveTypes" [value]="t.value">{{ t.label }}</option>
          </select>
          <select class="input-f" [(ngModel)]="fDuration" (ngModelChange)="applyFilters()">
            <option value="">All Durations</option>
            <option value="full-day">Full Day</option>
            <option value="half-day-first">Half Day (First)</option>
            <option value="half-day-second">Half Day (Second)</option>
          </select>
          <select class="input-f" [(ngModel)]="fStatus" (ngModelChange)="applyFilters()">
            <option value="">All Status</option>
            <option value="Pending">Pending</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
          </select>
          <input type="date" class="input-f" [(ngModel)]="fDateFrom" (ngModelChange)="applyFilters()" title="From Date">
          <input type="date" class="input-f" [(ngModel)]="fDateTo" (ngModelChange)="applyFilters()" title="To Date">
          <button class="btn btn-ghost clear-btn" (click)="clearFilters()" *ngIf="hasActiveFilters()">✕ Clear</button>
        </div>

        <!-- Table -->
        <div class="table-wrap">
          <table class="lv-table">
            <thead>
              <tr>
                <th class="sortable" (click)="sortBy('employee')">Employee {{ sortIcon('employee') }}</th>
                <th class="sortable" (click)="sortBy('fromDate')">From {{ sortIcon('fromDate') }}</th>
                <th class="sortable" (click)="sortBy('toDate')">To {{ sortIcon('toDate') }}</th>
                <th>Duration</th>
                <th class="sortable" (click)="sortBy('leaveType')">Type {{ sortIcon('leaveType') }}</th>
                <th>Reason</th>
                <th class="sortable" (click)="sortBy('status')">Status {{ sortIcon('status') }}</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let r of paginatedRecords" class="tbl-row">
                <td>
                  <div class="tbl-emp">
                    <div class="emp-avatar xs" [style.background]="getEmpColor(r.employeeId)">{{ getInitials(r.employeeId) }}</div>
                    <span>{{ getEmpName(r.employeeId) }}</span>
                  </div>
                </td>
                <td class="date-cell">{{ r.fromDate }}</td>
                <td class="date-cell">{{ r.toDate }}</td>
                <td><span class="dur-pill">{{ getDurationLabel(r.duration) }}</span></td>
                <td>
                  <span class="lv-badge" [style.background]="getLeaveColor(r.leaveType) + '22'" [style.color]="getLeaveColor(r.leaveType)">
                    {{ getLeaveLabel(r.leaveType) }}
                  </span>
                </td>
                <td class="reason-cell" [title]="r.reason">{{ r.reason | slice:0:40 }}{{ r.reason.length > 40 ? '…' : '' }}</td>
                <td><span class="status-pill" [class]="'status-pill-' + r.status.toLowerCase()">{{ r.status }}</span></td>
                <td>
                  <div class="tbl-actions">
                    <button class="icon-btn" title="Edit" (click)="openEdit(r)">✏️</button>
                    <button class="icon-btn" title="Delete" (click)="deleteLeave(r.id)">🗑️</button>
                  </div>
                </td>
              </tr>
              <tr *ngIf="filteredRecords.length === 0">
                <td colspan="8" class="empty-row">No leave records found matching your filters.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        <div class="pagination" *ngIf="totalPages > 1">
          <button class="pg-btn" [disabled]="currentPage === 1" (click)="currentPage = currentPage - 1; paginate()">‹ Prev</button>
          <button
            class="pg-btn"
            *ngFor="let p of pageNumbers"
            [class.active]="p === currentPage"
            (click)="currentPage = p; paginate()"
          >{{ p }}</button>
          <button class="pg-btn" [disabled]="currentPage === totalPages" (click)="currentPage = currentPage + 1; paginate()">Next ›</button>
        </div>
      </div>

      <!-- ══════════ CALENDAR ══════════ -->
      <div *ngIf="activeTab === 'calendar'" class="tab-content">
        <!-- Calendar toolbar -->
        <div class="cal-toolbar">
          <div class="view-switcher">
            <button class="vbtn" [class.active]="calView === 'day'" (click)="setCalView('day')">Day</button>
            <button class="vbtn" [class.active]="calView === 'week'" (click)="setCalView('week')">Week</button>
            <button class="vbtn" [class.active]="calView === 'month'" (click)="setCalView('month')">Month</button>
            <button class="vbtn" [class.active]="calView === 'year'" (click)="setCalView('year')">Year</button>
          </div>
          <div class="cal-nav">
            <button class="nav-btn" (click)="calNav(-1)">‹</button>
            <span class="cal-period">{{ calPeriodLabel }}</span>
            <button class="nav-btn" (click)="calNav(1)">›</button>
            <button class="nav-btn today-btn" (click)="goToday()">Today</button>
          </div>
          <!-- Legend -->
          <div class="cal-legend">
            <span class="legend-item" *ngFor="let lt of leaveTypes">
              <span class="legend-dot" [style.background]="lt.color"></span>{{ lt.label }}
            </span>
          </div>
        </div>

        <!-- DAY VIEW -->
        <div *ngIf="calView === 'day'" class="cal-day-view">
          <div class="day-header">{{ calDate | date:'EEEE, MMMM d, y' }}</div>
          <div class="day-body">
            <div *ngIf="getDayLeaves(calDate).length === 0" class="empty-state-sm center">No leaves on this day.</div>
            <div class="day-leave-item" *ngFor="let r of getDayLeaves(calDate)" (click)="openEdit(r)">
              <div class="dli-color" [style.background]="getLeaveColor(r.leaveType)"></div>
              <div class="dli-body">
                <div class="dli-name">{{ getEmpName(r.employeeId) }}</div>
                <div class="dli-type">{{ getLeaveLabel(r.leaveType) }} · {{ getDurationLabel(r.duration) }}</div>
                <div class="dli-reason">{{ r.reason }}</div>
              </div>
              <span class="status-pill sm" [class]="'status-pill-' + r.status.toLowerCase()">{{ r.status }}</span>
            </div>
          </div>
        </div>

        <!-- WEEK VIEW -->
        <div *ngIf="calView === 'week'" class="cal-week-view">
          <div class="week-grid">
            <div class="week-day-col" *ngFor="let day of weekDays">
              <div class="wdc-header" [class.is-today]="isToday(day)">
                <div class="wdc-dayname">{{ day | date:'EEE' }}</div>
                <div class="wdc-daynum" [class.today-circle]="isToday(day)">{{ day | date:'d' }}</div>
              </div>
              <div class="wdc-body">
                <div
                  class="week-pill"
                  *ngFor="let r of getDayLeaves(day)"
                  [style.background]="getLeaveColor(r.leaveType) + '22'"
                  [style.border-left]="'3px solid ' + getLeaveColor(r.leaveType)"
                  [title]="getEmpName(r.employeeId) + ' – ' + getLeaveLabel(r.leaveType) + ' (' + getDurationLabel(r.duration) + ')'"
                  (click)="openEdit(r)"
                >
                  <span class="wp-name">{{ getInitials(r.employeeId) }}</span>
                  <span class="wp-type">{{ getLeaveLabel(r.leaveType) }}</span>
                </div>
                <div *ngIf="getDayLeaves(day).length === 0" class="wdc-empty">—</div>
              </div>
            </div>
          </div>
        </div>

        <!-- MONTH VIEW -->
        <div *ngIf="calView === 'month'" class="cal-month-view">
          <div class="month-weekdays">
            <div *ngFor="let d of ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']" class="mwd">{{ d }}</div>
          </div>
          <div class="month-grid">
            <div
              class="month-cell"
              *ngFor="let cell of monthCells"
              [class.other-month]="!cell.isCurrentMonth"
              [class.is-today]="cell.isToday"
            >
              <div class="mc-num" [class.today-circle]="cell.isToday">{{ cell.date.getDate() }}</div>
              <div class="mc-leaves">
                <div
                  class="mc-pill"
                  *ngFor="let r of cell.leaves.slice(0, 3)"
                  [style.background]="getLeaveColor(r.leaveType)"
                  [title]="getEmpName(r.employeeId) + ' – ' + getLeaveLabel(r.leaveType)"
                  (click)="openEdit(r)"
                >{{ getInitials(r.employeeId) }}</div>
                <div *ngIf="cell.leaves.length > 3" class="mc-more" (click)="drillToDay(cell.date)">+{{ cell.leaves.length - 3 }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- YEAR VIEW -->
        <div *ngIf="calView === 'year'" class="cal-year-view">
          <div class="year-grid">
            <div class="year-month" *ngFor="let m of yearMonths">
              <div class="ym-title">{{ m.name }}</div>
              <div class="ym-weekdays">
                <span *ngFor="let d of ['S','M','T','W','T','F','S']">{{ d }}</span>
              </div>
              <div class="ym-grid">
                <div
                  class="ym-cell"
                  *ngFor="let cell of m.cells"
                  [class.other-month]="!cell.isCurrentMonth"
                  [class.is-today]="cell.isToday"
                  [class.has-leave]="cell.leaves.length > 0"
                  [style.background]="cell.leaves.length > 0 ? getLeaveColor(cell.leaves[0].leaveType) + '33' : ''"
                  [title]="getYearCellTooltip(cell)"
                  (click)="cell.leaves.length > 0 && drillToDay(cell.date)"
                >
                  <span>{{ cell.date.getDate() }}</span>
                  <div class="ym-dots" *ngIf="cell.leaves.length > 0">
                    <span
                      class="ym-dot"
                      *ngFor="let r of cell.leaves.slice(0, 3)"
                      [style.background]="getLeaveColor(r.leaveType)"
                    ></span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ══════════ ADD/EDIT MODAL ══════════ -->
    <div class="modal-overlay" *ngIf="showModal" (click)="closeModal()">
      <div class="modal" (click)="$event.stopPropagation()">
        <div class="modal-hdr">
          <h3>{{ editMode ? '✏️ Edit Leave' : '➕ Add Leave' }}</h3>
          <button class="icon-btn close-btn" (click)="closeModal()">✕</button>
        </div>
        <div class="modal-body">
          <!-- Row 1: Employee -->
          <div class="form-row">
            <label>Employee <span class="req">*</span></label>
            <select class="input-f full" [(ngModel)]="form.employeeId">
              <option value="">-- Select Employee --</option>
              <option *ngFor="let e of employees" [value]="e.id">{{ e.name }}</option>
            </select>
          </div>
          <!-- Row 2: Dates -->
          <div class="form-2col">
            <div class="form-row">
              <label>Leave From <span class="req">*</span></label>
              <input type="date" class="input-f full" [(ngModel)]="form.fromDate">
            </div>
            <div class="form-row">
              <label>Leave To <span class="req">*</span></label>
              <input type="date" class="input-f full" [(ngModel)]="form.toDate">
            </div>
          </div>
          <!-- Row 3: Duration -->
          <div class="form-row">
            <label>Duration <span class="req">*</span></label>
            <div class="radio-group">
              <label class="radio-opt" *ngFor="let d of durationOptions">
                <input type="radio" [value]="d.value" [(ngModel)]="form.duration"> {{ d.label }}
              </label>
            </div>
          </div>
          <!-- Row 4: Leave Type -->
          <div class="form-row">
            <label>Leave Type <span class="req">*</span></label>
            <select class="input-f full" [(ngModel)]="form.leaveType">
              <option *ngFor="let t of leaveTypes" [value]="t.value">{{ t.label }}</option>
            </select>
          </div>
          <!-- Partial time fields -->
          <div class="form-2col" *ngIf="form.leaveType === 'partial'">
            <div class="form-row">
              <label>Login Time</label>
              <input type="time" class="input-f full" [(ngModel)]="form.loginTime">
            </div>
            <div class="form-row">
              <label>Logoff Time</label>
              <input type="time" class="input-f full" [(ngModel)]="form.logoffTime">
            </div>
          </div>
          <!-- Row 5: Reason -->
          <div class="form-row">
            <label>Reason <span class="req">*</span></label>
            <textarea class="input-f full textarea" rows="3" [(ngModel)]="form.reason" placeholder="Reason for leave..."></textarea>
          </div>
          <!-- Row 6: Notes -->
          <div class="form-row">
            <label>Notes <span class="opt">(optional)</span></label>
            <textarea class="input-f full textarea" rows="2" [(ngModel)]="form.notes" placeholder="Any additional notes..."></textarea>
          </div>
          <!-- Row 7: Status -->
          <div class="form-row">
            <label>Status</label>
            <div class="radio-group">
              <label class="radio-opt" *ngFor="let s of statusOptions">
                <input type="radio" [value]="s" [(ngModel)]="form.status"> {{ s }}
              </label>
            </div>
          </div>
          <!-- Validation error -->
          <div class="form-error" *ngIf="formError">⚠️ {{ formError }}</div>
        </div>
        <div class="modal-ftr">
          <button class="btn btn-ghost" (click)="closeModal()">Cancel</button>
          <button class="btn btn-primary" (click)="saveLeave()">{{ editMode ? 'Save Changes' : 'Add Leave' }}</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }

    .lv-page { display: flex; flex-direction: column; gap: 1rem; }

    /* ── Tabs ── */
    .lv-tabs {
      display: flex; align-items: center; gap: 0.5rem;
      background: var(--bg-secondary); border: 1px solid var(--border-color);
      border-radius: 12px; padding: 0.4rem 0.5rem; flex-wrap: wrap;
    }
    .lv-tab {
      display: flex; align-items: center; gap: 0.4rem;
      padding: 0.4rem 0.8rem; border: none; background: none;
      border-radius: 8px; cursor: pointer; font-size: 0.88rem; font-weight: 500;
      color: var(--text-secondary); transition: all 0.15s;
    }
    .lv-tab:hover { background: var(--bg-tertiary); color: var(--text-primary); }
    .lv-tab.active { background: var(--accent-surface); color: var(--accent-primary); font-weight: 700; }
    .add-btn { margin-left: auto; white-space: nowrap; }

    /* ── Tab Content ── */
    .tab-content { display: flex; flex-direction: column; gap: 1rem; }

    /* ── Stats Grid ── */
    .stats-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 0.75rem;
    }
    .stat-card {
      background: var(--bg-secondary); border: 1px solid var(--border-color);
      border-radius: 12px; padding: 0.75rem; display: flex; align-items: center; gap: 0.75rem;
      box-shadow: var(--shadow-sm); transition: box-shadow 0.2s;
    }
    .stat-card:hover { box-shadow: var(--shadow-md); }
    .stat-icon { width: 44px; height: 44px; border-radius: 10px; font-size: 1.3rem; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .stat-val { font-size: 1.7rem; font-weight: 700; color: var(--text-primary); line-height: 1; }
    .stat-lbl { font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.2rem; }

    /* ── Dashboard Grid ── */
    .dash-grid {
      display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;
    }

    /* ── Panel ── */
    .panel {
      background: var(--bg-secondary); border: 1px solid var(--border-color);
      border-radius: 12px; overflow: hidden; display: flex; flex-direction: column;
      box-shadow: var(--shadow-sm);
    }
    .panel-hdr {
      display: flex; align-items: center; justify-content: space-between;
      padding: 0.6rem 0.75rem; border-bottom: 1px solid var(--border-color);
    }
    .panel-hdr h3 { margin: 0; font-size: 0.88rem; font-weight: 700; color: var(--text-primary); }
    .badge-count {
      background: var(--accent-surface); color: var(--accent-primary);
      font-size: 0.72rem; font-weight: 700; padding: 0.15rem 0.5rem; border-radius: 20px;
    }
    .panel-body { padding: 0.75rem; display: flex; flex-direction: column; gap: 0.6rem; max-height: 320px; overflow-y: auto; }
    .empty-state-sm { font-size: 0.82rem; color: var(--text-secondary); font-style: italic; text-align: center; padding: 0.75rem; }
    .empty-state-sm.center { padding: 2rem; }

    /* ── On Leave Items ── */
    .on-leave-item { display: flex; align-items: center; gap: 0.6rem; padding: 0.4rem 0; border-bottom: 1px solid var(--border-color); }
    .on-leave-item:last-child { border-bottom: none; }
    .oli-info { flex: 1; }
    .oli-name { font-size: 0.85rem; font-weight: 600; color: var(--text-primary); }
    .oli-type { display: flex; align-items: center; gap: 0.4rem; margin-top: 2px; }
    .oli-dur { font-size: 0.72rem; color: var(--text-secondary); }

    /* ── Upcoming ── */
    .upcoming-item { display: flex; align-items: center; gap: 0.6rem; padding: 0.3rem 0; border-bottom: 1px solid var(--border-color); }
    .upcoming-item:last-child { border-bottom: none; }
    .up-info { flex: 1; }
    .up-name { font-size: 0.82rem; font-weight: 600; color: var(--text-primary); }
    .up-meta { font-size: 0.72rem; color: var(--text-secondary); }

    /* ── Breakdown ── */
    .breakdown-row { display: flex; align-items: center; gap: 0.5rem; }
    .bd-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
    .bd-label { font-size: 0.78rem; color: var(--text-secondary); width: 110px; flex-shrink: 0; }
    .bd-bar-wrap { flex: 1; height: 6px; background: var(--border-color); border-radius: 3px; overflow: hidden; }
    .bd-bar { height: 100%; border-radius: 3px; transition: width 0.5s ease; }
    .bd-count { font-size: 0.78rem; font-weight: 700; color: var(--text-primary); width: 20px; text-align: right; }

    /* ── Recent ── */
    .recent-item { display: flex; justify-content: space-between; align-items: center; padding: 0.4rem 0; border-bottom: 1px solid var(--border-color); }
    .recent-item:last-child { border-bottom: none; }
    .ri-left { display: flex; align-items: center; gap: 0.5rem; }
    .ri-info {}
    .ri-name { font-size: 0.82rem; font-weight: 600; color: var(--text-primary); }
    .ri-dates { font-size: 0.72rem; color: var(--text-secondary); }
    .ri-right { display: flex; align-items: center; gap: 0.4rem; }

    /* ── Avatars ── */
    .emp-avatar {
      border-radius: 50%; display: flex; align-items: center; justify-content: center;
      font-weight: 700; color: white; flex-shrink: 0;
    }
    .emp-avatar { width: 36px; height: 36px; font-size: 0.8rem; }
    .emp-avatar.sm { width: 28px; height: 28px; font-size: 0.68rem; }
    .emp-avatar.xs { width: 24px; height: 24px; font-size: 0.62rem; }

    /* ── Badges & Pills ── */
    .lv-badge {
      display: inline-block; padding: 0.15rem 0.45rem; border-radius: 20px;
      font-size: 0.72rem; font-weight: 600;
    }
    .lv-badge.sm { font-size: 0.68rem; padding: 0.1rem 0.35rem; }
    .status-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
    .status-pending { background: #f59e0b; }
    .status-approved { background: #10b981; }
    .status-rejected { background: #ef4444; }
    .status-pill { display: inline-block; padding: 0.15rem 0.5rem; border-radius: 20px; font-size: 0.7rem; font-weight: 600; }
    .status-pill.sm { font-size: 0.65rem; padding: 0.1rem 0.4rem; }
    .status-pill-pending { background: #fef3c7; color: #b45309; }
    .status-pill-approved { background: #d1fae5; color: #065f46; }
    .status-pill-rejected { background: #fee2e2; color: #b91c1c; }
    .dur-pill { font-size: 0.72rem; color: var(--text-secondary); white-space: nowrap; }

    /* ── Filters Bar ── */
    .filters-bar {
      display: flex; gap: 0.5rem; flex-wrap: wrap;
      background: var(--bg-secondary); border: 1px solid var(--border-color);
      border-radius: 12px; padding: 0.5rem 0.75rem; align-items: center;
    }
    .input-f {
      padding: 0.4rem 0.5rem; border: 1px solid var(--border-color); border-radius: 8px;
      font-size: 0.82rem; background: var(--bg-input); color: var(--text-primary); outline: none;
      transition: border-color 0.15s;
    }
    .input-f:focus { border-color: var(--accent-primary); }
    .input-f.full { width: 100%; box-sizing: border-box; }
    .clear-btn { font-size: 0.8rem; padding: 0.4rem 0.6rem; }

    /* ── Table ── */
    .table-wrap { background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 12px; overflow: hidden; overflow-x: auto; }
    .lv-table { width: 100%; border-collapse: collapse; font-size: 0.83rem; }
    .lv-table thead tr { background: var(--bg-tertiary); border-bottom: 1px solid var(--border-color); }
    .lv-table th { padding: 0.55rem 0.75rem; text-align: left; font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); white-space: nowrap; user-select: none; }
    .lv-table th.sortable { cursor: pointer; }
    .lv-table th.sortable:hover { color: var(--accent-primary); }
    .lv-table td { padding: 0.5rem 0.75rem; border-bottom: 1px solid var(--border-color); vertical-align: middle; }
    .tbl-row:last-child td { border-bottom: none; }
    .tbl-row:hover { background: var(--bg-tertiary); }
    .tbl-emp { display: flex; align-items: center; gap: 0.4rem; }
    .date-cell { font-size: 0.78rem; color: var(--text-secondary); white-space: nowrap; }
    .reason-cell { max-width: 200px; color: var(--text-secondary); font-size: 0.8rem; }
    .tbl-actions { display: flex; gap: 0.25rem; }
    .empty-row { text-align: center; padding: 2rem; color: var(--text-secondary); font-style: italic; }
    .icon-btn { background: none; border: none; cursor: pointer; font-size: 0.9rem; opacity: 0.6; transition: opacity 0.15s, transform 0.15s; border-radius: 4px; padding: 0.2rem 0.3rem; }
    .icon-btn:hover { opacity: 1; transform: scale(1.15); }

    /* ── Pagination ── */
    .pagination { display: flex; justify-content: center; gap: 0.4rem; flex-wrap: wrap; }
    .pg-btn { padding: 0.3rem 0.6rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-secondary); color: var(--text-primary); cursor: pointer; font-size: 0.8rem; transition: all 0.15s; }
    .pg-btn:hover:not([disabled]) { border-color: var(--accent-primary); color: var(--accent-primary); }
    .pg-btn.active { background: var(--accent-primary); color: white; border-color: var(--accent-primary); }
    .pg-btn[disabled] { opacity: 0.4; cursor: not-allowed; }

    /* ── Calendar Toolbar ── */
    .cal-toolbar {
      display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;
      background: var(--bg-secondary); border: 1px solid var(--border-color);
      border-radius: 12px; padding: 0.5rem 0.75rem;
    }
    .view-switcher { display: flex; border: 1px solid var(--border-color); border-radius: 8px; overflow: hidden; }
    .vbtn {
      padding: 0.3rem 0.75rem; border: none; background: none; cursor: pointer;
      font-size: 0.82rem; font-weight: 500; color: var(--text-secondary); transition: all 0.15s;
    }
    .vbtn:not(:last-child) { border-right: 1px solid var(--border-color); }
    .vbtn:hover { background: var(--bg-tertiary); color: var(--text-primary); }
    .vbtn.active { background: var(--accent-primary); color: white; }
    .cal-nav { display: flex; align-items: center; gap: 0.4rem; }
    .nav-btn { padding: 0.3rem 0.6rem; border: 1px solid var(--border-color); background: var(--bg-secondary); color: var(--text-primary); border-radius: 6px; cursor: pointer; font-size: 0.88rem; transition: all 0.15s; }
    .nav-btn:hover { border-color: var(--accent-primary); color: var(--accent-primary); }
    .today-btn { font-size: 0.8rem; padding: 0.3rem 0.5rem; font-weight: 600; }
    .cal-period { font-weight: 700; font-size: 0.9rem; color: var(--text-primary); min-width: 160px; text-align: center; }
    .cal-legend { display: flex; gap: 0.6rem; flex-wrap: wrap; margin-left: auto; }
    .legend-item { display: flex; align-items: center; gap: 0.3rem; font-size: 0.72rem; color: var(--text-secondary); }
    .legend-dot { width: 8px; height: 8px; border-radius: 50%; }

    /* ── Day View ── */
    .cal-day-view { background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 12px; overflow: hidden; }
    .day-header { padding: 0.6rem 0.75rem; border-bottom: 1px solid var(--border-color); font-weight: 700; font-size: 0.95rem; color: var(--text-primary); }
    .day-body { padding: 0.75rem; display: flex; flex-direction: column; gap: 0.6rem; min-height: 200px; }
    .day-leave-item { display: flex; align-items: stretch; gap: 0; border-radius: 10px; overflow: hidden; border: 1px solid var(--border-color); cursor: pointer; transition: box-shadow 0.15s; }
    .day-leave-item:hover { box-shadow: var(--shadow-md); }
    .dli-color { width: 6px; flex-shrink: 0; }
    .dli-body { flex: 1; padding: 0.5rem 0.75rem; }
    .dli-name { font-size: 0.88rem; font-weight: 700; color: var(--text-primary); }
    .dli-type { font-size: 0.75rem; color: var(--text-secondary); margin: 2px 0; }
    .dli-reason { font-size: 0.78rem; color: var(--text-secondary); }

    /* ── Week View ── */
    .cal-week-view { background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 12px; overflow: hidden; }
    .week-grid { display: grid; grid-template-columns: repeat(7, 1fr); min-height: 300px; }
    .week-day-col { border-right: 1px solid var(--border-color); }
    .week-day-col:last-child { border-right: none; }
    .wdc-header { padding: 0.4rem; border-bottom: 1px solid var(--border-color); text-align: center; background: var(--bg-tertiary); }
    .wdc-header.is-today { background: var(--accent-surface); }
    .wdc-dayname { font-size: 0.7rem; font-weight: 600; color: var(--text-secondary); }
    .wdc-daynum { font-size: 0.85rem; font-weight: 700; color: var(--text-primary); }
    .today-circle { background: var(--accent-primary); color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; margin: 0 auto; font-size: 0.78rem; }
    .wdc-body { padding: 0.3rem; display: flex; flex-direction: column; gap: 0.3rem; min-height: 140px; }
    .wdc-empty { font-size: 0.68rem; color: var(--text-secondary); text-align: center; padding-top: 0.5rem; }
    .week-pill { padding: 0.2rem 0.4rem; border-radius: 6px; cursor: pointer; transition: opacity 0.15s; }
    .week-pill:hover { opacity: 0.8; }
    .wp-name { display: block; font-size: 0.68rem; font-weight: 700; color: var(--text-primary); }
    .wp-type { display: block; font-size: 0.62rem; color: var(--text-secondary); }

    /* ── Month View ── */
    .cal-month-view { background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 12px; overflow: hidden; }
    .month-weekdays { display: grid; grid-template-columns: repeat(7, 1fr); border-bottom: 1px solid var(--border-color); }
    .mwd { padding: 0.4rem; text-align: center; font-size: 0.72rem; font-weight: 700; color: var(--text-secondary); background: var(--bg-tertiary); }
    .month-grid { display: grid; grid-template-columns: repeat(7, 1fr); }
    .month-cell { border-right: 1px solid var(--border-color); border-bottom: 1px solid var(--border-color); min-height: 90px; padding: 0.25rem; transition: background 0.15s; }
    .month-cell:nth-child(7n) { border-right: none; }
    .month-cell.other-month .mc-num { opacity: 0.35; }
    .month-cell.is-today { background: var(--accent-surface); }
    .mc-num { font-size: 0.8rem; font-weight: 600; color: var(--text-primary); width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; }
    .mc-num.today-circle { background: var(--accent-primary); color: white; border-radius: 50%; font-size: 0.75rem; }
    .mc-leaves { display: flex; flex-direction: column; gap: 2px; margin-top: 2px; }
    .mc-pill { font-size: 0.62rem; font-weight: 700; color: white; padding: 1px 4px; border-radius: 4px; cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; transition: opacity 0.15s; }
    .mc-pill:hover { opacity: 0.8; }
    .mc-more { font-size: 0.65rem; color: var(--text-secondary); cursor: pointer; padding: 1px 0; }
    .mc-more:hover { color: var(--accent-primary); }

    /* ── Year View ── */
    .cal-year-view { background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 12px; padding: 1rem; }
    .year-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1rem; }
    .year-month { border: 1px solid var(--border-color); border-radius: 10px; overflow: hidden; }
    .ym-title { background: var(--bg-tertiary); border-bottom: 1px solid var(--border-color); padding: 0.35rem 0.5rem; font-size: 0.8rem; font-weight: 700; color: var(--text-primary); text-align: center; }
    .ym-weekdays { display: grid; grid-template-columns: repeat(7, 1fr); padding: 2px 4px; }
    .ym-weekdays span { text-align: center; font-size: 0.58rem; color: var(--text-secondary); font-weight: 600; }
    .ym-grid { display: grid; grid-template-columns: repeat(7, 1fr); padding: 2px 4px 4px; gap: 1px; }
    .ym-cell {
      text-align: center; font-size: 0.62rem; color: var(--text-secondary);
      border-radius: 4px; padding: 2px 1px; min-height: 20px;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      transition: background 0.15s;
    }
    .ym-cell.other-month { opacity: 0.3; }
    .ym-cell.is-today { font-weight: 700; color: var(--accent-primary); }
    .ym-cell.has-leave { cursor: pointer; }
    .ym-cell.has-leave:hover { opacity: 0.8; }
    .ym-dots { display: flex; gap: 1px; justify-content: center; margin-top: 1px; }
    .ym-dot { width: 4px; height: 4px; border-radius: 50%; }

    /* ── Modal ── */
    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.55); display: flex; align-items: center; justify-content: center; z-index: 200; backdrop-filter: blur(3px); }
    .modal { background: var(--bg-secondary); border-radius: 16px; width: 540px; max-width: 96vw; max-height: 92vh; overflow-y: auto; box-shadow: var(--shadow-lg); border: 1px solid var(--border-color); }
    .modal-hdr { display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; border-bottom: 1px solid var(--border-color); position: sticky; top: 0; background: var(--bg-secondary); z-index: 1; }
    .modal-hdr h3 { margin: 0; font-size: 1rem; color: var(--text-primary); }
    .modal-body { padding: 1rem; display: flex; flex-direction: column; gap: 0.75rem; }
    .modal-ftr { display: flex; justify-content: flex-end; gap: 0.75rem; padding: 0.75rem 1rem; border-top: 1px solid var(--border-color); position: sticky; bottom: 0; background: var(--bg-secondary); }
    .form-row { display: flex; flex-direction: column; gap: 0.3rem; }
    .form-row label { font-size: 0.8rem; font-weight: 600; color: var(--text-secondary); }
    .form-2col { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
    .textarea { resize: vertical; min-height: 60px; }
    .radio-group { display: flex; gap: 0.75rem; flex-wrap: wrap; }
    .radio-opt { display: flex; align-items: center; gap: 0.35rem; font-size: 0.82rem; color: var(--text-primary); cursor: pointer; }
    .req { color: #ef4444; }
    .opt { color: var(--text-secondary); font-weight: 400; font-size: 0.75rem; }
    .form-error { padding: 0.4rem 0.6rem; background: #fee2e2; color: #b91c1c; border-radius: 8px; font-size: 0.82rem; }
    .close-btn { font-size: 0.9rem; }

    /* ── Buttons ── */
    .btn { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.4rem 0.9rem; border-radius: 8px; font-size: 0.85rem; font-weight: 600; cursor: pointer; border: 1px solid transparent; transition: all 0.15s; }
    .btn-primary { background: var(--accent-primary); color: white; }
    .btn-primary:hover { opacity: 0.9; }
    .btn-ghost { background: none; border-color: var(--border-color); color: var(--text-secondary); }
    .btn-ghost:hover { background: var(--bg-tertiary); }

    /* ── Responsive ── */
    @media (max-width: 900px) {
      .dash-grid { grid-template-columns: 1fr; }
      .week-grid { grid-template-columns: repeat(7, minmax(90px, 1fr)); }
    }
    @media (max-width: 768px) {
      .stats-grid { grid-template-columns: repeat(2, 1fr); }
      .filters-bar { gap: 0.4rem; }
      .input-f { font-size: 0.8rem; }
      .year-grid { grid-template-columns: repeat(2, 1fr); }
      .month-cell { min-height: 60px; }
      .form-2col { grid-template-columns: 1fr; }
      .cal-legend { display: none; }
    }
    @media (max-width: 480px) {
      .stats-grid { grid-template-columns: 1fr; }
      .lv-tabs { flex-wrap: wrap; }
      .add-btn { width: 100%; justify-content: center; order: 10; }
      .year-grid { grid-template-columns: 1fr; }
    }
  `],
})
export class LeaveTrackingComponent implements OnInit, OnDestroy {
  svc = inject(StandupNoteService);

  activeTab: LeaveTab = 'dashboard';
  calView: CalView = 'month';

  employees: Employee[] = [];
  allLeaves: LeaveRecord[] = [];
  filteredRecords: LeaveRecord[] = [];
  paginatedRecords: LeaveRecord[] = [];

  // Dashboard
  dashboardStats: { icon: string; value: number; label: string; color: string }[] = [];
  onLeaveToday: LeaveRecord[] = [];
  upcomingLeaves: LeaveRecord[] = [];
  recentLeaves: LeaveRecord[] = [];
  leaveBreakdown: { label: string; color: string; count: number; pct: number }[] = [];

  // Filters
  fSearch = '';
  fEmployee = '';
  fType = '';
  fDuration = '';
  fStatus = '';
  fDateFrom = '';
  fDateTo = '';
  sortField = 'fromDate';
  sortDir: 'asc' | 'desc' = 'desc';

  // Pagination
  currentPage = 1;
  pageSize = 10;
  totalPages = 1;
  pageNumbers: number[] = [];

  // Calendar
  calDate = new Date();
  calPeriodLabel = '';
  weekDays: Date[] = [];
  monthCells: { date: Date; isCurrentMonth: boolean; isToday: boolean; leaves: LeaveRecord[] }[] = [];
  yearMonths: { name: string; cells: { date: Date; isCurrentMonth: boolean; isToday: boolean; leaves: LeaveRecord[] }[] }[] = [];

  // Modal
  showModal = false;
  editMode = false;
  formError = '';
  form: LeaveRecord = this.blankForm();

  private sub!: Subscription;

  readonly leaveTypes: { value: LeaveType; label: string; color: string }[] = [
    { value: 'planned', label: 'Planned Leave', color: LEAVE_COLORS.planned },
    { value: 'unplanned', label: 'Unplanned Leave', color: LEAVE_COLORS.unplanned },
    { value: 'sick', label: 'Sick Leave', color: LEAVE_COLORS.sick },
    { value: 'vacation', label: 'Vacation', color: LEAVE_COLORS.vacation },
    { value: 'maternity', label: 'Maternity Leave', color: LEAVE_COLORS.maternity },
    { value: 'wfh', label: 'Work From Home', color: LEAVE_COLORS.wfh },
    { value: 'late-login', label: 'Late Login', color: LEAVE_COLORS['late-login'] },
    { value: 'early-logoff', label: 'Early Logoff', color: LEAVE_COLORS['early-logoff'] },
    { value: 'partial', label: 'Partial Hours', color: LEAVE_COLORS.partial },
  ];

  readonly durationOptions: { value: LeaveDuration; label: string }[] = [
    { value: 'full-day', label: 'Full Day' },
    { value: 'half-day-first', label: 'Half Day (First Half)' },
    { value: 'half-day-second', label: 'Half Day (Second Half)' },
  ];

  readonly statusOptions: LeaveStatus[] = ['Pending', 'Approved', 'Rejected'];

  ngOnInit() {
    this.sub = this.svc.state$.subscribe(state => {
      this.employees = state.employees;
      this.allLeaves = state.leaveRecords || [];
      this.computeDashboard();
      this.applyFilters();
      this.buildCalendar();
    });
  }

  ngOnDestroy() { this.sub?.unsubscribe(); }

  // ── Dashboard Computations ────────────────────────────────────────────────
  computeDashboard() {
    const today = this.todayStr();
    this.onLeaveToday = this.allLeaves.filter(r => r.fromDate <= today && r.toDate >= today);
    const nextWeek = this.dateStr(new Date(Date.now() + 7 * 86400000));
    this.upcomingLeaves = this.allLeaves
      .filter(r => r.fromDate > today && r.fromDate <= nextWeek)
      .sort((a, b) => a.fromDate.localeCompare(b.fromDate));
    this.recentLeaves = [...this.allLeaves]
      .sort((a, b) => b.fromDate.localeCompare(a.fromDate))
      .slice(0, 6);

    const total = this.allLeaves.length;
    this.dashboardStats = [
      { icon: '📋', value: total, label: 'Total Leaves', color: '#6366f1' },
      { icon: '🏖️', value: this.onLeaveToday.length, label: 'On Leave Today', color: '#ef4444' },
      { icon: '📅', value: this.upcomingLeaves.length, label: 'Upcoming (7d)', color: '#f59e0b' },
      { icon: '✅', value: this.allLeaves.filter(r => r.status === 'Approved').length, label: 'Approved', color: '#10b981' },
      { icon: '⏳', value: this.allLeaves.filter(r => r.status === 'Pending').length, label: 'Pending', color: '#8b5cf6' },
      { icon: '❌', value: this.allLeaves.filter(r => r.status === 'Rejected').length, label: 'Rejected', color: '#f97316' },
    ];

    this.leaveBreakdown = this.leaveTypes
      .map(t => ({
        label: t.label,
        color: t.color,
        count: this.allLeaves.filter(r => r.leaveType === t.value).length,
        pct: total > 0 ? Math.round((this.allLeaves.filter(r => r.leaveType === t.value).length / total) * 100) : 0,
      }))
      .filter(x => x.count > 0)
      .sort((a, b) => b.count - a.count);
  }

  // ── Filters & Sorting ─────────────────────────────────────────────────────
  applyFilters() {
    let d = [...this.allLeaves];
    if (this.fSearch) {
      const t = this.fSearch.toLowerCase();
      d = d.filter(r =>
        this.getEmpName(r.employeeId).toLowerCase().includes(t) ||
        r.reason.toLowerCase().includes(t) ||
        (r.notes || '').toLowerCase().includes(t)
      );
    }
    if (this.fEmployee) d = d.filter(r => r.employeeId === this.fEmployee);
    if (this.fType) d = d.filter(r => r.leaveType === this.fType);
    if (this.fDuration) d = d.filter(r => r.duration === this.fDuration);
    if (this.fStatus) d = d.filter(r => r.status === this.fStatus);
    if (this.fDateFrom) d = d.filter(r => r.toDate >= this.fDateFrom);
    if (this.fDateTo) d = d.filter(r => r.fromDate <= this.fDateTo);

    d.sort((a, b) => {
      let va = '', vb = '';
      if (this.sortField === 'employee') { va = this.getEmpName(a.employeeId); vb = this.getEmpName(b.employeeId); }
      else if (this.sortField === 'fromDate') { va = a.fromDate; vb = b.fromDate; }
      else if (this.sortField === 'toDate') { va = a.toDate; vb = b.toDate; }
      else if (this.sortField === 'leaveType') { va = a.leaveType; vb = b.leaveType; }
      else if (this.sortField === 'status') { va = a.status; vb = b.status; }
      const cmp = va.localeCompare(vb);
      return this.sortDir === 'asc' ? cmp : -cmp;
    });

    this.filteredRecords = d;
    this.currentPage = 1;
    this.paginate();
  }

  paginate() {
    this.totalPages = Math.max(1, Math.ceil(this.filteredRecords.length / this.pageSize));
    this.currentPage = Math.min(this.currentPage, this.totalPages);
    const start = (this.currentPage - 1) * this.pageSize;
    this.paginatedRecords = this.filteredRecords.slice(start, start + this.pageSize);
    this.pageNumbers = Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  sortBy(field: string) {
    if (this.sortField === field) this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    else { this.sortField = field; this.sortDir = 'asc'; }
    this.applyFilters();
  }

  sortIcon(field: string): string {
    if (this.sortField !== field) return '↕';
    return this.sortDir === 'asc' ? '↑' : '↓';
  }

  hasActiveFilters(): boolean {
    return !!(this.fSearch || this.fEmployee || this.fType || this.fDuration || this.fStatus || this.fDateFrom || this.fDateTo);
  }

  clearFilters() {
    this.fSearch = this.fEmployee = this.fType = this.fDuration = this.fStatus = this.fDateFrom = this.fDateTo = '';
    this.applyFilters();
  }

  // ── Calendar ──────────────────────────────────────────────────────────────
  buildCalendar() {
    this.updatePeriodLabel();
    if (this.calView === 'week') this.buildWeek();
    else if (this.calView === 'month') this.buildMonth();
    else if (this.calView === 'year') this.buildYear();
  }

  setCalView(v: CalView) { this.calView = v; this.buildCalendar(); }

  calNav(dir: number) {
    const d = new Date(this.calDate);
    if (this.calView === 'day') d.setDate(d.getDate() + dir);
    else if (this.calView === 'week') d.setDate(d.getDate() + dir * 7);
    else if (this.calView === 'month') d.setMonth(d.getMonth() + dir);
    else if (this.calView === 'year') d.setFullYear(d.getFullYear() + dir);
    this.calDate = d;
    this.buildCalendar();
  }

  goToday() { this.calDate = new Date(); this.buildCalendar(); }

  updatePeriodLabel() {
    const d = this.calDate;
    if (this.calView === 'day') this.calPeriodLabel = d.toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' });
    else if (this.calView === 'week') {
      const start = this.getWeekStart(d);
      const end = new Date(start); end.setDate(end.getDate() + 6);
      this.calPeriodLabel = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' – ' + end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    else if (this.calView === 'month') this.calPeriodLabel = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    else this.calPeriodLabel = d.getFullYear().toString();
  }

  getWeekStart(d: Date): Date {
    const s = new Date(d); s.setDate(d.getDate() - d.getDay()); return s;
  }

  buildWeek() {
    const start = this.getWeekStart(this.calDate);
    this.weekDays = Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  }

  buildMonth() {
    const year = this.calDate.getFullYear(), month = this.calDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const cells: typeof this.monthCells = [];
    const prevLast = new Date(year, month, 0).getDate();
    const todayStr = this.todayStr();
    for (let i = firstDay.getDay() - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevLast - i);
      cells.push({ date: d, isCurrentMonth: false, isToday: false, leaves: this.getLeavesForDate(d) });
    }
    const total = new Date(year, month + 1, 0).getDate();
    for (let i = 1; i <= total; i++) {
      const d = new Date(year, month, i);
      cells.push({ date: d, isCurrentMonth: true, isToday: this.dateStr(d) === todayStr, leaves: this.getLeavesForDate(d) });
    }
    for (let i = 1; cells.length < 42; i++) {
      const d = new Date(year, month + 1, i);
      cells.push({ date: d, isCurrentMonth: false, isToday: false, leaves: this.getLeavesForDate(d) });
    }
    this.monthCells = cells;
  }

  buildYear() {
    const year = this.calDate.getFullYear();
    const todayStr = this.todayStr();
    this.yearMonths = Array.from({ length: 12 }, (_, m) => {
      const name = new Date(year, m, 1).toLocaleDateString('en-US', { month: 'long' });
      const cells: typeof this.monthCells = [];
      const firstDay = new Date(year, m, 1);
      const prevLast = new Date(year, m, 0).getDate();
      for (let i = firstDay.getDay() - 1; i >= 0; i--) {
        const d = new Date(year, m - 1, prevLast - i);
        cells.push({ date: d, isCurrentMonth: false, isToday: false, leaves: this.getLeavesForDate(d) });
      }
      const total = new Date(year, m + 1, 0).getDate();
      for (let i = 1; i <= total; i++) {
        const d = new Date(year, m, i);
        cells.push({ date: d, isCurrentMonth: true, isToday: this.dateStr(d) === todayStr, leaves: this.getLeavesForDate(d) });
      }
      for (let i = 1; cells.length < 42; i++) {
        const d = new Date(year, m + 1, i);
        cells.push({ date: d, isCurrentMonth: false, isToday: false, leaves: this.getLeavesForDate(d) });
      }
      return { name, cells };
    });
  }

  getDayLeaves(date: Date): LeaveRecord[] { return this.getLeavesForDate(date); }

  getLeavesForDate(date: Date): LeaveRecord[] {
    const ds = this.dateStr(date);
    return this.allLeaves.filter(r => r.fromDate <= ds && r.toDate >= ds);
  }

  drillToDay(date: Date) { this.calDate = date; this.calView = 'day'; this.buildCalendar(); }

  isToday(date: Date): boolean { return this.dateStr(date) === this.todayStr(); }

  getYearCellTooltip(cell: { date: Date; leaves: LeaveRecord[] }): string {
    if (cell.leaves.length === 0) return '';
    return cell.leaves.map(r => this.getEmpName(r.employeeId) + ' – ' + this.getLeaveLabel(r.leaveType)).join('\n');
  }

  // ── Modal ─────────────────────────────────────────────────────────────────
  blankForm(): LeaveRecord {
    return {
      id: '', employeeId: '',
      fromDate: this.todayStr(), toDate: this.todayStr(),
      duration: 'full-day', leaveType: 'planned',
      reason: '', notes: '', status: 'Pending',
    };
  }

  openAdd() { this.form = this.blankForm(); this.editMode = false; this.formError = ''; this.showModal = true; }
  openEdit(r: LeaveRecord) { this.form = { ...r }; this.editMode = true; this.formError = ''; this.showModal = true; }
  closeModal() { this.showModal = false; }

  saveLeave() {
    this.formError = '';
    if (!this.form.employeeId) { this.formError = 'Please select an employee.'; return; }
    if (!this.form.fromDate || !this.form.toDate) { this.formError = 'Please specify both dates.'; return; }
    if (this.form.fromDate > this.form.toDate) { this.formError = 'From date cannot be after To date.'; return; }
    if (!this.form.reason.trim()) { this.formError = 'Reason is required.'; return; }

    const overlaps = this.svc.hasOverlappingLeave(
      this.form.employeeId, this.form.fromDate, this.form.toDate,
      this.editMode ? this.form.id : undefined
    );
    if (overlaps) {
      if (!confirm('This employee already has a leave record in this date range. Add anyway?')) return;
    }

    if (this.editMode) {
      this.svc.updateLeave(this.form);
    } else {
      this.form.id = this.svc.generateId('LV', this.allLeaves);
      this.svc.addLeave(this.form);
    }
    this.closeModal();
  }

  deleteLeave(id: string) {
    if (confirm('Delete this leave record?')) this.svc.deleteLeave(id);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  getEmpName(id: string): string { return this.employees.find(e => e.id === id)?.name || id; }
  getInitials(id: string): string { return this.svc.getInitials(this.getEmpName(id)); }
  getLeaveColor(type: LeaveType): string { return LEAVE_COLORS[type] || '#64748b'; }
  getLeaveLabel(type: LeaveType): string { return LEAVE_LABELS[type] || type; }
  getDurationLabel(d: LeaveDuration): string { return DURATION_LABELS[d] || d; }
  getDaysFromNow(dateStr: string): number {
    const diff = new Date(dateStr).getTime() - Date.now();
    return Math.ceil(diff / 86400000);
  }
  readonly EMP_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'];
  getEmpColor(id: string): string { return this.EMP_COLORS[id.charCodeAt(id.length - 1) % this.EMP_COLORS.length]; }
  todayStr(): string { return this.dateStr(new Date()); }
  dateStr(d: Date): string {
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
  }
}
