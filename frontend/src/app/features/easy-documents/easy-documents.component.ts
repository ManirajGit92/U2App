import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EasyDocumentsService, DocPage, DocSection } from './easy-documents.service';
import { DocHeaderComponent } from './components/doc-header/doc-header.component';
import { DocSidebarComponent } from './components/doc-sidebar/doc-sidebar.component';
import { DocContentComponent } from './components/doc-content/doc-content.component';

@Component({
  selector: 'app-easy-documents',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DocHeaderComponent,
    DocSidebarComponent,
    DocContentComponent
  ],
  template: `
    <div class="docs-container" [class.dark-mode]="docService.isDarkMode()" [class.has-content]="hasContent()">
      
      <!-- Loading State -->
      <div class="loading-wrapper" *ngIf="docService.isLoading()">
        <div class="loading-card glass-card">
          <div class="spinner"></div>
          <h2>Parsing Excel Workbook...</h2>
          <p>Analyzing sheets, verifying mappings, and validating unique IDs.</p>
        </div>
      </div>

      <!-- Error State -->
      <div class="error-wrapper" *ngIf="!docService.isLoading() && (docService.errorMessage() || docService.parsingErrors().length > 0)">
        <div class="error-card glass-card">
          <div class="error-icon">⚠️</div>
          <h2>Workbook Validation Failed</h2>
          <p class="error-msg">{{ docService.errorMessage() }}</p>
          
          <div class="error-list-container" *ngIf="docService.parsingErrors().length > 0">
            <h4>Errors Found ({{ docService.parsingErrors().length }}):</h4>
            <div class="error-list">
              <div class="error-item" *ngFor="let err of docService.parsingErrors()">• {{ err }}</div>
            </div>
          </div>

          <div class="error-actions">
            <button class="btn btn-primary" (click)="clearErrors()">Retry Upload</button>
            <button class="btn btn-secondary" (click)="docService.loadDefaultContent(); clearErrors()">Reset to Demo</button>
          </div>
        </div>
      </div>

      <!-- Welcome / Setup State -->
      <ng-container *ngIf="!docService.isLoading() && !docService.errorMessage() && docService.parsingErrors().length === 0">
        <div class="upload-wrapper" *ngIf="!hasContent()">
          <div class="upload-card glass-card">
            <div class="upload-icon">📄</div>
            <h2>{{ docService.t('Welcome to Easy Documents') }}</h2>
            <p>{{ docService.t('Select Excel File') }}</p>
            <input type="file" #fileInput (change)="onFileSelected($event)" accept=".xlsx, .xls" hidden>
            <div class="upload-actions">
              <button class="btn btn-primary" (click)="fileInput.click()">
                {{ docService.t('Select Excel File') }}
              </button>
              <button class="btn btn-secondary" (click)="downloadTemplate()">
                {{ docService.t('Download Template') }}
              </button>
            </div>
          </div>
        </div>

        <!-- Document Main View -->
        <ng-container *ngIf="hasContent()">
          <app-doc-header></app-doc-header>
          <div class="docs-layout">
            <app-doc-sidebar></app-doc-sidebar>
            <main class="docs-main">
              <app-doc-content></app-doc-content>
            </main>
          </div>

          <!-- Content Management Floating Action Button -->
          <button class="fab-btn" (click)="openEditor()" title="Manage content and sheets without modifying Excel files">
            ✏️ Content Editor
          </button>
        </ng-container>
      </ng-container>

      <!-- Content Management Modal -->
      <div class="editor-overlay" *ngIf="showEditorModal">
        <div class="editor-modal">
          <div class="editor-header">
            <div>
              <h3>✏️ Easy Content Editor</h3>
              <p class="modal-sub">Create, edit, duplicate, or delete documentation sheets and rows</p>
            </div>
            <button class="close-btn" (click)="confirmClose()">✕</button>
          </div>

          <div class="editor-body">
            <!-- Sheet Manager Row -->
            <div class="editor-section-card">
              <h4>Tabs / Pages Settings</h4>
              <div class="sheet-actions-row">
                <div class="field-wrap">
                  <label>Selected Page</label>
                  <select [(ngModel)]="selectedSheetName" (change)="onSheetSelected()">
                    <option *ngFor="let page of docService.pages()" [value]="page.name">{{ page.name }}</option>
                  </select>
                </div>
                <div class="btn-group">
                  <button class="btn btn-secondary btn-sm" (click)="addPage()">➕ Add Page</button>
                  <button class="btn btn-secondary btn-sm btn-danger-text" (click)="deletePage()">🗑️ Delete Page</button>
                </div>
              </div>
            </div>

            <!-- Sections List & Actions -->
            <div class="editor-split">
              <!-- Left: Section List Selector -->
              <div class="sections-list-panel">
                <div class="section-list-header">
                  <h4>Page Rows / Sections</h4>
                  <button class="btn btn-primary btn-sm" (click)="createNewSection()">➕ Add Row</button>
                </div>
                <div class="section-list-body">
                  <div *ngIf="!selectedSheet?.sections?.length" class="empty-list">No rows on this page.</div>
                  <div 
                    *ngFor="let s of selectedSheet?.sections" 
                    class="section-list-item"
                    [class.active]="selectedSection?.uniqueId === s.uniqueId"
                    (click)="selectSection(s)"
                  >
                    <div class="item-id">{{ s.uniqueId }}</div>
                    <div class="item-title">{{ s.category || s.heading || 'No Heading' }}</div>
                  </div>
                </div>
              </div>

              <!-- Right: Row Form Editor -->
              <div class="section-form-panel">
                <div *ngIf="!selectedSection" class="form-empty-state">
                  👈 Select a row or click "Add Row" to start editing.
                </div>
                
                <div *ngIf="selectedSection" class="form-container">
                  <div class="form-tabs">
                    <button [class.active]="formTab === 'edit'" (click)="formTab = 'edit'">Edit Row Details</button>
                    <button [class.active]="formTab === 'preview'" (click)="formTab = 'preview'">Live Preview</button>
                  </div>

                  <!-- Form Edit fields -->
                  <div class="form-body" *ngIf="formTab === 'edit'">
                    <div class="form-row-grid">
                      <div class="field-wrap">
                        <label>Unique ID *</label>
                        <input type="text" [(ngModel)]="formSection.uniqueId" (ngModelChange)="markDirty()" placeholder="e.g. sec-intro">
                      </div>
                      <div class="field-wrap">
                        <label>Category (Sidebar Header)</label>
                        <input type="text" [(ngModel)]="formSection.category" (ngModelChange)="markDirty()" placeholder="e.g. Overview">
                      </div>
                      <div class="field-wrap">
                        <label>Subcategory (Sidebar Sub-Item)</label>
                        <input type="text" [(ngModel)]="formSection.subcategory" (ngModelChange)="markDirty()" placeholder="e.g. Introduction">
                      </div>
                    </div>

                    <div class="field-wrap">
                      <label>Main Body Content (HTML supported)</label>
                      <textarea [(ngModel)]="formSection.content" (ngModelChange)="markDirty()" rows="8" placeholder="Supports rich text: <b>, <i>, <ul>, etc."></textarea>
                    </div>

                    <div class="form-row-grid">
                      <div class="field-wrap">
                        <label>Image Carousel (comma-separated URLs)</label>
                        <input type="text" [(ngModel)]="formSection.carouselImage" (ngModelChange)="markDirty()" placeholder="https://site.com/img1.jpg,https://site.com/img2.jpg">
                      </div>
                      <div class="field-wrap">
                        <label>Notes / Highlights Card</label>
                        <input type="text" [(ngModel)]="formSection.note" (ngModelChange)="markDirty()" placeholder="[Success] Great work!">
                      </div>
                      <div class="field-wrap">
                        <label>Iframe Media Embed URL</label>
                        <input type="text" [(ngModel)]="formSection.iframe" (ngModelChange)="markDirty()" placeholder="https://www.youtube.com/embed/...">
                      </div>
                    </div>

                    <div class="field-wrap">
                      <label>Code Snippet</label>
                      <textarea class="code-area" [(ngModel)]="formSection.code" (ngModelChange)="markDirty()" rows="8" placeholder="Write code snippet here..."></textarea>
                    </div>
                  </div>

                  <!-- Form Live Preview tab -->
                  <div class="form-body preview-body" *ngIf="formTab === 'preview'">
                    <div class="preview-card">
                      <div class="preview-header">
                        <h4 class="pre-cat">{{ formSection.category || 'No Category' }}</h4>
                        <h5 class="pre-sub">{{ formSection.subcategory || 'No Subcategory' }}</h5>
                      </div>
                      <div class="preview-content" [innerHTML]="formSection.content"></div>
                      <div class="preview-note" *ngIf="formSection.note" style="border-left: 4px solid var(--accent-primary); background: rgba(99, 102, 241, 0.08); padding: 12px; margin-top: 12px; border-radius: 8px;">
                        💡 {{ formSection.note }}
                      </div>
                      <div class="preview-code" *ngIf="formSection.code" style="background: #1e293b; color: white; padding: 12px; font-family: monospace; border-radius: 8px; margin-top: 12px; white-space: pre;">
                        {{ formSection.code }}
                      </div>
                    </div>
                  </div>

                  <div class="form-actions-panel">
                    <button class="btn btn-secondary btn-sm" (click)="duplicateSection()">📋 Duplicate</button>
                    <button class="btn btn-secondary btn-sm btn-danger-text" (click)="deleteSection()">🗑️ Delete</button>
                    <div style="flex: 1;"></div>
                    <button class="btn btn-primary btn-sm" (click)="saveSection()">💾 Save Changes</button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="editor-footer">
            <button class="btn btn-secondary" (click)="confirmClose()">Close Editor</button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .docs-container {
      min-height: 100vh;
      background: var(--bg-surface);
      color: var(--text-primary);
      transition: all 0.3s ease;
      --bg-surface: #f8fafc;
      --bg-card: #ffffff;
      --text-primary: #1e293b;
      --text-secondary: #64748b;
      --border-color: #e2e8f0;
    }

    .docs-container.dark-mode {
      background: #0f172a;
      color: #f1f5f9;
      --bg-surface: #0f172a;
      --bg-card: #1e293b;
      --text-primary: #f1f5f9;
      --text-secondary: #94a3b8;
      --border-color: #1e293b;
    }

    /* Loading states */
    .loading-wrapper, .error-wrapper {
      height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
    }
    .loading-card, .error-card {
      max-width: 550px;
      width: 100%;
      padding: 32px;
      text-align: center;
      display: flex;
      flex-direction: column;
      gap: 20px;
      align-items: center;
      border-radius: 24px;
    }
    .spinner {
      width: 50px;
      height: 50px;
      border: 5px solid rgba(99, 102, 241, 0.15);
      border-top-color: var(--accent-primary, #6366f1);
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    /* Error styles */
    .error-icon {
      font-size: 3rem;
      color: #ef4444;
    }
    .error-msg {
      color: #ef4444;
      font-weight: 600;
    }
    .error-list-container {
      width: 100%;
      text-align: left;
      background: rgba(239, 68, 68, 0.08);
      border-radius: 12px;
      padding: 16px;
      border: 1px solid rgba(239, 68, 68, 0.15);
    }
    .error-list-container h4 {
      margin: 0 0 10px;
      color: #ef4444;
    }
    .error-list {
      max-height: 200px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 6px;
      font-size: 0.88rem;
    }
    .error-item {
      color: var(--text-secondary);
      font-family: monospace;
    }
    .error-actions {
      display: flex;
      gap: 12px;
    }

    /* Welcome / Upload */
    .upload-wrapper {
      height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
    }

    .upload-card {
      max-width: 500px;
      width: 100%;
      padding: 32px;
      text-align: center;
      display: flex;
      flex-direction: column;
      gap: 24px;
      border-radius: 24px;
    }

    .upload-icon {
      font-size: 4.5rem;
    }

    .upload-actions {
      display: flex;
      gap: 16px;
      justify-content: center;
    }

    /* Layout */
    .docs-layout {
      display: flex;
      height: calc(100vh - 64px);
      margin-top: 64px;
      overflow: hidden;
    }

    .docs-main {
      flex: 1;
      overflow-y: auto;
      scroll-behavior: smooth;
      background: var(--bg-surface);
    }

    /* Floating Action Button */
    .fab-btn {
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: var(--accent-primary, #6366f1);
      color: white;
      border: none;
      padding: 14px 22px;
      border-radius: 50px;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 10px 25px rgba(99, 102, 241, 0.4);
      z-index: 999;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .fab-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 12px 30px rgba(99, 102, 241, 0.5);
    }

    /* Content Editor Modal */
    .editor-overlay {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.5);
      backdrop-filter: blur(4px);
      z-index: 2000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
    }
    .editor-modal {
      width: 1400px;
      max-width: 98vw;
      height: 92vh;
      display: flex;
      flex-direction: column;
      border-radius: 28px;
      overflow: hidden;
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 10px 10px -5px rgba(0, 0, 0, 0.1);
    }
    .editor-header {
      padding: 20px 24px;
      border-bottom: 1px solid var(--border-color);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .editor-header h3 {
      margin: 0;
      font-size: 1.4rem;
    }
    .modal-sub {
      margin: 4px 0 0;
      font-size: 0.85rem;
      color: var(--text-secondary);
    }
    .close-btn {
      background: transparent;
      border: none;
      font-size: 1.3rem;
      cursor: pointer;
      color: var(--text-secondary);
    }
    .editor-body {
      flex: 1;
      overflow-y: auto;
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    .editor-section-card {
      background: rgba(148, 163, 184, 0.05);
      border: 1px solid var(--border-color);
      border-radius: 16px;
      padding: 16px;
    }
    .editor-section-card h4, .sections-list-panel h4 {
      margin: 0 0 12px;
      font-size: 0.95rem;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .sheet-actions-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 16px;
      flex-wrap: wrap;
    }
    .field-wrap {
      display: flex;
      flex-direction: column;
      gap: 6px;
      flex: 1;
      min-width: 200px;
    }
    .field-wrap label {
      font-size: 0.82rem;
      font-weight: 600;
      color: var(--text-secondary);
    }
    .field-wrap select, .field-wrap input, .field-wrap textarea {
      padding: 12px 16px;
      border-radius: 10px;
      border: 1px solid var(--border-color);
      background: var(--bg-card);
      color: var(--text-primary);
      outline: none;
      font-size: 1rem;
    }
    .field-wrap select:focus, .field-wrap input:focus, .field-wrap textarea:focus {
      border-color: var(--accent-primary, #6366f1);
    }
    .btn-group {
      display: flex;
      gap: 10px;
    }

    /* Split layout */
    .editor-split {
      display: flex;
      gap: 20px;
      flex: 1;
      min-height: 0;
    }
    .sections-list-panel {
      width: 320px;
      border: 1px solid var(--border-color);
      border-radius: 16px;
      display: flex;
      flex-direction: column;
      background: var(--bg-surface);
    }
    .section-list-header {
      padding: 16px;
      border-bottom: 1px solid var(--border-color);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .section-list-header h4 {
      margin: 0;
    }
    .section-list-body {
      flex: 1;
      overflow-y: auto;
      padding: 8px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-height: 0;
    }
    .section-list-item {
      padding: 10px 14px;
      border-radius: 8px;
      cursor: pointer;
      border: 1px solid transparent;
      transition: all 0.2s;
    }
    .section-list-item:hover {
      background: rgba(148, 163, 184, 0.08);
    }
    .section-list-item.active {
      background: rgba(99, 102, 241, 0.15);
      border-color: rgba(99, 102, 241, 0.3);
      color: var(--accent-primary, #6366f1);
    }
    .item-id {
      font-size: 0.72rem;
      font-family: monospace;
      color: var(--text-secondary);
    }
    .item-title {
      font-size: 0.88rem;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* Section form */
    .section-form-panel {
      flex: 1;
      border: 1px solid var(--border-color);
      border-radius: 16px;
      display: flex;
      flex-direction: column;
      background: var(--bg-surface);
      padding: 16px;
    }
    .form-empty-state {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: var(--text-secondary);
      font-style: italic;
    }
    .form-container {
      display: flex;
      flex-direction: column;
      height: 100%;
      gap: 16px;
    }
    .form-tabs {
      display: flex;
      border-bottom: 1px solid var(--border-color);
      gap: 12px;
    }
    .form-tabs button {
      padding: 8px 16px;
      background: transparent;
      border: none;
      border-bottom: 2px solid transparent;
      color: var(--text-secondary);
      font-weight: 600;
      cursor: pointer;
    }
    .form-tabs button.active {
      border-bottom-color: var(--accent-primary, #6366f1);
      color: var(--accent-primary, #6366f1);
    }
    .form-body {
      flex: 1;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding-right: 4px;
      min-height: 0;
    }
    .form-row-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 12px;
    }
    textarea.code-area {
      font-family: monospace;
      font-size: 0.95rem;
      background: #1e293b !important;
      color: #e2e8f0 !important;
    }
    .form-actions-panel {
      display: flex;
      gap: 8px;
      border-top: 1px solid var(--border-color);
      padding-top: 12px;
    }

    /* Preview tab styling */
    .preview-card {
      padding: 16px;
      border-radius: 12px;
      background: var(--bg-card);
      border: 1px solid var(--border-color);
    }
    .preview-header h4 { margin: 0; font-size: 1.25rem; }
    .preview-header h5 { margin: 4px 0 12px; font-size: 0.9rem; color: var(--text-secondary); }

    .editor-footer {
      padding: 16px 24px;
      border-top: 1px solid var(--border-color);
      display: flex;
      justify-content: flex-end;
    }

    /* General classes */
    .glass-card {
      background: rgba(255, 255, 255, 0.03);
      backdrop-filter: blur(8px);
      border: 1px solid var(--border-color);
      box-shadow: 0 8px 32px rgba(0,0,0,0.1);
    }
    .btn {
      padding: 8px 16px;
      border-radius: 8px;
      border: none;
      cursor: pointer;
      font-weight: 600;
      transition: all 0.2s;
    }
    .btn-sm {
      padding: 6px 12px;
      font-size: 0.8rem;
    }
    .btn-primary {
      background: var(--accent-primary, #6366f1);
      color: white;
    }
    .btn-secondary {
      background: rgba(148, 163, 184, 0.12);
      color: var(--text-primary);
    }
    .btn-secondary:hover {
      background: rgba(148, 163, 184, 0.2);
    }
    .btn-danger-text {
      color: #ef4444;
    }
    .btn-danger-text:hover {
      background: rgba(239, 68, 68, 0.1) !important;
    }

    @media (max-width: 768px) {
      .editor-split {
        flex-direction: column;
      }
      .sections-list-panel {
        width: 100%;
        max-height: 180px;
      }
      .editor-modal {
        height: 95vh;
      }
      .docs-layout {
        flex-direction: column;
        height: auto;
        min-height: calc(100vh - 64px);
        overflow: visible;
      }
      .docs-main {
        min-height: calc(100vh - 128px);
      }
    }
  `]
})
export class EasyDocumentsComponent {
  docService = inject(EasyDocumentsService);

  // Editor states
  showEditorModal = false;
  selectedSheetName = '';
  selectedSheet: DocPage | null = null;
  selectedSection: DocSection | null = null;
  formSection: DocSection = this.blankSection();
  formTab: 'edit' | 'preview' = 'edit';
  isDirty = false;

  hasContent() {
    return this.docService.pages().length > 0;
  }

  async onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      await this.docService.parseExcel(file);
    }
  }

  downloadTemplate() {
    this.docService.downloadTemplate();
  }

  clearErrors() {
    this.docService.errorMessage.set(null);
    this.docService.parsingErrors.set([]);
  }

  // --- Content Management UI logic ---
  openEditor() {
    this.selectedSheetName = this.docService.pages()[this.docService.currentPageIndex()]?.name || '';
    this.onSheetSelected();
    this.selectedSection = null;
    this.showEditorModal = true;
    this.isDirty = false;
    this.formTab = 'edit';
  }

  onSheetSelected() {
    this.selectedSheet = this.docService.pages().find(p => p.name === this.selectedSheetName) || null;
    this.selectedSection = null;
  }

  selectSection(sec: DocSection) {
    if (this.isDirty) {
      if (!confirm('Unsaved changes will be discarded. Continue?')) {
        return;
      }
    }
    this.selectedSection = sec;
    this.formSection = { ...sec };
    this.isDirty = false;
    this.formTab = 'edit';
  }

  blankSection(): DocSection {
    return {
      id: '',
      uniqueId: '',
      category: '',
      subcategory: '',
      content: '',
      carouselImage: '',
      code: '',
      note: '',
      iframe: ''
    };
  }

  createNewSection() {
    if (this.isDirty) {
      if (!confirm('Discard unsaved changes?')) {
        return;
      }
    }
    const newId = 'row-' + Math.floor(Math.random() * 10000);
    this.selectedSection = { id: newId, uniqueId: newId, content: '' };
    this.formSection = {
      id: newId,
      uniqueId: newId,
      category: '',
      subcategory: '',
      content: '',
      carouselImage: '',
      code: '',
      note: '',
      iframe: ''
    };
    this.isDirty = true;
    this.formTab = 'edit';
  }

  saveSection() {
    if (!this.selectedSheet) return;
    const uniqId = this.formSection.uniqueId.trim();
    if (!uniqId) {
      alert('Unique ID is required!');
      return;
    }

    // Verify uniqueness of uniqueId
    const duplicate = this.selectedSheet.sections.find(
      s => s.uniqueId.toLowerCase() === uniqId.toLowerCase() && s.id !== this.formSection.id
    );
    if (duplicate) {
      alert(`The Unique ID "${uniqId}" is already used by another row on this page!`);
      return;
    }

    // Sync legacy parameters
    const updated: DocSection = {
      ...this.formSection,
      heading: this.formSection.category,
      subheading: this.formSection.subcategory,
      codeBlock: this.formSection.code,
      notes: this.formSection.note,
      mediaUrl: this.formSection.iframe
    };

    const sections = [...this.selectedSheet.sections];
    const idx = sections.findIndex(s => s.id === updated.id);
    if (idx >= 0) {
      sections[idx] = updated;
    } else {
      sections.push(updated);
    }

    this.selectedSheet.sections = sections;
    this.docService.pages.set([...this.docService.pages()]);
    this.docService.filteredPages.set([...this.docService.pages()]);
    this.docService.saveLocalState();
    this.docService.syncToFirebase();
    this.selectedSection = updated;
    this.isDirty = false;
    alert('Row saved successfully.');
  }

  duplicateSection() {
    if (!this.selectedSection || !this.selectedSheet) return;
    const dupId = 'row-' + Math.floor(Math.random() * 10000);
    const duplicated: DocSection = {
      ...this.formSection,
      id: dupId,
      uniqueId: dupId + '-copy'
    };
    const sections = [...this.selectedSheet.sections];
    const idx = sections.findIndex(s => s.id === this.selectedSection!.id);
    if (idx >= 0) {
      sections.splice(idx + 1, 0, duplicated);
    } else {
      sections.push(duplicated);
    }
    this.selectedSheet.sections = sections;
    this.docService.pages.set([...this.docService.pages()]);
    this.docService.filteredPages.set([...this.docService.pages()]);
    this.docService.saveLocalState();
    this.docService.syncToFirebase();
    this.selectedSection = duplicated;
    this.formSection = { ...duplicated };
    this.isDirty = false;
    alert('Row duplicated successfully.');
  }

  deleteSection() {
    if (!this.selectedSection || !this.selectedSheet) return;
    if (!confirm('Are you sure you want to delete this row?')) return;

    const sections = this.selectedSheet.sections.filter(s => s.id !== this.selectedSection!.id);
    this.selectedSheet.sections = sections;
    this.docService.pages.set([...this.docService.pages()]);
    this.docService.filteredPages.set([...this.docService.pages()]);
    this.docService.saveLocalState();
    this.docService.syncToFirebase();
    this.selectedSection = null;
    this.isDirty = false;
    alert('Row deleted successfully.');
  }

  addPage() {
    const newName = prompt('Enter new page/tab name:');
    if (!newName || !newName.trim()) return;
    
    const duplicate = this.docService.pages().find(p => p.name.toLowerCase() === newName.toLowerCase().trim());
    if (duplicate) {
      alert('A page with this name already exists.');
      return;
    }

    const newPage: DocPage = {
      name: newName.trim(),
      sections: []
    };
    this.docService.pages.set([...this.docService.pages(), newPage]);
    this.docService.filteredPages.set([...this.docService.pages()]);
    this.docService.currentPageIndex.set(this.docService.pages().length - 1);
    this.selectedSheetName = newPage.name;
    this.onSheetSelected();
    this.docService.saveLocalState();
    this.docService.syncToFirebase();
  }

  deletePage() {
    if (!this.selectedSheet) return;
    if (this.docService.pages().length <= 1) {
      alert('Documentation must have at least one page.');
      return;
    }
    if (!confirm(`Delete page "${this.selectedSheetName}"? This will delete all rows on this page.`)) {
      return;
    }
    const idx = this.docService.pages().findIndex(p => p.name === this.selectedSheetName);
    const filtered = this.docService.pages().filter(p => p.name !== this.selectedSheetName);
    this.docService.pages.set(filtered);
    this.docService.filteredPages.set(filtered);
    this.docService.currentPageIndex.set(Math.max(0, idx - 1));
    this.selectedSheetName = this.docService.pages()[this.docService.currentPageIndex()].name;
    this.onSheetSelected();
    this.docService.saveLocalState();
    this.docService.syncToFirebase();
  }

  markDirty() {
    this.isDirty = true;
  }

  confirmClose() {
    if (this.isDirty) {
      if (!confirm('You have unsaved changes. Discard them and close?')) {
        return;
      }
    }
    this.showEditorModal = false;
  }
}
