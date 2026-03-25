import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WorkTrackerService } from '../work-tracker.service';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Component({
  selector: 'app-data-manager',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="manager-container">
      <div class="glass-card settings-panel">
        <h2>Storage Settings</h2>
        <div class="toggle-container">
          <button 
            [class.active]="(storageMode$ | async) === 'local'" 
            (click)="setStorageMode('local')">
            <span class="icon">📁</span> Local Worksheet
          </button>
          <button 
            [class.active]="(storageMode$ | async) === 'google-sheets'" 
            (click)="setStorageMode('google-sheets')">
            <span class="icon">📊</span> Google Sheets
          </button>
        </div>
        <p class="helper-text" *ngIf="(storageMode$ | async) === 'local'">
          Data is stored and managed via local .xlsx files. Download the template, fill it out, and upload to update the dashboard.
        </p>
        <p class="helper-text" *ngIf="(storageMode$ | async) === 'google-sheets'">
          Google Sheets integration is currently in mock mode. You can view the dashboard with mock data, but fully sync requires OAuth setup which is coming soon.
        </p>
      </div>

      <div class="glass-card action-panel" *ngIf="(storageMode$ | async) === 'local'">
        <h2>Worksheet Operations</h2>
        <div class="action-buttons">
          <button class="btn-primary" (click)="downloadTemplate()">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            Download Template (.xlsx)
          </button>

          <div class="upload-wrapper">
            <input type="file" id="fileUpload" accept=".xlsx, .xls" (change)="onFileChange($event)" #fileInput hidden>
            <button class="btn-secondary" (click)="fileInput.click()">
              <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="17 8 12 3 7 8"></polyline>
                <line x1="12" y1="3" x2="12" y2="15"></line>
              </svg>
              Upload Filled Template
            </button>
          </div>
        </div>
        <div class="upload-status" *ngIf="uploadMessage" [ngClass]="uploadStatus">
          {{ uploadMessage }}
        </div>
      </div>
    </div>
  `,
  styles: [`
    .manager-container {
      display: grid;
      grid-template-columns: 1fr;
      gap: 2rem;
      max-width: 800px;
      margin: 0 auto;
    }

    .glass-card {
      background: rgba(255, 255, 255, 0.4);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border-radius: 20px;
      padding: 2.5rem;
      border: 1px solid rgba(255, 255, 255, 0.3);
      box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.1);
    }

    h2 {
      margin-top: 0;
      margin-bottom: 2rem;
      color: #1a202c;
      font-size: 1.5rem;
    }

    .toggle-container {
      display: flex;
      gap: 1rem;
      margin-bottom: 1.5rem;
    }

    .toggle-container button {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.8rem;
      padding: 1rem;
      border: 2px solid transparent;
      border-radius: 12px;
      background: rgba(255,255,255,0.6);
      font-size: 1.1rem;
      font-weight: 600;
      color: #4a5568;
      cursor: pointer;
      transition: all 0.3s ease;
    }

    .toggle-container button:hover {
      background: rgba(255,255,255,0.8);
      transform: translateY(-2px);
    }

    .toggle-container button.active {
      background: #eff6ff;
      border-color: #3b82f6;
      color: #1d4ed8;
      box-shadow: 0 4px 14px rgba(59, 130, 246, 0.2);
    }

    .helper-text {
      color: #718096;
      font-size: 0.95rem;
      line-height: 1.6;
      padding: 1rem;
      background: rgba(255,255,255,0.3);
      border-radius: 8px;
    }

    .action-buttons {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .btn-primary, .btn-secondary {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.8rem;
      width: 100%;
      padding: 1.2rem;
      border: none;
      border-radius: 12px;
      font-size: 1.1rem;
      font-weight: 600;
      color: white;
      cursor: pointer;
      transition: all 0.3s ease;
    }

    .btn-primary {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      box-shadow: 0 4px 15px rgba(118, 75, 162, 0.4);
    }

    .btn-primary:hover {
      box-shadow: 0 6px 20px rgba(118, 75, 162, 0.6);
      transform: translateY(-2px);
    }

    .btn-secondary {
      background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
      box-shadow: 0 4px 15px rgba(0, 242, 254, 0.4);
    }

    .btn-secondary:hover {
      box-shadow: 0 6px 20px rgba(0, 242, 254, 0.6);
      transform: translateY(-2px);
    }

    .upload-status {
      margin-top: 1.5rem;
      padding: 1rem;
      border-radius: 8px;
      text-align: center;
      font-weight: 500;
      animation: fadeIn 0.3s ease;
    }

    .upload-status.success {
      background: #c6f6d5;
      color: #22543d;
    }

    .upload-status.error {
      background: #fed7d7;
      color: #822727;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(-5px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `]
})
export class DataManagerComponent implements OnInit {
  workTrackerService = inject(WorkTrackerService);
  
  storageMode$!: Observable<'local' | 'google-sheets'>;
  
  uploadMessage = '';
  uploadStatus: 'success' | 'error' = 'success';

  ngOnInit() {
    this.storageMode$ = this.workTrackerService.data$.pipe(
      map(data => data.storageMode)
    );
  }

  setStorageMode(mode: 'local' | 'google-sheets') {
    this.workTrackerService.setStorageMode(mode);
    this.uploadMessage = '';
  }

  downloadTemplate() {
    this.workTrackerService.downloadTemplate();
  }

  async onFileChange(event: any) {
    const file = event.target.files[0];
    if (file) {
      try {
        await this.workTrackerService.processLocalUpload(file);
        this.uploadStatus = 'success';
        this.uploadMessage = 'Worksheet processed successfully! Dashboard has been updated.';
        // Reset file input
        event.target.value = '';
      } catch (error) {
        this.uploadStatus = 'error';
        this.uploadMessage = 'Error parsing the worksheet. Please ensure you are using the downloaded template structure.';
        console.error(error);
      }
      
      setTimeout(() => {
        this.uploadMessage = '';
      }, 5000);
    }
  }
}
