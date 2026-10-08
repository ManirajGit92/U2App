import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EasyDocumentsService } from '../../easy-documents.service';
import { ThemeService } from '../../../../core/services/theme.service';

interface SectionLink {
  id: string;
  title: string;
}

interface SubcategoryGroup {
  name: string;
  sections: SectionLink[];
}

interface CategoryGroup {
  name: string;
  subcategories: SubcategoryGroup[];
  sections: SectionLink[];
}

interface NavTree {
  rootSections: SectionLink[];
  categories: CategoryGroup[];
}

@Component({
  selector: 'app-doc-sidebar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <aside class="doc-sidebar glass-card" 
      [class.collapsed]="isCollapsed"
      [class.theme-jarvis]="themeService.isJarvis()"
      [class.mobile-open]="docService.isSidebarOpenMobile()">
      <div class="sidebar-header">
        <span class="icon">📁</span>
        <span class="title">{{ docService.t('Navigation') }}</span>
        <button class="collapse-btn" (click)="isCollapsed = !isCollapsed">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path *ngIf="!isCollapsed" d="M15 19l-7-7 7-7"/>
            <path *ngIf="isCollapsed" d="M9 5l7 7-7 7"/>
          </svg>
        </button>
      </div>

      <div class="sidebar-content" *ngIf="!isCollapsed || docService.isSidebarOpenMobile()">
        <div class="tree-view" *ngIf="currentPage()">
          
          <!-- Root Sections (No Category) -->
          <div *ngFor="let s of navTree.rootSections" 
            class="tree-item root-item" 
            [class.active]="activeSectionId === s.id"
            (click)="scrollTo(s.id)"
          >
            <span class="dot"></span>
            <span class="item-text">{{ s.title }}</span>
          </div>

          <!-- Categories -->
          <div *ngFor="let cat of navTree.categories" class="category-group">
            <div class="group-header" (click)="toggleCategory(cat.name)">
              <span class="arrow" [class.open]="expandedCategories[cat.name]">▸</span>
              <span class="icon">📁</span>
              <span class="group-title-text">{{ cat.name }}</span>
            </div>

            <!-- Category Body -->
            <div class="group-body" *ngIf="expandedCategories[cat.name]">
              
              <!-- Direct Category Sections (No Subcategory) -->
              <div *ngFor="let s of cat.sections" 
                class="tree-item cat-item" 
                [class.active]="activeSectionId === s.id"
                (click)="scrollTo(s.id)"
              >
                <span class="dot"></span>
                <span class="item-text">{{ s.title }}</span>
              </div>

              <!-- Subcategories -->
              <div *ngFor="let sub of cat.subcategories" class="subcategory-group">
                <div class="sub-header" (click)="toggleSubcategory(cat.name, sub.name)">
                  <span class="arrow" [class.open]="expandedSubcategories[cat.name + '-' + sub.name]">▸</span>
                  <span class="icon">📄</span>
                  <span class="sub-title-text">{{ sub.name }}</span>
                </div>

                <!-- Subcategory Sections -->
                <div class="sub-body" *ngIf="expandedSubcategories[cat.name + '-' + sub.name]">
                  <div *ngFor="let s of sub.sections" 
                    class="tree-item sub-item" 
                    [class.active]="activeSectionId === s.id"
                    (click)="scrollTo(s.id)"
                  >
                    <span class="dot"></span>
                    <span class="item-text">{{ s.title }}</span>
                  </div>
                </div>

              </div>
            </div>
          </div>

          <!-- Holographic HUD Radar / Gyroscope Widget for JARVIS theme -->
          <div class="hud-sidebar-radar" *ngIf="themeService.isJarvis() && !isCollapsed">
            <svg viewBox="0 0 160 160" class="hud-radar-svg">
              <circle cx="80" cy="80" r="72" stroke="rgba(0, 210, 255, 0.22)" stroke-width="1.5" stroke-dasharray="4 8" class="spin-slow" />
              <circle cx="80" cy="80" r="62" stroke="#00d2ff" stroke-width="1" opacity="0.35" />
              <circle cx="80" cy="80" r="46" stroke="rgba(0, 210, 255, 0.3)" stroke-width="1" stroke-dasharray="8 6" class="spin-reverse" />
              <circle cx="80" cy="80" r="28" stroke="#00d2ff" stroke-width="1.5" opacity="0.6" />
              
              <!-- Crosshair axes -->
              <line x1="80" y1="8" x2="80" y2="152" stroke="rgba(0, 210, 255, 0.4)" stroke-width="1" stroke-dasharray="4 4" />
              <line x1="8" y1="80" x2="152" y2="80" stroke="rgba(0, 210, 255, 0.4)" stroke-width="1" stroke-dasharray="4 4" />
              
              <!-- 3D Globe latitude & longitude orbital wireframe -->
              <ellipse cx="80" cy="80" rx="58" ry="24" stroke="rgba(0, 210, 255, 0.55)" stroke-width="1.2" fill="none" class="spin-globe-lat" />
              <ellipse cx="80" cy="80" rx="24" ry="58" stroke="rgba(0, 210, 255, 0.4)" stroke-width="1.2" fill="none" />
              
              <!-- Center glowing pulse -->
              <circle cx="80" cy="80" r="5" fill="#00d2ff" class="hud-pulse" />
              
              <!-- Amber tech telemetry marks from screenshot -->
              <circle cx="18" cy="80" r="3.5" fill="#f59e0b" />
              <circle cx="80" cy="142" r="3.5" fill="#f59e0b" />
            </svg>
            <div class="hud-radar-telemetry">
              <span class="tele-tag">NAV.HUD // ONLINE</span>
              <span class="tele-val">99.8% SYNC</span>
            </div>
          </div>
        </div>
      </div>
    </aside>

    <div class="sidebar-backdrop" *ngIf="docService.isSidebarOpenMobile()" (click)="docService.toggleSidebarMobile()"></div>
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
      flex-shrink: 0;
    }

    /* JARVIS Sidebar Styles */
    .doc-sidebar.theme-jarvis {
      border: 1.5px solid #00d2ff !important;
      border-radius: 14px !important;
      box-shadow: 0 0 20px rgba(0, 210, 255, 0.32), inset 0 0 20px rgba(0, 210, 255, 0.05) !important;
      background: rgba(2, 14, 32, 0.92) !important;
      backdrop-filter: blur(14px) !important;
    }

    .doc-sidebar.theme-jarvis .sidebar-header {
      border-bottom: 1px solid rgba(0, 210, 255, 0.25);
    }

    .doc-sidebar.theme-jarvis .sidebar-header .title {
      font-family: 'Orbitron', var(--font-family);
      font-weight: 700;
      letter-spacing: 0.05em;
      color: #ffffff;
      text-shadow: 0 0 10px rgba(0, 210, 255, 0.5);
    }

    .doc-sidebar.theme-jarvis .collapse-btn {
      color: #00d2ff;
      border-radius: 8px;
      transition: all 0.2s;
    }

    .doc-sidebar.theme-jarvis .collapse-btn:hover {
      background: rgba(0, 210, 255, 0.15);
      box-shadow: 0 0 10px rgba(0, 210, 255, 0.4);
    }

    .doc-sidebar.theme-jarvis .tree-item.active {
      border: 1.5px solid #00d2ff !important;
      background: rgba(0, 210, 255, 0.16) !important;
      box-shadow: 0 0 14px rgba(0, 210, 255, 0.45) !important;
      border-radius: 20px !important;
      color: #ffffff !important;
      font-weight: 600;
    }

    .doc-sidebar.theme-jarvis .tree-item.active .dot {
      background: #00d2ff !important;
      box-shadow: 0 0 8px #00d2ff, 0 0 16px #00d2ff !important;
      width: 7px !important;
      height: 7px !important;
      border-radius: 50% !important;
    }

    .doc-sidebar.theme-jarvis .group-title-text,
    .doc-sidebar.theme-jarvis .sub-title-text,
    .doc-sidebar.theme-jarvis .item-text {
      color: #c8eeff;
      transition: color 0.2s;
    }

    .doc-sidebar.theme-jarvis .tree-item:hover {
      background: rgba(0, 210, 255, 0.08);
      color: #ffffff;
    }

    /* Holographic Radar Widget */
    .hud-sidebar-radar {
      margin-top: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      border-top: 1px solid rgba(0, 210, 255, 0.2);
      background: rgba(0, 15, 35, 0.5);
      border-bottom-left-radius: 14px;
      border-bottom-right-radius: 14px;
    }

    .hud-radar-svg {
      width: 130px;
      height: 130px;
      filter: drop-shadow(0 0 8px rgba(0, 210, 255, 0.4));
    }

    .hud-radar-telemetry {
      display: flex;
      justify-content: space-between;
      width: 100%;
      font-family: 'Orbitron', monospace;
      font-size: 0.68rem;
      color: rgba(0, 210, 255, 0.75);
      letter-spacing: 0.08em;
    }

    .tele-status, .tele-val {
      color: #38bdf8;
      font-weight: 700;
    }

    @keyframes spinLinear {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    @keyframes spinReverse {
      from { transform: rotate(360deg); }
      to { transform: rotate(0deg); }
    }

    @keyframes pulseReticle {
      0%, 100% { opacity: 0.8; transform: scale(1); }
      50% { opacity: 0.3; transform: scale(1.4); }
    }

    .spin-slow {
      transform-origin: 80px 80px;
      animation: spinLinear 24s linear infinite;
    }

    .spin-reverse {
      transform-origin: 80px 80px;
      animation: spinReverse 16s linear infinite;
    }

    .spin-globe-lat {
      transform-origin: 80px 80px;
      animation: spinLinear 30s linear infinite;
    }

    .hud-pulse {
      animation: pulseReticle 2s ease-in-out infinite;
      transform-origin: 80px 80px;
    }

    .doc-sidebar.collapsed {
      width: 60px;
    }

    .sidebar-header {
      padding: 16px;
      display: flex;
      align-items: center;
      gap: 12px;
      border-bottom: 1px solid var(--border-color);
      height: 64px;
      box-sizing: border-box;
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
      padding: 12px 0;
    }

    .tree-view {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    /* Tree items styling */
    .tree-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 16px;
      cursor: pointer;
      color: var(--text-secondary);
      font-size: 0.88rem;
      transition: all 0.2s;
      border-left: 3px solid transparent;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .tree-item:hover {
      background: var(--accent-surface);
      color: var(--text-primary);
    }
    .tree-item.active {
      color: var(--accent-primary, #6366f1);
      background: rgba(99, 102, 241, 0.08);
      border-left-color: var(--accent-primary, #6366f1);
      font-weight: 600;
    }

    /* Nested indentations */
    .root-item { padding-left: 20px; }
    .cat-item { padding-left: 32px; }
    .sub-item { padding-left: 44px; }

    .dot {
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: var(--border-color);
      flex-shrink: 0;
    }
    .tree-item.active .dot {
      background: var(--accent-primary, #6366f1);
    }

    /* Groups */
    .category-group, .subcategory-group {
      display: flex;
      flex-direction: column;
    }
    .group-header, .sub-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      cursor: pointer;
      font-size: 0.88rem;
      font-weight: 600;
      color: var(--text-primary);
      transition: background 0.2s;
    }
    .group-header:hover, .sub-header:hover {
      background: var(--accent-surface);
    }
    .group-header { padding-left: 16px; }
    .sub-header { padding-left: 28px; }

    .group-title-text, .sub-title-text {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      flex: 1;
    }

    .arrow {
      font-size: 0.65rem;
      color: var(--text-secondary);
      transition: transform 0.2s;
      display: inline-block;
      width: 10px;
    }
    .arrow.open {
      transform: rotate(90deg);
    }

    .sidebar-backdrop {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.4);
      backdrop-filter: blur(2px);
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
export class DocSidebarComponent implements OnInit, OnDestroy {
  docService = inject(EasyDocumentsService);
  themeService = inject(ThemeService);
  isCollapsed = false;
  activeSectionId: string | null = null;

  expandedCategories: Record<string, boolean> = {};
  expandedSubcategories: Record<string, boolean> = {};

  ngOnInit() {
    this.handleHashLink();
    window.addEventListener('hashchange', this.onHashChange);
    window.addEventListener('scroll', this.onScroll, { passive: true });
  }

  ngOnDestroy() {
    window.removeEventListener('hashchange', this.onHashChange);
    window.removeEventListener('scroll', this.onScroll);
  }

  onHashChange = () => {
    this.handleHashLink();
  };

  handleHashLink() {
    const hash = window.location.hash;
    if (!hash) return;
    const targetId = hash.replace(/^#/, '');
    if (!targetId) return;

    const pages = this.docService.pages();
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      const hasSection = page.sections.some(s => s.uniqueId === targetId);
      if (hasSection) {
        this.docService.currentPageIndex.set(i);
        this.activeSectionId = targetId;
        this.autoExpandParents(targetId);
        
        setTimeout(() => {
          const element = document.getElementById(targetId);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 150);
        break;
      }
    }
  }

  currentPage(): any {
    return this.docService.filteredPages()[this.docService.currentPageIndex()];
  }

  get navTree(): NavTree {
    const page = this.currentPage();
    if (!page || !page.sections) {
      return { rootSections: [], categories: [] };
    }

    const categoriesMap = new Map<string, { subcategories: Map<string, SectionLink[]>; sections: SectionLink[] }>();
    const rootSections: SectionLink[] = [];

    page.sections.forEach((s: any) => {
      const cat = s.category?.trim();
      const subcat = s.subcategory?.trim();
      const link: SectionLink = {
        id: s.uniqueId,
        title: s.heading || s.subheading || s.uniqueId
      };

      if (!cat) {
        rootSections.push(link);
      } else {
        if (!categoriesMap.has(cat)) {
          categoriesMap.set(cat, { subcategories: new Map(), sections: [] });
        }
        const group = categoriesMap.get(cat)!;
        if (!subcat) {
          group.sections.push(link);
        } else {
          if (!group.subcategories.has(subcat)) {
            group.subcategories.set(subcat, []);
          }
          group.subcategories.get(subcat)!.push(link);
        }
      }
    });

    const categories: CategoryGroup[] = [];
    categoriesMap.forEach((val, key) => {
      const subcategories: SubcategoryGroup[] = [];
      val.subcategories.forEach((sections, name) => {
        subcategories.push({ name, sections });
      });
      categories.push({
        name: key,
        subcategories,
        sections: val.sections
      });
    });

    return { rootSections, categories };
  }

  toggleCategory(name: string) {
    this.expandedCategories[name] = !this.expandedCategories[name];
  }

  toggleSubcategory(catName: string, subName: string) {
    const key = catName + '-' + subName;
    this.expandedSubcategories[key] = !this.expandedSubcategories[key];
  }

  scrollTo(id: string) {
    this.activeSectionId = id;
    if (window.innerWidth <= 1024) {
      this.docService.isSidebarOpenMobile.set(false);
    }
    window.location.hash = id;
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  autoExpandParents(sectionId: string) {
    const tree = this.navTree;
    for (const cat of tree.categories) {
      if (cat.sections.some(s => s.id === sectionId)) {
        this.expandedCategories[cat.name] = true;
        return;
      }
      for (const sub of cat.subcategories) {
        if (sub.sections.some(s => s.id === sectionId)) {
          this.expandedCategories[cat.name] = true;
          this.expandedSubcategories[cat.name + '-' + sub.name] = true;
          return;
        }
      }
    }
  }

  onScroll = () => {
    const page = this.currentPage();
    if (!page || !page.sections) return;

    let currentActiveId: string | null = null;
    const scrollPosition = window.scrollY + 100;

    for (const section of page.sections) {
      const el = document.getElementById(section.uniqueId);
      if (el) {
        const top = el.offsetTop;
        const height = el.offsetHeight;
        if (scrollPosition >= top && scrollPosition < top + height) {
          currentActiveId = section.uniqueId;
          break;
        }
      }
    }

    if (currentActiveId && currentActiveId !== this.activeSectionId) {
      this.activeSectionId = currentActiveId;
      this.autoExpandParents(currentActiveId);
    }
  };
}
