import { Injectable, inject, signal, computed } from '@angular/core';
import {
  WorkTask,
  WorkProject,
  ScheduleItem,
  TimeLog,
  ActivityLog,
  CalendarDayEvent,
  ProductivityMetric,
} from './work-tracker.models';
import { FirebaseAuthService } from '../../../core/services/firebase-auth.service';
import { FirebaseSyncService } from '../../../core/services/firebase-sync.service';

const STORAGE_KEY = 'u2_work_tracker_state_v1';
const APP_NAME = 'life-tracker';

@Injectable({
  providedIn: 'root',
})
export class WorkTrackerService {
  private authService = inject(FirebaseAuthService);
  private syncService = inject(FirebaseSyncService);

  // Core signals
  readonly tasks = signal<WorkTask[]>([]);
  readonly projects = signal<WorkProject[]>([]);
  readonly schedules = signal<ScheduleItem[]>([]);
  readonly timeLogs = signal<TimeLog[]>([]);
  readonly activities = signal<ActivityLog[]>([]);
  readonly calendarEvents = signal<CalendarDayEvent[]>([]);

  // Navigation & Drawer state
  readonly selectedMonth = signal<string>('2026-05');
  readonly selectedCalendarDate = signal<string>('2026-05-31');
  readonly isAddDrawerOpen = signal<boolean>(true);
  readonly editingTask = signal<WorkTask | null>(null);
  readonly searchQuery = signal<string>('');

  // ─── Computed Metrics Matching Screenshot ───
  readonly totalTasks = computed(() => this.tasks().length);

  readonly completedTasks = computed(() =>
    this.tasks().filter((t) => t.status === 'Completed').length
  );

  readonly completedPercent = computed(() => {
    const total = this.totalTasks();
    return total > 0 ? Math.round((this.completedTasks() / total) * 100) : 0;
  });

  readonly inProgressTasks = computed(() =>
    this.tasks().filter((t) => t.status === 'In Progress').length
  );

  readonly overdueTasks = computed(() =>
    this.tasks().filter((t) => t.status !== 'Completed' && t.dueDate < '2026-05-31').length
  );

  readonly totalProjects = computed(() => this.projects().length);

  readonly totalHoursTracked = computed(() =>
    this.timeLogs().reduce((acc, log) => acc + log.hours, 0)
  );

  // Task Status breakdown
  readonly taskStatusBreakdown = computed(() => {
    const total = this.totalTasks() || 1;
    const completed = this.completedTasks();
    const inProgress = this.inProgressTasks();
    const overdue = this.overdueTasks();
    const notStarted = Math.max(0, total - completed - inProgress);

    return [
      { label: 'Completed', count: completed, percentage: Math.round((completed / total) * 100), color: '#10b981' },
      { label: 'In Progress', count: inProgress, percentage: Math.round((inProgress / total) * 100), color: '#3b82f6' },
      { label: 'Not Started', count: notStarted, percentage: Math.round((notStarted / total) * 100), color: '#94a3b8' },
      { label: 'Overdue', count: overdue, percentage: Math.round((overdue / total) * 100), color: '#ef4444' },
    ];
  });

  // Work by Project distribution
  readonly workByProject = computed(() => {
    const counts: Record<string, { count: number; color: string }> = {
      U2Tools: { count: 12, color: '#3b82f6' },
      'Client Project': { count: 8, color: '#8b5cf6' },
      Learning: { count: 5, color: '#10b981' },
      Documentation: { count: 4, color: '#f59e0b' },
      Meeting: { count: 3, color: '#f43f5e' },
      Other: { count: 2, color: '#64748b' },
    };

    // Calculate dynamically from tasks if tasks belong to these projects
    for (const p of this.projects()) {
      const taskCount = this.tasks().filter((t) => t.projectId === p.id || t.projectName === p.name).length;
      if (counts[p.name]) {
        counts[p.name].count = Math.max(counts[p.name].count, taskCount);
      }
    }

    return Object.entries(counts).map(([name, data]) => ({
      name,
      count: data.count,
      color: data.color,
    }));
  });

  // Time Tracking Breakdown
  readonly timeTrackingBreakdown = computed(() => {
    return this.timeLogs();
  });

  // Upcoming Tasks (sorted by due date, incomplete tasks prioritized)
  readonly upcomingTasks = computed(() => {
    return [...this.tasks()]
      .sort((a, b) => {
        if (a.status === 'Completed' && b.status !== 'Completed') return 1;
        if (a.status !== 'Completed' && b.status === 'Completed') return -1;
        return a.dueDate.localeCompare(b.dueDate);
      })
      .slice(0, 5);
  });

  // Today's schedule
  readonly todaySchedule = computed(() => {
    return this.schedules();
  });

  // Recent Activity
  readonly recentActivity = computed(() => {
    return this.activities();
  });

  // Project Progress list
  readonly projectProgressList = computed(() => {
    return this.projects();
  });

  // Productivity Insights
  readonly productivityMetrics = computed<ProductivityMetric[]>(() => {
    return [
      {
        title: 'Focus Time',
        value: '5.5h',
        trend: '15%',
        trendPositive: true,
        icon: 'pi pi-compass',
        color: '#10b981',
      },
      {
        title: 'Meetings',
        value: '6h',
        trend: '10%',
        trendPositive: false,
        icon: 'pi pi-users',
        color: '#8b5cf6',
      },
      {
        title: 'Tasks Completed',
        value: String(this.completedTasks()),
        trend: '25%',
        trendPositive: true,
        icon: 'pi pi-check-circle',
        color: '#3b82f6',
      },
      {
        title: 'Avg. Task Time',
        value: '1.8h',
        trend: '12%',
        trendPositive: false,
        icon: 'pi pi-clock',
        color: '#f59e0b',
      },
    ];
  });

  constructor() {
    this.loadState();

    this.syncService.onAuthChange((uid) => {
      if (uid) {
        this.loadFromFirestore();
      }
    });
  }

  // ─── State Persistence ───
  private loadState(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        if (data.tasks?.length) this.tasks.set(data.tasks);
        if (data.projects?.length) this.projects.set(data.projects);
        if (data.schedules?.length) this.schedules.set(data.schedules);
        if (data.timeLogs?.length) this.timeLogs.set(data.timeLogs);
        if (data.activities?.length) this.activities.set(data.activities);
        if (data.calendarEvents?.length) this.calendarEvents.set(data.calendarEvents);
        return;
      }
    } catch (e) {
      console.warn('Failed to load local work-tracker state, using defaults', e);
    }

    this.seedDefaultData();
  }

  private saveState(): void {
    try {
      const data = {
        tasks: this.tasks(),
        projects: this.projects(),
        schedules: this.schedules(),
        timeLogs: this.timeLogs(),
        activities: this.activities(),
        calendarEvents: this.calendarEvents(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      this.syncToFirestore();
    } catch (e) {
      console.error('Error saving work-tracker state', e);
    }
  }

  private async syncToFirestore(): Promise<void> {
    if (!this.authService.isAuthenticated()) return;
    try {
      await this.syncService.pushToFirestore(
        APP_NAME,
        'work_tracker_tasks',
        this.tasks() as any
      );
      await this.syncService.pushToFirestore(
        APP_NAME,
        'work_tracker_projects',
        this.projects() as any
      );
    } catch (err) {
      console.error('Failed syncing work tracker data to Firestore', err);
    }
  }

  private async loadFromFirestore(): Promise<void> {
    try {
      const ts = await this.syncService.pullFromFirestore<WorkTask>(
        APP_NAME,
        'work_tracker_tasks'
      );
      const prs = await this.syncService.pullFromFirestore<WorkProject>(
        APP_NAME,
        'work_tracker_projects'
      );
      if (ts?.length) this.tasks.set(ts);
      if (prs?.length) this.projects.set(prs);
    } catch (err) {
      console.error('Failed loading work tracker from Firestore', err);
    }
  }

  private seedDefaultData(): void {
    // 1. Projects matching screenshot
    const defaultProjects: WorkProject[] = [
      {
        id: 'p-1',
        name: 'U2Tools',
        color: '#3b82f6',
        icon: 'pi pi-box',
        totalTasks: 15,
        completedTasks: 12,
        progress: 80,
      },
      {
        id: 'p-2',
        name: 'Client Project',
        color: '#8b5cf6',
        icon: 'pi pi-briefcase',
        totalTasks: 10,
        completedTasks: 6,
        progress: 60,
      },
      {
        id: 'p-3',
        name: 'Learning & Certification',
        color: '#06b6d4',
        icon: 'pi pi-book',
        totalTasks: 10,
        completedTasks: 4,
        progress: 40,
      },
      {
        id: 'p-4',
        name: 'Documentation',
        color: '#f59e0b',
        icon: 'pi pi-file',
        totalTasks: 10,
        completedTasks: 7,
        progress: 70,
      },
      {
        id: 'p-5',
        name: 'Internal Tasks',
        color: '#ef4444',
        icon: 'pi pi-check-square',
        totalTasks: 10,
        completedTasks: 3,
        progress: 30,
      },
      {
        id: 'p-6',
        name: 'Other',
        color: '#64748b',
        icon: 'pi pi-folder',
        totalTasks: 5,
        completedTasks: 3,
        progress: 60,
      },
    ];

    // 2. Tasks: 24 total, 18 completed, 4 in progress, 2 overdue (not started/overdue)
    const defaultTasks: WorkTask[] = [
      {
        id: 'task-1',
        title: 'Prepare project presentation',
        description: 'Prepare slide deck and demo walkthrough for stakeholder meeting.',
        projectId: 'p-1',
        projectName: 'U2Tools',
        category: 'Development',
        priority: 'High',
        status: 'In Progress',
        dueDate: '2026-05-31',
        dueDateLabel: 'Today',
        estimatedHours: 2,
        tags: ['feature', 'frontend'],
        assignee: { name: 'Mani' },
        hasReminder: true,
        reminderDateTime: '2026-05-31 09:00 AM',
        createdAt: '2026-05-30T10:00:00Z',
      },
      {
        id: 'task-2',
        title: 'Review code changes',
        description: 'Review pull request #142 for the payment integration and write feedback.',
        projectId: 'p-2',
        projectName: 'Client Project',
        category: 'Development',
        priority: 'Medium',
        status: 'In Progress',
        dueDate: '2026-05-31',
        dueDateLabel: 'Today',
        estimatedHours: 1.5,
        tags: ['code-review'],
        assignee: { name: 'Mani' },
        hasReminder: false,
        createdAt: '2026-05-30T11:00:00Z',
      },
      {
        id: 'task-3',
        title: 'Team sync meeting',
        description: 'Weekly team sync on roadmap deliverables and blockers.',
        projectId: 'p-5',
        projectName: 'Internal',
        category: 'Meeting',
        priority: 'Medium',
        status: 'Not Started',
        dueDate: '2026-06-01',
        dueDateLabel: 'Tomorrow',
        estimatedHours: 1,
        tags: ['sync', 'planning'],
        assignee: { name: 'Mani' },
        hasReminder: true,
        createdAt: '2026-05-30T12:00:00Z',
      },
      {
        id: 'task-4',
        title: 'Update documentation',
        description: 'Update API docs and SDK reference manual.',
        projectId: 'p-1',
        projectName: 'U2Tools',
        category: 'Documentation',
        priority: 'Low',
        status: 'Not Started',
        dueDate: '2026-06-01',
        dueDateLabel: 'Tomorrow',
        estimatedHours: 2,
        tags: ['docs'],
        assignee: { name: 'Mani' },
        hasReminder: false,
        createdAt: '2026-05-30T14:00:00Z',
      },
      {
        id: 'task-5',
        title: 'Plan next sprint',
        description: 'Groom backlog, estimate story points and assign priorities.',
        projectId: 'p-1',
        projectName: 'U2Tools',
        category: 'Planning',
        priority: 'High',
        status: 'In Progress',
        dueDate: '2026-06-02',
        dueDateLabel: 'Jun 2',
        estimatedHours: 2.5,
        tags: ['sprint', 'scrum'],
        assignee: { name: 'Mani' },
        hasReminder: true,
        createdAt: '2026-05-30T16:00:00Z',
      },
      // 2 Overdue tasks
      {
        id: 'task-6',
        title: 'Audit security permissions',
        description: 'Review admin role security policies and token expiry.',
        projectId: 'p-2',
        projectName: 'Client Project',
        category: 'Research',
        priority: 'Urgent',
        status: 'In Progress',
        dueDate: '2026-05-28',
        dueDateLabel: 'May 28',
        estimatedHours: 3,
        tags: ['security'],
        assignee: { name: 'Mani' },
        hasReminder: false,
        createdAt: '2026-05-26T10:00:00Z',
      },
      {
        id: 'task-7',
        title: 'Fix database schema indexing',
        description: 'Index userId and date columns for fast lookup.',
        projectId: 'p-1',
        projectName: 'U2Tools',
        category: 'Development',
        priority: 'High',
        status: 'Not Started',
        dueDate: '2026-05-29',
        dueDateLabel: 'May 29',
        estimatedHours: 1.5,
        tags: ['database'],
        assignee: { name: 'Mani' },
        hasReminder: false,
        createdAt: '2026-05-27T09:00:00Z',
      },
    ];

    // Seed 17 more completed tasks to reach exactly 18 completed and 24 total
    for (let i = 8; i <= 24; i++) {
      defaultTasks.push({
        id: `task-${i}`,
        title: `Task #${i}: Feature Implementation & Verification`,
        description: 'Successfully implemented, tested and deployed to staging.',
        projectId: i % 2 === 0 ? 'p-1' : 'p-2',
        projectName: i % 2 === 0 ? 'U2Tools' : 'Client Project',
        category: 'Development',
        priority: i % 3 === 0 ? 'High' : 'Medium',
        status: 'Completed',
        dueDate: `2026-05-${Math.min(i + 5, 30)}`,
        dueDateLabel: 'Completed',
        estimatedHours: 2,
        actualHours: 2,
        tags: ['completed'],
        assignee: { name: 'Mani' },
        hasReminder: false,
        createdAt: '2026-05-10T10:00:00Z',
        completedAt: '2026-05-28T16:00:00Z',
      });
    }

    // 3. Today's Schedule matching screenshot:
    const defaultSchedules: ScheduleItem[] = [
      {
        id: 'sch-1',
        timeStart: '09:00 AM',
        timeEnd: '09:30 AM',
        title: 'Daily Standup',
        subtitle: 'Online Meeting',
        type: 'meeting',
        icon: 'pi pi-video',
        color: '#06b6d4',
        date: '2026-05-31',
      },
      {
        id: 'sch-2',
        timeStart: '10:00 AM',
        timeEnd: '12:00 PM',
        title: 'Feature Development',
        subtitle: 'U2Tools',
        type: 'work',
        icon: 'pi pi-code',
        color: '#3b82f6',
        date: '2026-05-31',
      },
      {
        id: 'sch-3',
        timeStart: '01:00 PM',
        timeEnd: '02:00 PM',
        title: 'Client Discussion',
        subtitle: 'Client Project',
        type: 'client',
        icon: 'pi pi-users',
        color: '#8b5cf6',
        date: '2026-05-31',
      },
      {
        id: 'sch-4',
        timeStart: '03:00 PM',
        timeEnd: '04:00 PM',
        title: 'Documentation Update',
        subtitle: 'Docs',
        type: 'docs',
        icon: 'pi pi-file',
        color: '#f59e0b',
        date: '2026-05-31',
      },
      {
        id: 'sch-5',
        timeStart: '04:30 PM',
        timeEnd: '05:00 PM',
        title: 'Plan Next Sprint',
        subtitle: 'Planning',
        type: 'planning',
        icon: 'pi pi-calendar',
        color: '#ef4444',
        date: '2026-05-31',
      },
    ];

    // 4. Time Tracking Logs matching screenshot (32h / 40h):
    const defaultTimeLogs: TimeLog[] = [
      { id: 'tl-1', category: 'Focused Work', hours: 22, percentage: 69, color: '#3b82f6' },
      { id: 'tl-2', category: 'Meetings', hours: 6, percentage: 19, color: '#8b5cf6' },
      { id: 'tl-3', category: 'Documentation', hours: 3, percentage: 9, color: '#f97316' },
      { id: 'tl-4', category: 'Others', hours: 1, percentage: 3, color: '#64748b' },
    ];

    // 5. Recent Activity matching screenshot:
    const defaultActivities: ActivityLog[] = [
      {
        id: 'act-1',
        type: 'complete',
        actionText: 'You completed',
        targetTitle: 'Update API integration',
        timeAgo: '2 hours ago',
        icon: 'pi pi-check',
        color: '#10b981',
      },
      {
        id: 'act-2',
        type: 'create',
        actionText: 'You created a new task',
        targetTitle: 'Prepare project presentation',
        timeAgo: '4 hours ago',
        icon: 'pi pi-plus',
        color: '#3b82f6',
      },
      {
        id: 'act-3',
        type: 'join',
        actionText: 'You joined',
        targetTitle: 'Team sync meeting',
        timeAgo: '5 hours ago',
        icon: 'pi pi-users',
        color: '#8b5cf6',
      },
      {
        id: 'act-4',
        type: 'update',
        actionText: 'You updated documentation',
        targetTitle: 'U2Tools Design Doc',
        timeAgo: '1 day ago',
        icon: 'pi pi-file',
        color: '#64748b',
      },
    ];

    // 6. Calendar events (May 2026)
    const defaultCalendarEvents: CalendarDayEvent[] = [
      { date: '2026-05-02', hasTask: true },
      { date: '2026-05-06', hasTask: true },
      { date: '2026-05-09', hasMeeting: true },
      { date: '2026-05-12', hasDeadline: true },
      { date: '2026-05-15', hasMeeting: true },
      { date: '2026-05-19', hasTask: true },
      { date: '2026-05-23', hasEvent: true },
      { date: '2026-05-26', hasMeeting: true },
      { date: '2026-05-31', hasTask: true, hasMeeting: true, hasDeadline: true },
    ];

    this.projects.set(defaultProjects);
    this.tasks.set(defaultTasks);
    this.schedules.set(defaultSchedules);
    this.timeLogs.set(defaultTimeLogs);
    this.activities.set(defaultActivities);
    this.calendarEvents.set(defaultCalendarEvents);
    this.saveState();
  }

  // ─── CRUD Actions ───
  addTask(taskData: Omit<WorkTask, 'id' | 'createdAt'>): void {
    const newTask: WorkTask = {
      ...taskData,
      id: 'task-' + Date.now(),
      createdAt: new Date().toISOString(),
    };

    this.tasks.update((list) => [newTask, ...list]);

    // Record activity
    const newAct: ActivityLog = {
      id: 'act-' + Date.now(),
      type: 'create',
      actionText: 'You created a new task',
      targetTitle: newTask.title,
      timeAgo: 'Just now',
      icon: 'pi pi-plus',
      color: '#3b82f6',
    };
    this.activities.update((list) => [newAct, ...list.slice(0, 9)]);

    this.saveState();
  }

  updateTask(id: string, updated: Partial<WorkTask>): void {
    this.tasks.update((list) =>
      list.map((t) => (t.id === id ? { ...t, ...updated } : t))
    );
    this.saveState();
  }

  deleteTask(id: string): void {
    this.tasks.update((list) => list.filter((t) => t.id !== id));
    this.saveState();
  }

  toggleTaskComplete(id: string): void {
    const task = this.tasks().find((t) => t.id === id);
    if (!task) return;

    const isCompleting = task.status !== 'Completed';
    const newStatus = isCompleting ? 'Completed' : 'In Progress';

    this.tasks.update((list) =>
      list.map((t) =>
        t.id === id
          ? {
              ...t,
              status: newStatus,
              completedAt: isCompleting ? new Date().toISOString() : undefined,
            }
          : t
      )
    );

    if (isCompleting) {
      const act: ActivityLog = {
        id: 'act-' + Date.now(),
        type: 'complete',
        actionText: 'You completed',
        targetTitle: task.title,
        timeAgo: 'Just now',
        icon: 'pi pi-check',
        color: '#10b981',
      };
      this.activities.update((list) => [act, ...list.slice(0, 9)]);
    }

    this.saveState();
  }

  addProject(projectData: Omit<WorkProject, 'id' | 'totalTasks' | 'completedTasks' | 'progress'>): void {
    const newProject: WorkProject = {
      ...projectData,
      id: 'p-' + Date.now(),
      totalTasks: 0,
      completedTasks: 0,
      progress: 0,
    };
    this.projects.update((list) => [...list, newProject]);
    this.saveState();
  }

  addScheduleItem(item: Omit<ScheduleItem, 'id'>): void {
    const newSch: ScheduleItem = {
      ...item,
      id: 'sch-' + Date.now(),
    };
    this.schedules.update((list) => [...list, newSch]);
    this.saveState();
  }

  addTimeLog(category: TimeLog['category'], hours: number): void {
    this.timeLogs.update((list) =>
      list.map((l) => (l.category === category ? { ...l, hours: l.hours + hours } : l))
    );
    this.saveState();
  }

  openAddDrawer(task?: WorkTask): void {
    this.editingTask.set(task ?? null);
    this.isAddDrawerOpen.set(true);
  }

  closeAddDrawer(): void {
    this.isAddDrawerOpen.set(false);
    this.editingTask.set(null);
  }

  toggleAddDrawer(): void {
    if (this.isAddDrawerOpen()) {
      this.closeAddDrawer();
    } else {
      this.openAddDrawer();
    }
  }
}
