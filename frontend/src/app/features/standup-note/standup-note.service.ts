import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import * as XLSX from 'xlsx';

export interface Employee {
  id: string;
  name: string;
  position: string;
  team: string;
  email: string;
  photo?: string; // url or initials fallback
}

export interface StandupNote {
  id: string;
  employeeId: string;
  date: string; // YYYY-MM-DD
  previousWork: string;
  todayPlan: string;
  blockers: string;
  notes: string;
  projectId?: string;
}

export interface Project {
  id: string;
  name: string;
  status: 'Active' | 'On Hold' | 'Completed';
  startDate: string;
  endDate: string;
  notes: string;
  lead: string;
}

export interface Reminder {
  id: string;
  title: string;
  description: string;
  deadline: string; // YYYY-MM-DD
  priority: 'High' | 'Medium' | 'Low';
  assignedTo: string;
  done: boolean;
}

export interface StandupState {
  employees: Employee[];
  standupNotes: StandupNote[];
  projects: Project[];
  reminders: Reminder[];
}

const SEED_STATE: StandupState = {
  employees: [
    { id: 'EMP-001', name: 'Alice Johnson', position: 'Frontend Developer', team: 'UI', email: 'alice@company.com' },
    { id: 'EMP-002', name: 'Bob Smith', position: 'Backend Developer', team: 'API', email: 'bob@company.com' },
    { id: 'EMP-003', name: 'Carol White', position: 'QA Engineer', team: 'QA', email: 'carol@company.com' },
  ],
  standupNotes: [
    {
      id: 'SN-001', employeeId: 'EMP-001', date: new Date().toISOString().split('T')[0],
      previousWork: 'Completed dashboard UI component',
      todayPlan: 'Work on chart integration and filters',
      blockers: 'Waiting for API contract from backend',
      notes: 'Need design review by EOD', projectId: 'PRJ-001'
    },
    {
      id: 'SN-002', employeeId: 'EMP-002', date: new Date().toISOString().split('T')[0],
      previousWork: 'Fixed auth token refresh bug',
      todayPlan: 'Implement pagination endpoint',
      blockers: 'None',
      notes: 'Will sync with Alice on API contract', projectId: 'PRJ-001'
    },
  ],
  projects: [
    { id: 'PRJ-001', name: 'Customer Portal v2', status: 'Active', startDate: '2026-02-01', endDate: '2026-04-30', notes: 'Major release pending QA sign-off', lead: 'Alice Johnson' },
    { id: 'PRJ-002', name: 'Internal HR Tool', status: 'On Hold', startDate: '2026-03-01', endDate: '2026-06-30', notes: 'Blocked on stakeholder approval', lead: 'Bob Smith' },
  ],
  reminders: [
    { id: 'REM-001', title: 'Sprint Review Meeting', description: 'Prepare demo and retrospective slides', deadline: '2026-03-28', priority: 'High', assignedTo: 'Alice Johnson', done: false },
    { id: 'REM-002', title: 'Deploy to Staging', description: 'Post QA approval, push build to staging environment', deadline: '2026-03-31', priority: 'Medium', assignedTo: 'Bob Smith', done: false },
  ]
};

@Injectable({ providedIn: 'root' })
export class StandupNoteService {
  private stateSubject = new BehaviorSubject<StandupState>(SEED_STATE);
  state$ = this.stateSubject.asObservable();

  get state(): StandupState { return this.stateSubject.value; }
  private update(patch: Partial<StandupState>) { this.stateSubject.next({ ...this.state, ...patch }); }

  // ── Employees ──────────────────────────────────────────────────────────────
  addEmployee(emp: Employee) { this.update({ employees: [...this.state.employees, emp] }); }
  updateEmployee(emp: Employee) { this.update({ employees: this.state.employees.map(e => e.id === emp.id ? emp : e) }); }
  deleteEmployee(id: string) { this.update({ employees: this.state.employees.filter(e => e.id !== id) }); }

  // ── Standup Notes ──────────────────────────────────────────────────────────
  addNote(note: StandupNote) { this.update({ standupNotes: [...this.state.standupNotes, note] }); }
  updateNote(note: StandupNote) { this.update({ standupNotes: this.state.standupNotes.map(n => n.id === note.id ? note : n) }); }
  deleteNote(id: string) { this.update({ standupNotes: this.state.standupNotes.filter(n => n.id !== id) }); }

  // ── Projects ───────────────────────────────────────────────────────────────
  addProject(p: Project) { this.update({ projects: [...this.state.projects, p] }); }
  updateProject(p: Project) { this.update({ projects: this.state.projects.map(x => x.id === p.id ? p : x) }); }
  deleteProject(id: string) { this.update({ projects: this.state.projects.filter(p => p.id !== id) }); }

  // ── Reminders ──────────────────────────────────────────────────────────────
  addReminder(r: Reminder) { this.update({ reminders: [...this.state.reminders, r] }); }
  updateReminder(r: Reminder) { this.update({ reminders: this.state.reminders.map(x => x.id === r.id ? r : x) }); }
  deleteReminder(id: string) { this.update({ reminders: this.state.reminders.filter(r => r.id !== id) }); }

  // ── Excel Export ───────────────────────────────────────────────────────────
  exportExcel() {
    const ws1 = XLSX.utils.json_to_sheet(this.state.employees);
    const ws2 = XLSX.utils.json_to_sheet(this.state.standupNotes);
    const ws3 = XLSX.utils.json_to_sheet(this.state.projects);
    const ws4 = XLSX.utils.json_to_sheet(this.state.reminders);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws1, 'Employees');
    XLSX.utils.book_append_sheet(wb, ws2, 'StandupNotes');
    XLSX.utils.book_append_sheet(wb, ws3, 'Projects');
    XLSX.utils.book_append_sheet(wb, ws4, 'Reminders');
    XLSX.writeFile(wb, 'StandupNote_DB.xlsx');
  }

  // ── Excel Import ───────────────────────────────────────────────────────────
  importExcel(file: File) {
    const reader = new FileReader();
    reader.onload = (e: any) => {
      const wb = XLSX.read(e.target.result, { type: 'array' });
      const employees: Employee[] = XLSX.utils.sheet_to_json(wb.Sheets['Employees'] || {});
      const standupNotes: StandupNote[] = XLSX.utils.sheet_to_json(wb.Sheets['StandupNotes'] || {});
      const projects: Project[] = XLSX.utils.sheet_to_json(wb.Sheets['Projects'] || {});
      const reminders: Reminder[] = XLSX.utils.sheet_to_json(wb.Sheets['Reminders'] || {});
      this.stateSubject.next({ employees, standupNotes, projects, reminders });
    };
    reader.readAsArrayBuffer(file);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  getInitials(name: string): string {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }

  generateId(prefix: string, items: any[]): string {
    const ids = items.map(i => parseInt(i.id.replace(`${prefix}-`, '')) || 0);
    const max = ids.length ? Math.max(...ids) : 0;
    return `${prefix}-${(max + 1).toString().padStart(3, '0')}`;
  }

  daysUntil(dateStr: string): number {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const target = new Date(dateStr); target.setHours(0, 0, 0, 0);
    return Math.round((target.getTime() - today.getTime()) / 86400000);
  }
}
