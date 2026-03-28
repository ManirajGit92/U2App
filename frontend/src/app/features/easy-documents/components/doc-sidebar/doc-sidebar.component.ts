import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EasyDocumentsService } from '../../easy-documents.service';

@Component({
  selector: 'app-doc-sidebar',
  standalone: true,
  imports: [],
  template: `
    <aside class="doc-sidebar glass-card" 
      [class.collapsed]="isCollapsed"
      [class.mobile-open]="docService.isSidebarOpenMobile()">
      <div class="sidebar-header">
        <span class="icon">📁</span>
        <span class="title">{{ docService.t('Navigation') }}</span>
        <button class="collapse-btn" (click)="isCollapsed = !isCollapsed">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            @if (!isCollapsed) {
              <path d="M15 19l-7-7 7-7"/>
            } @else {
              <path d="M9 5l7 7-7 7"/>
            }
          </svg>
        </button>
      </div>

      @if (currentPage()) {
        @if (!isCollapsed || docService.isSidebarOpenMobile()) {
          <div class="sidebar-content">
            <div class="tree-view">
              @for (section of currentPage().sections; track section.id) {
                <div class="tree-item" 
                  [class.active]="activeSectionId === section.id"
                  (click)="scrollTo(section.id)">
                  <div class="item-line">
                    <span class="dot"></span>
                    <span class="item-text">{{ section.heading || section.subheading }}</span>
                  </div>
                </div>
              }
            </div>
          </div>
        }
      }
    </aside>

    @if (docService.isSidebarOpenMobile()) {
      <div class="sidebar-backdrop" (click)="docService.toggleSidebarMobile()"></div>
    }
  `,
  styles: [`
    .doc-sidebar {
      width: 280px;
      height: 100%;
      border-radius: 0;
      border-right: 1px solid var(--border-color);
      display: flex;
      flex-direction: column;
      transition: width 0.3s ease;
      background: var(--bg-surface);
    }

    .doc-sidebar.collapsed {
      width: 60px;
    }

    .sidebar-header {
      padding: 24px;
      display: flex;
      align-items: center;
      gap: 12px;
      border-bottom: 1px solid var(--border-color);
    }

    .sidebar-header .icon {
      font-size: 1.2rem;
    }

    .sidebar-header .title {
      font-weight: 700;
      font-size: 1rem;
      flex: 1;
      white-space: nowrap;
      overflow: hidden;
    }

    .collapse-btn {
      background: transparent;
      border: none;
      cursor: pointer;
      padding: 4px;
      border-radius: 4px;
      color: var(--text-secondary);
      transition: background 0.2s;
    }

    .collapse-btn:hover {
      background: var(--accent-surface);
    }

    .sidebar-content {
      flex: 1;
      overflow-y: auto;
      padding: 16px 0;
    }

    .tree-view {
      display: flex;
      flex-direction: column;
    }

    .tree-item {
      padding: 10px 24px;
      cursor: pointer;
      color: var(--text-secondary);
      font-size: 0.9rem;
      transition: all 0.2s;
      border-left: 2px solid transparent;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .tree-item:hover {
      background: var(--accent-surface);
      color: var(--text-primary);
    }

    .tree-item.active {
      color: var(--accent-primary);
      background: var(--accent-surface);
      border-left-color: var(--accent-primary);
      font-weight: 600;
    }

    .item-line {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--border-color);
      flex-shrink: 0;
    }

    .tree-item.active .dot {
      background: var(--accent-primary);
    }

    .sidebar-backdrop {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.5);
      backdrop-filter: blur(4px);
      z-index: 999;
    }

    @media (max-width: 1024px) {
      .doc-sidebar {
        position: fixed;
        left: -280px;
        top: 64px;
        bottom: 0;
        z-index: 1001;
        background: var(--bg-surface);
        width: 280px !important;
      }
      .doc-sidebar.mobile-open {
        left: 0;
      }
      .sidebar-backdrop {
        display: block;
      }
      .collapse-btn {
        display: none;
      }
    }
  `]
})
export class DocSidebarComponent {
  docService = inject(EasyDocumentsService);
  isCollapsed = false;
  activeSectionId: string | null = null;

  currentPage(): any {
    return this.docService.filteredPages()[this.docService.currentPageIndex()];
  }

  scrollTo(id: string) {
    this.activeSectionId = id;
    if (window.innerWidth <= 1024) {
      this.docService.isSidebarOpenMobile.set(false);
    }
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
}
