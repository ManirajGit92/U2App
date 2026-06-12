import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Employee, Project, Reminder, StandupNote, StandupNoteService, CalendarCategory, CalendarEvent } from '../standup-note.service';

@Component({
  selector: 'app-standup-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="dashboard">
      <!-- Stats Row -->
      <div class="stats-row">
        <div class="stat-card" *ngFor="let stat of stats">
          <div class="stat-icon">{{ stat.icon }}</div>
          <div class="stat-info">
            <div class="stat-value">{{ stat.value }}</div>
            <div class="stat-label">{{ stat.label }}</div>
          </div>
        </div>
      </div>

      <div class="grid-2">
        <!-- Today's Standup Notes -->
        <div class="panel">
          <div class="panel-header">
            <h3>📝 Today's Standups</h3>
            <span class="badge badge-blue">{{ todayNotes.length }}</span>
          </div>
          <div class="panel-body">
            <div *ngIf="todayNotes.length === 0" class="empty">No standup notes submitted today yet.</div>
            <div class="today-card" *ngFor="let note of todayNotes">
              <div class="tc-header">
                <div class="avatar" [style.background]="getAvatarColor(note.employeeId)">{{ getInitials(note.employeeId) }}</div>
                <div>
                  <div class="tc-name">{{ getEmployeeName(note.employeeId) }}</div>
                  <div class="tc-position">{{ getPosition(note.employeeId) }}</div>
                </div>
              </div>
              <div class="tc-rows">
                <div class="tc-row" *ngIf="note.todayPlan"><span class="tc-tag plan">Today</span> {{ note.todayPlan }}</div>
                <div class="tc-row" *ngIf="note.blockers && note.blockers !== 'None'"><span class="tc-tag blocker">Blocker</span> {{ note.blockers }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Upcoming Reminders -->
        <div class="panel">
          <div class="panel-header">
            <h3>🔔 Upcoming Reminders</h3>
            <span class="badge badge-red">{{ urgentReminders.length }}</span>
          </div>
          <div class="panel-body">
            <div *ngIf="urgentReminders.length === 0" class="empty">No urgent reminders. All clear!</div>
            <div class="reminder-row" *ngFor="let r of urgentReminders">
              <div class="rem-info">
                <div class="rem-title">{{ r.title }}</div>
                <div class="rem-meta">{{ r.assignedTo }}</div>
              </div>
              <div class="rem-right">
                <span class="badge" [ngClass]="'badge-' + r.priority.toLowerCase()">{{ r.priority }}</span>
                <span class="rem-days" [class.overdue]="daysUntil(r.deadline) < 0">
                  {{ daysUntil(r.deadline) < 0 ? 'Overdue' : daysUntil(r.deadline) + 'd left' }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="grid-2">
        <!-- Office Calendar Widget -->
        <div class="panel">
          <div class="panel-header">
            <h3>📅 Office Calendar - {{ currentMonthName }}</h3>
          </div>
          <div class="panel-body flex-row">
            <!-- Mini Calendar Grid -->
            <div class="mini-calendar">
              <div class="mini-weekday" *ngFor="let d of weekDays">{{ d[0] }}</div>
              <div
                *ngFor="let cell of miniCalDays"
                class="mini-day"
                [class.prev-next]="!cell.isCurrentMonth"
                [class.today]="cell.isToday"
                [class.selected]="isSelectedDay(cell.date)"
                (click)="selectDashboardDay(cell.date)"
              >
                <span>{{ cell.date.getDate() }}</span>
                <div class="mini-dots" *ngIf="cell.events.length > 0">
                  <span
                    *ngFor="let e of cell.events.slice(0, 3)"
                    class="mini-dot"
                    [style.background]="getCategoryColor(e.categoryId)"
                    [title]="e.title"
                  ></span>
                </div>
              </div>
            </div>

            <!-- Selected Day Events List -->
            <div class="mini-day-events">
              <h4>Events for {{ selectedDashboardDate | date:'MMM d' }}</h4>
              <div *ngIf="selectedDayEvents.length === 0" class="empty-mini-events">
                No events scheduled.
              </div>
              <div class="mini-event-item" *ngFor="let e of selectedDayEvents">
                <span class="mini-event-badge" [style.background]="getCategoryColor(e.categoryId)"></span>
                <div class="mini-event-details">
                  <div class="me-title">{{ e.title }}</div>
                  <div class="me-time" *ngIf="e.time">⏰ {{ e.time }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Projects Summary -->
        <div class="panel">
          <div class="panel-header">
            <h3>🚀 Project Status</h3>
          </div>
          <div class="panel-body">
            <div class="projects-grid">
              <div class="proj-card" *ngFor="let p of projects">
                <div class="proj-top">
                  <div class="proj-name">{{ p.name }}</div>
                  <span class="badge" [ngClass]="'badge-' + p.status.toLowerCase().replace(' ', '-')">{{ p.status }}</span>
                </div>
                <div class="proj-lead">Lead: {{ p.lead }}</div>
                <div class="proj-notes">{{ p.notes }}</div>
                <div class="timeline-bar-wrap">
                  <div class="timeline-bar">
                    <div class="timeline-fill" [style.width]="getProgress(p) + '%'"></div>
                  </div>
                  <div class="timeline-labels">
                    <span>{{ p.startDate }}</span>
                    <span>{{ getProgress(p) }}%</span>
                    <span>{{ p.endDate }}</span>
                  </div>
                </div>
              </div>
              <div *ngIf="projects.length === 0" class="empty">No projects configured.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dashboard { display: flex; flex-direction: column; gap: 1.5rem; }
 
    /* Stats */
    .stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; }
    .stat-card {
      background: var(--bg-secondary); border-radius: 12px;
      border: 1px solid var(--border-color);
      padding: 0.5rem; display: flex; align-items: center; gap: 1rem;
      box-shadow: var(--shadow-sm);
    }
    .stat-icon { font-size: 2rem; }
    .stat-value { font-size: 1.8rem; font-weight: 700; color: var(--accent-primary); line-height: 1; }
    .stat-label { font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.25rem; }
 
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
 
    /* Panel */
    .panel { background: var(--bg-secondary); border-radius: 12px; border: 1px solid var(--border-color); box-shadow: var(--shadow-sm); overflow: hidden; display: flex; flex-direction: column; }
    .panel-header { display: flex; align-items: center; justify-content: space-between; padding: 0.5rem 0.5rem; border-bottom: 1px solid var(--border-color); }
    .panel-header h3 { margin: 0; font-size: 0.95rem; color: var(--text-primary); }
    .panel-body { padding: 0.5rem 0.5rem; display: flex; flex-direction: column; gap: 1rem; max-height: 420px; overflow-y: auto; flex: 1; }
 
    /* Mini Calendar Styling */
    .flex-row { display: flex; gap: 1rem; flex-wrap: wrap; }
    .mini-calendar {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 4px;
      flex: 1.2;
      min-width: 200px;
    }
    .mini-weekday {
      text-align: center;
      font-size: 0.75rem;
      font-weight: 700;
      color: var(--text-secondary);
      padding: 2px 0;
    }
    .mini-day {
      background: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      padding: 4px 2px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: space-between;
      min-height: 40px;
      font-size: 0.78rem;
      cursor: pointer;
      transition: background 0.15s;
    }
    .mini-day:hover {
      background: var(--bg-input);
    }
    .mini-day.prev-next {
      opacity: 0.35;
    }
    .mini-day.today {
      background: var(--accent-surface);
      border-color: var(--accent-primary);
      font-weight: 700;
      color: var(--accent-primary);
    }
    .mini-day.selected {
      border-color: var(--accent-primary);
      background: rgba(99, 102, 241, 0.15);
    }
    .mini-dots {
      display: flex;
      gap: 2px;
      justify-content: center;
      margin-top: 2px;
    }
    .mini-dot {
      width: 5px;
      height: 5px;
      border-radius: 50%;
    }
    .mini-day-events {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      min-width: 180px;
    }
    .mini-day-events h4 {
      margin: 0;
      font-size: 0.82rem;
      font-weight: 700;
      color: var(--text-primary);
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 4px;
    }
    .empty-mini-events {
      font-size: 0.75rem;
      color: var(--text-secondary);
      font-style: italic;
      padding-top: 0.5rem;
    }
    .mini-event-item {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 6px;
      background: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      border-radius: 6px;
    }
    .mini-event-badge {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .mini-event-details {
      display: flex;
      flex-direction: column;
    }
    .me-title {
      font-size: 0.78rem;
      font-weight: 600;
      color: var(--text-primary);
    }
    .me-time {
      font-size: 0.68rem;
      color: var(--text-secondary);
    }

    /* Today's note cards */
    .today-card { border: 1px solid var(--border-color); border-radius: 10px; padding: 0.5rem; background: var(--bg-tertiary); }
    .tc-header { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem; }
    .avatar { width: 38px; height: 38px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.85rem; font-weight: 700; color: white; flex-shrink: 0; }
    .tc-name { font-weight: 600; font-size: 0.9rem; color: var(--text-primary); }
    .tc-position { font-size: 0.75rem; color: var(--text-secondary); }
    .tc-rows { display: flex; flex-direction: column; gap: 0.4rem; }
    .tc-row { font-size: 0.82rem; color: var(--text-primary); display: flex; gap: 0.5rem; align-items: flex-start; }
    .tc-tag { font-size: 0.7rem; font-weight: 600; padding: 0.1rem 0.45rem; border-radius: 4px; white-space: nowrap; }
    .tc-tag.plan { background: rgba(16,185,129,0.15); color: #10b981; }
    .tc-tag.blocker { background: rgba(239,68,68,0.15); color: #ef4444; }
 
    /* Reminders */
    .reminder-row { display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0; border-bottom: 1px solid var(--border-color); }
    .reminder-row:last-child { border-bottom: none; }
    .rem-title { font-weight: 600; font-size: 0.88rem; color: var(--text-primary); }
    .rem-meta { font-size: 0.75rem; color: var(--text-secondary); }
    .rem-right { display: flex; flex-direction: column; align-items: flex-end; gap: 0.25rem; }
    .rem-days { font-size: 0.75rem; color: var(--text-secondary); }
    .rem-days.overdue { color: var(--danger); font-weight: 600; }
 
    /* Projects grid */
    .projects-grid { display: grid; grid-template-columns: 1fr; gap: 1rem; }
    .proj-card { border: 1px solid var(--border-color); border-radius: 10px; padding: 0.5rem; background: var(--bg-tertiary); }
    .proj-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.4rem; }
    .proj-name { font-weight: 600; font-size: 0.9rem; color: var(--text-primary); }
    .proj-lead { font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.25rem; }
    .proj-notes { font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 0.5rem; }
    .timeline-bar-wrap { }
    .timeline-bar { height: 8px; background: var(--border-color); border-radius: 4px; overflow: hidden; }
    .timeline-fill { height: 100%; background: linear-gradient(90deg, var(--accent-primary), var(--accent-secondary)); border-radius: 4px; transition: width 0.5s ease; }
    .timeline-labels { display: flex; justify-content: space-between; font-size: 0.7rem; color: var(--text-secondary); margin-top: 0.3rem; }
 
    /* Badges */
    .badge { padding: 0.2rem 0.5rem; border-radius: 20px; font-size: 0.72rem; font-weight: 600; }
    .badge-blue { background: #dbeafe; color: #1d4ed8; }
    .badge-red { background: #fee2e2; color: #b91c1c; }
    .badge-active { background: #d1fae5; color: #065f46; }
    .badge-on-hold { background: #fef3c7; color: #b45309; }
    .badge-completed { background: #e0e7ff; color: #4338ca; }
    .badge-high { background: #fee2e2; color: #b91c1c; }
    .badge-medium { background: #fef3c7; color: #b45309; }
    .badge-low { background: #d1fae5; color: #065f46; }
    .empty { text-align: center; padding: 0.5rem; color: var(--text-muted, #64748b); font-style: italic; font-size: 0.85rem; }
 
    @media (max-width: 768px) {
      .stats-row { grid-template-columns: repeat(2, 1fr); }
      .grid-2 { grid-template-columns: 1fr; }
    }
 
    @media (max-width: 480px) {
      .stats-row { grid-template-columns: 1fr; }
      .stat-card { padding: 0.75rem; }
    }
  `]
})
export class StandupDashboardComponent implements OnInit {
  svc = inject(StandupNoteService);
  employees: Employee[] = [];
  allNotes: StandupNote[] = [];
  todayNotes: StandupNote[] = [];
  projects: Project[] = [];
  urgentReminders: Reminder[] = [];
  categories: CalendarCategory[] = [];
  allEvents: CalendarEvent[] = [];

  stats: { icon: string; value: number; label: string }[] = [];

  // Calendar Widget states
  miniCalDays: { date: Date; isCurrentMonth: boolean; isToday: boolean; events: CalendarEvent[] }[] = [];
  selectedDashboardDate = new Date();
  selectedDayEvents: CalendarEvent[] = [];
  currentMonthName = '';
  weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  readonly AVATAR_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'];

  ngOnInit() {
    this.svc.state$.subscribe(state => {
      this.employees = state.employees;
      this.allNotes = state.standupNotes;
      const today = new Date().toISOString().split('T')[0];
      this.todayNotes = state.standupNotes.filter(n => n.date === today);
      this.projects = state.projects;
      this.urgentReminders = state.reminders.filter(r => !r.done).sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime()).slice(0, 5);
      this.categories = state.calendarCategories || [];
      this.allEvents = state.calendarEvents || [];

      this.stats = [
        { icon: '👥', value: state.employees.length, label: 'Total Employees' },
        { icon: '🚀', value: state.projects.filter(p => p.status === 'Active').length, label: 'Active Projects' },
        { icon: '📝', value: this.todayNotes.length, label: "Today's Notes" },
        { icon: '🔔', value: state.reminders.filter(r => !r.done).length, label: 'Open Reminders' },
      ];

      this.generateMiniCalendar();
    });
  }

  generateMiniCalendar() {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    this.currentMonthName = today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    const firstDay = new Date(year, month, 1);
    const startOffset = firstDay.getDay();
    const lastDay = new Date(year, month + 1, 0);
    const totalDays = lastDay.getDate();

    const days = [];

    // Prev month padding
    const prevMonthLast = new Date(year, month, 0).getDate();
    for (let i = startOffset - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonthLast - i);
      days.push(this.createMiniDayItem(d, false));
    }

    // Current month
    for (let i = 1; i <= totalDays; i++) {
      const d = new Date(year, month, i);
      days.push(this.createMiniDayItem(d, true));
    }

    // Next month padding
    const remainingSlots = 42 - days.length;
    for (let i = 1; i <= remainingSlots; i++) {
      const d = new Date(year, month + 1, i);
      days.push(this.createMiniDayItem(d, false));
    }

    this.miniCalDays = days;
    this.updateSelectedDayEvents();
  }

  createMiniDayItem(date: Date, isCurrentMonth: boolean) {
    const dateStr = this.formatDateString(date);
    const dayEvents = this.allEvents.filter(e => e.date === dateStr);
    const todayStr = this.formatDateString(new Date());
    return {
      date,
      isCurrentMonth,
      isToday: dateStr === todayStr,
      events: dayEvents,
    };
  }

  formatDateString(d: Date): string {
    const y = d.getFullYear();
    const m = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  isSelectedDay(date: Date): boolean {
    return this.formatDateString(date) === this.formatDateString(this.selectedDashboardDate);
  }

  selectDashboardDay(date: Date) {
    this.selectedDashboardDate = date;
    this.updateSelectedDayEvents();
  }

  updateSelectedDayEvents() {
    const dateStr = this.formatDateString(this.selectedDashboardDate);
    this.selectedDayEvents = this.allEvents.filter(e => e.date === dateStr);
  }

  getCategoryColor(catId: string): string {
    return this.categories.find(c => c.id === catId)?.color || '#94a3b8';
  }

  getEmployeeName(id: string): string {
    return this.employees.find(e => e.id === id)?.name || id;
  }
  getPosition(id: string): string {
    return this.employees.find(e => e.id === id)?.position || '';
  }
  getInitials(id: string): string {
    return this.svc.getInitials(this.getEmployeeName(id));
  }
  getAvatarColor(id: string): string {
    const idx = id.charCodeAt(id.length - 1) % this.AVATAR_COLORS.length;
    return this.AVATAR_COLORS[idx];
  }
  daysUntil(d: string): number { return this.svc.daysUntil(d); }

  getProgress(p: Project): number {
    const start = new Date(p.startDate).getTime();
    const end = new Date(p.endDate).getTime();
    const now = Date.now();
    if (now <= start) return 0;
    if (now >= end) return 100;
    return Math.round(((now - start) / (end - start)) * 100);
  }
}
