import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { DataManagerComponent } from './components/data-manager/data-manager.component';
import { ProductManagementComponent } from './components/product-management/product-management.component';
import { CustomerManagementComponent } from './components/customer-management/customer-management.component';
import { PurchaseManagementComponent } from './components/purchase-management/purchase-management.component';
import { InvoiceCreatorComponent } from './components/invoice-creator/invoice-creator.component';

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
    InvoiceCreatorComponent
  ],
  template: `
    <div class="billing-layout">
      <!-- Sidebar -->
      <aside class="sidebar">
        <div class="sidebar-header">
          <h2>Billing System</h2>
        </div>
        <nav class="sidebar-nav">
          <button [class.active]="currentTab === 'dashboard'" (click)="setTab('dashboard')">📊 Dashboard</button>
          <button [class.active]="currentTab === 'data'" (click)="setTab('data')">🗂️ Manage Data</button>
          <button [class.active]="currentTab === 'products'" (click)="setTab('products')">📦 Products</button>
          <button [class.active]="currentTab === 'customers'" (click)="setTab('customers')">👥 Customers</button>
          <button [class.active]="currentTab === 'purchases'" (click)="setTab('purchases')">🛒 Purchases</button>
          <button [class.active]="currentTab === 'invoices'" (click)="setTab('invoices')">🧾 Invoices</button>
        </nav>
      </aside>

      <!-- Main Content Area -->
      <main class="main-content">
        <ng-container [ngSwitch]="currentTab">
          <div *ngSwitchCase="'dashboard'">
            <h2>Dashboard</h2>
            <app-dashboard></app-dashboard>
          </div>
          <div *ngSwitchCase="'data'">
            <h2>Manage Data</h2>
            <app-data-manager></app-data-manager>
          </div>
          <div *ngSwitchCase="'products'">
            <h2>Products Management</h2>
            <app-product-management></app-product-management>
          </div>
          <div *ngSwitchCase="'customers'">
            <h2>Customers Management</h2>
            <app-customer-management></app-customer-management>
          </div>
          <div *ngSwitchCase="'purchases'">
            <h2>Purchases Management</h2>
            <app-purchase-management></app-purchase-management>
          </div>
          <div *ngSwitchCase="'invoices'">
            <h2>Invoice Creator</h2>
            <app-invoice-creator></app-invoice-creator>
          </div>
        </ng-container>
      </main>
    </div>
  `,
  styles: [`
    .billing-layout {
      display: flex;
      height: 100%;
      min-height: calc(100vh - 60px);
      background: var(--bg-primary);
    }
    
    .sidebar {
      width: 260px;
      background: var(--surface-card);
      border-right: 1px solid var(--border-color);
      display: flex;
      flex-direction: column;
    }
    
    .sidebar-header {
      padding: 24px;
      border-bottom: 1px solid var(--border-color);
    }
    
    .sidebar-header h2 {
      margin: 0;
      font-size: 1.25rem;
      font-weight: 700;
      color: var(--text-primary);
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    
    .sidebar-nav {
      flex: 1;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    
    .sidebar-nav button {
      background: none;
      border: none;
      border-radius: var(--radius-md);
      padding: 12px 16px;
      text-align: left;
      font-size: 0.95rem;
      font-weight: 500;
      color: var(--text-secondary);
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    
    .sidebar-nav button:hover {
      background: rgba(var(--accent-primary-rgb), 0.05);
      color: var(--accent-primary);
    }
    
    .sidebar-nav button.active {
      background: rgba(var(--accent-primary-rgb), 0.1);
      color: var(--accent-primary);
      font-weight: 600;
    }
    
    .main-content {
      flex: 1;
      padding: 32px;
      overflow-y: auto;
    }

    h2 {
      margin-top: 0;
      margin-bottom: 24px;
      font-weight: 700;
    }
  `]
})
export class FreeBillingComponent {
  currentTab = 'dashboard';

  setTab(tab: string) {
    this.currentTab = tab;
  }
}
