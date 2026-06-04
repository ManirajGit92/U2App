import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { ThemeService } from '../../../core/services/theme.service';
import { SupabaseService } from '../../../core/services/supabase.service';
import { FirebaseAuthService } from '../../../core/services/firebase-auth.service';
import { FirebaseSyncService } from '../../../core/services/firebase-sync.service';
import { SyncStatusComponent } from '../sync-status/sync-status.component';

interface NavItem {
  label: string;
  path: string;
  exact: boolean;
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
          <!-- <img src="assets/images/u2app.png" alt="Logo" class="logo-icon" /> -->
          💡<span class="logo-text"> U2 <span class="logo-highlight">Tools</span></span>
        </a>

        <!-- Nav Links -->
        <div class="navbar-links">
          @for (item of navItems; track item.path) {
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
                    <span class="user-name">{{
                      firebaseAuth.user()?.displayName || 'User'
                    }}</span>
                    <span class="user-email">{{ firebaseAuth.user()?.email }}</span>
                  </div>
                  <hr class="dropdown-divider" />
                  <a
                    routerLink="/profile"
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
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                    Profile & Sync
                  </a>
                  <button
                    class="dropdown-item"
                    (click)="handleSignOut()"
                  >
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
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
                <polyline points="10 17 15 12 10 7"/>
                <line x1="15" y1="12" x2="3" y2="12"/>
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
        padding: 8px 16px;
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
        padding: 16px;
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
        padding: 12px 16px;
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
          padding-top: 10px;
          padding-bottom: 10px;
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
  showUserMenu = false;
  navItems: NavItem[] = this.router.config
    .filter((route) => route.data?.['showInNav'] && route.data?.['navLabel'])
    .map((route) => ({
      label: String(route.data?.['navLabel']),
      path: route.path ? `/${route.path}` : '/',
      exact: route.path === '',
    }));

  toggleUserMenu(): void {
    this.showUserMenu = !this.showUserMenu;
  }

  async handleSignOut(): Promise<void> {
    this.showUserMenu = false;
    await this.firebaseAuth.signOutUser();
  }
}
