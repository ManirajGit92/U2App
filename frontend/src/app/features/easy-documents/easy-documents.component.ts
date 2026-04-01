import { Component, inject } from '@angular/core';
import { EasyDocumentsService } from './easy-documents.service';
import { DocHeaderComponent } from './components/doc-header/doc-header.component';
import { DocSidebarComponent } from './components/doc-sidebar/doc-sidebar.component';
import { DocContentComponent } from './components/doc-content/doc-content.component';

@Component({
  selector: 'app-easy-documents',
  standalone: true,
  imports: [
    DocHeaderComponent,
    DocSidebarComponent,
    DocContentComponent
  ],
  template: `
    <div class="docs-container" [class.dark-mode]="docService.isDarkMode()" [class.has-content]="hasContent()">
      @if (!hasContent()) {
        <div class="upload-wrapper">
          <div class="upload-card glass-card">
            <div class="upload-icon">📄</div>
            <h2>{{ docService.t('Welcome to Easy Documents') }}</h2>
            <p>{{ docService.t('Select Excel File') }}</p>
            <input type="file" #fileInput (change)="onFileSelected($event)" accept=".xlsx" hidden>
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
      } @else {
        <app-doc-header></app-doc-header>
        <div class="docs-layout">
          <app-doc-sidebar></app-doc-sidebar>
          <main class="docs-main">
            <app-doc-content></app-doc-content>
          </main>
        </div>
      }
    </div>
  `,
  styles: [`
    .docs-container {
      min-height: 100vh;
      background: var(--bg-surface);
      color: var(--text-primary);
      transition: all 0.3s ease;
    }

    .docs-container.dark-mode {
      background: #0f172a;
      color: #f1f5f9;
      --bg-surface: #0f172a;
      --text-primary: #f1f5f9;
      --text-secondary: #94a3b8;
      --border-color: #1e293b;
    }

    .upload-wrapper {
      height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }

    .upload-card {
      max-width: 500px;
      width: 100%;
      padding: 48px;
      text-align: center;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .upload-icon {
      font-size: 4rem;
      margin-bottom: 8px;
    }

    .upload-actions {
      display: flex;
      gap: 12px;
      justify-content: center;
      margin-top: 16px;
    }

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

    @media (max-width: 768px) {
      .upload-card {
        padding: 28px 20px;
      }

      .upload-actions {
        flex-direction: column;
      }

      .upload-actions .btn {
        width: 100%;
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
}
