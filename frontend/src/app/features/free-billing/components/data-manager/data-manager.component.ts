import { Component, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BillingExcelService } from '../../services/billing-excel.service';
import { BillingStateService } from '../../services/billing-state.service';

@Component({
  selector: 'app-data-manager',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="data-manager-card">
      <div class="actions-grid">
        <!-- Download Template -->
        <div class="action-card">
          <div class="icon">📥</div>
          <h3>Download Template</h3>
          <p>Get a fresh Excel template schema ready to be filled with products, customers, and historical data.</p>
          <button class="btn btn-secondary" (click)="downloadTemplate()">Download Template</button>
        </div>

        <!-- Upload Data -->
        <div class="action-card">
          <div class="icon">📤</div>
          <h3>Upload Data Hub</h3>
          <p>Upload a filled Excel database to initialize or overwrite the application state.</p>
          <button class="btn btn-primary" (click)="fileInput.click()">Upload Excel File</button>
          <input type="file" #fileInput [hidden]="true" (change)="onFileChange($event)" accept=".xlsx, .xls">
        </div>

        <!-- Export Data -->
        <div class="action-card">
          <div class="icon">💾</div>
          <h3>Backup / Export</h3>
          <p>Export all the current products, invoices, and customers back into an Excel sheet.</p>
          <button class="btn btn-primary" (click)="exportData()">Export Current Data</button>
        </div>

        <!-- Clear Memory -->
        <div class="action-card danger">
          <div class="icon text-danger">⚠️</div>
          <h3>Danger Zone</h3>
          <p>Clear all local in-memory billing data. Ensure you have exported a backup first!</p>
          <button class="btn btn-danger" (click)="clearData()">Wipe Local Data</button>
        </div>
      </div>
      
      <div *ngIf="message" class="status-msg" [class.error]="isError">
        {{ message }}
      </div>
    </div>
  `,
  styles: [`
    .actions-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 24px;
      margin-bottom: 24px;
    }
    .action-card {
      background: var(--surface-card);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      padding: 32px 24px;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
    }
    .action-card.danger {
      border-color: rgba(239, 68, 68, 0.4);
    }
    .icon {
      font-size: 3rem;
    }
    .action-card h3 {
      margin: 0;
      font-size: 1.25rem;
    }
    .action-card p {
      color: var(--text-secondary);
      font-size: 0.95rem;
      margin-bottom: auto;
    }
    .btn {
      width: 100%;
    }
    .btn-danger {
      background: rgba(239, 68, 68, 0.1);
      color: #ef4444;
      border: 1px solid rgba(239, 68, 68, 0.3);
      padding: 8px 16px;
      border-radius: var(--radius-md);
      cursor: pointer;
      font-weight: 500;
    }
    .btn-danger:hover {
      background: rgba(239, 68, 68, 0.2);
    }
    .status-msg {
      padding: 16px;
      border-radius: var(--radius-md);
      background: rgba(16, 185, 129, 0.1);
      color: #10b981;
      text-align: center;
      font-weight: 500;
    }
    .status-msg.error {
      background: rgba(239, 68, 68, 0.1);
      color: #ef4444;
    }
  `]
})
export class DataManagerComponent {
  @ViewChild('fileInput') fileInput!: ElementRef;
  message = '';
  isError = false;

  constructor(
    private excelServ: BillingExcelService,
    private state: BillingStateService
  ) {}

  downloadTemplate() {
    this.excelServ.generateTemplate();
    this.showMessage('Template downloaded successfully.', false);
  }

  async onFileChange(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const data = await this.excelServ.parseExcelFile(file);
      this.state.initializeData(data);
      this.showMessage('Data successfully loaded from Excel!', false);
    } catch (e: any) {
      this.showMessage(e.toString(), true);
    }
    this.fileInput.nativeElement.value = '';
  }

  exportData() {
    const data = this.state.getExportData();
    this.excelServ.exportData(data);
    this.showMessage('Exported current state successfully.', false);
  }

  clearData() {
    if (confirm('Are you absolutely sure you want to wipe local data? This cannot be undone without a backup.')) {
      this.state.clearData();
      this.showMessage('Data wiped.', false);
    }
  }

  private showMessage(msg: string, isErr: boolean) {
    this.message = msg;
    this.isError = isErr;
    setTimeout(() => this.message = '', 5000);
  }
}
