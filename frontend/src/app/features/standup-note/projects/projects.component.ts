import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Project, StandupNoteService } from '../standup-note.service';

@Component({
  selector: 'app-projects',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="projects-page">
      <div class="toolbar">
        <input type="text" placeholder="🔍 Search projects..." [(ngModel)]="search" (ngModelChange)="applyFilters()" class="input-field search">
        <select [(ngModel)]="filterStatus" (ngModelChange)="applyFilters()" class="input-field">
          <option value="">All Statuses</option>
          <option value="Active">Active</option>
          <option value="On Hold">On Hold</option>
          <option value="Completed">Completed</option>
        </select>
        <button class="btn btn-primary" (click)="openAdd()">+ New Project</button>
      </div>

      <!-- Project Cards -->
      <div *ngFor="let p of filtered" class="project-card">
        <div class="pc-header">
          <div class="pc-left">
            <div class="pc-name">{{ p.name }}</div>
            <div class="pc-lead">Lead: {{ p.lead }}</div>
          </div>
          <div class="pc-right">
            <span class="badge" [ngClass]="'badge-' + p.status.toLowerCase().replace(' ', '-')">{{ p.status }}</span>
            <button class="icon-btn" (click)="openEdit(p)">✏️</button>
            <button class="icon-btn" (click)="deleteProject(p.id)">🗑️</button>
          </div>
        </div>
        <div class="pc-notes">{{ p.notes }}</div>
        <!-- Timeline -->
        <div class="timeline-section">
          <div class="timeline-dates">
            <span>{{ formatDate(p.startDate) }}</span>
            <span class="progress-pct">{{ getProgress(p) }}% complete</span>
            <span>{{ formatDate(p.endDate) }}</span>
          </div>
          <div class="timeline-track">
            <div class="timeline-fill" [class.complete]="p.status === 'Completed'" [style.width]="(p.status === 'Completed' ? 100 : getProgress(p)) + '%'"></div>
          </div>
          <div class="timeline-milestones">
            <div class="milestone start">▶ Start</div>
            <div class="milestone today" *ngIf="getProgress(p) > 0 && getProgress(p) < 100" [style.left]="getProgress(p) + '%'">Today</div>
            <div class="milestone end">End ▶</div>
          </div>
        </div>
      </div>
      <div class="empty-state" *ngIf="filtered.length === 0"><span>🚀</span><div>No projects found.</div></div>

      <!-- Modal -->
      <div class="modal-overlay" *ngIf="showModal" (click)="closeModal()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>{{ editMode ? 'Edit' : 'New' }} Project</h3>
            <button class="icon-btn" (click)="closeModal()">✕</button>
          </div>
          <div class="modal-body">
            <div class="form-row"><label>Project Name</label><input type="text" [(ngModel)]="form.name" class="input-field"></div>
            <div class="form-row"><label>Lead</label><input type="text" [(ngModel)]="form.lead" class="input-field"></div>
            <div class="form-row">
              <label>Status</label>
              <select [(ngModel)]="form.status" class="input-field">
                <option value="Active">Active</option>
                <option value="On Hold">On Hold</option>
                <option value="Completed">Completed</option>
              </select>
            </div>
            <div class="form-grid">
              <div class="form-row"><label>Start Date</label><input type="date" [(ngModel)]="form.startDate" class="input-field"></div>
              <div class="form-row"><label>End Date</label><input type="date" [(ngModel)]="form.endDate" class="input-field"></div>
            </div>
            <div class="form-row"><label>Notes</label><textarea [(ngModel)]="form.notes" class="input-field" rows="2"></textarea></div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-ghost" (click)="closeModal()">Cancel</button>
            <button class="btn btn-primary" (click)="saveProject()">{{ editMode ? 'Save' : 'Create' }}</button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .projects-page { display: flex; flex-direction: column; gap: 1.25rem; }
    .toolbar { display: flex; gap: 0.75rem; flex-wrap: wrap; background: var(--surface, #fff); padding: 1rem 1.25rem; border-radius: 12px; border: 1px solid var(--border, #e2e8f0); align-items: center; }
    .input-field { padding: 0.55rem 0.9rem; border: 1px solid var(--border, #d1d5db); border-radius: 8px; font-size: 0.88rem; background: #f8fafc; color: var(--text, #1e293b); outline: none; }
    .input-field:focus { border-color: #6366f1; background: white; }
    .search { flex: 1; min-width: 200px; }
    textarea.input-field { resize: vertical; font-family: inherit; }

    .project-card { background: var(--surface, #fff); border-radius: 14px; border: 1px solid var(--border, #e2e8f0); padding: 1.25rem 1.5rem; box-shadow: 0 2px 8px rgba(0,0,0,0.04); }
    .pc-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem; }
    .pc-left { }
    .pc-name { font-weight: 700; font-size: 1.05rem; color: var(--text, #1e293b); }
    .pc-lead { font-size: 0.8rem; color: var(--text-muted, #64748b); margin-top: 0.2rem; }
    .pc-right { display: flex; align-items: center; gap: 0.5rem; }
    .pc-notes { font-size: 0.83rem; color: var(--text-muted, #64748b); margin-bottom: 1rem; }

    /* Timeline */
    .timeline-section { }
    .timeline-dates { display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--text-muted, #64748b); margin-bottom: 0.4rem; }
    .progress-pct { font-weight: 600; color: #6366f1; }
    .timeline-track { height: 12px; background: var(--border, #e2e8f0); border-radius: 6px; overflow: hidden; position: relative; }
    .timeline-fill { height: 100%; background: linear-gradient(90deg, #6366f1, #a855f7); border-radius: 6px; transition: width 0.6s ease; }
    .timeline-fill.complete { background: linear-gradient(90deg, #10b981, #34d399); }
    .timeline-milestones { display: flex; justify-content: space-between; font-size: 0.7rem; color: var(--text-muted, #64748b); margin-top: 0.3rem; position: relative; }
    .milestone { }
    .milestone.today { position: absolute; transform: translateX(-50%); color: #6366f1; font-weight: 600; }

    .badge { padding: 0.25rem 0.6rem; border-radius: 20px; font-size: 0.75rem; font-weight: 600; }
    .badge-active { background: #d1fae5; color: #065f46; }
    .badge-on-hold { background: #fef3c7; color: #b45309; }
    .badge-completed { background: #e0e7ff; color: #4338ca; }

    .icon-btn { background: none; border: none; cursor: pointer; font-size: 1rem; opacity: 0.6; transition: opacity 0.15s, transform 0.15s; border-radius: 4px; padding: 0.2rem 0.3rem; }
    .icon-btn:hover { opacity: 1; transform: scale(1.1); }

    .empty-state { text-align: center; padding: 3rem; color: var(--text-muted, #64748b); display: flex; flex-direction: column; align-items: center; gap: 0.75rem; font-size: 2rem; }
    .empty-state div { font-size: 0.9rem; }

    .btn { display: inline-flex; align-items: center; padding: 0.55rem 1.1rem; border-radius: 8px; font-size: 0.88rem; font-weight: 600; cursor: pointer; border: 1px solid transparent; transition: all 0.15s; white-space: nowrap; }
    .btn-primary { background: #6366f1; color: white; }
    .btn-primary:hover { background: #4f46e5; }
    .btn-ghost { background: none; border-color: var(--border, #e2e8f0); color: var(--text-muted, #64748b); }
    .btn-ghost:hover { background: #f1f5f9; }

    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 100; backdrop-filter: blur(2px); }
    .modal { background: var(--surface, white); border-radius: 16px; width: 480px; max-width: 95vw; box-shadow: 0 20px 60px rgba(0,0,0,0.2); }
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
export class ProjectsComponent implements OnInit {
  svc = inject(StandupNoteService);
  all: Project[] = [];
  filtered: Project[] = [];
  search = '';
  filterStatus = '';
  showModal = false;
  editMode = false;
  form!: Project;

  ngOnInit() {
    this.svc.state$.subscribe(s => { this.all = s.projects; this.applyFilters(); });
  }

  applyFilters() {
    let d = [...this.all];
    if (this.search) { const t = this.search.toLowerCase(); d = d.filter(p => p.name.toLowerCase().includes(t) || p.lead.toLowerCase().includes(t)); }
    if (this.filterStatus) d = d.filter(p => p.status === this.filterStatus);
    this.filtered = d;
  }

  getProgress(p: Project): number {
    const start = new Date(p.startDate).getTime();
    const end = new Date(p.endDate).getTime();
    const now = Date.now();
    if (now <= start) return 0;
    if (now >= end) return 100;
    return Math.round(((now - start) / (end - start)) * 100);
  }

  formatDate(d: string): string {
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  blank(): Project { return { id: '', name: '', status: 'Active', startDate: '', endDate: '', notes: '', lead: '' }; }
  openAdd() { this.form = this.blank(); this.editMode = false; this.showModal = true; }
  openEdit(p: Project) { this.form = { ...p }; this.editMode = true; this.showModal = true; }
  closeModal() { this.showModal = false; }

  saveProject() {
    if (!this.form.name) return;
    if (this.editMode) { this.svc.updateProject(this.form); }
    else { this.form.id = this.svc.generateId('PRJ', this.all); this.svc.addProject(this.form); }
    this.closeModal();
  }
  deleteProject(id: string) { if (confirm('Delete this project?')) this.svc.deleteProject(id); }
}
