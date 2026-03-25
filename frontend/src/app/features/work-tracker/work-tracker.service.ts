import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import * as XLSX from 'xlsx';

export interface DeveloperStatus {
  name: string;
  status: string;
  tasksCompleted: number;
  totalTasks: number;
}

export interface ReleaseTrack {
  feature: string;
  stage: 'Development' | 'Testing' | 'Staging' | 'Released';
  progress: number;
}

export interface WorkTrackerData {
  developerStatuses: DeveloperStatus[];
  releaseTracks: ReleaseTrack[];
  storageMode: 'local' | 'google-sheets';
}

@Injectable({
  providedIn: 'root'
})
export class WorkTrackerService {
  private initialState: WorkTrackerData = {
    developerStatuses: [
      { name: 'Alice Smith', status: 'On Track', tasksCompleted: 8, totalTasks: 10 },
      { name: 'Bob Jones', status: 'Blocked', tasksCompleted: 3, totalTasks: 12 },
      { name: 'Charlie Day', status: 'Ahead', tasksCompleted: 15, totalTasks: 15 }
    ],
    releaseTracks: [
      { feature: 'User Authentication', stage: 'Released', progress: 100 },
      { feature: 'Payment Gateway', stage: 'Staging', progress: 85 },
      { feature: 'New Landing Page', stage: 'Testing', progress: 60 },
      { feature: 'Analytics Dashboard', stage: 'Development', progress: 20 }
    ],
    storageMode: 'local'
  };

  private dataSubject = new BehaviorSubject<WorkTrackerData>(this.initialState);
  public data$: Observable<WorkTrackerData> = this.dataSubject.asObservable();

  constructor() { }

  updateData(newData: Partial<WorkTrackerData>) {
    this.dataSubject.next({ ...this.dataSubject.value, ...newData });
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
          
          // Parse Developer Status
          const devSheetName = workbook.SheetNames[0];
          const devWorksheet = workbook.Sheets[devSheetName];
          const devData: any[] = XLSX.utils.sheet_to_json(devWorksheet);
          
          const developerStatuses: DeveloperStatus[] = devData.map(row => ({
            name: row.Name || 'Unknown',
            status: row.Status || 'Unknown',
            tasksCompleted: Number(row.TasksCompleted) || 0,
            totalTasks: Number(row.TotalTasks) || 0
          }));

          // Parse Release Track
          const releaseSheetName = workbook.SheetNames[1];
          const releaseWorksheet = workbook.Sheets[releaseSheetName];
          const releaseData: any[] = XLSX.utils.sheet_to_json(releaseWorksheet);
          
          const releaseTracks: ReleaseTrack[] = releaseData.map(row => ({
            feature: row.Feature || 'Unknown',
            stage: row.Stage || 'Development',
            progress: Number(row.Progress) || 0
          }));

          this.updateData({ developerStatuses, releaseTracks });
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
    
    // Create Developer Sheet
    const devSheetData = currentData.developerStatuses.map(dev => ({
      Name: dev.name,
      Status: dev.status,
      TasksCompleted: dev.tasksCompleted,
      TotalTasks: dev.totalTasks
    }));
    const devWs = XLSX.utils.json_to_sheet(devSheetData);

    // Create Release Sheet
    const releaseSheetData = currentData.releaseTracks.map(track => ({
      Feature: track.feature,
      Stage: track.stage,
      Progress: track.progress
    }));
    const releaseWs = XLSX.utils.json_to_sheet(releaseSheetData);

    // Build Workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, devWs, 'Developers');
    XLSX.utils.book_append_sheet(wb, releaseWs, 'Releases');

    // Save
    XLSX.writeFile(wb, 'WorkTracker_Template.xlsx');
  }
}
