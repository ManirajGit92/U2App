import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Employee, StandupNoteService } from '../standup-note.service';

@Component({
  selector: 'app-employees',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="emp-page">
      <div class="toolbar">
        <input type="text" placeholder="🔍 Search employees..." [(ngModel)]="search" (ngModelChange)="applyFilters()" class="input-field search">
        <select [(ngModel)]="filterTeam" (ngModelChange)="applyFilters()" class="input-field">
          <option value="">All Teams</option>
          <option *ngFor="let t of teams" [value]="t">{{ t }}</option>
        </select>
        <button class="btn btn-primary" (click)="openAdd()">+ Add Employee</button>
      </div>

      <div class="emp-grid">
        <div class="emp-card" *ngFor="let emp of filtered">
          <div class="card-top">
            <div class="big-avatar" [style.background]="getColor(emp.id)">{{ getInitials(emp.name) }}</div>
            <div class="card-actions">
              <button class="icon-btn" (click)="openEdit(emp)">✏️</button>
              <button class="icon-btn" (click)="deleteEmp(emp.id)">🗑️</button>
            </div>
          </div>
          <div class="emp-name">{{ emp.name }}</div>
          <div class="emp-position">{{ emp.position }}</div>
          <div class="emp-team-badge">{{ emp.team }}</div>
          <a class="emp-email" [href]="'mailto:' + emp.email">{{ emp.email }}</a>
        </div>
        <div class="add-card" (click)="openAdd()">
          <div class="add-icon">+</div>
          <div>Add Employee</div>
        </div>
      </div>
      <div class="empty-state" *ngIf="filtered.length === 0"><span class="empty-icon">👥</span><div>No employees found.</div></div>

      <!-- Modal -->
      <div class="modal-overlay" *ngIf="showModal" (click)="closeModal()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>{{ editMode ? 'Edit' : 'Add' }} Employee</h3>
            <button class="icon-btn" (click)="closeModal()">✕</button>
          </div>
          <div class="modal-body">
            <div class="form-row"><label>Full Name</label><input type="text" [(ngModel)]="form.name" class="input-field" placeholder="e.g. Alice Johnson"></div>
            <div class="form-row"><label>Position</label><input type="text" [(ngModel)]="form.position" class="input-field" placeholder="e.g. Frontend Developer"></div>
            <div class="form-row"><label>Team</label><input type="text" [(ngModel)]="form.team" class="input-field" placeholder="e.g. UI, API, QA"></div>
            <div class="form-row"><label>Email</label><input type="email" [(ngModel)]="form.email" class="input-field" placeholder="alice@company.com"></div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-ghost" (click)="closeModal()">Cancel</button>
            <button class="btn btn-primary" (click)="saveEmp()">{{ editMode ? 'Save' : 'Add' }}</button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .emp-page { display: flex; flex-direction: column; gap: 1.25rem; }
    .toolbar { display: flex; gap: 0.75rem; flex-wrap: wrap; background: var(--surface, #fff); padding: 1rem 1.25rem; border-radius: 12px; border: 1px solid var(--border, #e2e8f0); align-items: center; }
    .input-field { padding: 0.55rem 0.9rem; border: 1px solid var(--border, #d1d5db); border-radius: 8px; font-size: 0.88rem; background: #f8fafc; color: var(--text, #1e293b); outline: none; }
    .input-field:focus { border-color: #6366f1; background: white; }
    .search { flex: 1; min-width: 180px; }

    .emp-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 1.25rem; }
    .emp-card {
      background: var(--surface, #fff); border-radius: 16px; border: 1px solid var(--border, #e2e8f0);
      padding: 1.25rem; display: flex; flex-direction: column; align-items: center; text-align: center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.04); transition: box-shadow 0.2s; position: relative;
    }
    .emp-card:hover { box-shadow: 0 4px 20px rgba(99,102,241,0.12); }
    .card-top { width: 100%; display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem; }
    .big-avatar { width: 64px; height: 64px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.3rem; font-weight: 700; color: white; margin: 0 auto 0 auto; }
    .card-actions { display: flex; gap: 0.25rem; }
    .emp-name { font-weight: 700; font-size: 0.95rem; color: var(--text, #1e293b); margin-top: 0.5rem; }
    .emp-position { font-size: 0.78rem; color: var(--text-muted, #64748b); margin: 0.2rem 0; }
    .emp-team-badge { display: inline-block; background: #ede9fe; color: #6366f1; font-size: 0.72rem; font-weight: 600; padding: 0.2rem 0.6rem; border-radius: 12px; margin: 0.4rem 0; }
    .emp-email { font-size: 0.75rem; color: #6366f1; text-decoration: none; }
    .emp-email:hover { text-decoration: underline; }
    .icon-btn { background: none; border: none; cursor: pointer; font-size: 0.95rem; opacity: 0.6; transition: opacity 0.15s, transform 0.15s; border-radius: 4px; padding: 0.2rem 0.3rem; }
    .icon-btn:hover { opacity: 1; transform: scale(1.15); }

    .add-card {
      background: none; border: 2px dashed var(--border, #e2e8f0); border-radius: 16px; padding: 1.5rem;
      display: flex; flex-direction: column; align-items: center; gap: 0.5rem; cursor: pointer;
      color: var(--text-muted, #94a3b8); transition: all 0.15s; min-height: 180px; justify-content: center;
      font-size: 0.88rem;
    }
    .add-card:hover { border-color: #6366f1; color: #6366f1; background: #f5f3ff; }
    .add-icon { font-size: 2.5rem; font-weight: 300; }

    .empty-state { text-align: center; padding: 3rem; color: var(--text-muted, #64748b); display: flex; flex-direction: column; align-items: center; gap: 0.75rem; }
    .empty-icon { font-size: 2.5rem; }

    .btn { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.55rem 1.1rem; border-radius: 8px; font-size: 0.88rem; font-weight: 600; cursor: pointer; border: 1px solid transparent; transition: all 0.15s; white-space: nowrap; }
    .btn-primary { background: #6366f1; color: white; }
    .btn-primary:hover { background: #4f46e5; }
    .btn-ghost { background: none; border-color: var(--border, #e2e8f0); color: var(--text-muted, #64748b); }
    .btn-ghost:hover { background: #f1f5f9; }

    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 100; backdrop-filter: blur(2px); }
    .modal { background: var(--surface, white); border-radius: 16px; width: 440px; max-width: 95vw; box-shadow: 0 20px 60px rgba(0,0,0,0.2); }
    .modal-header { display: flex; justify-content: space-between; align-items: center; padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--border, #e2e8f0); }
    .modal-header h3 { margin: 0; font-size: 1.05rem; color: var(--text, #1e293b); }
    .modal-body { padding: 1.25rem 1.5rem; display: flex; flex-direction: column; gap: 1rem; }
    .modal-footer { display: flex; justify-content: flex-end; gap: 0.75rem; padding: 1rem 1.5rem; border-top: 1px solid var(--border, #e2e8f0); }
    .form-row { display: flex; flex-direction: column; gap: 0.4rem; }
    .form-row label { font-size: 0.82rem; font-weight: 600; color: var(--text-muted, #64748b); }
    .form-row .input-field { width: 100%; box-sizing: border-box; }
  `]
})
export class EmployeesComponent implements OnInit {
  svc = inject(StandupNoteService);
  all: Employee[] = [];
  filtered: Employee[] = [];
  teams: string[] = [];
  search = '';
  filterTeam = '';
  showModal = false;
  editMode = false;
  form!: Employee;

  readonly COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'];

  ngOnInit() {
    this.svc.state$.subscribe(s => {
      this.all = s.employees;
      this.teams = [...new Set(s.employees.map(e => e.team))];
      this.applyFilters();
    });
  }

  applyFilters() {
    let d = [...this.all];
    if (this.search) { const t = this.search.toLowerCase(); d = d.filter(e => e.name.toLowerCase().includes(t) || e.position.toLowerCase().includes(t)); }
    if (this.filterTeam) d = d.filter(e => e.team === this.filterTeam);
    this.filtered = d;
  }

  getInitials(name: string) { return this.svc.getInitials(name); }
  getColor(id: string) { return this.COLORS[id.charCodeAt(id.length - 1) % this.COLORS.length]; }

  blank(): Employee { return { id: '', name: '', position: '', team: '', email: '' }; }
  openAdd() { this.form = this.blank(); this.editMode = false; this.showModal = true; }
  openEdit(e: Employee) { this.form = { ...e }; this.editMode = true; this.showModal = true; }
  closeModal() { this.showModal = false; }

  saveEmp() {
    if (!this.form.name) return;
    if (this.editMode) { this.svc.updateEmployee(this.form); }
    else { this.form.id = this.svc.generateId('EMP', this.all); this.svc.addEmployee(this.form); }
    this.closeModal();
  }

  deleteEmp(id: string) { if (confirm('Remove this employee?')) this.svc.deleteEmployee(id); }
}
