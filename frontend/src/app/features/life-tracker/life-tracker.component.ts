import { Component, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, RouterOutlet } from '@angular/router';
import { LifeTrackerService } from './life-tracker.service';
import { ThemeService } from '../../core/services/theme.service';

interface NavItem {
  label: string;
  route: string;
  icon: string;
}

@Component({
  selector: 'app-life-tracker',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterModule],
  template: `
    <div class="lt-shell" [class.sidebar-collapsed]="sidebarCollapsed()" [class.drawer-open]="mobileDrawerOpen()">
      <button
        type="button"
        class="drawer-backdrop"
        aria-label="Close navigation"
        *ngIf="mobileDrawerOpen()"
        (click)="closeMobileDrawer()">
      </button>

      <aside class="lt-sidebar" aria-label="LifeTracker navigation">
        <div class="brand-row">
          <div class="brand-mark" aria-hidden="true">
            <i class="pi pi-sparkles"></i>
          </div>
          <div class="brand-copy">
            <strong>LifeTracker</strong>
            <span>Plan · Track · Achieve</span>
          </div>
          <button
            type="button"
            class="icon-button sidebar-toggle"
            [attr.aria-label]="sidebarCollapsed() ? 'Expand sidebar' : 'Collapse sidebar'"
            (click)="toggleSidebar()">
            <i class="pi" [ngClass]="sidebarCollapsed() ? 'pi-angle-double-right' : 'pi-angle-double-left'"></i>
          </button>
        </div>

        <nav class="nav-list">
          <a
            *ngFor="let item of navItems"
            [routerLink]="item.route"
            routerLinkActive="active"
            [routerLinkActiveOptions]="item.route === 'dashboard' ? { exact: true } : { exact: false }"
            (click)="closeMobileDrawer()">
            <i [class]="item.icon" aria-hidden="true"></i>
            <span>{{ item.label }}</span>
          </a>
        </nav>

        <div class="sidebar-progress">
          <div class="mini-illustration" aria-hidden="true">
            <span></span>
            <span></span>
            <span></span>
          </div>
          <p>Discipline today</p>
          <strong>Success tomorrow</strong>
          <div class="tiny-progress"><span style="width: 72%"></span></div>
          <small>72% weekly rhythm</small>
        </div>
      </aside>

      <section class="lt-main">
        <header class="lt-topbar">
          <div class="welcome-block">
            <button type="button" class="icon-button mobile-menu" aria-label="Open navigation" (click)="openMobileDrawer()">
              <i class="pi pi-bars"></i>
            </button>
            <div>
              <p>{{ greeting() }}</p>
              <h1>Welcome back, {{ userName }}</h1>
            </div>
          </div>

          <label class="global-search">
            <i class="pi pi-search" aria-hidden="true"></i>
            <input type="search" placeholder="Search routines, goals, expenses..." aria-label="Global search">
          </label>

          <div class="top-actions">
            <button type="button" class="icon-button theme-button" aria-label="Toggle theme" (click)="theme.toggle()">
              <i class="pi" [ngClass]="theme.theme() === 'dark' ? 'pi-sun' : 'pi-moon'"></i>
            </button>
            <button type="button" class="icon-button notification-button" aria-label="Notifications">
              <i class="pi pi-bell"></i>
              <span aria-hidden="true">3</span>
            </button>
            <button type="button" class="btn btn-secondary import-button" (click)="fileInput.click()">
              <i class="pi pi-upload"></i>
              Import
            </button>
            <input type="file" #fileInput hidden (change)="onUpload($event)" accept=".xlsx, .xls">
            <button type="button" class="btn btn-primary export-button" (click)="service.exportExcel()">
              <i class="pi pi-download"></i>
              Export
            </button>
            <div class="profile-menu">
              <button type="button" class="profile-trigger" aria-label="Open profile menu">
                <span class="avatar">M</span>
                <span class="profile-name">{{ userName }}</span>
                <i class="pi pi-chevron-down" aria-hidden="true"></i>
              </button>
              <div class="profile-dropdown" role="menu">
                <a routerLink="Settings">Settings</a>
                <a routerLink="Reports">Reports</a>
              </div>
            </div>
          </div>
        </header>

        <main class="lt-content">
          <router-outlet></router-outlet>
        </main>
      </section>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      min-height: calc(100vh - 72px);
      color: var(--text-primary);
      --lt-card: color-mix(in srgb, var(--surface-card) 88%, transparent);
      --lt-line: var(--border-color);
      --lt-shadow: 0 18px 60px rgba(15, 23, 42, 0.10);
    }

    .lt-shell {
      min-height: calc(100vh - 72px);
      display: grid;
      grid-template-columns: 280px minmax(0, 1fr);
      background:
        radial-gradient(circle at 12% 8%, rgba(14, 165, 233, 0.12), transparent 30%),
        radial-gradient(circle at 92% 0%, rgba(16, 185, 129, 0.11), transparent 28%),
        linear-gradient(135deg, var(--bg-primary), var(--bg-tertiary));
      overflow: hidden;
    }

    .lt-sidebar {
      position: sticky;
      top: 0;
      height: calc(100vh - 72px);
      padding: 18px 14px;
      background: color-mix(in srgb, var(--surface-card) 82%, transparent);
      border-right: 1px solid var(--lt-line);
      backdrop-filter: blur(24px);
      display: flex;
      flex-direction: column;
      gap: 20px;
      transition: width var(--transition-normal), transform var(--transition-normal), padding var(--transition-normal);
      z-index: 20;
    }

    .brand-row {
      display: grid;
      grid-template-columns: 44px minmax(0, 1fr) 38px;
      align-items: center;
      gap: 12px;
      min-height: 48px;
    }

    .brand-mark, .avatar {
      display: inline-grid;
      place-items: center;
      border-radius: 16px;
      background: linear-gradient(135deg, #0ea5e9, #2563eb);
      color: #fff;
      box-shadow: 0 12px 24px rgba(37, 99, 235, 0.28);
    }

    .brand-mark {
      width: 44px;
      height: 44px;
      font-size: 1.2rem;
    }

    .brand-copy {
      min-width: 0;
    }

    .brand-copy strong {
      display: block;
      font-size: 1.14rem;
      line-height: 1.1;
      letter-spacing: 0;
    }

    .brand-copy span {
      display: block;
      color: var(--text-secondary);
      font-size: 0.78rem;
      margin-top: 3px;
      white-space: nowrap;
    }

    .icon-button {
      width: 40px;
      height: 40px;
      border: 1px solid var(--lt-line);
      border-radius: 14px;
      display: inline-grid;
      place-items: center;
      color: var(--text-secondary);
      background: var(--lt-card);
      cursor: pointer;
      transition: transform var(--transition-fast), border-color var(--transition-fast), color var(--transition-fast), background var(--transition-fast);
      position: relative;
    }

    .icon-button:hover, .profile-trigger:hover {
      transform: translateY(-2px);
      border-color: color-mix(in srgb, var(--accent-primary) 60%, var(--lt-line));
      color: var(--accent-primary);
      background: var(--accent-surface);
    }

    .nav-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .nav-list a {
      display: flex;
      align-items: center;
      gap: 12px;
      min-height: 44px;
      padding: 0 13px;
      color: var(--text-secondary);
      border-radius: 14px;
      font-weight: 700;
      font-size: 0.91rem;
      transition: color var(--transition-fast), background var(--transition-fast), transform var(--transition-fast), box-shadow var(--transition-fast);
    }

    .nav-list a i {
      width: 20px;
      text-align: center;
      font-size: 1rem;
    }

    .nav-list a:hover {
      color: var(--accent-primary);
      background: var(--accent-surface);
      transform: translateX(3px);
    }

    .nav-list a.active {
      color: #fff;
      background: linear-gradient(135deg, #2563eb, #0ea5e9);
      box-shadow: 0 12px 28px rgba(37, 99, 235, 0.28);
    }

    .sidebar-progress {
      margin-top: auto;
      padding: 16px;
      border-radius: 20px;
      background: linear-gradient(180deg, rgba(14, 165, 233, 0.12), rgba(16, 185, 129, 0.09));
      border: 1px solid color-mix(in srgb, var(--accent-primary) 18%, transparent);
      text-align: center;
      overflow: hidden;
    }

    .mini-illustration {
      height: 70px;
      display: flex;
      align-items: end;
      justify-content: center;
      gap: 8px;
      margin-bottom: 10px;
    }

    .mini-illustration span {
      width: 44px;
      border-radius: 14px 14px 6px 6px;
      background: linear-gradient(180deg, #60a5fa, #34d399);
      opacity: 0.88;
    }

    .mini-illustration span:nth-child(1) { height: 34px; }
    .mini-illustration span:nth-child(2) { height: 58px; }
    .mini-illustration span:nth-child(3) { height: 42px; }

    .sidebar-progress p {
      color: var(--text-secondary);
      font-weight: 700;
      margin-bottom: 0;
    }

    .sidebar-progress strong {
      display: block;
      margin-bottom: 12px;
    }

    .tiny-progress {
      height: 7px;
      background: color-mix(in srgb, var(--accent-primary) 12%, transparent);
      border-radius: 999px;
      overflow: hidden;
    }

    .tiny-progress span {
      display: block;
      height: 100%;
      border-radius: inherit;
      background: linear-gradient(90deg, #2563eb, #34d399);
    }

    .sidebar-progress small {
      display: block;
      margin-top: 8px;
      color: var(--text-secondary);
    }

    .lt-main {
      min-width: 0;
      height: calc(100vh - 72px);
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    .lt-topbar {
      min-height: 78px;
      padding: 14px 20px;
      display: grid;
      grid-template-columns: minmax(240px, 1fr) minmax(280px, 540px) minmax(420px, auto);
      align-items: center;
      gap: 18px;
      border-bottom: 1px solid var(--lt-line);
      background: color-mix(in srgb, var(--surface-card) 72%, transparent);
      backdrop-filter: blur(22px);
      z-index: 10;
    }

    .welcome-block {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
    }

    .welcome-block p {
      color: var(--text-secondary);
      font-size: 0.84rem;
      margin: 0;
      font-weight: 700;
    }

    .welcome-block h1 {
      font-size: clamp(1.15rem, 2vw, 1.65rem);
      line-height: 1.1;
      margin: 3px 0 0;
      letter-spacing: 0;
    }

    .mobile-menu {
      display: none;
    }

    .global-search {
      min-height: 46px;
      border-radius: 16px;
      border: 1px solid var(--lt-line);
      background: var(--lt-card);
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 0 14px;
      box-shadow: 0 8px 30px rgba(15, 23, 42, 0.05);
      transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
    }

    .global-search:focus-within {
      border-color: var(--accent-primary);
      box-shadow: 0 0 0 4px var(--accent-surface);
    }

    .global-search input {
      border: 0;
      outline: 0;
      width: 100%;
      background: transparent;
      color: var(--text-primary);
      font: inherit;
    }

    .top-actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 10px;
      min-width: 0;
    }

    .notification-button span {
      position: absolute;
      top: -5px;
      right: -5px;
      width: 19px;
      height: 19px;
      border-radius: 999px;
      display: grid;
      place-items: center;
      background: var(--danger);
      color: #fff;
      font-size: 0.68rem;
      font-weight: 800;
      border: 2px solid var(--surface-card);
    }

    .profile-menu {
      position: relative;
    }

    .profile-trigger {
      min-height: 44px;
      border: 1px solid var(--lt-line);
      background: var(--lt-card);
      color: var(--text-primary);
      border-radius: 999px;
      padding: 3px 10px 3px 4px;
      display: flex;
      align-items: center;
      gap: 9px;
      cursor: pointer;
      transition: all var(--transition-fast);
    }

    .avatar {
      width: 36px;
      height: 36px;
      font-weight: 900;
    }

    .profile-name {
      font-weight: 800;
      max-width: 90px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .profile-dropdown {
      position: absolute;
      right: 0;
      top: calc(100% + 10px);
      width: 160px;
      padding: 8px;
      border-radius: 16px;
      background: var(--surface-card);
      border: 1px solid var(--lt-line);
      box-shadow: var(--lt-shadow);
      opacity: 0;
      pointer-events: none;
      transform: translateY(-6px);
      transition: all var(--transition-fast);
    }

    .profile-menu:hover .profile-dropdown,
    .profile-menu:focus-within .profile-dropdown {
      opacity: 1;
      pointer-events: auto;
      transform: translateY(0);
    }

    .profile-dropdown a {
      display: block;
      padding: 9px 10px;
      border-radius: 10px;
      color: var(--text-secondary);
      font-weight: 700;
    }

    .profile-dropdown a:hover {
      color: var(--accent-primary);
      background: var(--accent-surface);
    }

    .lt-content {
      flex: 1;
      overflow: auto;
      padding: 18px;
      scroll-behavior: smooth;
    }

    .sidebar-collapsed {
      grid-template-columns: 84px minmax(0, 1fr);
    }

    .sidebar-collapsed .lt-sidebar {
      padding-inline: 12px;
    }

    .sidebar-collapsed .brand-row {
      grid-template-columns: 44px;
      justify-content: center;
    }

    .sidebar-collapsed .brand-copy,
    .sidebar-collapsed .sidebar-toggle,
    .sidebar-collapsed .nav-list a span,
    .sidebar-collapsed .sidebar-progress {
      display: none;
    }

    .sidebar-collapsed .nav-list a {
      justify-content: center;
      padding: 0;
    }

    @media (max-width: 1200px) {
      .lt-topbar {
        grid-template-columns: minmax(220px, 1fr) minmax(240px, 420px) auto;
      }

      .profile-name,
      .import-button,
      .export-button {
        display: none;
      }
    }

    @media (max-width: 900px) {
      .lt-shell {
        grid-template-columns: 1fr;
      }

      .lt-sidebar {
        position: fixed;
        top: 0;
        left: 0;
        height: 100vh;
        width: min(320px, 86vw);
        transform: translateX(-105%);
        box-shadow: 20px 0 60px rgba(15, 23, 42, 0.22);
      }

      .drawer-open .lt-sidebar {
        transform: translateX(0);
      }

      .drawer-backdrop {
        position: fixed;
        inset: 0;
        z-index: 15;
        border: 0;
        background: rgba(15, 23, 42, 0.42);
        backdrop-filter: blur(4px);
      }

      .lt-main {
        height: calc(100vh - 72px);
      }

      .lt-topbar {
        grid-template-columns: 1fr auto;
        grid-template-areas:
          "welcome actions"
          "search search";
        gap: 12px;
      }

      .welcome-block { grid-area: welcome; }
      .top-actions { grid-area: actions; }
      .global-search { grid-area: search; }
      .mobile-menu { display: inline-grid; }
      .sidebar-toggle { display: none; }
    }

    @media (max-width: 560px) {
      :host, .lt-shell, .lt-main {
        min-height: 100vh;
        height: auto;
      }

      .lt-topbar {
        position: sticky;
        top: 0;
        padding: 12px;
      }

      .lt-content {
        padding: 12px 12px 28px;
      }

      .theme-button {
        display: none;
      }

      .welcome-block h1 {
        font-size: 1.05rem;
      }
    }
  `],
})
export class LifeTrackerComponent implements OnInit {
  service = inject(LifeTrackerService);
  theme = inject(ThemeService);

  userName = 'Mani';
  sidebarCollapsed = signal(false);
  mobileDrawerOpen = signal(false);
  currentHour = signal(new Date().getHours());

  greeting = computed(() => {
    const hour = this.currentHour();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  });

  navItems: NavItem[] = [
    { label: 'Dashboard', route: 'dashboard', icon: 'pi pi-home' },
    { label: 'Daily Routine', route: 'Routines', icon: 'pi pi-clock' },
    { label: 'Health', route: 'MentalHealth', icon: 'pi pi-heart' },
    { label: 'Fitness', route: 'Fitness', icon: 'pi pi-bolt' },
    { label: 'Diet', route: 'Diet', icon: 'pi pi-apple' },
    { label: 'Expenses', route: 'Expenses', icon: 'pi pi-wallet' },
    { label: 'Investments', route: 'Investments', icon: 'pi pi-chart-line' },
    { label: 'Mental Health', route: 'MentalHealth', icon: 'pi pi-face-smile' },
    { label: 'Relationships', route: 'Relationships', icon: 'pi pi-users' },
    { label: 'Calendar', route: 'calendar', icon: 'pi pi-calendar' },
    { label: 'Reports', route: 'Reports', icon: 'pi pi-chart-bar' },
    { label: 'Settings', route: 'Settings', icon: 'pi pi-cog' },
  ];

  ngOnInit() {}

  @HostListener('window:resize')
  onResize() {
    if (window.innerWidth > 900) this.mobileDrawerOpen.set(false);
  }

  toggleSidebar() {
    this.sidebarCollapsed.set(!this.sidebarCollapsed());
  }

  openMobileDrawer() {
    this.mobileDrawerOpen.set(true);
  }

  closeMobileDrawer() {
    this.mobileDrawerOpen.set(false);
  }

  onUpload(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.service.importExcel(file).then(() => {
        alert('Data imported successfully!');
        input.value = '';
      }).catch((err: Error) => {
        alert('Error importing Excel: ' + err.message);
      });
    }
  }
}
