import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Employee, StandupNote, StandupNoteService } from '../standup-note.service';

@Component({
  selector: 'app-standup-notes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="notes-page">
      <!-- Toolbar -->
      <div class="toolbar">
        <div class="toolbar-left">
          <input type="text" placeholder="🔍 Search notes..." [(ngModel)]="search" (ngModelChange)="applyFilters()" class="input-field search">
          <input type="date" [(ngModel)]="filterDate" (ngModelChange)="applyFilters()" class="input-field">
          <select [(ngModel)]="filterEmp" (ngModelChange)="applyFilters()" class="input-field">
            <option value="">All Employees</option>
            <option *ngFor="let e of employees" [value]="e.id">{{ e.name }}</option>
          </select>
        </div>
        <button class="btn btn-primary" (click)="openAdd()">+ Add Note</button>
      </div>

      <!-- Notes Grid -->
      <div class="notes-grid" *ngIf="filtered.length > 0">
        <div class="note-card" *ngFor="let note of filtered">
          <div class="card-header">
            <div class="emp-info">
              <div class="avatar" [style.background]="getColor(note.employeeId)">{{ getInitials(note.employeeId) }}</div>
              <div>
                <div class="emp-name">{{ getEmpName(note.employeeId) }}</div>
                <div class="emp-pos">{{ getPosition(note.employeeId) }}</div>
              </div>
            </div>
            <div class="card-meta">
              <span class="date-badge">{{ note.date }}</span>
              <div class="card-actions">
                <button class="icon-btn" (click)="openEdit(note)">✏️</button>
                <button class="icon-btn" (click)="deleteNote(note.id)">🗑️</button>
              </div>
            </div>
          </div>
          <div class="card-body">
            <div class="note-row" *ngIf="note.previousWork">
              <div class="note-label yesterday">✅ Yesterday</div>
              <div class="note-text">{{ note.previousWork }}</div>
            </div>
            <div class="note-row" *ngIf="note.todayPlan">
              <div class="note-label today">📌 Today</div>
              <div class="note-text">{{ note.todayPlan }}</div>
            </div>
            <div class="note-row" *ngIf="note.blockers && note.blockers !== 'None'">
              <div class="note-label blocker">🚧 Blockers</div>
              <div class="note-text">{{ note.blockers }}</div>
            </div>
            <div class="note-row" *ngIf="note.notes">
              <div class="note-label misc">💬 Notes</div>
              <div class="note-text">{{ note.notes }}</div>
            </div>
          </div>
        </div>
      </div>
      <div class="empty-state" *ngIf="filtered.length === 0">
        <div class="empty-icon">📝</div>
        <div>No standup notes found.</div>
        <button class="btn btn-primary" (click)="openAdd()">Add Today's Note</button>
      </div>

      <!-- Modal -->
      <div class="modal-overlay" *ngIf="showModal" (click)="closeModal()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>{{ editMode ? 'Edit' : 'Add' }} Standup Note</h3>
            <button class="icon-btn" (click)="closeModal()">✕</button>
          </div>
          <div class="modal-body">
            <div class="form-row">
              <label>Employee</label>
              <select [(ngModel)]="form.employeeId" class="input-field">
                <option value="">-- Select --</option>
                <option *ngFor="let e of employees" [value]="e.id">{{ e.name }}</option>
              </select>
            </div>
            <div class="form-row">
              <label>Date</label>
              <input type="date" [(ngModel)]="form.date" class="input-field">
            </div>
            <div class="form-row">
              <label>Previous Work (Yesterday)</label>
              <textarea [(ngModel)]="form.previousWork" class="input-field" rows="2" placeholder="What did you complete?"></textarea>
            </div>
            <div class="form-row">
              <label>Today's Plan</label>
              <textarea [(ngModel)]="form.todayPlan" class="input-field" rows="2" placeholder="What will you work on today?"></textarea>
            </div>
            <div class="form-row">
              <label>Blockers</label>
              <textarea [(ngModel)]="form.blockers" class="input-field" rows="1" placeholder="Any blockers? Type 'None' if clear."></textarea>
            </div>
            <div class="form-row">
              <label>Additional Notes</label>
              <textarea [(ngModel)]="form.notes" class="input-field" rows="1" placeholder="Any other notes..."></textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-ghost" (click)="closeModal()">Cancel</button>
            <button class="btn btn-primary" (click)="saveNote()">{{ editMode ? 'Save Changes' : 'Add Note' }}</button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .notes-page { display: flex; flex-direction: column; gap: 1.25rem; }
    .toolbar { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; background: var(--surface, #fff); padding: 1rem 1.25rem; border-radius: 12px; border: 1px solid var(--border, #e2e8f0); }
    .toolbar-left { display: flex; gap: 0.75rem; flex-wrap: wrap; flex: 1; }
    .input-field { padding: 0.55rem 0.9rem; border: 1px solid var(--border, #d1d5db); border-radius: 8px; font-size: 0.88rem; background: #f8fafc; color: var(--text, #1e293b); outline: none; }
    .input-field:focus { border-color: #6366f1; background: white; }
    .search { min-width: 200px; flex: 1; }

    .notes-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 1.25rem; }
    .note-card { background: var(--surface, #fff); border-radius: 14px; border: 1px solid var(--border, #e2e8f0); overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.04); transition: box-shadow 0.2s; }
    .note-card:hover { box-shadow: 0 4px 16px rgba(99,102,241,0.12); }

    .card-header { display: flex; justify-content: space-between; align-items: flex-start; padding: 1rem; border-bottom: 1px solid var(--border, #e2e8f0); background: linear-gradient(135deg, #f8f7ff, #f0fdfa); }
    .emp-info { display: flex; align-items: center; gap: 0.75rem; }
    .avatar { width: 42px; height: 42px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.9rem; font-weight: 700; color: white; }
    .emp-name { font-weight: 700; font-size: 0.92rem; color: var(--text, #1e293b); }
    .emp-pos { font-size: 0.75rem; color: var(--text-muted, #64748b); }
    .card-meta { display: flex; flex-direction: column; align-items: flex-end; gap: 0.5rem; }
    .date-badge { font-size: 0.72rem; background: #ede9fe; color: #6366f1; padding: 0.2rem 0.5rem; border-radius: 6px; font-weight: 600; }
    .card-actions { display: flex; gap: 0.25rem; }
    .icon-btn { background: none; border: none; cursor: pointer; font-size: 1rem; opacity: 0.6; transition: opacity 0.15s, transform 0.15s; padding: 0.2rem 0.3rem; border-radius: 4px; }
    .icon-btn:hover { opacity: 1; transform: scale(1.1); }

    .card-body { padding: 0.85rem 1rem; display: flex; flex-direction: column; gap: 0.6rem; }
    .note-row { display: flex; gap: 0.5rem; }
    .note-label { font-size: 0.7rem; font-weight: 700; padding: 0.15rem 0.4rem; border-radius: 4px; white-space: nowrap; height: fit-content; }
    .note-label.yesterday { background: #d1fae5; color: #065f46; }
    .note-label.today { background: #ede9fe; color: #6366f1; }
    .note-label.blocker { background: #fee2e2; color: #b91c1c; }
    .note-label.misc { background: #f0f9ff; color: #0369a1; }
    .note-text { font-size: 0.83rem; color: var(--text, #1e293b); line-height: 1.5; }

    .empty-state { text-align: center; padding: 4rem; color: var(--text-muted, #64748b); display: flex; flex-direction: column; align-items: center; gap: 1rem; }
    .empty-icon { font-size: 3rem; }

    /* Buttons */
    .btn { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.55rem 1.1rem; border-radius: 8px; font-size: 0.88rem; font-weight: 600; cursor: pointer; border: 1px solid transparent; transition: all 0.15s; }
    .btn-primary { background: #6366f1; color: white; }
    .btn-primary:hover { background: #4f46e5; }
    .btn-ghost { background: none; border-color: var(--border, #e2e8f0); color: var(--text-muted, #64748b); }
    .btn-ghost:hover { background: #f1f5f9; }

    /* Modal */
    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 100; backdrop-filter: blur(2px); }
    .modal { background: var(--surface, white); border-radius: 16px; width: 540px; max-width: 95vw; box-shadow: 0 20px 60px rgba(0,0,0,0.2); }
    .modal-header { display: flex; justify-content: space-between; align-items: center; padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--border, #e2e8f0); }
    .modal-header h3 { margin: 0; font-size: 1.05rem; color: var(--text, #1e293b); }
    .modal-body { padding: 1.25rem 1.5rem; display: flex; flex-direction: column; gap: 1rem; max-height: 65vh; overflow-y: auto; }
    .modal-footer { display: flex; justify-content: flex-end; gap: 0.75rem; padding: 1rem 1.5rem; border-top: 1px solid var(--border, #e2e8f0); }
    .form-row { display: flex; flex-direction: column; gap: 0.4rem; }
    .form-row label { font-size: 0.82rem; font-weight: 600; color: var(--text-muted, #64748b); }
    .form-row .input-field { width: 100%; box-sizing: border-box; }
    textarea.input-field { resize: vertical; font-family: inherit; }
  `]
})
export class StandupNotesComponent implements OnInit {
  svc = inject(StandupNoteService);
  employees: Employee[] = [];
  allNotes: StandupNote[] = [];
  filtered: StandupNote[] = [];
  search = '';
  filterDate = '';
  filterEmp = '';
  showModal = false;
  editMode = false;
  form!: StandupNote;

  readonly COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#06b6d4', '#10b981', '#f59e0b'];

  ngOnInit() {
    this.svc.state$.subscribe(s => {
      this.employees = s.employees;
      this.allNotes = s.standupNotes;
      this.applyFilters();
    });
  }

  applyFilters() {
    let data = [...this.allNotes];
    if (this.search) {
      const t = this.search.toLowerCase();
      data = data.filter(n => n.todayPlan.toLowerCase().includes(t) || n.previousWork.toLowerCase().includes(t) || n.blockers.toLowerCase().includes(t) || this.getEmpName(n.employeeId).toLowerCase().includes(t));
    }
    if (this.filterDate) data = data.filter(n => n.date === this.filterDate);
    if (this.filterEmp) data = data.filter(n => n.employeeId === this.filterEmp);
    this.filtered = data.sort((a, b) => b.date.localeCompare(a.date));
  }

  getEmpName(id: string) { return this.employees.find(e => e.id === id)?.name || id; }
  getPosition(id: string) { return this.employees.find(e => e.id === id)?.position || ''; }
  getInitials(id: string) { return this.svc.getInitials(this.getEmpName(id)); }
  getColor(id: string) { return this.COLORS[id.charCodeAt(id.length - 1) % this.COLORS.length]; }

  blankForm(): StandupNote {
    return { id: '', employeeId: '', date: new Date().toISOString().split('T')[0], previousWork: '', todayPlan: '', blockers: 'None', notes: '' };
  }

  openAdd() { this.form = this.blankForm(); this.editMode = false; this.showModal = true; }
  openEdit(n: StandupNote) { this.form = { ...n }; this.editMode = true; this.showModal = true; }
  closeModal() { this.showModal = false; }

  saveNote() {
    if (!this.form.employeeId) return;
    if (this.editMode) {
      this.svc.updateNote(this.form);
    } else {
      this.form.id = this.svc.generateId('SN', this.allNotes);
      this.svc.addNote(this.form);
    }
    this.closeModal();
  }

  deleteNote(id: string) { if (confirm('Delete this note?')) this.svc.deleteNote(id); }
}
