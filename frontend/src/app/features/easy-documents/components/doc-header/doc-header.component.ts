import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EasyDocumentsService } from '../../easy-documents.service';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-doc-header',
  standalone: true,
  imports: [RouterLink],
  template: `
    <header class="doc-header glass-card">
      <div class="header-left">
        <button class="hamburger-btn" (click)="docService.toggleSidebarMobile()">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 6h16M4 12h16M4 18h16"/>
          </svg>
        </button>
        <a routerLink="/" class="back-link">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M19 12H5m0 0l7-7m-7 7l7 7"/>
          </svg>
        </a>
        <h1 class="doc-title">{{ docService.config()?.title || docService.t('Documentation') }}</h1>
        
        <nav class="page-tabs desktop-only">
          @for (page of docService.filteredPages(); track page.name; let i = $index) {
            <button class="tab-btn" 
              [class.active]="docService.currentPageIndex() === i"
              (click)="docService.currentPageIndex.set(i)">
              {{ page.name }}
            </button>
          }
        </nav>
      </div>

      <div class="header-right">
        <div class="search-container">
          <input type="text" [placeholder]="docService.t('Search...')" (input)="onSearch($event)">
          <span class="search-icon">🔍</span>
        </div>

        <button class="icon-btn" (click)="docService.toggleLanguage()">
          {{ docService.currentLanguage() === 'en' ? 'EN' : 'TA' }}
        </button>

        <button class="icon-btn" (click)="docService.toggleDarkMode()">
          {{ docService.isDarkMode() ? '☀️' : '🌙' }}
        </button>

        <div class="export-dropdown">
          <button class="btn btn-secondary btn-sm" (click)="triggerUpload()">
            {{ docService.t('Upload 📤') }}
          </button>
          <button class="btn btn-secondary btn-sm" (click)="showExportDropdown = !showExportDropdown">
            {{ docService.t('Export ⬇️') }}
          </button>
          @if (showExportDropdown) {
            <div class="dropdown-menu">
              <button (click)="exportPDF()">{{ docService.t('PDF') }}</button>
              <button (click)="exportWord()">{{ docService.t('Word') }}</button>
            </div>
          }
        </div>
      </div>
    </header>
  `,
  styles: [`
    .doc-header {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      height: 64px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 24px;
      z-index: 1000;
      border-radius: 0;
      border-bottom: 1px solid var(--border-color);
      backdrop-filter: blur(10px);
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 20px;
    }

    .back-link {
      color: var(--text-secondary);
      transition: color 0.2s;
    }

    .back-link:hover {
      color: var(--accent-primary);
    }

    .doc-title {
      font-size: 1.25rem;
      font-weight: 700;
      margin: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 200px;
    }

    .hamburger-btn {
      display: none;
      background: transparent;
      border: none;
      color: var(--text-primary);
      cursor: pointer;
      padding: 8px;
    }

    .page-tabs {
      display: flex;
      gap: 8px;
    }

    .tab-btn {
      padding: 6px 16px;
      padding-bottom: 5px;
      border-radius: 8px;
      border: none;
      background: transparent;
      color: var(--text-secondary);
      cursor: pointer;
      font-weight: 500;
      transition: all 0.2s;
    }

    .tab-btn.active {
      background: var(--accent-surface);
      color: var(--accent-primary);
    }

    .header-right {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .search-container {
      position: relative;
    }

    .search-container input {
      padding: 8px 32px 8px 12px;
      border-radius: 8px;
      border: 1px solid var(--border-color);
      background: var(--bg-surface);
      color: var(--text-primary);
      width: 200px;
    }

    .search-icon {
      position: absolute;
      right: 12px;
      top: 50%;
      transform: translateY(-50%);
      font-size: 0.8rem;
    }

    .icon-btn {
      background: transparent;
      border: none;
      font-size: 1.1rem;
      cursor: pointer;
      padding: 8px;
      border-radius: 8px;
      transition: background 0.2s;
    }

    .icon-btn:hover {
      background: var(--accent-surface);
    }

    .export-dropdown {
      position: relative;
    }

    .dropdown-menu {
      position: absolute;
      top: 100%;
      right: 0;
      margin-top: 8px;
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      box-shadow: var(--shadow-xl);
      padding: 8px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 120px;
    }

    .dropdown-menu button {
      padding: 8px 12px;
      border-radius: 6px;
      border: none;
      background: transparent;
      color: var(--text-primary);
      cursor: pointer;
      text-align: left;
    }

    .dropdown-menu button:hover {
      background: var(--accent-surface);
    }

    @media (max-width: 1024px) {
      .desktop-only {
        display: none !important;
      }
      .hamburger-btn {
        display: block;
      }
      .search-container input {
        width: 120px;
      }
    }

    @media (max-width: 640px) {
      .doc-header {
        padding: 0 12px;
      }
      .btn-sm {
        padding: 4px 8px;
        font-size: 0.7rem;
      }
      .search-container {
        display: none;
      }
    }
  `]
})
export class DocHeaderComponent {
  docService = inject(EasyDocumentsService);
  showExportDropdown = false;

  onSearch(event: any) {
    this.docService.setSearchQuery(event.target.value);
  }

  triggerUpload() {
    // We'll use a hidden input in the main component, but we can also just 
    // emit an event or use the service to trigger a file picker if we had one.
    // For now, let's just use a simple approach: provide a way to reset.
    if (confirm('Upload a new Excel file? Current content will be replaced.')) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.xlsx';
        input.onchange = (e: any) => {
            const file = e.target.files[0];
            if (file) {
                this.docService.parseExcel(file);
            }
        };
        input.click();
    }
  }

  exportPDF() {
    this.showExportDropdown = false;
    this.docService.exportToPDF();
  }

  exportWord() {
    this.showExportDropdown = false;
    this.docService.exportToWord();
  }
}
