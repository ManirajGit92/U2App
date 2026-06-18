import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Project, StandupNoteService, Task } from '../standup-note.service';

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

        <!-- Task Chips -->
        <div class="task-chips" *ngIf="getProjectTasks(p).length > 0">
          <span
            *ngFor="let t of getProjectTasks(p)"
            class="task-chip"
            [ngClass]="getChipClass(t.tag)"
            [title]="t.description"
          >
            <span class="chip-tag">{{ t.tag || 'TASK' }}</span>
            <span class="chip-title">{{ t.title }}</span>
          </span>
        </div>

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
      <div class="modal-overlay" *ngIf="showModal">
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

            <!-- Task Multi-Select -->
            <div class="form-row">
              <label class="tasks-label">
                <span>📋 Linked Tasks</span>
                <span class="tasks-count-badge">{{ selectedTaskIds.length }} selected</span>
              </label>
              <div class="task-multiselect" *ngIf="allTasks.length > 0; else noTasks">
                <div
                  *ngFor="let t of allTasks"
                  class="task-checkbox-item"
                  [class.checked]="isTaskSelected(t.id)"
                  (click)="toggleTask(t.id)"
                >
                  <div class="checkbox-indicator">
                    <svg *ngIf="isTaskSelected(t.id)" width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </div>
                  <span class="task-item-tag" [ngClass]="getChipClass(t.tag)">{{ t.tag || 'TASK' }}</span>
                  <div class="task-item-info">
                    <span class="task-item-title">{{ t.title }}</span>
                    <span class="task-item-project" *ngIf="t.projectName">{{ t.projectName }}</span>
                  </div>
                  <span class="task-item-col" [ngClass]="getColClass(t.column)">{{ getColLabel(t.column) }}</span>
                </div>
              </div>
              <ng-template #noTasks>
                <div class="no-tasks-hint">No tasks available. Create tasks in the Tasks tab first.</div>
              </ng-template>

              <!-- Selected chips preview -->
              <div class="selected-chips-preview" *ngIf="selectedTaskIds.length > 0">
                <span
                  *ngFor="let id of selectedTaskIds"
                  class="task-chip"
                  [ngClass]="getChipClass(getTaskById(id)?.tag || '')"
                >
                  <span class="chip-tag">{{ getTaskById(id)?.tag || 'TASK' }}</span>
                  <span class="chip-title">{{ getTaskById(id)?.title }}</span>
                  <button class="chip-remove" (click)="toggleTask(id); $event.stopPropagation()">×</button>
                </span>
              </div>
            </div>
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
    .toolbar { display: flex; gap: 0.75rem; flex-wrap: wrap; background: var(--bg-secondary); padding: 0.5rem 0.5rem; border-radius: 12px; border: 1px solid var(--border-color); align-items: center; }
    .input-field { padding: 0.5rem 0.5rem; border: 1px solid var(--border-color); border-radius: 8px; font-size: 0.88rem; background: var(--bg-input); color: var(--text-primary); outline: none; }
    .input-field:focus { border-color: var(--accent-primary); }
    .search { flex: 1; min-width: 200px; }
    textarea.input-field { resize: vertical; font-family: inherit; }

    .project-card { background: var(--bg-secondary); border-radius: 14px; border: 1px solid var(--border-color); padding: 0.5rem 0.5rem; box-shadow: var(--shadow-sm); }
    .pc-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem; }
    .pc-left { }
    .pc-name { font-weight: 700; font-size: 1.05rem; color: var(--text-primary); }
    .pc-lead { font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.2rem; }
    .pc-right { display: flex; align-items: center; gap: 0.5rem; }
    .pc-notes { font-size: 0.83rem; color: var(--text-secondary); margin-bottom: 0.6rem; }

    /* Task chips on project card */
    .task-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 0.35rem;
      margin-bottom: 0.6rem;
    }
    .task-chip {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      padding: 0.2rem 0.5rem;
      border-radius: 6px;
      font-size: 0.72rem;
      font-weight: 600;
      border: 1px solid transparent;
      cursor: default;
    }
    .chip-tag {
      font-size: 0.62rem;
      font-weight: 800;
      padding: 0.05rem 0.3rem;
      border-radius: 3px;
      background: rgba(255,255,255,0.35);
    }
    .chip-title { max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .chip-remove {
      background: none;
      border: none;
      cursor: pointer;
      font-size: 0.85rem;
      line-height: 1;
      opacity: 0.6;
      padding: 0;
      color: inherit;
    }
    .chip-remove:hover { opacity: 1; }

    /* Chip color classes */
    .chip-design { background: rgba(139,92,246,0.12); color: #7c3aed; border-color: rgba(139,92,246,0.25); }
    .chip-bug    { background: rgba(239,68,68,0.12);  color: #dc2626; border-color: rgba(239,68,68,0.25); }
    .chip-feat   { background: rgba(59,130,246,0.12);  color: #2563eb; border-color: rgba(59,130,246,0.25); }
    .chip-test   { background: rgba(16,185,129,0.12);  color: #059669; border-color: rgba(16,185,129,0.25); }
    .chip-infra  { background: rgba(245,158,11,0.12);  color: #d97706; border-color: rgba(245,158,11,0.25); }
    .chip-docs   { background: rgba(236,72,153,0.12);  color: #be185d; border-color: rgba(236,72,153,0.25); }
    .chip-default{ background: rgba(99,102,241,0.12);  color: #4f46e5; border-color: rgba(99,102,241,0.25); }

    /* Timeline */
    .timeline-section { }
    .timeline-dates { display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.4rem; }
    .progress-pct { font-weight: 600; color: var(--accent-primary); }
    .timeline-track { height: 12px; background: var(--bg-tertiary); border-radius: 6px; overflow: hidden; position: relative; }
    .timeline-fill { height: 100%; background: linear-gradient(90deg, var(--accent-primary), var(--accent-secondary)); border-radius: 6px; transition: width 0.6s ease; }
    .timeline-fill.complete { background: linear-gradient(90deg, #10b981, #34d399); }
    .timeline-milestones { display: flex; justify-content: space-between; font-size: 0.7rem; color: var(--text-secondary); margin-top: 0.3rem; position: relative; }
    .milestone { }
    .milestone.today { position: absolute; transform: translateX(-50%); color: var(--accent-primary); font-weight: 600; }

    .badge { padding: 0.25rem 0.5rem; border-radius: 20px; font-size: 0.75rem; font-weight: 600; }
    .badge-active { background: rgba(16,185,129,0.15); color: #10b981; }
    .badge-on-hold { background: rgba(245,158,11,0.15); color: #f59e0b; }
    .badge-completed { background: rgba(99,102,241,0.15); color: var(--accent-primary); }

    .icon-btn { background: none; border: none; cursor: pointer; font-size: 1rem; opacity: 0.6; transition: opacity 0.15s, transform 0.15s; border-radius: 4px; padding: 0.2rem 0.3rem; }
    .icon-btn:hover { opacity: 1; transform: scale(1.1); }

    .empty-state { text-align: center; padding: 0.5rem; color: var(--text-secondary); display: flex; flex-direction: column; align-items: center; gap: 0.75rem; font-size: 2rem; }
    .empty-state div { font-size: 0.9rem; }

    .btn { display: inline-flex; align-items: center; padding: 0.5rem 0.5rem; border-radius: 8px; font-size: 0.88rem; font-weight: 600; cursor: pointer; border: 1px solid transparent; transition: all 0.15s; white-space: nowrap; }
    .btn-primary { background: var(--accent-primary); color: white; }
    .btn-primary:hover { opacity: 0.9; }
    .btn-ghost { background: none; border-color: var(--border-color); color: var(--text-secondary); }
    .btn-ghost:hover { background: var(--bg-tertiary); }

    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 100; backdrop-filter: blur(2px); }
    .modal { background: var(--bg-secondary); border-radius: 16px; width: 520px; max-width: 95vw; box-shadow: var(--shadow-lg); border: 1px solid var(--border-color); }
    .modal-header { display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0.5rem; border-bottom: 1px solid var(--border-color); }
    .modal-header h3 { margin: 0; font-size: 1.05rem; color: var(--text-primary); }
    .modal-body { padding: 0.5rem 0.5rem; display: flex; flex-direction: column; gap: 1rem; max-height: 70vh; overflow-y: auto; }
    .modal-footer { display: flex; justify-content: flex-end; gap: 0.75rem; padding: 0.5rem 0.5rem; border-top: 1px solid var(--border-color); }
    .form-row { display: flex; flex-direction: column; gap: 0.4rem; }
    .form-row label { font-size: 0.82rem; font-weight: 600; color: var(--text-secondary); }
    .form-row .input-field { width: 100%; box-sizing: border-box; }
    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }

    /* Task multi-select */
    .tasks-label {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .tasks-count-badge {
      font-size: 0.7rem;
      background: var(--accent-surface);
      color: var(--accent-primary);
      padding: 0.1rem 0.45rem;
      border-radius: 10px;
      font-weight: 600;
    }
    .task-multiselect {
      border: 1px solid var(--border-color);
      border-radius: 10px;
      overflow: hidden;
      max-height: 200px;
      overflow-y: auto;
    }
    .task-checkbox-item {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      padding: 0.5rem 0.75rem;
      cursor: pointer;
      transition: background 0.12s;
      border-bottom: 1px solid var(--border-color);
    }
    .task-checkbox-item:last-child { border-bottom: none; }
    .task-checkbox-item:hover { background: var(--bg-tertiary); }
    .task-checkbox-item.checked { background: var(--accent-surface); }

    .checkbox-indicator {
      width: 18px;
      height: 18px;
      border-radius: 5px;
      border: 2px solid var(--border-color);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      background: var(--bg-secondary);
      transition: all 0.12s;
    }
    .task-checkbox-item.checked .checkbox-indicator {
      background: var(--accent-primary);
      border-color: var(--accent-primary);
    }

    .task-item-tag {
      font-size: 0.6rem;
      font-weight: 800;
      padding: 0.1rem 0.35rem;
      border-radius: 4px;
      letter-spacing: 0.04em;
      flex-shrink: 0;
    }
    .task-item-info { flex: 1; min-width: 0; }
    .task-item-title {
      display: block;
      font-size: 0.82rem;
      font-weight: 500;
      color: var(--text-primary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .task-item-project {
      display: block;
      font-size: 0.7rem;
      color: var(--text-secondary);
    }
    .task-item-col {
      font-size: 0.65rem;
      font-weight: 700;
      padding: 0.1rem 0.35rem;
      border-radius: 4px;
      flex-shrink: 0;
    }
    .col-not-taken    { background: rgba(99,102,241,0.12); color: #4f46e5; }
    .col-in-progress  { background: rgba(245,158,11,0.12);  color: #d97706; }
    .col-completed    { background: rgba(16,185,129,0.12);  color: #059669; }

    .selected-chips-preview {
      display: flex;
      flex-wrap: wrap;
      gap: 0.35rem;
      margin-top: 0.35rem;
      padding: 0.5rem;
      background: var(--bg-tertiary);
      border-radius: 8px;
      border: 1px dashed var(--border-color);
    }

    .no-tasks-hint {
      font-size: 0.8rem;
      color: var(--text-secondary);
      padding: 0.75rem;
      background: var(--bg-tertiary);
      border-radius: 8px;
      border: 1px dashed var(--border-color);
      text-align: center;
    }

    @media (max-width: 576px) {
      .toolbar { flex-direction: column; align-items: stretch; gap: 0.5rem; padding: 0.75rem; }
      .input-field { width: 100% !important; }
      .btn { width: 100%; justify-content: center; }
      .pc-header { flex-direction: column; gap: 0.5rem; }
      .pc-right { width: 100%; justify-content: space-between; }
      .form-grid { grid-template-columns: 1fr; gap: 0.5rem; }
    }
  `]
})
export class ProjectsComponent implements OnInit {
  svc = inject(StandupNoteService);
  all: Project[] = [];
  filtered: Project[] = [];
  allTasks: Task[] = [];
  selectedTaskIds: string[] = [];
  search = '';
  filterStatus = '';
  showModal = false;
  editMode = false;
  form!: Project;

  ngOnInit() {
    this.svc.state$.subscribe(s => {
      this.all = s.projects;
      this.allTasks = s.tasks || [];
      this.applyFilters();
    });
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

  getProjectTasks(p: Project): Task[] {
    if (!p.taskIds?.length) return [];
    return this.allTasks.filter(t => p.taskIds!.includes(t.id));
  }

  getTaskById(id: string): Task | undefined {
    return this.allTasks.find(t => t.id === id);
  }

  isTaskSelected(id: string): boolean {
    return this.selectedTaskIds.includes(id);
  }

  toggleTask(id: string) {
    const idx = this.selectedTaskIds.indexOf(id);
    if (idx === -1) this.selectedTaskIds = [...this.selectedTaskIds, id];
    else this.selectedTaskIds = this.selectedTaskIds.filter(x => x !== id);
  }

  getChipClass(tag: string): string {
    const map: Record<string, string> = {
      DESIGN: 'chip-design', BUG: 'chip-bug', FEAT: 'chip-feat',
      TEST: 'chip-test', INFRA: 'chip-infra', DOCS: 'chip-docs',
    };
    return map[tag?.toUpperCase()] || 'chip-default';
  }

  getColClass(col: string): string {
    const map: Record<string, string> = {
      'not-taken': 'col-not-taken',
      'in-progress': 'col-in-progress',
      'completed': 'col-completed',
    };
    return map[col] || '';
  }

  getColLabel(col: string): string {
    const map: Record<string, string> = {
      'not-taken': 'Not Taken',
      'in-progress': 'In Progress',
      'completed': 'Done',
    };
    return map[col] || col;
  }

  blank(): Project {
    return { id: '', name: '', status: 'Active', startDate: '', endDate: '', notes: '', lead: '', taskIds: [] };
  }

  openAdd() {
    this.form = this.blank();
    this.selectedTaskIds = [];
    this.editMode = false;
    this.showModal = true;
  }

  openEdit(p: Project) {
    this.form = { ...p };
    this.selectedTaskIds = [...(p.taskIds || [])];
    this.editMode = true;
    this.showModal = true;
  }

  closeModal() { this.showModal = false; this.selectedTaskIds = []; }

  saveProject() {
    if (!this.form.name) return;
    this.form.taskIds = [...this.selectedTaskIds];
    if (this.editMode) { this.svc.updateProject(this.form); }
    else { this.form.id = this.svc.generateId('PRJ', this.all); this.svc.addProject(this.form); }
    this.closeModal();
  }

  deleteProject(id: string) { if (confirm('Delete this project?')) this.svc.deleteProject(id); }
}
