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
    .toolbar { display: flex; gap: 0.75rem; flex-wrap: wrap; background: var(--bg-secondary); padding: 1rem 1.25rem; border-radius: 12px; border: 1px solid var(--border-color); align-items: center; }
    .input-field { padding: 0.55rem 0.9rem; border: 1px solid var(--border-color); border-radius: 8px; font-size: 0.88rem; background: var(--bg-input); color: var(--text-primary); outline: none; }
    .input-field:focus { border-color: var(--accent-primary); }
    .search { flex: 1; min-width: 180px; }

    .emp-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 1.25rem; }
    .emp-card {
      background: var(--bg-secondary); border-radius: 16px; border: 1px solid var(--border-color);
      padding: 1.25rem; display: flex; flex-direction: column; align-items: center; text-align: center;
      box-shadow: var(--shadow-sm); transition: box-shadow 0.2s; position: relative;
    }
    .emp-card:hover { box-shadow: var(--shadow-md); }
    .card-top { width: 100%; display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem; }
    .big-avatar { width: 64px; height: 64px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.3rem; font-weight: 700; color: white; margin: 0 auto 0 auto; }
    .card-actions { display: flex; gap: 0.25rem; }
    .emp-name { font-weight: 700; font-size: 0.95rem; color: var(--text-primary); margin-top: 0.5rem; }
    .emp-position { font-size: 0.78rem; color: var(--text-secondary); margin: 0.2rem 0; }
    .emp-team-badge { display: inline-block; background: var(--accent-surface); color: var(--accent-primary); font-size: 0.72rem; font-weight: 600; padding: 0.2rem 0.6rem; border-radius: 12px; margin: 0.4rem 0; }
    .emp-email { font-size: 0.75rem; color: var(--accent-primary); text-decoration: none; }
    .emp-email:hover { text-decoration: underline; }
    .icon-btn { background: none; border: none; cursor: pointer; font-size: 0.95rem; opacity: 0.6; transition: opacity 0.15s, transform 0.15s; border-radius: 4px; padding: 0.2rem 0.3rem; }
    .icon-btn:hover { opacity: 1; transform: scale(1.15); }

    .add-card {
      background: none; border: 2px dashed var(--border-color); border-radius: 16px; padding: 1.5rem;
      display: flex; flex-direction: column; align-items: center; gap: 0.5rem; cursor: pointer;
      color: var(--text-secondary); transition: all 0.15s; min-height: 180px; justify-content: center;
      font-size: 0.88rem;
    }
    .add-card:hover { border-color: var(--accent-primary); color: var(--accent-primary); background: var(--bg-tertiary); }
    .add-icon { font-size: 2.5rem; font-weight: 300; }

    .empty-state { text-align: center; padding: 3rem; color: var(--text-secondary); display: flex; flex-direction: column; align-items: center; gap: 0.75rem; }
    .empty-icon { font-size: 2.5rem; }

    .btn { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.55rem 1.1rem; border-radius: 8px; font-size: 0.88rem; font-weight: 600; cursor: pointer; border: 1px solid transparent; transition: all 0.15s; white-space: nowrap; }
    .btn-primary { background: var(--accent-primary); color: white; }
    .btn-primary:hover { opacity: 0.9; }
    .btn-ghost { background: none; border-color: var(--border-color); color: var(--text-secondary); }
    .btn-ghost:hover { background: var(--bg-tertiary); }

    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 100; backdrop-filter: blur(2px); }
    .modal { background: var(--bg-secondary); border-radius: 16px; width: 440px; max-width: 95vw; box-shadow: var(--shadow-lg); border: 1px solid var(--border-color); }
    .modal-header { display: flex; justify-content: space-between; align-items: center; padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--border-color); }
    .modal-header h3 { margin: 0; font-size: 1.05rem; color: var(--text-primary); }
    .modal-body { padding: 1.25rem 1.5rem; display: flex; flex-direction: column; gap: 1rem; }
    .modal-footer { display: flex; justify-content: flex-end; gap: 0.75rem; padding: 1rem 1.5rem; border-top: 1px solid var(--border-color); }
    .form-row { display: flex; flex-direction: column; gap: 0.4rem; }
    .form-row label { font-size: 0.82rem; font-weight: 600; color: var(--text-secondary); }
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
