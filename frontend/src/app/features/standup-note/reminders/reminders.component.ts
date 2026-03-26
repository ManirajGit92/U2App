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
    .toolbar { display: flex; gap: 0.75rem; flex-wrap: wrap; background: var(--surface, #fff); padding: 1rem 1.25rem; border-radius: 12px; border: 1px solid var(--border, #e2e8f0); align-items: center; }
    .input-field { padding: 0.55rem 0.9rem; border: 1px solid var(--border, #d1d5db); border-radius: 8px; font-size: 0.88rem; background: #f8fafc; color: var(--text, #1e293b); outline: none; }
    .input-field:focus { border-color: #6366f1; background: white; }
    .search { flex: 1; min-width: 180px; }
    textarea.input-field { resize: vertical; font-family: inherit; }

    .reminder-list { display: flex; flex-direction: column; gap: 0.85rem; }
    .reminder-card {
      background: var(--surface, #fff); border-radius: 12px; border: 1px solid var(--border, #e2e8f0);
      padding: 1rem 1.25rem; display: flex; align-items: flex-start; gap: 1rem;
      box-shadow: 0 2px 6px rgba(0,0,0,0.04); transition: box-shadow 0.15s;
    }
    .reminder-card:hover { box-shadow: 0 4px 14px rgba(99,102,241,0.1); }
    .reminder-card.done { opacity: 0.55; }
    .rc-left { padding-top: 0.25rem; }
    .check { width: 18px; height: 18px; cursor: pointer; accent-color: #6366f1; }
    .rc-body { flex: 1; }
    .rc-title { font-weight: 700; font-size: 0.95rem; color: var(--text, #1e293b); margin-bottom: 0.25rem; }
    .rc-title.done-text { text-decoration: line-through; color: var(--text-muted, #94a3b8); }
    .rc-desc { font-size: 0.82rem; color: var(--text-muted, #64748b); margin-bottom: 0.5rem; }
    .rc-meta { display: flex; gap: 1rem; font-size: 0.76rem; color: var(--text-muted, #64748b); }
    .rc-right { display: flex; flex-direction: column; align-items: flex-end; gap: 0.5rem; }
    .rc-actions { display: flex; gap: 0.2rem; }

    .countdown { font-size: 0.75rem; font-weight: 700; padding: 0.2rem 0.5rem; border-radius: 6px; }
    .countdown-ok { background: #d1fae5; color: #065f46; }
    .countdown-soon { background: #fef3c7; color: #b45309; }
    .countdown-overdue { background: #fee2e2; color: #b91c1c; }
    .countdown-done { background: #e0e7ff; color: #4338ca; }

    .badge { padding: 0.2rem 0.55rem; border-radius: 20px; font-size: 0.72rem; font-weight: 600; }
    .badge-high { background: #fee2e2; color: #b91c1c; }
    .badge-medium { background: #fef3c7; color: #b45309; }
    .badge-low { background: #d1fae5; color: #065f46; }

    .icon-btn { background: none; border: none; cursor: pointer; font-size: 0.95rem; opacity: 0.6; transition: opacity 0.15s, transform 0.15s; border-radius: 4px; padding: 0.2rem 0.3rem; }
    .icon-btn:hover { opacity: 1; transform: scale(1.1); }

    .empty-state { text-align: center; padding: 3rem; color: var(--text-muted, #64748b); display: flex; flex-direction: column; align-items: center; gap: 0.75rem; font-size: 2rem; }
    .empty-state div { font-size: 0.9rem; }

    .btn { display: inline-flex; align-items: center; padding: 0.55rem 1.1rem; border-radius: 8px; font-size: 0.88rem; font-weight: 600; cursor: pointer; border: 1px solid transparent; transition: all 0.15s; white-space: nowrap; }
    .btn-primary { background: #6366f1; color: white; }
    .btn-primary:hover { background: #4f46e5; }
    .btn-ghost { background: none; border-color: var(--border, #e2e8f0); color: var(--text-muted, #64748b); }
    .btn-ghost:hover { background: #f1f5f9; }

    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 100; backdrop-filter: blur(2px); }
    .modal { background: var(--surface, white); border-radius: 16px; width: 460px; max-width: 95vw; box-shadow: 0 20px 60px rgba(0,0,0,0.2); }
    .modal-header { display: flex; justify-content: space-between; align-items: center; padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--border, #e2e8f0); }
    .modal-header h3 { margin: 0; font-size: 1.05rem; color: var(--text, #1e293b); }
    .modal-body { padding: 1.25rem 1.5rem; display: flex; flex-direction: column; gap: 1rem; }
    .modal-footer { display: flex; justify-content: flex-end; gap: 0.75rem; padding: 1rem 1.5rem; border-top: 1px solid var(--border, #e2e8f0); }
    .form-row { display: flex; flex-direction: column; gap: 0.4rem; }
    .form-row label { font-size: 0.82rem; font-weight: 600; color: var(--text-muted, #64748b); }
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
