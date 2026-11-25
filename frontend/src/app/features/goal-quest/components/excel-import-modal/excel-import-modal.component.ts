import { Component, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  GoalQuestExcelImportResponse,
  GoalQuestExcelWorkbook,
  ImportMode,
} from '../../models/goal-quest.models';
import { GoalQuestApiService } from '../../services/goal-quest-api.service';
import { GoalQuestExcelService } from '../../services/goal-quest-excel.service';

@Component({
  selector: 'app-gq-excel-import-modal',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="gq-modal-backdrop">
      <div class="gq-modal">
        <div class="gq-modal-header">
          <div>
            <h3>📊 Bulk Excel Import Wizard</h3>
            <p class="subtitle">Validate sheets, preview inserts/updates, and import into GoalQuest.</p>
          </div>
          <button class="icon-close" type="button" (click)="close.emit()">✕</button>
        </div>

        <div class="gq-modal-body">
          <!-- Template Quick Downloads -->
          <div class="template-bar">
            <span class="label">Need a template?</span>
            <div class="template-actions">
              <button type="button" class="btn-ghost" (click)="excel.downloadBlankTemplate()">
                📄 Blank Template
              </button>
              <button type="button" class="btn-ghost" (click)="excel.downloadSampleTemplate()">
                ✨ Sample Template
              </button>
              <button type="button" class="btn-ghost" (click)="excel.downloadTemplateGuide()">
                ℹ️ Template Guide
              </button>
            </div>
          </div>

          <!-- Upload & Mode Selector -->
          <div class="controls-row">
            <label class="file-drop">
              <input type="file" accept=".xlsx,.xls" (change)="onFileSelected($event)" />
              <span class="file-icon">📥</span>
              <span class="file-text">
                {{ selectedFileName() || 'Click to select Excel (.xlsx / .xls) workbook' }}
              </span>
            </label>

            <div class="mode-box">
              <label for="gqImportMode">Import Mode</label>
              <select
                id="gqImportMode"
                [ngModel]="mode()"
                (ngModelChange)="onModeChange($event)"
              >
                <option value="Upsert">Insert + Update (Upsert)</option>
                <option value="InsertOnly">Insert Only (Skip Existing)</option>
                <option value="UpdateOnly">Update Only (Skip New)</option>
              </select>
            </div>
          </div>

          @if (statusError()) {
            <div class="alert-error">{{ statusError() }}</div>
          }

          @if (isProcessing()) {
            <div class="processing-box">Validating workbook sheets and relationships...</div>
          }

          <!-- Preview Summary -->
          @if (preview(); as prev) {
            <div class="preview-stats">
              <div class="stat-pill insert">
                <span class="val">{{ prev.totalInserted }}</span>
                <span class="lbl">To Insert</span>
              </div>
              <div class="stat-pill update">
                <span class="val">{{ prev.totalUpdated }}</span>
                <span class="lbl">To Update</span>
              </div>
              <div class="stat-pill skip">
                <span class="val">{{ prev.totalSkipped }}</span>
                <span class="lbl">To Skip</span>
              </div>
              <div class="stat-pill" [class.error]="prev.totalErrors > 0" [class.ok]="prev.totalErrors === 0">
                <span class="val">{{ prev.totalErrors }}</span>
                <span class="lbl">Validation Errors</span>
              </div>
            </div>

            <div class="table-wrap">
              <table class="gq-table">
                <thead>
                  <tr>
                    <th>Sheet</th>
                    <th>Rows</th>
                    <th>Insert</th>
                    <th>Update</th>
                    <th>Skip</th>
                    <th>Errors</th>
                  </tr>
                </thead>
                <tbody>
                  @for (sheet of prev.sheetSummaries; track sheet.sheetName) {
                    <tr>
                      <td>{{ sheet.sheetName }}</td>
                      <td>{{ sheet.totalRows }}</td>
                      <td class="text-green">{{ sheet.toInsert }}</td>
                      <td class="text-blue">{{ sheet.toUpdate }}</td>
                      <td class="text-muted">{{ sheet.toSkip }}</td>
                      <td [class.text-red]="sheet.errorCount > 0">{{ sheet.errorCount }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>

            @if (prev.errors.length > 0) {
              <div class="errors-section">
                <div class="errors-header">
                  <h4>⚠️ Validation Errors ({{ prev.errors.length }})</h4>
                  <button
                    type="button"
                    class="btn-danger-outline"
                    (click)="excel.downloadErrorReport(prev.errors)"
                  >
                    ⬇️ Download Error Report (.xlsx)
                  </button>
                </div>
                <div class="error-list">
                  @for (err of prev.errors; track $index) {
                    <div class="error-item">
                      <span class="badge">{{ err.sheetName }} · Row {{ err.rowNumber }}</span>
                      <strong>{{ err.column }}:</strong> {{ err.message }}
                    </div>
                  }
                </div>
              </div>
            }
          }
        </div>

        <div class="gq-modal-footer">
          <button type="button" class="btn-secondary" (click)="close.emit()">Cancel</button>
          <button
            type="button"
            class="btn-green"
            [disabled]="!canCommit() || isProcessing()"
            (click)="commitImport()"
          >
            {{ isProcessing() ? 'Importing...' : '✅ Confirm & Save Import' }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .gq-modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(5, 8, 22, 0.78);
        backdrop-filter: blur(8px);
        z-index: 1200;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1rem;
      }
      .gq-modal {
        width: 100%;
        max-width: 820px;
        max-height: 90vh;
        display: flex;
        flex-direction: column;
        background: linear-gradient(160deg, #131b3a 0%, #0b1026 100%);
        border: 1px solid rgba(139, 92, 246, 0.45);
        border-radius: 18px;
        box-shadow: 0 24px 60px rgba(0, 0, 0, 0.6);
        color: #f8fafc;
        overflow: hidden;
      }
      .gq-modal-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        padding: 1.1rem 1.4rem;
        border-bottom: 1px solid rgba(148, 163, 184, 0.16);
      }
      .gq-modal-header h3 {
        margin: 0;
        font-size: 1.2rem;
      }
      .subtitle {
        margin: 0.25rem 0 0;
        color: #94a3b8;
        font-size: 0.85rem;
      }
      .icon-close {
        background: rgba(255, 255, 255, 0.08);
        border: none;
        color: #e2e8f0;
        width: 32px;
        height: 32px;
        border-radius: 8px;
        cursor: pointer;
      }
      .gq-modal-body {
        padding: 1.2rem 1.4rem;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }
      .template-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 0.6rem;
        background: rgba(30, 41, 59, 0.55);
        border: 1px solid rgba(148, 163, 184, 0.18);
        border-radius: 12px;
        padding: 0.65rem 0.9rem;
      }
      .template-bar .label {
        font-size: 0.85rem;
        color: #cbd5e1;
        font-weight: 600;
      }
      .template-actions {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
      }
      .btn-ghost {
        background: rgba(139, 92, 246, 0.16);
        border: 1px solid rgba(139, 92, 246, 0.4);
        color: #e9d5ff;
        padding: 0.4rem 0.75rem;
        border-radius: 8px;
        font-size: 0.8rem;
        cursor: pointer;
      }
      .controls-row {
        display: grid;
        grid-template-columns: 1fr 220px;
        gap: 0.9rem;
      }
      .file-drop {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.85rem 1rem;
        border: 1.5px dashed rgba(52, 211, 153, 0.55);
        border-radius: 12px;
        background: rgba(16, 185, 129, 0.08);
        cursor: pointer;
      }
      .file-drop input {
        display: none;
      }
      .file-text {
        font-size: 0.88rem;
        color: #d1fae5;
      }
      .mode-box {
        display: flex;
        flex-direction: column;
        gap: 0.3rem;
      }
      .mode-box label {
        font-size: 0.78rem;
        color: #94a3b8;
      }
      .mode-box select {
        background: #0f172a;
        border: 1px solid rgba(148, 163, 184, 0.3);
        color: #f8fafc;
        border-radius: 10px;
        padding: 0.6rem 0.75rem;
      }
      .preview-stats {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 0.7rem;
      }
      .stat-pill {
        background: rgba(15, 23, 42, 0.7);
        border: 1px solid rgba(148, 163, 184, 0.2);
        border-radius: 12px;
        padding: 0.7rem;
        text-align: center;
      }
      .stat-pill .val {
        display: block;
        font-size: 1.35rem;
        font-weight: 800;
      }
      .stat-pill .lbl {
        font-size: 0.75rem;
        color: #94a3b8;
      }
      .stat-pill.insert .val {
        color: #34d399;
      }
      .stat-pill.update .val {
        color: #60a5fa;
      }
      .stat-pill.error .val {
        color: #f87171;
      }
      .stat-pill.ok .val {
        color: #4ade80;
      }
      .table-wrap {
        overflow-x: auto;
        border: 1px solid rgba(148, 163, 184, 0.16);
        border-radius: 12px;
      }
      .gq-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.84rem;
      }
      .gq-table th,
      .gq-table td {
        padding: 0.55rem 0.75rem;
        border-bottom: 1px solid rgba(148, 163, 184, 0.12);
        text-align: left;
      }
      .gq-table th {
        background: rgba(30, 41, 59, 0.75);
        color: #cbd5e1;
      }
      .text-green {
        color: #34d399;
        font-weight: 700;
      }
      .text-blue {
        color: #60a5fa;
        font-weight: 700;
      }
      .text-red {
        color: #f87171;
        font-weight: 700;
      }
      .text-muted {
        color: #94a3b8;
      }
      .errors-section {
        background: rgba(127, 29, 29, 0.22);
        border: 1px solid rgba(248, 113, 113, 0.45);
        border-radius: 12px;
        padding: 0.85rem;
      }
      .errors-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.6rem;
      }
      .errors-header h4 {
        margin: 0;
        color: #fca5a5;
      }
      .btn-danger-outline {
        background: rgba(239, 68, 68, 0.2);
        border: 1px solid #f87171;
        color: #fecaca;
        padding: 0.35rem 0.7rem;
        border-radius: 8px;
        font-size: 0.8rem;
        cursor: pointer;
      }
      .error-list {
        max-height: 170px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
      }
      .error-item {
        font-size: 0.8rem;
        color: #fee2e2;
      }
      .error-item .badge {
        display: inline-block;
        background: rgba(239, 68, 68, 0.35);
        padding: 0.1rem 0.45rem;
        border-radius: 6px;
        margin-right: 0.4rem;
        font-weight: 600;
      }
      .alert-error {
        padding: 0.75rem 1rem;
        background: rgba(239, 68, 68, 0.18);
        border: 1px solid rgba(248, 113, 113, 0.5);
        border-radius: 10px;
        color: #fecaca;
        font-size: 0.86rem;
      }
      .processing-box {
        text-align: center;
        padding: 0.8rem;
        color: #93c5fd;
        font-weight: 600;
      }
      .gq-modal-footer {
        display: flex;
        justify-content: flex-end;
        gap: 0.7rem;
        padding: 1rem 1.4rem;
        border-top: 1px solid rgba(148, 163, 184, 0.16);
      }
      .btn-secondary {
        background: rgba(148, 163, 184, 0.16);
        border: 1px solid rgba(148, 163, 184, 0.3);
        color: #e2e8f0;
        padding: 0.55rem 1.1rem;
        border-radius: 10px;
        cursor: pointer;
      }
      .btn-green {
        background: linear-gradient(135deg, #16a34a, #22c55e);
        border: none;
        color: #ffffff;
        font-weight: 700;
        padding: 0.55rem 1.25rem;
        border-radius: 10px;
        cursor: pointer;
      }
      .btn-green:disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }
      @media (max-width: 680px) {
        .controls-row {
          grid-template-columns: 1fr;
        }
        .preview-stats {
          grid-template-columns: repeat(2, 1fr);
        }
      }
    `,
  ],
})
export class ExcelImportModalComponent {
  private readonly api = inject(GoalQuestApiService);
  readonly excel = inject(GoalQuestExcelService);

  readonly close = output<void>();
  readonly imported = output<GoalQuestExcelImportResponse>();

  readonly mode = signal<ImportMode>('Upsert');
  readonly selectedFileName = signal<string>('');
  readonly parsedWorkbook = signal<GoalQuestExcelWorkbook | null>(null);
  readonly preview = signal<GoalQuestExcelImportResponse | null>(null);
  readonly isProcessing = signal(false);
  readonly statusError = signal<string | null>(null);

  canCommit(): boolean {
    const p = this.preview();
    return !!this.parsedWorkbook() && !!p && p.totalErrors === 0;
  }

  async onFileSelected(event: Event): Promise<void> {
    const inputEl = event.target as HTMLInputElement;
    const file = inputEl.files?.[0];
    if (!file) return;

    this.selectedFileName.set(file.name);
    this.statusError.set(null);
    this.isProcessing.set(true);

    try {
      const wb = await this.excel.parseExcelFile(file);
      this.parsedWorkbook.set(wb);
      await this.runDryRun(wb);
    } catch (err: unknown) {
      this.statusError.set(
        (err as { message?: string })?.message ?? 'Failed to parse Excel workbook.',
      );
      this.preview.set(null);
    } finally {
      this.isProcessing.set(false);
    }
  }

  async onModeChange(newMode: ImportMode): Promise<void> {
    this.mode.set(newMode);
    const wb = this.parsedWorkbook();
    if (wb) {
      this.isProcessing.set(true);
      try {
        await this.runDryRun(wb);
      } finally {
        this.isProcessing.set(false);
      }
    }
  }

  private async runDryRun(wb: GoalQuestExcelWorkbook): Promise<void> {
    this.statusError.set(null);
    try {
      const res = await this.api.importExcelData({
        mode: this.mode(),
        dryRun: true,
        workbook: wb,
      });
      this.preview.set(res);
    } catch {
      this.statusError.set(
        'Could not reach the GoalQuest backend API to validate the workbook. Please ensure U2Tools.Api is running.',
      );
    }
  }

  async commitImport(): Promise<void> {
    const wb = this.parsedWorkbook();
    if (!wb || !this.canCommit()) return;

    this.isProcessing.set(true);
    this.statusError.set(null);
    try {
      const res = await this.api.importExcelData({
        mode: this.mode(),
        dryRun: false,
        workbook: wb,
      });
      if (res.success) {
        this.imported.emit(res);
      } else {
        this.preview.set(res);
      }
    } catch {
      this.statusError.set('Import failed while saving to database.');
    } finally {
      this.isProcessing.set(false);
    }
  }
}
