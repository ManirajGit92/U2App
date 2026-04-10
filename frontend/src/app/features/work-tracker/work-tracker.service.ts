import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import * as XLSX from 'xlsx';

export interface DeveloperTask {
  taskId: string;
  week: string;
  resourceName: string;
  projectName: string;
  module: string;
  taskTitle: string;
  taskDescription: string;
  taskType: string;
  status: string;
  priority: string;
  size: string;
  startDate: string;
  dueDate: string;
  completedDate: string;
  progress: number;
  tags: string;
  comments: string;
  isVisible?: boolean;
}

export interface ReleaseTrack {
  id: string;
  title: string;
  category: string;
  module: string;
  type: string;
  priority: string;
  status: string;
  prdStatus: string;
  assignedTo: string;
  createdDate: string;
  targetDate: string;
  completedDate: string;
  progress: number;
  remarks: string;
  sourceSheet: string;
  dependency: string;
  tags: string;
  isVisible?: boolean;
}

export type HourlyUpdateStatus = 'Completed' | 'In Progress' | 'Pending';

export interface HourlyWorkUpdate {
  id: string;
  date: string;
  hour: string;
  taskDescription: string;
  status: HourlyUpdateStatus;
  isVisible?: boolean;
}

export interface WorkTrackerData {
  developerTasks: DeveloperTask[];
  releaseTracks: ReleaseTrack[];
  hourlyUpdates: HourlyWorkUpdate[];
  storageMode: 'local' | 'google-sheets';
}

@Injectable({
  providedIn: 'root'
})
export class WorkTrackerService {
  private initialState: WorkTrackerData = {
    developerTasks: [
      {
        taskId: 'T-001', week: 'W1', resourceName: 'Alice Smith', projectName: 'E-Commerce', module: 'Auth',
        taskTitle: 'Implement OAuth', taskDescription: 'Add Google login', taskType: 'Feature', status: 'In Progress',
        priority: 'High', size: 'M', startDate: '2026-03-20', dueDate: '2026-03-25', completedDate: '',
        progress: 50, tags: 'backend, auth', comments: '', isVisible: true
      },
      {
        taskId: 'T-002', week: 'W1', resourceName: 'Bob Jones', projectName: 'E-Commerce', module: 'Cart',
        taskTitle: 'Fix cart bug', taskDescription: 'Items drop on refresh', taskType: 'Bug', status: 'Blocked',
        priority: 'Critical', size: 'S', startDate: '2026-03-21', dueDate: '2026-03-22', completedDate: '',
        progress: 10, tags: 'frontend, bug', comments: 'Waiting on API changes', isVisible: true
      },
      {
        taskId: 'T-003', week: 'W1', resourceName: 'Charlie Day', projectName: 'Internal Tool', module: 'Dashboard',
        taskTitle: 'Create filters', taskDescription: 'Add UI for data filtering', taskType: 'Feature', status: 'Completed',
        priority: 'Medium', size: 'L', startDate: '2026-03-15', dueDate: '2026-03-19', completedDate: '2026-03-18',
        progress: 100, tags: 'ui', comments: 'Done early', isVisible: true
      }
    ],
    releaseTracks: [
      {
        id: 'R-100', title: 'User Authentication', category: 'Core', module: 'Auth', type: 'Feature',
        priority: 'High', status: 'Released', prdStatus: 'Approved', assignedTo: 'Alice Smith',
        createdDate: '2026-01-10', targetDate: '2026-02-15', completedDate: '2026-02-14',
        progress: 100, remarks: 'Deployed successfully', sourceSheet: 'Sheet 1', dependency: 'None', tags: 'security', isVisible: true
      },
      {
        id: 'R-101', title: 'Payment Gateway', category: 'Integration', module: 'Billing', type: 'Feature',
        priority: 'Critical', status: 'Staging', prdStatus: 'Approved', assignedTo: 'Bob Jones',
        createdDate: '2026-02-20', targetDate: '2026-03-30', completedDate: '',
        progress: 85, remarks: 'Final testing', sourceSheet: 'Sheet 1', dependency: 'Auth', tags: 'billing', isVisible: true
      },
      {
        id: 'R-102', title: 'New Landing Page', category: 'UI/UX', module: 'Frontpage', type: 'Enhancement',
        priority: 'Medium', status: 'Testing', prdStatus: 'In Review', assignedTo: 'Charlie Day',
        createdDate: '2026-03-01', targetDate: '2026-04-05', completedDate: '',
        progress: 60, remarks: 'A/B testing soon', sourceSheet: 'Sheet 1', dependency: 'None', tags: 'marketing', isVisible: true
      },
      {
        id: 'R-103', title: 'Analytics Dashboard', category: 'Reporting', module: 'Dashboard', type: 'Feature',
        priority: 'Low', status: 'Development', prdStatus: 'Draft', assignedTo: 'Alice Smith',
        createdDate: '2026-03-10', targetDate: '2026-05-20', completedDate: '',
        progress: 20, remarks: 'Initial setup', sourceSheet: 'Sheet 1', dependency: 'DB Upgrade', tags: 'data', isVisible: true
      }
    ],
    hourlyUpdates: [
      {
        id: 'HU-001',
        date: '2026-03-20',
        hour: '09:00',
        taskDescription: 'OAuth provider callback validation',
        status: 'Completed',
        isVisible: true
      },
      {
        id: 'HU-002',
        date: '2026-03-20',
        hour: '11:00',
        taskDescription: 'Cart refresh defect reproduction',
        status: 'In Progress',
        isVisible: true
      },
      {
        id: 'HU-003',
        date: '2026-03-21',
        hour: '14:00',
        taskDescription: 'Dashboard filter polish',
        status: 'Pending',
        isVisible: true
      }
    ],
    storageMode: 'local'
  };

  private dataSubject = new BehaviorSubject<WorkTrackerData>(this.initialState);
  public data$: Observable<WorkTrackerData> = this.dataSubject.asObservable();

  constructor() { }

  updateData(newData: Partial<WorkTrackerData>) {
    this.dataSubject.next({ ...this.dataSubject.value, ...newData });
  }

  addDeveloperTask(task: Omit<DeveloperTask, 'taskId'> & { taskId?: string }) {
    const developerTasks = [
      ...this.dataSubject.value.developerTasks,
      {
        ...task,
        taskId: task.taskId?.trim() || this.createId('T', this.dataSubject.value.developerTasks.length + 1),
        isVisible: task.isVisible ?? true
      }
    ];
    this.updateData({ developerTasks });
  }

  updateDeveloperTask(taskId: string, changes: Partial<DeveloperTask>) {
    const developerTasks = this.dataSubject.value.developerTasks.map(task =>
      task.taskId === taskId ? { ...task, ...changes, taskId } : task
    );
    this.updateData({ developerTasks });
  }

  deleteDeveloperTask(taskId: string) {
    const developerTasks = this.dataSubject.value.developerTasks.filter(task => task.taskId !== taskId);
    this.updateData({ developerTasks });
  }

  toggleDeveloperTaskVisibility(taskId: string) {
    const developerTasks = this.dataSubject.value.developerTasks.map(task =>
      task.taskId === taskId ? { ...task, isVisible: !(task.isVisible ?? true) } : task
    );
    this.updateData({ developerTasks });
  }

  addReleaseTrack(track: Omit<ReleaseTrack, 'id'> & { id?: string }) {
    const releaseTracks = [
      ...this.dataSubject.value.releaseTracks,
      {
        ...track,
        id: track.id?.trim() || this.createId('R', this.dataSubject.value.releaseTracks.length + 100),
        isVisible: track.isVisible ?? true
      }
    ];
    this.updateData({ releaseTracks });
  }

  updateReleaseTrack(id: string, changes: Partial<ReleaseTrack>) {
    const releaseTracks = this.dataSubject.value.releaseTracks.map(track =>
      track.id === id ? { ...track, ...changes, id } : track
    );
    this.updateData({ releaseTracks });
  }

  deleteReleaseTrack(id: string) {
    const releaseTracks = this.dataSubject.value.releaseTracks.filter(track => track.id !== id);
    this.updateData({ releaseTracks });
  }

  toggleReleaseTrackVisibility(id: string) {
    const releaseTracks = this.dataSubject.value.releaseTracks.map(track =>
      track.id === id ? { ...track, isVisible: !(track.isVisible ?? true) } : track
    );
    this.updateData({ releaseTracks });
  }

  addHourlyUpdate(update: Omit<HourlyWorkUpdate, 'id'> & { id?: string }) {
    const hourlyUpdates = [
      ...this.dataSubject.value.hourlyUpdates,
      {
        ...update,
        id: update.id?.trim() || this.createId('HU', this.dataSubject.value.hourlyUpdates.length + 1),
        isVisible: update.isVisible ?? true
      }
    ];
    this.updateData({ hourlyUpdates });
  }

  updateHourlyUpdate(id: string, changes: Partial<HourlyWorkUpdate>) {
    const hourlyUpdates = this.dataSubject.value.hourlyUpdates.map(update =>
      update.id === id ? { ...update, ...changes, id } : update
    );
    this.updateData({ hourlyUpdates });
  }

  deleteHourlyUpdate(id: string) {
    const hourlyUpdates = this.dataSubject.value.hourlyUpdates.filter(update => update.id !== id);
    this.updateData({ hourlyUpdates });
  }

  toggleHourlyUpdateVisibility(id: string) {
    const hourlyUpdates = this.dataSubject.value.hourlyUpdates.map(update =>
      update.id === id ? { ...update, isVisible: !(update.isVisible ?? true) } : update
    );
    this.updateData({ hourlyUpdates });
  }

  setStorageMode(mode: 'local' | 'google-sheets') {
    this.updateData({ storageMode: mode });
  }

  processLocalUpload(file: File): Promise<void> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          
          // Parse Developer Tasks
          const devSheetName = workbook.SheetNames[0];
          const devWorksheet = workbook.Sheets[devSheetName];
          const devData: any[] = XLSX.utils.sheet_to_json(devWorksheet);
          
          const developerTasks: DeveloperTask[] = devData.map(row => ({
            taskId: row['Task_ID'] || '',
            week: row['Week'] || '',
            resourceName: row['Resource_Name'] || '',
            projectName: row['Project_Name'] || '',
            module: row['Module'] || '',
            taskTitle: row['Task_Title'] || '',
            taskDescription: row['Task_Description'] || '',
            taskType: row['Task_Type'] || '',
            status: row['Status'] || 'Unknown',
            priority: row['Priority'] || '',
            size: row['Size'] || '',
            startDate: row['Start_Date'] || '',
            dueDate: row['Due_Date'] || '',
            completedDate: row['Completed_Date'] || '',
            progress: Number(row['Progress_%']) || 0,
            tags: row['Tags'] || '',
            comments: row['Comments'] || '',
            isVisible: row['Visible'] === undefined ? true : String(row['Visible']).toLowerCase() !== 'false'
          }));

          // Parse Release Track
          let releaseTracks = this.dataSubject.value.releaseTracks;
          if (workbook.SheetNames.length > 1) {
            const releaseSheetName = workbook.SheetNames[1];
            const releaseWorksheet = workbook.Sheets[releaseSheetName];
            const releaseData: any[] = XLSX.utils.sheet_to_json(releaseWorksheet);
            
            releaseTracks = releaseData.map(row => ({
              id: row['ID'] || '',
              title: row['Title'] || '',
              category: row['Category'] || '',
              module: row['Module'] || '',
              type: row['Type'] || '',
              priority: row['Priority'] || '',
              status: row['Status'] || 'Development',
              prdStatus: row['PRD Status'] || '',
              assignedTo: row['Assigned To'] || '',
              createdDate: row['Created Date'] || '',
              targetDate: row['Target Date'] || '',
              completedDate: row['Completed Date'] || '',
              progress: Number(row['Progress %']) || 0,
              remarks: row['Remarks'] || '',
              sourceSheet: row['Source Sheet'] || '',
              dependency: row['Dependency'] || '',
              tags: row['Tags'] || '',
              isVisible: row['Visible'] === undefined ? true : String(row['Visible']).toLowerCase() !== 'false'
            }));
          }

          let hourlyUpdates = this.dataSubject.value.hourlyUpdates;
          if (workbook.SheetNames.length > 2) {
            const hourlySheetName = workbook.SheetNames[2];
            const hourlyWorksheet = workbook.Sheets[hourlySheetName];
            const hourlyData: any[] = XLSX.utils.sheet_to_json(hourlyWorksheet);

            hourlyUpdates = hourlyData.map((row, index) => ({
              id: row['ID'] || this.createId('HU', index + 1),
              date: row['Date'] || '',
              hour: row['Hour'] || '',
              taskDescription: row['Task Description'] || '',
              status: row['Status'] || 'Pending',
              isVisible: row['Visible'] === undefined ? true : String(row['Visible']).toLowerCase() !== 'false'
            }));
          }

          this.updateData({ developerTasks, releaseTracks, hourlyUpdates });
          resolve();
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = (error) => reject(error);
      reader.readAsArrayBuffer(file);
    });
  }

  downloadTemplate(): void {
    const currentData = this.dataSubject.value;
    
    // Create Developer Tasks Sheet
    const devSheetData = currentData.developerTasks.map(task => ({
      'Task_ID': task.taskId,
      'Week': task.week,
      'Resource_Name': task.resourceName,
      'Project_Name': task.projectName,
      'Module': task.module,
      'Task_Title': task.taskTitle,
      'Task_Description': task.taskDescription,
      'Task_Type': task.taskType,
      'Status': task.status,
      'Priority': task.priority,
      'Size': task.size,
      'Start_Date': task.startDate,
      'Due_Date': task.dueDate,
      'Completed_Date': task.completedDate,
      'Progress_%': task.progress,
      'Tags': task.tags,
      'Comments': task.comments,
      'Visible': task.isVisible ?? true
    }));
    const devWs = XLSX.utils.json_to_sheet(devSheetData);

    // Create Release Sheet
    const releaseSheetData = currentData.releaseTracks.map(track => ({
      'ID': track.id,
      'Title': track.title,
      'Category': track.category,
      'Module': track.module,
      'Type': track.type,
      'Priority': track.priority,
      'Status': track.status,
      'PRD Status': track.prdStatus,
      'Assigned To': track.assignedTo,
      'Created Date': track.createdDate,
      'Target Date': track.targetDate,
      'Completed Date': track.completedDate,
      'Progress %': track.progress,
      'Remarks': track.remarks,
      'Source Sheet': track.sourceSheet,
      'Dependency': track.dependency,
      'Tags': track.tags,
      'Visible': track.isVisible ?? true
    }));
    const releaseWs = XLSX.utils.json_to_sheet(releaseSheetData);

    const hourlySheetData = currentData.hourlyUpdates.map(update => ({
      'ID': update.id,
      'Date': update.date,
      'Hour': update.hour,
      'Task Description': update.taskDescription,
      'Status': update.status,
      'Visible': update.isVisible ?? true
    }));
    const hourlyWs = XLSX.utils.json_to_sheet(hourlySheetData);

    // Build Workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, devWs, 'Developer Tasks');
    XLSX.utils.book_append_sheet(wb, releaseWs, 'Releases');
    XLSX.utils.book_append_sheet(wb, hourlyWs, 'Hourly Updates');

    // Save
    XLSX.writeFile(wb, 'WorkTracker_Template.xlsx');
  }

  private createId(prefix: string, seed: number): string {
    const existingIds = new Set([
      ...this.dataSubject.value.developerTasks.map(task => task.taskId),
      ...this.dataSubject.value.releaseTracks.map(track => track.id),
      ...this.dataSubject.value.hourlyUpdates.map(update => update.id)
    ]);
    let next = seed;
    let candidate = `${prefix}-${String(next).padStart(3, '0')}`;
    while (existingIds.has(candidate)) {
      next++;
      candidate = `${prefix}-${String(next).padStart(3, '0')}`;
    }
    return candidate;
  }
}
