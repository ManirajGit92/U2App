import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Reminder, StandupNoteService } from '../standup-note.service';

@Component({
  selector: 'app-reminders',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="reminders-page">
      <div class="toolbar">
        <input type="text" placeholder="🔍 Search reminders..." [(ngModel)]="search" (ngModelChange)="applyFilters()" class="input-field search">
        <select [(ngModel)]="filterPriority" (ngModelChange)="applyFilters()" class="input-field">
          <option value="">All Priorities</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>
        <select [(ngModel)]="filterDone" (ngModelChange)="applyFilters()" class="input-field">
          <option value="">All</option>
          <option value="open">Open</option>
          <option value="done">Completed</option>
        </select>
        <button class="btn btn-primary" (click)="openAdd()">+ Add Reminder</button>
      </div>

      <div class="reminder-list">
        <div class="reminder-card" *ngFor="let r of filtered" [class.done]="r.done">
          <div class="rc-left">
            <input type="checkbox" [checked]="r.done" (change)="toggleDone(r)" class="check">
          </div>
          <div class="rc-body">
            <div class="rc-title" [class.done-text]="r.done">{{ r.title }}</div>
            <div class="rc-desc">{{ r.description }}</div>
            <div class="rc-meta">
              <span>👤 {{ r.assignedTo }}</span>
              <span>📅 {{ r.deadline }}</span>
            </div>
          </div>
          <div class="rc-right">
            <span class="badge" [ngClass]="'badge-' + r.priority.toLowerCase()">{{ r.priority }}</span>
            <div class="countdown" [ngClass]="getCountdownClass(r)">{{ formatCountdown(r) }}</div>
            <div class="rc-actions">
              <button class="icon-btn" (click)="openEdit(r)">✏️</button>
              <button class="icon-btn" (click)="deleteReminder(r.id)">🗑️</button>
            </div>
          </div>
        </div>
        <div class="empty-state" *ngIf="filtered.length === 0">
          <span>🔔</span>
          <div>No reminders found. You're all caught up!</div>
        </div>
      </div>

      <!-- Modal -->
      <div class="modal-overlay" *ngIf="showModal" (click)="closeModal()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>{{ editMode ? 'Edit' : 'Add' }} Reminder</h3>
            <button class="icon-btn" (click)="closeModal()">✕</button>
          </div>
          <div class="modal-body">
            <div class="form-row"><label>Title</label><input type="text" [(ngModel)]="form.title" class="input-field" placeholder="e.g. Sprint Review"></div>
            <div class="form-row"><label>Description</label><textarea [(ngModel)]="form.description" class="input-field" rows="2" placeholder="Details..."></textarea></div>
            <div class="form-grid">
              <div class="form-row">
                <label>Priority</label>
                <select [(ngModel)]="form.priority" class="input-field">
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>
              <div class="form-row"><label>Deadline</label><input type="date" [(ngModel)]="form.deadline" class="input-field"></div>
            </div>
            <div class="form-row"><label>Assigned To</label><input type="text" [(ngModel)]="form.assignedTo" class="input-field" placeholder="Team member name"></div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-ghost" (click)="closeModal()">Cancel</button>
            <button class="btn btn-primary" (click)="saveReminder()">{{ editMode ? 'Save' : 'Add' }}</button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .reminders-page { display: flex; flex-direction: column; gap: 1.25rem; }
    .toolbar { display: flex; gap: 0.75rem; flex-wrap: wrap; background: var(--bg-secondary); padding: 1rem 1.25rem; border-radius: 12px; border: 1px solid var(--border-color); align-items: center; }
    .input-field { padding: 0.55rem 0.9rem; border: 1px solid var(--border-color); border-radius: 8px; font-size: 0.88rem; background: var(--bg-input); color: var(--text-primary); outline: none; }
    .input-field:focus { border-color: var(--accent-primary); }
    .search { flex: 1; min-width: 180px; }
    textarea.input-field { resize: vertical; font-family: inherit; }

    .reminder-list { display: flex; flex-direction: column; gap: 0.85rem; }
    .reminder-card {
      background: var(--bg-secondary); border-radius: 12px; border: 1px solid var(--border-color);
      padding: 1rem 1.25rem; display: flex; align-items: flex-start; gap: 1rem;
      box-shadow: var(--shadow-sm); transition: box-shadow 0.15s;
    }
    .reminder-card:hover { box-shadow: var(--shadow-md); }
    .reminder-card.done { opacity: 0.55; }
    .rc-left { padding-top: 0.25rem; }
    .check { width: 18px; height: 18px; cursor: pointer; accent-color: var(--accent-primary); }
    .rc-body { flex: 1; }
    .rc-title { font-weight: 700; font-size: 0.95rem; color: var(--text-primary); margin-bottom: 0.25rem; }
    .rc-title.done-text { text-decoration: line-through; color: var(--text-secondary); }
    .rc-desc { font-size: 0.82rem; color: var(--text-secondary); margin-bottom: 0.5rem; }
    .rc-meta { display: flex; gap: 1rem; font-size: 0.76rem; color: var(--text-secondary); }
    .rc-right { display: flex; flex-direction: column; align-items: flex-end; gap: 0.5rem; }
    .rc-actions { display: flex; gap: 0.2rem; }

    .countdown { font-size: 0.75rem; font-weight: 700; padding: 0.2rem 0.5rem; border-radius: 6px; }
    .countdown-ok { background: rgba(16,185,129,0.15); color: #10b981; }
    .countdown-soon { background: rgba(245,158,11,0.15); color: #f59e0b; }
    .countdown-overdue { background: rgba(239,68,68,0.15); color: #ef4444; }
    .countdown-done { background: rgba(99,102,241,0.15); color: var(--accent-primary); }

    .badge { padding: 0.2rem 0.55rem; border-radius: 20px; font-size: 0.72rem; font-weight: 600; }
    .badge-high { background: rgba(239,68,68,0.15); color: #ef4444; }
    .badge-medium { background: rgba(245,158,11,0.15); color: #f59e0b; }
    .badge-low { background: rgba(16,185,129,0.15); color: #10b981; }

    .icon-btn { background: none; border: none; cursor: pointer; font-size: 0.95rem; opacity: 0.6; transition: opacity 0.15s, transform 0.15s; border-radius: 4px; padding: 0.2rem 0.3rem; }
    .icon-btn:hover { opacity: 1; transform: scale(1.1); }

    .empty-state { text-align: center; padding: 3rem; color: var(--text-secondary); display: flex; flex-direction: column; align-items: center; gap: 0.75rem; font-size: 2rem; }
    .empty-state div { font-size: 0.9rem; }

    .btn { display: inline-flex; align-items: center; padding: 0.55rem 1.1rem; border-radius: 8px; font-size: 0.88rem; font-weight: 600; cursor: pointer; border: 1px solid transparent; transition: all 0.15s; white-space: nowrap; }
    .btn-primary { background: var(--accent-primary); color: white; }
    .btn-primary:hover { opacity: 0.9; }
    .btn-ghost { background: none; border-color: var(--border-color); color: var(--text-secondary); }
    .btn-ghost:hover { background: var(--bg-tertiary); }

    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 100; backdrop-filter: blur(2px); }
    .modal { background: var(--bg-secondary); border-radius: 16px; width: 460px; max-width: 95vw; box-shadow: var(--shadow-lg); border: 1px solid var(--border-color); }
    .modal-header { display: flex; justify-content: space-between; align-items: center; padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--border-color); }
    .modal-header h3 { margin: 0; font-size: 1.05rem; color: var(--text-primary); }
    .modal-body { padding: 1.25rem 1.5rem; display: flex; flex-direction: column; gap: 1rem; }
    .modal-footer { display: flex; justify-content: flex-end; gap: 0.75rem; padding: 1rem 1.5rem; border-top: 1px solid var(--border-color); }
    .form-row { display: flex; flex-direction: column; gap: 0.4rem; }
    .form-row label { font-size: 0.82rem; font-weight: 600; color: var(--text-secondary); }
    .form-row .input-field { width: 100%; box-sizing: border-box; }
    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
  `]
})
export class RemindersComponent implements OnInit {
  svc = inject(StandupNoteService);
  all: Reminder[] = [];
  filtered: Reminder[] = [];
  search = '';
  filterPriority = '';
  filterDone = '';
  showModal = false;
  editMode = false;
  form!: Reminder;

  ngOnInit() {
    this.svc.state$.subscribe(s => { this.all = s.reminders; this.applyFilters(); });
  }

  applyFilters() {
    let d = [...this.all];
    if (this.search) { const t = this.search.toLowerCase(); d = d.filter(r => r.title.toLowerCase().includes(t) || r.assignedTo.toLowerCase().includes(t)); }
    if (this.filterPriority) d = d.filter(r => r.priority === this.filterPriority);
    if (this.filterDone === 'open') d = d.filter(r => !r.done);
    if (this.filterDone === 'done') d = d.filter(r => r.done);
    d.sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());
    this.filtered = d;
  }

  getCountdownClass(r: Reminder): string {
    if (r.done) return 'countdown-done';
    const days = this.svc.daysUntil(r.deadline);
    if (days < 0) return 'countdown-overdue';
    if (days <= 3) return 'countdown-soon';
    return 'countdown-ok';
  }

  formatCountdown(r: Reminder): string {
    if (r.done) return '✓ Done';
    const days = this.svc.daysUntil(r.deadline);
    if (days < 0) return `${Math.abs(days)}d overdue`;
    if (days === 0) return 'Due today!';
    return `${days}d left`;
  }

  toggleDone(r: Reminder) {
    this.svc.updateReminder({ ...r, done: !r.done });
  }

  blank(): Reminder {
    return { id: '', title: '', description: '', deadline: '', priority: 'Medium', assignedTo: '', done: false };
  }

  openAdd() { this.form = this.blank(); this.editMode = false; this.showModal = true; }
  openEdit(r: Reminder) { this.form = { ...r }; this.editMode = true; this.showModal = true; }
  closeModal() { this.showModal = false; }

  saveReminder() {
    if (!this.form.title) return;
    if (this.editMode) { this.svc.updateReminder(this.form); }
    else { this.form.id = this.svc.generateId('REM', this.all); this.svc.addReminder(this.form); }
    this.closeModal();
  }
  deleteReminder(id: string) { if (confirm('Delete this reminder?')) this.svc.deleteReminder(id); }
}
