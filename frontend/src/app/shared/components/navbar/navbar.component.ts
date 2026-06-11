import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { combineLatest } from 'rxjs';
import { ThemeService } from '../../../core/services/theme.service';
import { SupabaseService } from '../../../core/services/supabase.service';
import { FirebaseAuthService } from '../../../core/services/firebase-auth.service';
import { FirebaseSyncService } from '../../../core/services/firebase-sync.service';
import { NavPreferencesService } from '../../../core/services/nav-preferences.service';
import { SyncStatusComponent } from '../sync-status/sync-status.component';

interface NavItem {
  label: string;
  path: string;
  exact: boolean;
  hidden: boolean;
}

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, SyncStatusComponent],
  template: `
    <nav class="navbar">
      <div class="navbar-inner container">
        <!-- Logo -->
        <a routerLink="/" class="navbar-logo">
          💡<span class="logo-text"> U2 <span class="logo-highlight">Tools</span></span>
        </a>

        <!-- Nav Links -->
        <div class="navbar-links">
          @for (item of visibleNavItems; track item.path) {
            <a
              [routerLink]="item.path"
              routerLinkActive="active"
              [routerLinkActiveOptions]="{ exact: item.exact }"
              class="nav-link"
            >
              {{ item.label }}
            </a>
          }
        </div>

        <!-- Actions -->
        <div class="navbar-actions">
          <!-- Sync Status (only when Firebase-authenticated) -->
          @if (firebaseAuth.isAuthenticated()) {
            <app-sync-status
              [state]="syncService.syncState()"
              [tooltip]="'Cloud sync: ' + syncService.syncState()"
            />
          }

          <!-- Nav Settings -->
          <div class="nav-settings">
            <button class="settings-toggle" type="button" (click)="toggleNavSettings()">
              <span class="settings-icon">⋮</span>
              Customize
            </button>
            @if (navSettingsOpen) {
              <div class="nav-settings-panel animate-fade-in">
                <div class="settings-header">
                  <span>Tool navigation</span>
                  <button class="settings-close" type="button" (click)="navSettingsOpen = false">
                    ×
                  </button>
                </div>
                <p class="settings-note">
                  Drag tools to reorder. Toggle visibility to hide or show each tool.
                </p>
                <div class="settings-list">
                  @for (item of toolNavItems; track item.path) {
                    <div
                      class="settings-item"
                      draggable="true"
                      (dragstart)="handleDragStart($event, item.path)"
                      (dragover)="handleDragOver($event)"
                      (drop)="handleDrop($event, item.path)"
                    >
                      <span class="drag-handle" aria-hidden="true">☰</span>
                      <span class="item-label">{{ item.label }}</span>
                      <label class="item-toggle">
                        <input
                          type="checkbox"
                          [checked]="!item.hidden"
                          (change)="toggleItemVisibility(item)"
                        />
                        <span>{{ item.hidden ? 'Hidden' : 'Shown' }}</span>
                      </label>
                    </div>
                  }
                </div>
              </div>
            }
          </div>

          <!-- Theme Toggle -->
          <button
            class="theme-toggle"
            (click)="themeService.toggle()"
            [attr.aria-label]="
              'Switch to ' + (themeService.theme() === 'dark' ? 'light' : 'dark') + ' mode'
            "
          >
            <span class="theme-icon" [class.is-dark]="themeService.theme() === 'dark'">
              @if (themeService.theme() === 'dark') {
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" />
                  <line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
              } @else {
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              }
            </span>
          </button>

          <!-- Firebase Auth -->
          @if (firebaseAuth.isAuthenticated()) {
            <div class="user-menu">
              <button class="user-avatar" (click)="toggleUserMenu()">
                <img
                  [src]="
                    firebaseAuth.user()?.photoURL ||
                    'https://ui-avatars.com/api/?name=U&background=6366f1&color=fff'
                  "
                  alt="User"
                />
              </button>
              @if (showUserMenu) {
                <div class="user-dropdown animate-fade-in">
                  <div class="user-info">
                    <span class="user-name">{{ firebaseAuth.user()?.displayName || 'User' }}</span>
                    <span class="user-email">{{ firebaseAuth.user()?.email }}</span>
                  </div>
                  <hr class="dropdown-divider" />
                  <a routerLink="/profile" class="dropdown-item" (click)="showUserMenu = false">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                    Profile & Sync
                  </a>
                  @if (firebaseAuth.isAdmin()) {
                    <a
                      routerLink="/admin/users"
                      class="dropdown-item"
                      (click)="showUserMenu = false"
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                      >
                        <path d="M12 2l3 4 5 .7-3.5 3.4.8 5-4.3-2.3L7.5 15l.8-5L4.8 6.7 10 6z" />
                      </svg>
                      User Management
                    </a>
                  }
                  <button class="dropdown-item" (click)="handleSignOut()">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <polyline points="16 17 21 12 16 7" />
                      <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                    Sign Out
                  </button>
                </div>
              }
            </div>
          } @else {
            <!-- Sign In Button -->
            <a routerLink="/login" class="btn btn-primary btn-sm">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                <polyline points="10 17 15 12 10 7" />
                <line x1="15" y1="12" x2="3" y2="12" />
              </svg>
              Sign In
            </a>
          }
        </div>
      </div>
    </nav>
  `,
  styles: [
    `
      .navbar {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        z-index: 1000;
        background: var(--navbar-bg);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border-bottom: 1px solid var(--border-color);
        transition: background var(--transition-normal);
      }

      .navbar-inner {
        display: flex;
        align-items: center;
        justify-content: space-between;
        height: 64px;
        gap: 24px;
      }

      .navbar-logo {
        display: flex;
        align-items: center;
        gap: 10px;
        text-decoration: none;
        color: var(--text-primary);
      }

      .logo-icon {
        width: 28px;
        height: 28px;
        object-fit: contain;
        filter: drop-shadow(0 0 8px rgba(99, 102, 241, 0.5));
      }

      .logo-text {
        font-size: 1.3rem;
        font-weight: 800;
        letter-spacing: -0.5px;
      }

      .logo-highlight {
        background: var(--accent-gradient);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      }

      .navbar-links {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
        overflow-x: auto;
        scrollbar-width: none;
      }

      .navbar-links::-webkit-scrollbar {
        display: none;
      }

      .nav-link {
        flex: 0 0 auto;
        padding: 8px 0.5rem;
        font-size: 0.9rem;
        font-weight: 500;
        color: var(--text-secondary);
        border-radius: var(--radius-sm);
        transition: all var(--transition-fast);
        text-decoration: none;
      }

      .nav-link:hover {
        color: var(--text-primary);
        background: var(--accent-surface);
      }

      .nav-link.active {
        color: var(--accent-primary);
        background: var(--accent-surface);
        font-weight: 600;
      }

      .navbar-actions {
        display: flex;
        align-items: center;
        gap: 12px;
        position: relative;
      }

      .nav-settings {
        position: relative;
      }

      .settings-toggle {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 8px 10px;
        border-radius: var(--radius-sm);
        border: 1px solid var(--border-color);
        background: var(--bg-tertiary);
        color: var(--text-secondary);
        cursor: pointer;
        transition: all var(--transition-fast);
      }

      .settings-toggle:hover {
        background: var(--accent-surface);
        color: var(--text-primary);
      }

      .settings-icon {
        font-size: 1.1rem;
      }

      .nav-settings-panel {
        position: absolute;
        right: 0;
        top: calc(100% + 8px);
        width: min(360px, 90vw);
        background: var(--bg-secondary);
        border: 1px solid var(--border-color-strong);
        border-radius: var(--radius-md);
        box-shadow: var(--shadow-lg);
        padding: 1rem;
        z-index: 1002;
      }

      .settings-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 0.75rem;
      }

      .settings-header span {
        font-weight: 700;
        font-size: 0.95rem;
        color: var(--text-primary);
      }

      .settings-close {
        width: 32px;
        height: 32px;
        border: none;
        border-radius: 50%;
        background: var(--bg-tertiary);
        color: var(--text-secondary);
        cursor: pointer;
      }

      .settings-note {
        margin: 0 0 0.75rem;
        font-size: 0.82rem;
        color: var(--text-secondary);
      }

      .settings-list {
        display: grid;
        gap: 8px;
      }

      .settings-item {
        display: grid;
        grid-template-columns: auto 1fr auto;
        gap: 10px;
        align-items: center;
        padding: 0.65rem 0.75rem;
        border-radius: var(--radius-sm);
        background: var(--bg-tertiary);
        border: 1px solid transparent;
        cursor: grab;
      }

      .settings-item:active {
        cursor: grabbing;
      }

      .settings-item:hover {
        border-color: var(--border-color);
      }

      .drag-handle {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background: var(--bg-primary);
        color: var(--text-secondary);
        font-size: 1rem;
      }

      .item-label {
        font-size: 0.9rem;
        color: var(--text-primary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .item-toggle {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 0.82rem;
        color: var(--text-secondary);
      }

      .item-toggle input {
        width: 16px;
        height: 16px;
        accent-color: var(--accent-primary);
      }

      .theme-toggle {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 40px;
        height: 40px;
        background: var(--bg-tertiary);
        border: 1px solid var(--border-color);
        border-radius: 50%;
        cursor: pointer;
        color: var(--text-secondary);
        transition: all var(--transition-fast);
      }

      .theme-toggle:hover {
        background: var(--accent-surface);
        color: var(--accent-primary);
        border-color: var(--accent-primary);
        transform: rotate(15deg);
      }

      .theme-icon {
        display: flex;
        transition: transform var(--transition-fast);
      }

      .user-menu {
        position: relative;
      }

      .user-avatar {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        border: 2px solid var(--accent-primary);
        cursor: pointer;
        overflow: hidden;
        padding: 0;
        background: none;
      }

      .user-avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        border-radius: 50%;
      }

      .user-dropdown {
        position: absolute;
        top: calc(100% + 8px);
        right: 0;
        width: 240px;
        background: var(--bg-secondary);
        border: 1px solid var(--border-color-strong);
        border-radius: var(--radius-md);
        box-shadow: var(--shadow-lg);
        overflow: hidden;
        z-index: 1001;
      }

      .user-info {
        padding: 0.5rem;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .user-name {
        font-weight: 600;
        font-size: 0.95rem;
        color: var(--text-primary);
      }

      .user-email {
        font-size: 0.8rem;
        color: var(--text-secondary);
      }

      .dropdown-divider {
        border: none;
        border-top: 1px solid var(--border-color);
      }

      .dropdown-item {
        display: flex;
        align-items: center;
        gap: 10px;
        width: 100%;
        padding: 0.5rem 0.5rem;
        font-family: var(--font-family);
        font-size: 0.88rem;
        color: var(--text-secondary);
        background: none;
        border: none;
        cursor: pointer;
        transition: all var(--transition-fast);
        text-decoration: none;
      }

      .dropdown-item:hover {
        background: var(--accent-surface);
        color: var(--accent-primary);
      }

      @media (max-width: 768px) {
        .navbar-inner {
          height: auto;
          min-height: 64px;
          padding-top: 0.5rem;
          padding-bottom: 0.5rem;
          flex-wrap: wrap;
        }

        .navbar-links {
          order: 3;
          width: 100%;
          overflow-x: auto;
          padding-bottom: 2px;
          scrollbar-width: none;
        }

        .navbar-links::-webkit-scrollbar {
          display: none;
        }

        .nav-link {
          flex: 0 0 auto;
        }
      }

      @media (max-width: 640px) {
        .logo-text {
          font-size: 1.1rem;
        }

        .navbar-actions {
          gap: 8px;
        }

        .nav-settings-panel {
          right: auto;
          left: 0;
        }
      }
    `,
  ],
})
export class NavbarComponent {
  themeService = inject(ThemeService);
  supabaseService = inject(SupabaseService);
  firebaseAuth = inject(FirebaseAuthService);
  syncService = inject(FirebaseSyncService);
  private router = inject(Router);
  private navPreferencesService = inject(NavPreferencesService);

  showUserMenu = false;
  navSettingsOpen = false;
  toolNavItems: NavItem[] = [];
  visibleNavItems: NavItem[] = [];
  private draggedItemPath: string | null = null;
  private readonly defaultToolOrder = [
    'standup-note',
    'work-tracker',
    'unit-test-tracker',
    'compare',
    'html-viewer',
    'estimator',
  ];
  private currentOrder: string[] = [];
  private currentVisibility: Record<string, boolean> = {};
  private readonly orderKey = 'u2app.navOrder';
  private readonly visibilityKey = 'u2app.navVisibility';

  constructor() {
    combineLatest([
      this.navPreferencesService.order$,
      this.navPreferencesService.visibility$,
    ]).subscribe(([order, visibility]) => {
      this.currentOrder = order;
      this.currentVisibility = visibility;
      this.initializeNavItems(order, visibility);
    });
  }

  toggleUserMenu(): void {
    this.showUserMenu = !this.showUserMenu;
  }

  toggleNavSettings(): void {
    this.navSettingsOpen = !this.navSettingsOpen;
  }

  handleDragStart(event: DragEvent, path: string): void {
    this.draggedItemPath = path;
    event.dataTransfer?.setData('text/plain', path);
    event.dataTransfer?.setDragImage(event.currentTarget as Element, 0, 0);
  }

  handleDragOver(event: DragEvent): void {
    event.preventDefault();
    event.dataTransfer!.dropEffect = 'move';
  }

  handleDrop(event: DragEvent, targetPath: string): void {
    event.preventDefault();
    const sourcePath = this.draggedItemPath;
    this.draggedItemPath = null;
    if (!sourcePath || sourcePath === targetPath) {
      return;
    }

    const sourceIndex = this.toolNavItems.findIndex((item) => item.path === sourcePath);
    const targetIndex = this.toolNavItems.findIndex((item) => item.path === targetPath);
    if (sourceIndex === -1 || targetIndex === -1) {
      return;
    }

    const [movedItem] = this.toolNavItems.splice(sourceIndex, 1);
    this.toolNavItems.splice(targetIndex, 0, movedItem);

    const order = this.toolNavItems.map((item) => item.path.replace(/^\//, ''));
    this.navPreferencesService.setOrder(order);
  }

  toggleItemVisibility(item: NavItem): void {
    const id = item.path.replace(/^\//, '');
    const newVisibility = {
      ...this.currentVisibility,
      [id]: !item.hidden,
    };

    this.navPreferencesService.setVisibility(newVisibility);
  }

  async handleSignOut(): Promise<void> {
    this.showUserMenu = false;
    await this.firebaseAuth.signOutUser();
  }

  private initializeNavItems(order: string[], visibility: Record<string, boolean>): void {
    const allNavItems = this.router.config
      .filter((route) => route.data?.['showInNav'] && route.data?.['navLabel'])
      .map((route) => {
        const path = route.path ? `/${route.path}` : '/';
        return {
          label: String(route.data?.['navLabel']),
          path,
          exact: route.path === '',
          hidden: visibility[route.path ?? ''] ?? false,
        };
      });

    this.toolNavItems = allNavItems
      .filter((item) => item.path !== '/')
      .sort((a, b) =>
        this.navPreferencesService.compareToolOrder(
          a.path.replace(/^\//, ''),
          b.path.replace(/^\//, ''),
          order,
        ),
      );

    this.refreshVisibleNav();
  }

  private refreshVisibleNav(): void {
    const homeItem = this.router.config
      .filter((route) => route.data?.['showInNav'] && route.data?.['navLabel'])
      .find((route) => route.path === '');

    this.visibleNavItems = [];
    if (homeItem) {
      this.visibleNavItems.push({
        label: String(homeItem.data?.['navLabel']),
        path: '/',
        exact: true,
        hidden: false,
      });
    }

    this.visibleNavItems.push(...this.toolNavItems.filter((item) => !item.hidden));
  }

  private persistNavPreferences(): void {
    const order = this.toolNavItems.map((item) => item.path.replace(/^\//, ''));
    const visibility = Object.fromEntries(
      this.toolNavItems.map((item) => [item.path.replace(/^\//, ''), item.hidden]),
    );

    localStorage.setItem(this.orderKey, JSON.stringify(order));
    localStorage.setItem(this.visibilityKey, JSON.stringify(visibility));
  }

  private loadStoredOrder(): string[] {
    try {
      const stored = localStorage.getItem(this.orderKey);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  private loadStoredVisibility(): Record<string, boolean> {
    try {
      const stored = localStorage.getItem(this.visibilityKey);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  }

  private compareToolOrder(pathA: string, pathB: string, storedOrder: string[]): number {
    const idA = pathA.replace(/^\//, '');
    const idB = pathB.replace(/^\//, '');

    const indexA = this.navIndex(idA, storedOrder);
    const indexB = this.navIndex(idB, storedOrder);

    return indexA - indexB;
  }

  private navIndex(id: string, storedOrder: string[]): number {
    const savedIndex = storedOrder.indexOf(id);
    if (savedIndex >= 0) {
      return savedIndex;
    }

    const defaultIndex = this.defaultToolOrder.indexOf(id);
    if (defaultIndex >= 0) {
      return defaultIndex;
    }

    const extras = this.router.config
      .filter(
        (route) =>
          route.data?.['showInNav'] &&
          route.data?.['navLabel'] &&
          route.path !== '' &&
          !this.defaultToolOrder.includes(route.path!),
      )
      .map((route) => route.path!);
    const extraIndex = extras.indexOf(id);
    return this.defaultToolOrder.length + (extraIndex >= 0 ? extraIndex : Number.MAX_SAFE_INTEGER);
  }
}
