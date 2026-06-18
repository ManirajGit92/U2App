import { Injectable, inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import * as XLSX from 'xlsx';
import { FirebaseAuthService } from '../../core/services/firebase-auth.service';
import { FirebaseSyncService } from '../../core/services/firebase-sync.service';

const APP_NAME = 'standup-note';

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
  taskIds?: string[];
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

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface ChecklistGroup {
  id: string;
  title: string;
  items: ChecklistItem[];
}

export interface FeedbackEntry {
  id: string;
  targetType: 'Employee' | 'Project';
  targetId: string; // employee id or project id
  subject: string;
  message: string;
  createdAt: string; // ISO
}

export interface CalendarCategory {
  id: string;
  name: string;
  color: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:MM
  categoryId: string;
}

export type TaskPriority =
  | 'important-urgent'
  | 'urgent-not-important'
  | 'important-not-urgent'
  | 'not-important-not-urgent';

export type TaskColumn = 'not-taken' | 'in-progress' | 'completed';

export type TaskProgress = 'Not Started' | 'In Progress' | 'Review' | 'Done';

export interface Task {
  id: string;
  title: string;
  tag: string;
  description: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  progress: TaskProgress;
  priority: TaskPriority;
  column: TaskColumn;
  employeeName: string;
  projectName: string;
}

export interface StandupState {
  employees: Employee[];
  standupNotes: StandupNote[];
  projects: Project[];
  reminders: Reminder[];
  checklistGroups: ChecklistGroup[];
  feedbacks: FeedbackEntry[];
  calendarCategories?: CalendarCategory[];
  calendarEvents?: CalendarEvent[];
  tasks?: Task[];
}

const SEED_STATE: StandupState = {
  employees: [
    {
      id: 'EMP-001',
      name: 'Alice Johnson',
      position: 'Frontend Developer',
      team: 'UI',
      email: 'alice@company.com',
    },
    {
      id: 'EMP-002',
      name: 'Bob Smith',
      position: 'Backend Developer',
      team: 'API',
      email: 'bob@company.com',
    },
    {
      id: 'EMP-003',
      name: 'Carol White',
      position: 'QA Engineer',
      team: 'QA',
      email: 'carol@company.com',
    },
  ],
  standupNotes: [
    {
      id: 'SN-001',
      employeeId: 'EMP-001',
      date: new Date().toISOString().split('T')[0],
      previousWork: 'Completed dashboard UI component',
      todayPlan: 'Work on chart integration and filters',
      blockers: 'Waiting for API contract from backend',
      notes: 'Need design review by EOD',
      projectId: 'PRJ-001',
    },
    {
      id: 'SN-002',
      employeeId: 'EMP-002',
      date: new Date().toISOString().split('T')[0],
      previousWork: 'Fixed auth token refresh bug',
      todayPlan: 'Implement pagination endpoint',
      blockers: 'None',
      notes: 'Will sync with Alice on API contract',
      projectId: 'PRJ-001',
    },
  ],
  projects: [
    {
      id: 'PRJ-001',
      name: 'Customer Portal v2',
      status: 'Active',
      startDate: '2026-02-01',
      endDate: '2026-04-30',
      notes: 'Major release pending QA sign-off',
      lead: 'Alice Johnson',
    },
    {
      id: 'PRJ-002',
      name: 'Internal HR Tool',
      status: 'On Hold',
      startDate: '2026-03-01',
      endDate: '2026-06-30',
      notes: 'Blocked on stakeholder approval',
      lead: 'Bob Smith',
    },
  ],
  reminders: [
    {
      id: 'REM-001',
      title: 'Sprint Review Meeting',
      description: 'Prepare demo and retrospective slides',
      deadline: '2026-03-28',
      priority: 'High',
      assignedTo: 'Alice Johnson',
      done: false,
    },
    {
      id: 'REM-002',
      title: 'Deploy to Staging',
      description: 'Post QA approval, push build to staging environment',
      deadline: '2026-03-31',
      priority: 'Medium',
      assignedTo: 'Bob Smith',
      done: false,
    },
  ],
  checklistGroups: [
    {
      id: 'CG-001',
      title: 'Release Checklist',
      items: [
        { id: 'CI-001', text: 'Run unit tests', done: false },
        { id: 'CI-002', text: 'Smoke test staging', done: false },
      ],
    },
  ],
  feedbacks: [
    {
      id: 'FB-001',
      targetType: 'Employee',
      targetId: 'EMP-001',
      subject: 'Great work',
      message: 'Alice did a great job on the dashboard component.',
      createdAt: new Date().toISOString(),
    },
  ],
  calendarCategories: [
    { id: 'CAT-001', name: 'Meeting', color: '#6366f1' },
    { id: 'CAT-002', name: 'Holiday', color: '#10b981' },
    { id: 'CAT-003', name: 'Deadline', color: '#ef4444' },
    { id: 'CAT-004', name: 'General', color: '#ec4899' },
  ],
  calendarEvents: [
    {
      id: 'EVT-001',
      title: 'Sprint Planning',
      description: 'Align on upcoming sprint goals',
      date: new Date().toISOString().split('T')[0],
      time: '10:00',
      categoryId: 'CAT-001',
    },
  ],
  tasks: [
    {
      id: 'TSK-001',
      title: 'Design new login page',
      tag: 'DESIGN',
      description: 'Create wireframes and hi-fi mockups for the new login flow',
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0],
      progress: 'In Progress',
      priority: 'important-urgent',
      column: 'in-progress',
      employeeName: 'Alice Johnson',
      projectName: 'Customer Portal v2',
    },
    {
      id: 'TSK-002',
      title: 'Fix pagination bug',
      tag: 'BUG',
      description: 'Pagination breaks on mobile viewport for the product list',
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
      progress: 'Not Started',
      priority: 'urgent-not-important',
      column: 'not-taken',
      employeeName: 'Bob Smith',
      projectName: 'Customer Portal v2',
    },
    {
      id: 'TSK-003',
      title: 'Write unit tests for auth module',
      tag: 'TEST',
      description: 'Cover all auth service methods with Jest unit tests',
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + 10 * 86400000).toISOString().split('T')[0],
      progress: 'Not Started',
      priority: 'important-not-urgent',
      column: 'not-taken',
      employeeName: 'Carol White',
      projectName: 'Internal HR Tool',
    },
  ],
};

@Injectable({ providedIn: 'root' })
export class StandupNoteService {
  private authService = inject(FirebaseAuthService);
  private syncService = inject(FirebaseSyncService);

  private static readonly STORAGE_KEY_PREFIX = 'u2app.standupState';
  private static readonly LEGACY_STORAGE_KEY = 'u2app.standupState';

  private static getStorageKey(uid?: string | null): string {
    return uid
      ? `${StandupNoteService.STORAGE_KEY_PREFIX}.${uid}`
      : StandupNoteService.STORAGE_KEY_PREFIX;
  }

  private static loadLocalState(uid?: string | null): StandupState {
    const key = StandupNoteService.getStorageKey(uid);
    try {
      const data = localStorage.getItem(key);
      if (data) {
        const parsed = JSON.parse(data);
        return {
          employees: parsed.employees || SEED_STATE.employees,
          standupNotes: parsed.standupNotes || SEED_STATE.standupNotes,
          projects: parsed.projects || SEED_STATE.projects,
          reminders: parsed.reminders || SEED_STATE.reminders,
          checklistGroups: parsed.checklistGroups || SEED_STATE.checklistGroups,
          feedbacks: parsed.feedbacks || SEED_STATE.feedbacks,
          calendarCategories: parsed.calendarCategories || SEED_STATE.calendarCategories,
          calendarEvents: parsed.calendarEvents || SEED_STATE.calendarEvents,
          tasks: parsed.tasks || SEED_STATE.tasks,
        };
      }
    } catch (e) {
      console.error('Failed to load local standup state', e);
    }
    return SEED_STATE;
  }

  private currentUid: string | null = null;
  private stateSubject = new BehaviorSubject<StandupState>(
    StandupNoteService.loadLocalState(this.authService.user()?.uid),
  );
  state$ = this.stateSubject.asObservable();

  constructor() {
    this.syncService.onAuthChange((uid) => {
      if (uid) {
        this.currentUid = uid;
        const localState = StandupNoteService.loadLocalState(uid);
        this.stateSubject.next(localState);
        this.loadFromFirestore();
      } else {
        this.currentUid = null;
        this.resetState();
      }
    });
  }

  get state(): StandupState {
    return this.stateSubject.value;
  }
  private update(patch: Partial<StandupState>) {
    const newState = { ...this.state, ...patch };
    this.stateSubject.next(newState);
    try {
      const key = StandupNoteService.getStorageKey(this.authService.user()?.uid);
      localStorage.setItem(key, JSON.stringify(newState));
    } catch (e) {
      console.error('Failed to save state to localStorage', e);
    }
    this.syncToFirestore();
  }

  private resetState(): void {
    this.stateSubject.next(SEED_STATE);
    try {
      localStorage.removeItem(StandupNoteService.LEGACY_STORAGE_KEY);
    } catch (e) {
      console.error('StandupNoteService: failed to clear legacy localStorage key', e);
    }
  }

  // --- Firestore Sync ---
  private async syncToFirestore(): Promise<void> {
    if (!this.authService.isAuthenticated()) return;
    const data = this.state;
    await Promise.all([
      this.syncService.pushToFirestore(
        APP_NAME,
        'employees',
        data.employees as unknown as Record<string, unknown>[],
      ),
      this.syncService.pushToFirestore(
        APP_NAME,
        'standupNotes',
        data.standupNotes as unknown as Record<string, unknown>[],
      ),
      this.syncService.pushToFirestore(
        APP_NAME,
        'projects',
        data.projects as unknown as Record<string, unknown>[],
      ),
      this.syncService.pushToFirestore(
        APP_NAME,
        'reminders',
        data.reminders as unknown as Record<string, unknown>[],
      ),
      this.syncService.pushToFirestore(
        APP_NAME,
        'checklistGroups',
        data.checklistGroups as unknown as Record<string, unknown>[],
      ),
      this.syncService.pushToFirestore(
        APP_NAME,
        'feedbacks',
        data.feedbacks as unknown as Record<string, unknown>[],
      ),
      this.syncService.pushToFirestore(
        APP_NAME,
        'calendarCategories',
        (data.calendarCategories || []) as unknown as Record<string, unknown>[],
      ),
      this.syncService.pushToFirestore(
        APP_NAME,
        'calendarEvents',
        (data.calendarEvents || []) as unknown as Record<string, unknown>[],
      ),
      this.syncService.pushToFirestore(
        APP_NAME,
        'tasks',
        (data.tasks || []) as unknown as Record<string, unknown>[],
      ),
    ]);
  }

  async loadFromFirestore(): Promise<void> {
    if (!this.authService.isAuthenticated()) return;
    try {
      const employees = await this.syncService.pullFromFirestore<Employee>(APP_NAME, 'employees');
      const standupNotes = await this.syncService.pullFromFirestore<StandupNote>(
        APP_NAME,
        'standupNotes',
      );
      const projects = await this.syncService.pullFromFirestore<Project>(APP_NAME, 'projects');
      const reminders = await this.syncService.pullFromFirestore<Reminder>(APP_NAME, 'reminders');
      const checklistGroups = await this.syncService.pullFromFirestore<ChecklistGroup>(
        APP_NAME,
        'checklistGroups',
      );
      const feedbacks = await this.syncService.pullFromFirestore<FeedbackEntry>(
        APP_NAME,
        'feedbacks',
      );
      const calendarCategories = await this.syncService.pullFromFirestore<CalendarCategory>(
        APP_NAME,
        'calendarCategories',
      );
      const calendarEvents = await this.syncService.pullFromFirestore<CalendarEvent>(
        APP_NAME,
        'calendarEvents',
      );
      const tasks = await this.syncService.pullFromFirestore<Task>(APP_NAME, 'tasks');

      if (
        employees.length > 0 ||
        standupNotes.length > 0 ||
        projects.length > 0 ||
        reminders.length > 0 ||
        checklistGroups.length > 0 ||
        feedbacks.length > 0 ||
        calendarCategories.length > 0 ||
        calendarEvents.length > 0 ||
        tasks.length > 0
      ) {
        const newState = {
          employees: employees.length > 0 ? employees : this.state.employees,
          standupNotes: standupNotes.length > 0 ? standupNotes : this.state.standupNotes,
          projects: projects.length > 0 ? projects : this.state.projects,
          reminders: reminders.length > 0 ? reminders : this.state.reminders,
          checklistGroups:
            checklistGroups.length > 0 ? checklistGroups : this.state.checklistGroups,
          feedbacks: feedbacks.length > 0 ? feedbacks : this.state.feedbacks,
          calendarCategories:
            calendarCategories.length > 0 ? calendarCategories : this.state.calendarCategories,
          calendarEvents: calendarEvents.length > 0 ? calendarEvents : this.state.calendarEvents,
          tasks: tasks.length > 0 ? tasks : this.state.tasks,
        };
        this.stateSubject.next(newState);
        try {
          const key = StandupNoteService.getStorageKey(this.authService.user()?.uid);
          localStorage.setItem(key, JSON.stringify(newState));
        } catch (e) {
          console.error('Failed to save firestore state to localStorage', e);
        }
      }
    } catch (e) {
      console.error('StandupNoteService: failed to load from Firestore', e);
    }
  }

  async syncAllToFirestore(): Promise<void> {
    await this.syncToFirestore();
  }

  // ── Employees ──────────────────────────────────────────────────────────────
  addEmployee(emp: Employee) {
    this.update({ employees: [...this.state.employees, emp] });
  }
  updateEmployee(emp: Employee) {
    this.update({ employees: this.state.employees.map((e) => (e.id === emp.id ? emp : e)) });
  }
  deleteEmployee(id: string) {
    this.update({ employees: this.state.employees.filter((e) => e.id !== id) });
  }

  // ── Standup Notes ──────────────────────────────────────────────────────────
  addNote(note: StandupNote) {
    this.update({ standupNotes: [...this.state.standupNotes, note] });
  }
  updateNote(note: StandupNote) {
    this.update({
      standupNotes: this.state.standupNotes.map((n) => (n.id === note.id ? note : n)),
    });
  }
  deleteNote(id: string) {
    this.update({ standupNotes: this.state.standupNotes.filter((n) => n.id !== id) });
  }

  // ── Projects ───────────────────────────────────────────────────────────────
  addProject(p: Project) {
    this.update({ projects: [...this.state.projects, p] });
  }
  updateProject(p: Project) {
    this.update({ projects: this.state.projects.map((x) => (x.id === p.id ? p : x)) });
  }
  deleteProject(id: string) {
    this.update({ projects: this.state.projects.filter((p) => p.id !== id) });
  }

  // ── Reminders ──────────────────────────────────────────────────────────────
  addReminder(r: Reminder) {
    this.update({ reminders: [...this.state.reminders, r] });
  }
  updateReminder(r: Reminder) {
    this.update({ reminders: this.state.reminders.map((x) => (x.id === r.id ? r : x)) });
  }
  deleteReminder(id: string) {
    this.update({ reminders: this.state.reminders.filter((r) => r.id !== id) });
  }

  // ── Excel Export ───────────────────────────────────────────────────────────
  exportExcel() {
    const ws1 = XLSX.utils.json_to_sheet(this.state.employees);
    const ws2 = XLSX.utils.json_to_sheet(this.state.standupNotes);
    const ws3 = XLSX.utils.json_to_sheet(this.state.projects);
    const ws4 = XLSX.utils.json_to_sheet(this.state.reminders);

    // Serialize checklist items
    const serializedChecklists = (this.state.checklistGroups || []).map((group) => ({
      id: group.id,
      title: group.title,
      items: JSON.stringify(group.items || []),
    }));
    const ws5 = XLSX.utils.json_to_sheet(serializedChecklists);

    // Feedback export
    const ws6 = XLSX.utils.json_to_sheet(this.state.feedbacks || []);

    // Calendar export
    const ws7 = XLSX.utils.json_to_sheet(this.state.calendarCategories || []);
    const ws8 = XLSX.utils.json_to_sheet(this.state.calendarEvents || []);
    const ws9 = XLSX.utils.json_to_sheet(this.state.tasks || []);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws1, 'Employees');
    XLSX.utils.book_append_sheet(wb, ws2, 'StandupNotes');
    XLSX.utils.book_append_sheet(wb, ws3, 'Projects');
    XLSX.utils.book_append_sheet(wb, ws4, 'Reminders');
    XLSX.utils.book_append_sheet(wb, ws5, 'ChecklistGroups');
    XLSX.utils.book_append_sheet(wb, ws6, 'Feedbacks');
    XLSX.utils.book_append_sheet(wb, ws7, 'CalendarCategories');
    XLSX.utils.book_append_sheet(wb, ws8, 'CalendarEvents');
    XLSX.utils.book_append_sheet(wb, ws9, 'Tasks');
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
      const checklistGroupsRaw: any[] = XLSX.utils.sheet_to_json(
        wb.Sheets['ChecklistGroups'] || {},
      );
      const feedbacks: FeedbackEntry[] = XLSX.utils.sheet_to_json(wb.Sheets['Feedbacks'] || {});
      const calendarCategories: CalendarCategory[] = XLSX.utils.sheet_to_json(
        wb.Sheets['CalendarCategories'] || {},
      );
      const calendarEvents: CalendarEvent[] = XLSX.utils.sheet_to_json(
        wb.Sheets['CalendarEvents'] || {},
      );
      const tasks: Task[] = XLSX.utils.sheet_to_json(wb.Sheets['Tasks'] || {});

      const checklistGroups: ChecklistGroup[] = (checklistGroupsRaw || []).map((g: any) => {
        let items: ChecklistItem[] = [];
        if (g.items) {
          try {
            items = typeof g.items === 'string' ? JSON.parse(g.items) : g.items;
          } catch (err) {
            console.error('Error parsing checklist items JSON during import', err);
          }
        }
        return {
          id: g.id || '',
          title: g.title || '',
          items: Array.isArray(items) ? items : [],
        };
      });

      this.update({
        employees: employees || [],
        standupNotes: standupNotes || [],
        projects: projects || [],
        reminders: reminders || [],
        checklistGroups: checklistGroups || [],
        feedbacks: feedbacks || [],
        calendarCategories: calendarCategories || [],
        calendarEvents: calendarEvents || [],
        tasks: tasks || [],
      });
    };
    reader.readAsArrayBuffer(file);
  }

  // ── Calendar Categories ───────────────────────────────────────────────────
  addCalendarCategory(cat: CalendarCategory) {
    this.update({ calendarCategories: [...(this.state.calendarCategories || []), cat] });
  }
  updateCalendarCategory(cat: CalendarCategory) {
    this.update({
      calendarCategories: (this.state.calendarCategories || []).map((c) =>
        c.id === cat.id ? cat : c,
      ),
    });
  }
  deleteCalendarCategory(id: string) {
    const categories = (this.state.calendarCategories || []).filter((c) => c.id !== id);
    const events = (this.state.calendarEvents || []).filter((e) => e.categoryId !== id);
    this.update({ calendarCategories: categories, calendarEvents: events });
  }

  // ── Calendar Events ────────────────────────────────────────────────────────
  addCalendarEvent(evt: CalendarEvent) {
    this.update({ calendarEvents: [...(this.state.calendarEvents || []), evt] });
  }
  updateCalendarEvent(evt: CalendarEvent) {
    this.update({
      calendarEvents: (this.state.calendarEvents || []).map((e) => (e.id === evt.id ? evt : e)),
    });
  }
  deleteCalendarEvent(id: string) {
    this.update({
      calendarEvents: (this.state.calendarEvents || []).filter((e) => e.id !== id),
    });
  }

  // ── Tasks ─────────────────────────────────────────────────────────────────
  addTask(task: Task) {
    this.update({ tasks: [...(this.state.tasks || []), task] });
  }
  updateTask(task: Task) {
    this.update({ tasks: (this.state.tasks || []).map((t) => (t.id === task.id ? task : t)) });
  }
  deleteTask(id: string) {
    this.update({ tasks: (this.state.tasks || []).filter((t) => t.id !== id) });
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  getInitials(name: string): string {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  generateId(prefix: string, items: any[]): string {
    const ids = items.map((i) => parseInt(i.id.replace(`${prefix}-`, '')) || 0);
    const max = ids.length ? Math.max(...ids) : 0;
    return `${prefix}-${(max + 1).toString().padStart(3, '0')}`;
  }

  // ── Checklists ───────────────────────────────────────────────────────────
  addChecklistGroup(group: Omit<ChecklistGroup, 'id'>) {
    const id = this.generateId('CG', this.state.checklistGroups || []);
    this.update({ checklistGroups: [...(this.state.checklistGroups || []), { ...group, id }] });
  }

  updateChecklistGroup(group: ChecklistGroup) {
    this.update({
      checklistGroups: (this.state.checklistGroups || []).map((g) =>
        g.id === group.id ? group : g,
      ),
    });
  }

  deleteChecklistGroup(id: string) {
    this.update({ checklistGroups: (this.state.checklistGroups || []).filter((g) => g.id !== id) });
  }

  addChecklistItem(groupId: string, item: Omit<ChecklistItem, 'id'>) {
    const groups = this.state.checklistGroups || [];
    const group = groups.find((g) => g.id === groupId);
    if (!group) return;
    const id = this.generateId('CI', group.items || []);
    const updated: ChecklistGroup = { ...group, items: [...(group.items || []), { ...item, id }] };
    this.update({ checklistGroups: groups.map((g) => (g.id === groupId ? updated : g)) });
  }

  updateChecklistItem(groupId: string, item: ChecklistItem) {
    const groups = this.state.checklistGroups || [];
    const group = groups.find((g) => g.id === groupId);
    if (!group) return;
    const updated: ChecklistGroup = {
      ...group,
      items: group.items.map((i) => (i.id === item.id ? item : i)),
    };
    this.update({ checklistGroups: groups.map((g) => (g.id === groupId ? updated : g)) });
  }

  deleteChecklistItem(groupId: string, itemId: string) {
    const groups = this.state.checklistGroups || [];
    const group = groups.find((g) => g.id === groupId);
    if (!group) return;
    const updated: ChecklistGroup = { ...group, items: group.items.filter((i) => i.id !== itemId) };
    this.update({ checklistGroups: groups.map((g) => (g.id === groupId ? updated : g)) });
  }

  // ── Feedbacks ────────────────────────────────────────────────────────────
  addFeedback(entry: Omit<FeedbackEntry, 'id' | 'createdAt'>) {
    const id = this.generateId('FB', this.state.feedbacks || []);
    const createdAt = new Date().toISOString();
    this.update({ feedbacks: [...(this.state.feedbacks || []), { ...entry, id, createdAt }] });
  }

  updateFeedback(entry: FeedbackEntry) {
    this.update({
      feedbacks: (this.state.feedbacks || []).map((f) => (f.id === entry.id ? entry : f)),
    });
  }

  deleteFeedback(id: string) {
    this.update({ feedbacks: (this.state.feedbacks || []).filter((f) => f.id !== id) });
  }

  daysUntil(dateStr: string): number {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(dateStr);
    target.setHours(0, 0, 0, 0);
    return Math.round((target.getTime() - today.getTime()) / 86400000);
  }
}
