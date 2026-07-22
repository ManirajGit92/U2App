import { Component, inject, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Employee, Project, StandupNote, StandupNoteService, Task } from '../standup-note.service';

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
          <select [(ngModel)]="filterProj" (ngModelChange)="applyFilters()" class="input-field">
            <option value="">All Projects</option>
            <option *ngFor="let p of projects" [value]="p.id">{{ p.name }}</option>
          </select>
        </div>
        <button class="btn btn-primary" (click)="openAdd()">+ Add Note</button>
      </div>

      <!-- Notes Grid -->
      <div class="notes-grid" *ngIf="filtered.length > 0">
        <div class="note-card" *ngFor="let note of filtered">
          <div class="card-header">
            <div class="emp-info">
              <div class="avatar" [style.background]="getColor(note.employeeId || note.projectId || 'SN')">
                {{ getInitialsForCard(note) }}
              </div>
              <div>
                <div class="emp-name">{{ getHeading(note) }}</div>
                <div class="emp-pos">{{ getSubheading(note) }}</div>
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
              <div class="note-text" [innerHTML]="note.previousWork"></div>
            </div>
            <div class="note-row" *ngIf="note.todayPlan">
              <div class="note-label today">📌 Today</div>
              <div class="note-text" [innerHTML]="note.todayPlan"></div>
            </div>
            <div class="note-row" *ngIf="note.blockers && note.blockers !== 'None'">
              <div class="note-label blocker">🚧 Blockers</div>
              <div class="note-text" [innerHTML]="note.blockers"></div>
            </div>
            <div class="note-row" *ngIf="note.notes">
              <div class="note-label misc">💬 Notes</div>
              <div class="note-text" [innerHTML]="note.notes"></div>
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
      <div class="modal-overlay" *ngIf="showModal">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>{{ editMode ? 'Edit' : 'Add' }} Standup Note</h3>
            <button class="icon-btn" (click)="closeModal()">✕</button>
          </div>
          <div class="modal-body">
            <div class="form-row-group">
              <div class="form-row emp-select">
                <label>Employee</label>
                <div class="searchable-select">
                  <div class="select-trigger" (click)="employeeDropdownOpen = !employeeDropdownOpen; projectDropdownOpen = false; $event.stopPropagation()">
                    <span>{{ selectedEmployeeName }}</span>
                    <span class="arrow">▼</span>
                  </div>
                  <div class="select-dropdown" *ngIf="employeeDropdownOpen" (click)="$event.stopPropagation()">
                    <input type="text" class="input-field select-search" placeholder="🔍 Search employee..." [(ngModel)]="employeeSearchText">
                    <div class="options-list">
                      <div class="option-item reset-option" (click)="selectEmployee('')">-- Select None --</div>
                      <div class="option-item" *ngFor="let e of filteredEmployeesForSelect" [class.selected]="e.id === form.employeeId" (click)="selectEmployee(e.id)">
                        <div class="option-title">{{ e.name }}</div>
                        <div class="option-sub">{{ e.position }}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div class="form-row proj-select">
                <label>Project</label>
                <div class="searchable-select">
                  <div class="select-trigger" (click)="projectDropdownOpen = !projectDropdownOpen; employeeDropdownOpen = false; $event.stopPropagation()">
                    <span>{{ selectedProjectName }}</span>
                    <span class="arrow">▼</span>
                  </div>
                  <div class="select-dropdown" *ngIf="projectDropdownOpen" (click)="$event.stopPropagation()">
                    <input type="text" class="input-field select-search" placeholder="🔍 Search project..." [(ngModel)]="projectSearchText">
                    <div class="options-list">
                      <div class="option-item reset-option" (click)="selectProject('')">-- Select None --</div>
                      <div class="option-item" *ngFor="let p of filteredProjectsForSelect" [class.selected]="p.id === form.projectId" (click)="selectProject(p.id)">
                        <div class="option-title">{{ p.name }}</div>
                        <div class="option-sub">{{ p.status }}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
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
              <div class="task-select-row">
                <select class="input-field task-dropdown" [(ngModel)]="selectedTaskId" (ngModelChange)="onTaskSelect($event)">
                  <option value="">📋 Link a task (optional)...</option>
                  <option *ngFor="let t of availableTasks" [value]="t.id">
                    [{{ t.tag || 'TASK' }}] {{ t.title }}
                  </option>
                </select>
              </div>
              <textarea [(ngModel)]="form.todayPlan" class="input-field" rows="3" placeholder="What will you work on today?"></textarea>
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
    .toolbar { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; background: var(--bg-secondary); padding: 0.5rem 0.5rem; border-radius: 12px; border: 1px solid var(--border-color); }
    .toolbar-left { display: flex; gap: 0.75rem; flex-wrap: wrap; flex: 1; }
    .input-field { padding: 0.5rem 0.5rem; border: 1px solid var(--border-color); border-radius: 8px; font-size: 0.88rem; background: var(--bg-input); color: var(--text-primary); outline: none; }
    .input-field:focus { border-color: var(--accent-primary); }
    .search { min-width: 200px; flex: 1; }

    .notes-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 1.25rem; }
    .note-card { background: var(--bg-secondary); border-radius: 14px; border: 1px solid var(--border-color); overflow: hidden; box-shadow: var(--shadow-sm); transition: box-shadow 0.2s; }
    .note-card:hover { box-shadow: var(--shadow-md); }

    .card-header { display: flex; justify-content: space-between; align-items: flex-start; padding: 0.5rem; border-bottom: 1px solid var(--border-color); background: var(--bg-tertiary); }
    .emp-info { display: flex; align-items: center; gap: 0.75rem; max-width: calc(100% - 100px); }
    .avatar { width: 42px; height: 42px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.9rem; font-weight: 700; color: white; flex-shrink: 0; }
    .emp-name { font-weight: 700; font-size: 0.92rem; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .emp-pos { font-size: 0.75rem; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .card-meta { display: flex; flex-direction: column; align-items: flex-end; gap: 0.5rem; }
    .date-badge { font-size: 0.72rem; background: #ede9fe; color: #6366f1; padding: 0.2rem 0.5rem; border-radius: 6px; font-weight: 600; }
    .card-actions { display: flex; gap: 0.25rem; }
    .icon-btn { background: none; border: none; cursor: pointer; font-size: 1rem; opacity: 0.6; transition: opacity 0.15s, transform 0.15s; padding: 0.2rem 0.3rem; border-radius: 4px; }
    .icon-btn:hover { opacity: 1; transform: scale(1.1); }

    .card-body { padding: 0.5rem 0.5rem; display: flex; flex-direction: column; gap: 0.6rem; }
    .note-row { display: flex; gap: 0.5rem; }
    .note-label { font-size: 0.7rem; font-weight: 700; padding: 0.15rem 0.4rem; border-radius: 4px; white-space: nowrap; height: fit-content; }
    .note-label.yesterday { background: rgba(16,185,129,0.15); color: #10b981; }
    .note-label.today { background: var(--accent-surface); color: var(--accent-primary); }
    .note-label.blocker { background: rgba(239,68,68,0.15); color: #ef4444; }
    .note-label.misc { background: rgba(59,130,246,0.15); color: #3b82f6; }
    .note-text { font-size: 0.83rem; color: var(--text-primary); line-height: 1.5; white-space: pre-wrap; }

    .empty-state { text-align: center; padding: 0.5rem; color: var(--text-secondary); display: flex; flex-direction: column; align-items: center; gap: 1rem; }
    .empty-icon { font-size: 3rem; }

    /* Buttons */
    .btn { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.5rem 0.5rem; border-radius: 8px; font-size: 0.88rem; font-weight: 600; cursor: pointer; border: 1px solid transparent; transition: all 0.15s; }
    .btn-primary { background: var(--accent-primary); color: white; }
    .btn-primary:hover { opacity: 0.9; }
    .btn-ghost { background: none; border-color: var(--border-color); color: var(--text-secondary); }
    .btn-ghost:hover { background: var(--bg-tertiary); }

    /* Modal */
    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 100; backdrop-filter: blur(2px); }
    .modal { background: var(--bg-secondary); border-radius: 16px; width: 560px; max-width: 95vw; box-shadow: var(--shadow-lg); border: 1px solid var(--border-color); display: flex; flex-direction: column; }
    .modal-header { display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0.5rem; border-bottom: 1px solid var(--border-color); }
    .modal-header h3 { margin: 0; font-size: 1.05rem; color: var(--text-primary); }
    .modal-body { padding: 0.5rem 0.5rem; display: flex; flex-direction: column; gap: 1rem; max-height: 65vh; overflow-y: auto; }
    .modal-footer { display: flex; justify-content: flex-end; gap: 0.75rem; padding: 0.5rem 0.5rem; border-top: 1px solid var(--border-color); }
    .form-row { display: flex; flex-direction: column; gap: 0.4rem; position: relative; }
    .form-row label { font-size: 0.82rem; font-weight: 600; color: var(--text-secondary); }
    .form-row .input-field { width: 100%; box-sizing: border-box; }
    textarea.input-field { resize: vertical; font-family: inherit; }
    .task-select-row { margin-bottom: 0.4rem; }
    .task-dropdown { width: 100%; box-sizing: border-box; color: var(--accent-primary); font-weight: 500; }

    .form-row-group { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }

    /* Searchable Select styles */
    .searchable-select { position: relative; width: 100%; }
    .select-trigger {
      display: flex; justify-content: space-between; align-items: center;
      padding: 0.5rem 0.75rem; border: 1px solid var(--border-color); border-radius: 8px;
      font-size: 0.88rem; background: var(--bg-input); color: var(--text-primary);
      cursor: pointer; min-height: 38px; box-sizing: border-box; user-select: none;
      transition: border-color 0.2s;
    }
    .select-trigger:hover { border-color: var(--accent-primary); }
    .select-trigger .arrow { font-size: 0.7rem; opacity: 0.7; }
    
    .select-dropdown {
      position: absolute; top: 100%; left: 0; right: 0;
      background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 8px;
      margin-top: 4px; box-shadow: var(--shadow-lg); z-index: 50; padding: 0.5rem;
      display: flex; flex-direction: column; gap: 0.5rem; max-height: 250px;
    }
    .select-search { width: 100%; box-sizing: border-box; }
    .options-list { overflow-y: auto; max-height: 180px; display: flex; flex-direction: column; gap: 2px; }
    
    .option-item { padding: 0.4rem 0.5rem; border-radius: 6px; cursor: pointer; font-size: 0.83rem; color: var(--text-primary); transition: background 0.15s; }
    .option-item:hover { background: var(--accent-surface); color: var(--accent-primary); }
    .option-item.selected { background: var(--accent-primary); color: white; }
    .option-item.selected .option-sub { color: rgba(255, 255, 255, 0.8); }
    
    .option-title { font-weight: 600; }
    .option-sub { font-size: 0.72rem; color: var(--text-secondary); margin-top: 1px; }
    .reset-option { font-style: italic; color: var(--text-secondary); border-bottom: 1px dashed var(--border-color); margin-bottom: 4px; padding-bottom: 4px; }

    @media (max-width: 768px) {
      .notes-grid { grid-template-columns: 1fr; }
    }

    @media (max-width: 576px) {
      .toolbar {
        flex-direction: column;
        align-items: stretch;
        gap: 0.75rem;
        padding: 0.75rem;
      }
      .toolbar-left {
        flex-direction: column;
        gap: 0.5rem;
        width: 100%;
      }
      .input-field {
        width: 100% !important;
      }
      .toolbar button {
        width: 100%;
        justify-content: center;
      }
      .form-row-group { grid-template-columns: 1fr; gap: 1rem; }
    }
  `]
})
export class StandupNotesComponent implements OnInit {
  svc = inject(StandupNoteService);
  employees: Employee[] = [];
  projects: Project[] = [];
  allNotes: StandupNote[] = [];
  filtered: StandupNote[] = [];
  availableTasks: Task[] = [];
  selectedTaskId = '';
  search = '';
  filterDate = '';
  filterEmp = '';
  filterProj = '';
  showModal = false;
  editMode = false;
  form!: StandupNote;

  employeeDropdownOpen = false;
  employeeSearchText = '';
  projectDropdownOpen = false;
  projectSearchText = '';

  readonly COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#06b6d4', '#10b981', '#f59e0b'];

  @HostListener('document:click', ['$event'])
  onClickOutside(event: Event) {
    const path = event.composedPath();
    const isInsideEmployee = path.some(el => (el as HTMLElement).classList?.contains('emp-select'));
    const isInsideProject = path.some(el => (el as HTMLElement).classList?.contains('proj-select'));
    if (!isInsideEmployee) this.employeeDropdownOpen = false;
    if (!isInsideProject) this.projectDropdownOpen = false;
  }

  ngOnInit() {
    this.svc.state$.subscribe(s => {
      this.employees = s.employees;
      this.projects = s.projects || [];
      this.allNotes = s.standupNotes;
      this.availableTasks = s.tasks || [];
      this.applyFilters();
    });
  }

  applyFilters() {
    let data = [...this.allNotes];
    if (this.search) {
      const t = this.search.toLowerCase();
      data = data.filter(n => 
        n.todayPlan.toLowerCase().includes(t) || 
        n.previousWork.toLowerCase().includes(t) || 
        n.blockers.toLowerCase().includes(t) || 
        (n.employeeId && this.getEmpName(n.employeeId).toLowerCase().includes(t)) ||
        (n.projectId && this.getProjName(n.projectId).toLowerCase().includes(t))
      );
    }
    if (this.filterDate) data = data.filter(n => n.date === this.filterDate);
    if (this.filterEmp) data = data.filter(n => n.employeeId === this.filterEmp);
    if (this.filterProj) data = data.filter(n => n.projectId === this.filterProj);
    this.filtered = data.sort((a, b) => b.date.localeCompare(a.date));
  }

  getEmpName(id: string) { return this.employees.find(e => e.id === id)?.name || id; }
  getPosition(id: string) { return this.employees.find(e => e.id === id)?.position || ''; }
  getProjName(id: string | undefined) { return id ? (this.projects.find(p => p.id === id)?.name || id) : ''; }
  getInitials(id: string) { return this.svc.getInitials(this.getEmpName(id)); }
  getColor(id: string) { return this.COLORS[id.charCodeAt(id.length - 1) % this.COLORS.length]; }

  getHeading(note: StandupNote): string {
    const hasEmp = !!note.employeeId;
    const hasProj = !!note.projectId;
    if (hasEmp && hasProj) {
      return `${this.getEmpName(note.employeeId)} | ${this.getProjName(note.projectId)}`;
    } else if (hasEmp) {
      return this.getEmpName(note.employeeId);
    } else if (hasProj) {
      return this.getProjName(note.projectId);
    }
    return 'No Selection';
  }

  getSubheading(note: StandupNote): string {
    if (note.employeeId) {
      return this.getPosition(note.employeeId);
    } else if (note.projectId) {
      const proj = this.projects.find(p => p.id === note.projectId);
      return proj ? `Project — ${proj.status}` : 'Project';
    }
    return '';
  }

  getInitialsForCard(note: StandupNote): string {
    if (note.employeeId) {
      return this.getInitials(note.employeeId);
    } else if (note.projectId) {
      const projName = this.getProjName(note.projectId);
      return this.svc.getInitials(projName);
    }
    return '?';
  }

  get selectedEmployeeName(): string {
    if (!this.form || !this.form.employeeId) return '-- Select Employee --';
    const emp = this.employees.find(e => e.id === this.form.employeeId);
    return emp ? emp.name : '-- Select Employee --';
  }

  get selectedProjectName(): string {
    if (!this.form || !this.form.projectId) return '-- Select Project --';
    const proj = this.projects.find(p => p.id === this.form.projectId);
    return proj ? proj.name : '-- Select Project --';
  }

  get filteredEmployeesForSelect(): Employee[] {
    if (!this.employeeSearchText) {
      return this.employees;
    }
    const txt = this.employeeSearchText.toLowerCase();
    return this.employees.filter(e => e.name.toLowerCase().includes(txt) || e.position.toLowerCase().includes(txt));
  }

  get filteredProjectsForSelect(): Project[] {
    if (!this.projectSearchText) {
      return this.projects;
    }
    const txt = this.projectSearchText.toLowerCase();
    return this.projects.filter(p => p.name.toLowerCase().includes(txt));
  }

  selectEmployee(empId: string) {
    this.form.employeeId = empId;
    this.employeeDropdownOpen = false;
    this.employeeSearchText = '';
  }

  selectProject(projId: string) {
    this.form.projectId = projId;
    this.projectDropdownOpen = false;
    this.projectSearchText = '';
  }

  blankForm(): StandupNote {
    return { id: '', employeeId: '', date: new Date().toISOString().split('T')[0], previousWork: '', todayPlan: '', blockers: 'None', notes: '', projectId: '' };
  }

  openAdd() { this.form = this.blankForm(); this.selectedTaskId = ''; this.editMode = false; this.showModal = true; }
  openEdit(n: StandupNote) { this.form = { projectId: '', ...n }; this.selectedTaskId = ''; this.editMode = true; this.showModal = true; }
  
  closeModal() {
    this.showModal = false;
    this.selectedTaskId = '';
    this.employeeDropdownOpen = false;
    this.employeeSearchText = '';
    this.projectDropdownOpen = false;
    this.projectSearchText = '';
  }

  onTaskSelect(taskId: string) {
    if (!taskId) return;
    const task = this.availableTasks.find(t => t.id === taskId);
    if (!task) return;
    const parts: string[] = [];
    if (task.tag) parts.push(`[${task.tag}]`);
    parts.push(task.title);
    if (task.description) parts.push(`\u2014 ${task.description}`);
    if (task.projectName) parts.push(`(${task.projectName})`);
    this.form.todayPlan = parts.join(' ');
  }

  saveNote() {
    if (!this.form.employeeId && !this.form.projectId) {
      alert('Please select at least an Employee or a Project before saving.');
      return;
    }
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
