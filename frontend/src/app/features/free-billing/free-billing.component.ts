import { Component, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { DataManagerComponent } from './components/data-manager/data-manager.component';
import { ProductManagementComponent } from './components/product-management/product-management.component';
import { CustomerManagementComponent } from './components/customer-management/customer-management.component';
import { PurchaseManagementComponent } from './components/purchase-management/purchase-management.component';
import { EmployeeManagementComponent } from './components/employee-management/employee-management.component';
import { OrdersComponent } from './components/orders/orders.component';
import { BillingComponent } from './components/billing/billing.component';

interface NavItem {
  key: string;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-free-billing',
  standalone: true,
  imports: [
    CommonModule,
    DashboardComponent,
    DataManagerComponent,
    ProductManagementComponent,
    CustomerManagementComponent,
    PurchaseManagementComponent,
    EmployeeManagementComponent,
    OrdersComponent,
    BillingComponent
  ],
  template: `
    <div class="billing-layout" [class.sidebar-collapsed]="sidebarCollapsed" [class.mobile-open]="mobileMenuOpen">

      <!-- Mobile overlay backdrop -->
      <div class="mobile-backdrop" *ngIf="mobileMenuOpen" (click)="mobileMenuOpen = false"></div>

      <!-- Sidebar -->
      <aside class="sidebar" [class.collapsed]="sidebarCollapsed">
        <div class="sidebar-header">
          <div class="brand-logo">💳</div>
          <span class="brand-name" *ngIf="!sidebarCollapsed">Billing System</span>
          <button class="collapse-btn" (click)="toggleSidebar()" [title]="sidebarCollapsed ? 'Expand' : 'Collapse'">
            <span class="collapse-icon" [class.flipped]="sidebarCollapsed">‹</span>
          </button>
        </div>

        <nav class="sidebar-nav">
          <button
            *ngFor="let item of navItems"
            class="nav-btn"
            [class.active]="currentTab === item.key"
            (click)="setTab(item.key)"
            [title]="sidebarCollapsed ? item.label : ''"
          >
            <span class="nav-icon">{{ item.icon }}</span>
            <span class="nav-label" *ngIf="!sidebarCollapsed">{{ item.label }}</span>
            <span class="active-bar" *ngIf="currentTab === item.key"></span>
          </button>
        </nav>

        <div class="sidebar-footer" *ngIf="!sidebarCollapsed">
          <span class="footer-text">Free Billing v2.0</span>
        </div>
      </aside>

      <!-- Mobile Header Bar -->
      <div class="mobile-header">
        <button class="hamburger-btn" (click)="mobileMenuOpen = !mobileMenuOpen">
          <span></span><span></span><span></span>
        </button>
        <span class="mobile-title">{{ currentNavItem?.icon }} {{ currentNavItem?.label }}</span>
      </div>

      <!-- Main Content -->
      <main class="main-content">
        <div class="content-inner">
          <ng-container [ngSwitch]="currentTab">
            <app-dashboard *ngSwitchCase="'dashboard'"></app-dashboard>
            <app-data-manager *ngSwitchCase="'data'"></app-data-manager>
            <app-product-management *ngSwitchCase="'products'"></app-product-management>
            <app-customer-management *ngSwitchCase="'customers'"></app-customer-management>
            <app-purchase-management *ngSwitchCase="'purchases'"></app-purchase-management>
            <app-employee-management *ngSwitchCase="'employees'"></app-employee-management>
            <app-orders *ngSwitchCase="'orders'"></app-orders>
            <app-billing *ngSwitchCase="'billing'"></app-billing>
          </ng-container>
        </div>
      </main>
    </div>
  `,
  styles: [`
    /* ========================
       Layout Shell
    ======================== */
    .billing-layout {
      display: flex;
      height: 100vh;
      width: 100vw;
      background: var(--bg-primary);
      position: relative;
      overflow: hidden;
    }

    /* ========================
       Sidebar
    ======================== */
    .sidebar {
      width: 240px;
      background: var(--bg-secondary);
      border-right: 1px solid var(--border-color);
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
      transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      overflow: hidden;
      z-index: 100;
    }
    .sidebar.collapsed { width: 68px; }

    .sidebar-header {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 16px 14px;
      border-bottom: 1px solid var(--border-color);
      min-height: 64px;
    }
    .brand-logo { font-size: 1.6rem; flex-shrink: 0; line-height: 1; }
    .brand-name {
      flex: 1;
      font-size: 1rem;
      font-weight: 800;
      color: var(--text-primary);
      white-space: nowrap;
      overflow: hidden;
      letter-spacing: 0.3px;
    }
    .collapse-btn {
      background: none;
      border: 1px solid var(--border-color);
      border-radius: 8px;
      width: 28px;
      height: 28px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--text-secondary);
      flex-shrink: 0;
      transition: background 0.2s;
    }
    .collapse-btn:hover { background: rgba(0,0,0,0.06); }
    .collapse-icon {
      font-size: 1.2rem;
      line-height: 1;
      display: inline-block;
      transition: transform 0.3s;
    }
    .collapse-icon.flipped { transform: rotate(180deg); }

    .sidebar-nav {
      flex: 1;
      padding: 10px 8px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      overflow-y: auto;
    }

    .nav-btn {
      background: none;
      border: none;
      border-radius: 10px;
      padding: 10px 12px;
      text-align: left;
      font-size: 0.92rem;
      font-weight: 500;
      color: var(--text-secondary);
      cursor: pointer;
      transition: all 0.18s ease;
      display: flex;
      align-items: center;
      gap: 12px;
      position: relative;
      white-space: nowrap;
      overflow: hidden;
      min-height: 44px;
    }
    .nav-btn:hover {
      background: rgba(var(--accent-primary-rgb), 0.06);
      color: var(--accent-primary);
    }
    .nav-btn.active {
      background: rgba(var(--accent-primary-rgb), 0.12);
      color: var(--accent-primary);
      font-weight: 700;
    }
    .nav-icon { font-size: 1.2rem; flex-shrink: 0; line-height: 1; }
    .nav-label { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .active-bar {
      position: absolute; right: 0; top: 50%; transform: translateY(-50%);
      width: 3px; height: 20px; background: var(--accent-primary); border-radius: 2px 0 0 2px;
    }

    .sidebar-footer {
      padding: 12px 16px;
      border-top: 1px solid var(--border-color);
      font-size: 0.75rem;
      color: var(--text-tertiary);
    }

    /* ========================
       Main Content
    ======================== */
    .main-content {
      flex: 1;
      overflow-y: auto;
      min-width: 0;
    }
    .content-inner {
      padding: 20px;
      max-width: 1400px;
    }

    /* ========================
       Mobile Header
    ======================== */
    .mobile-header {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      height: 56px;
      background: var(--bg-secondary);
      border-bottom: 1px solid var(--border-color);
      z-index: 200;
      align-items: center;
      padding: 0 16px;
      gap: 12px;
    }
    .hamburger-btn {
      background: none;
      border: none;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      gap: 5px;
      padding: 6px;
    }
    .hamburger-btn span {
      display: block;
      width: 22px;
      height: 2px;
      background: var(--text-primary);
      border-radius: 2px;
      transition: all 0.2s;
    }
    .mobile-title { font-size: 1rem; font-weight: 700; color: var(--text-primary); }

    /* Mobile Backdrop */
    .mobile-backdrop {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.5);
      z-index: 150;
    }

    /* ========================
       Collapsed Sidebar Tooltip via title
    ======================== */
    .sidebar.collapsed .nav-btn {
      justify-content: center;
      padding: 10px;
    }
    .sidebar.collapsed .sidebar-header {
      justify-content: center;
      padding: 16px 10px;
    }

    /* ========================
       Responsive
    ======================== */
    @media (max-width: 768px) {
      .mobile-header { display: flex; }
      .mobile-backdrop { display: block; }

      .billing-layout {
        flex-direction: column;
        padding-top: 56px;
      }

      .sidebar {
        position: fixed;
        left: -260px;
        top: 0;
        bottom: 0;
        width: 240px !important;
        z-index: 300;
        transition: left 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        border-right: 1px solid var(--border-color);
        box-shadow: 4px 0 20px rgba(0,0,0,0.15);
      }

      .mobile-open .sidebar { left: 0; }
      .mobile-open .mobile-backdrop { display: block; }

      .main-content { padding-top: 0; }
      .content-inner { padding: 14px; }
    }

    @media (max-width: 480px) {
      .content-inner { padding: 10px; }
    }
  `]
})
export class FreeBillingComponent {
  currentTab = 'dashboard';
  sidebarCollapsed = false;
  mobileMenuOpen = false;

  navItems: NavItem[] = [
    { key: 'dashboard', label: 'Dashboard', icon: '📊' },
    { key: 'products', label: 'Products', icon: '📦' },
    { key: 'customers', label: 'Customers', icon: '👥' },
    { key: 'employees', label: 'Employees', icon: '👤' },
    { key: 'orders', label: 'Orders', icon: '🛍️' },
    { key: 'billing', label: 'Billing', icon: '🧾' },
    { key: 'purchases', label: 'Purchases', icon: '🛒' },
    { key: 'data', label: 'Manage Data', icon: '🗂️' },
  ];

  get currentNavItem(): NavItem | undefined {
    return this.navItems.find(n => n.key === this.currentTab);
  }

  setTab(tab: string) {
    this.currentTab = tab;
    this.mobileMenuOpen = false;
  }

  toggleSidebar() {
    this.sidebarCollapsed = !this.sidebarCollapsed;
  }

  @HostListener('window:resize')
  onResize() {
    if (window.innerWidth > 768) {
      this.mobileMenuOpen = false;
    }
  }
}
