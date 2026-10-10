export type TaskPriority = 'Low' | 'Medium' | 'High' | 'Urgent';
export type TaskStatus = 'Not Started' | 'In Progress' | 'Completed' | 'Blocked';
export type WorkItemType = 'task' | 'project' | 'meeting' | 'timeLog';

export interface WorkTask {
  id: string;
  title: string;
  description?: string;
  projectId: string;
  projectName: string;
  category: string;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: string; // YYYY-MM-DD
  dueDateLabel?: string; // 'Today', 'Tomorrow', 'Jun 2', etc.
  estimatedHours: number;
  actualHours?: number;
  tags: string[];
  assignee: {
    name: string;
    avatar?: string;
  };
  hasReminder: boolean;
  reminderDateTime?: string;
  createdAt: string;
  completedAt?: string;
}

export interface WorkProject {
  id: string;
  name: string;
  color: string;
  icon: string;
  totalTasks: number;
  completedTasks: number;
  progress: number; // 0 - 100
  category?: string;
}

export interface ScheduleItem {
  id: string;
  timeStart: string;
  timeEnd: string;
  title: string;
  subtitle: string;
  type: 'meeting' | 'work' | 'client' | 'docs' | 'planning';
  icon: string;
  color: string;
  date: string;
}

export interface TimeLog {
  id: string;
  taskId?: string;
  category: 'Focused Work' | 'Meetings' | 'Documentation' | 'Others';
  hours: number;
  percentage: number;
  color: string;
}

export interface ActivityLog {
  id: string;
  type: 'complete' | 'create' | 'join' | 'update';
  actionText: string;
  targetTitle: string;
  timeAgo: string;
  icon: string;
  color: string;
}

export interface CalendarDayEvent {
  date: string; // YYYY-MM-DD
  hasTask?: boolean;
  hasMeeting?: boolean;
  hasDeadline?: boolean;
  hasEvent?: boolean;
}

export interface ProductivityMetric {
  title: string;
  value: string;
  trend: string;
  trendPositive: boolean;
  icon: string;
  color: string;
}
