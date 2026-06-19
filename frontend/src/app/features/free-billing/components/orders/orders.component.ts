import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BillingStateService } from '../../services/billing-state.service';
import { Product, Employee, Order, OrderItem } from '../../models/billing.models';

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="orders-container">
      <!-- Header -->
      <div class="page-header">
        <div>
          <h2 class="page-title">🛍️ Orders</h2>
          <p class="page-subtitle">Create and manage customer orders</p>
        </div>
        <div class="header-actions">
          <button class="btn" [class.btn-primary]="activeView === 'create'" [class.btn-ghost]="activeView !== 'create'" (click)="activeView = 'create'">+ New Order</button>
          <button class="btn" [class.btn-primary]="activeView === 'history'" [class.btn-ghost]="activeView !== 'history'" (click)="activeView = 'history'">📋 Order History</button>
        </div>
      </div>

      <!-- CREATE ORDER VIEW -->
      <div *ngIf="activeView === 'create'" class="create-order-layout">

        <!-- Left: Product Browser -->
        <div class="product-browser">
          <div class="browser-toolbar">
            <input type="text" class="search-input" placeholder="🔍 Search products..." [(ngModel)]="searchTerm" (ngModelChange)="filterProducts()">
            <div class="view-toggle">
              <button class="toggle-btn" [class.active]="viewMode === 'grid'" (click)="viewMode = 'grid'" title="Grid View">⊞</button>
              <button class="toggle-btn" [class.active]="viewMode === 'list'" (click)="viewMode = 'list'" title="List View">☰</button>
            </div>
            <div class="cols-control" *ngIf="viewMode === 'grid'">
              <label>Cols:</label>
              <select [(ngModel)]="gridCols" class="cols-select">
                <option [value]="2">2</option>
                <option [value]="3">3</option>
                <option [value]="4">4</option>
                <option [value]="5">5</option>
              </select>
            </div>
          </div>

          <!-- Grid View -->
          <div class="product-grid" [style.--grid-cols]="gridCols" *ngIf="viewMode === 'grid'">
            <div class="product-card" *ngFor="let p of filteredProducts" [class.out-of-stock]="p.stock === 0">
              <div class="card-image">
                <img *ngIf="p.imageUrl" [src]="p.imageUrl" [alt]="p.name">
                <div *ngIf="!p.imageUrl" class="no-image">📦</div>
                <div class="stock-badge" [class.low]="p.stock <= p.lowStockThreshold && p.stock > 0" [class.out]="p.stock === 0">
                  {{ p.stock === 0 ? 'Out' : p.stock + ' left' }}
                </div>
              </div>
              <div class="card-body">
                <h4 class="product-name">{{ p.name }}</h4>
                <p class="product-category">{{ p.category || 'General' }}</p>
                <div class="product-price">₹{{ p.price | number:'1.2-2' }}</div>
              </div>
              <div class="card-footer">
                <div class="qty-controls" *ngIf="getQty(p.id) > 0; else addBtn">
                  <button class="qty-btn minus" (click)="decrementQty(p)">−</button>
                  <span class="qty-value">{{ getQty(p.id) }}</span>
                  <button class="qty-btn plus" (click)="incrementQty(p)" [disabled]="getQty(p.id) >= p.stock && p.stock > 0">+</button>
                </div>
                <ng-template #addBtn>
                  <button class="btn-add" (click)="incrementQty(p)" [disabled]="p.stock === 0">
                    {{ p.stock === 0 ? 'Out of Stock' : '+ Add' }}
                  </button>
                </ng-template>
              </div>
            </div>
            <div class="empty-products" *ngIf="filteredProducts.length === 0">
              <span>📦</span><p>No products found</p>
            </div>
          </div>

          <!-- List View -->
          <div class="product-list" *ngIf="viewMode === 'list'">
            <div class="list-item" *ngFor="let p of filteredProducts" [class.out-of-stock]="p.stock === 0">
              <div class="list-image">
                <img *ngIf="p.imageUrl" [src]="p.imageUrl" [alt]="p.name">
                <div *ngIf="!p.imageUrl" class="no-image-sm">📦</div>
              </div>
              <div class="list-info">
                <span class="list-name">{{ p.name }}</span>
                <span class="list-cat">{{ p.category }}</span>
              </div>
              <div class="list-stock" [class.low-text]="p.stock <= p.lowStockThreshold">
                Stock: {{ p.stock }}
              </div>
              <div class="list-price">₹{{ p.price | number:'1.2-2' }}</div>
              <div class="list-qty">
                <div class="qty-controls" *ngIf="getQty(p.id) > 0; else addBtnList">
                  <button class="qty-btn minus" (click)="decrementQty(p)">−</button>
                  <span class="qty-value">{{ getQty(p.id) }}</span>
                  <button class="qty-btn plus" (click)="incrementQty(p)" [disabled]="getQty(p.id) >= p.stock && p.stock > 0">+</button>
                </div>
                <ng-template #addBtnList>
                  <button class="btn-add-sm" (click)="incrementQty(p)" [disabled]="p.stock === 0">+ Add</button>
                </ng-template>
              </div>
            </div>
            <div class="empty-products" *ngIf="filteredProducts.length === 0">
              <span>📦</span><p>No products found</p>
            </div>
          </div>
        </div>

        <!-- Right: Order Summary -->
        <div class="order-summary">
          <h3 class="summary-title">Order Summary</h3>

          <!-- Employee Selector -->
          <div class="form-group">
            <label>Assign Employee</label>
            <select [(ngModel)]="selectedEmployeeId" (change)="onEmployeeChange()" class="form-select">
              <option value="">-- Select Employee --</option>
              <option *ngFor="let emp of employees" [value]="emp.id">{{ emp.id }} – {{ emp.name }}</option>
            </select>
          </div>
          <div class="selected-employee" *ngIf="selectedEmployee">
            <img *ngIf="selectedEmployee.photoUrl" [src]="selectedEmployee.photoUrl" [alt]="selectedEmployee.name" class="emp-mini-photo">
            <div *ngIf="!selectedEmployee.photoUrl" class="emp-mini-initials">{{ getInitials(selectedEmployee.name) }}</div>
            <div class="emp-mini-info">
              <span class="emp-mini-name">{{ selectedEmployee.name }}</span>
              <span class="emp-mini-role">{{ selectedEmployee.role }}</span>
            </div>
          </div>

          <!-- Cart Items -->
          <div class="cart-items">
            <div class="cart-empty" *ngIf="cartItems.length === 0">
              <span>🛒</span>
              <p>Add products to begin</p>
            </div>
            <div class="cart-item" *ngFor="let item of cartItems">
              <div class="cart-item-img">
                <img *ngIf="item.productImage" [src]="item.productImage" [alt]="item.productName">
                <div *ngIf="!item.productImage" class="no-img-xs">📦</div>
              </div>
              <div class="cart-item-info">
                <span class="cart-item-name">{{ item.productName }}</span>
                <span class="cart-item-price">₹{{ item.unitPrice }} × {{ item.quantity }}</span>
              </div>
              <div class="cart-item-total">₹{{ item.total | number:'1.2-2' }}</div>
              <button class="remove-btn" (click)="removeFromCart(item.productId)">✕</button>
            </div>
          </div>

          <!-- Grand Total -->
          <div class="summary-total">
            <span>Grand Total</span>
            <span class="total-amount">₹{{ grandTotal | number:'1.2-2' }}</span>
          </div>

          <!-- Order Name + Confirm -->
          <div class="form-group">
            <label>Order Name *</label>
            <input type="text" [(ngModel)]="orderName" class="form-input" placeholder="e.g. Morning Batch #1">
          </div>
          <button class="btn btn-primary btn-full" (click)="confirmOrder()" [disabled]="cartItems.length === 0 || !orderName.trim()">
            ✅ Confirm Order
          </button>
          <button class="btn btn-ghost btn-full" (click)="clearCart()">🗑 Clear Cart</button>
        </div>
      </div>

      <!-- ORDER HISTORY VIEW -->
      <div *ngIf="activeView === 'history'" class="order-history">
        <div class="history-filters">
          <input type="text" class="search-input" placeholder="🔍 Search orders..." [(ngModel)]="historySearch" (ngModelChange)="filterOrders()">
          <select [(ngModel)]="statusFilter" (change)="filterOrders()" class="status-select">
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="billed">Billed</option>
          </select>
        </div>

        <div class="orders-table-wrap">
          <table class="orders-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Date</th>
                <th>Employee</th>
                <th>Items</th>
                <th>Total</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let o of filteredOrders">
                <td>
                  <div class="order-name-cell">
                    <div class="order-thumb" *ngIf="o.imageUrl">
                      <img [src]="o.imageUrl" alt="">
                    </div>
                    <span>{{ o.name }}</span>
                    <span class="demo-badge" *ngIf="o.isDemo">Demo</span>
                  </div>
                </td>
                <td>{{ o.date | date:'short' }}</td>
                <td>
                  <div class="emp-cell">
                    <img *ngIf="o.employeePhoto" [src]="o.employeePhoto" class="emp-xs" [alt]="o.employeeName">
                    <span>{{ o.employeeName || '-' }}</span>
                  </div>
                </td>
                <td>{{ o.items.length }}</td>
                <td class="total-cell">₹{{ o.grandTotal | number:'1.2-2' }}</td>
                <td>
                  <span class="status-badge" [class.billed]="o.status === 'billed'" [class.pending]="o.status === 'pending'">
                    {{ o.status === 'billed' ? '✓ Billed' : '⏳ Pending' }}
                  </span>
                </td>
                <td>
                  <button class="action-btn" (click)="deleteOrder(o.id)" title="Delete">🗑️</button>
                </td>
              </tr>
              <tr *ngIf="filteredOrders.length === 0">
                <td colspan="7" class="empty-row">No orders yet</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Success Toast -->
      <div class="toast" *ngIf="showToast">
        <span>✅</span> {{ toastMessage }}
      </div>
    </div>
  `,
  styles: [`
    .orders-container { display: flex; flex-direction: column; gap: 20px; }

    .page-header { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px; }
    .page-title { margin: 0; font-size: 1.6rem; font-weight: 800; color: var(--text-primary); }
    .page-subtitle { margin: 4px 0 0; color: var(--text-secondary); font-size: 0.9rem; }
    .header-actions { display: flex; gap: 8px; }

    .btn { padding: 10px 18px; border-radius: var(--radius-md); border: none; cursor: pointer; font-size: 0.9rem; font-weight: 600; transition: all 0.2s; }
    .btn-primary { background: var(--accent-primary); color: white; }
    .btn-ghost { background: transparent; border: 1px solid var(--border-color); color: var(--text-secondary); }
    .btn-ghost:hover { background: var(--bg-primary); }
    .btn-full { width: 100%; margin-top: 8px; }

    /* Layout */
    .create-order-layout {
      display: grid; grid-template-columns: 1fr 320px; gap: 20px; align-items: start;
    }

    /* Toolbar */
    .browser-toolbar {
      display: flex; gap: 12px; align-items: center; flex-wrap: wrap; margin-bottom: 16px;
    }
    .search-input {
      flex: 1; min-width: 160px; padding: 10px 14px;
      border: 1px solid var(--border-color); border-radius: var(--radius-md);
      background: var(--bg-primary); color: var(--text-primary); font-size: 0.9rem;
    }
    .view-toggle { display: flex; border: 1px solid var(--border-color); border-radius: var(--radius-sm); overflow: hidden; }
    .toggle-btn { padding: 8px 14px; background: none; border: none; cursor: pointer; font-size: 1rem; color: var(--text-secondary); transition: all 0.15s; }
    .toggle-btn.active { background: var(--accent-primary); color: white; }
    .cols-control { display: flex; align-items: center; gap: 6px; font-size: 0.85rem; color: var(--text-secondary); }
    .cols-select { padding: 6px 10px; border: 1px solid var(--border-color); border-radius: var(--radius-sm); background: var(--bg-primary); color: var(--text-primary); }

    /* Product Grid */
    .product-grid {
      display: grid;
      grid-template-columns: repeat(var(--grid-cols, 3), 1fr);
      gap: 16px;
    }
    .product-card {
      background: var(--surface-card); border: 1px solid var(--border-color);
      border-radius: var(--radius-lg); overflow: hidden; display: flex;
      flex-direction: column; transition: transform 0.2s, box-shadow 0.2s;
    }
    .product-card:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(0,0,0,0.1); }
    .product-card.out-of-stock { opacity: 0.6; }

    .card-image {
      position: relative; height: 140px; background: var(--bg-primary);
      display: flex; align-items: center; justify-content: center; overflow: hidden;
    }
    .card-image img { width: 100%; height: 100%; object-fit: cover; }
    .no-image { font-size: 3rem; color: var(--text-tertiary); }
    .stock-badge {
      position: absolute; top: 8px; right: 8px; padding: 3px 8px;
      border-radius: 999px; font-size: 0.72rem; font-weight: 700;
      background: rgba(16,185,129,0.2); color: #10b981;
    }
    .stock-badge.low { background: rgba(245,158,11,0.2); color: #f59e0b; }
    .stock-badge.out { background: rgba(239,68,68,0.2); color: #ef4444; }

    .card-body { padding: 12px 12px 8px; flex: 1; }
    .product-name { margin: 0 0 2px; font-size: 1rem; font-weight: 700; color: var(--text-primary); line-height: 1.3; }
    .product-category { margin: 0 0 6px; font-size: 0.75rem; color: var(--text-tertiary); }
    .product-price { font-size: 1.15rem; font-weight: 800; color: var(--accent-primary); }

    .card-footer { padding: 8px 12px 12px; }
    .qty-controls { display: flex; align-items: center; gap: 0; border: 1px solid var(--border-color); border-radius: var(--radius-md); overflow: hidden; }
    .qty-btn { width: 36px; height: 36px; border: none; background: var(--bg-primary); cursor: pointer; font-size: 1.2rem; font-weight: 700; color: var(--text-primary); transition: background 0.15s; }
    .qty-btn:hover:not(:disabled) { background: rgba(var(--accent-primary-rgb),0.1); color: var(--accent-primary); }
    .qty-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .qty-value { flex: 1; text-align: center; font-weight: 700; font-size: 1rem; }
    .btn-add { width: 100%; padding: 8px; background: var(--accent-primary); color: white; border: none; border-radius: var(--radius-md); cursor: pointer; font-weight: 600; font-size: 0.9rem; transition: opacity 0.2s; }
    .btn-add:disabled { background: var(--border-color); color: var(--text-tertiary); cursor: not-allowed; }

    /* Product List */
    .product-list { display: flex; flex-direction: column; gap: 8px; }
    .list-item {
      display: flex; align-items: center; gap: 12px;
      background: var(--surface-card); border: 1px solid var(--border-color);
      border-radius: var(--radius-md); padding: 10px 14px;
    }
    .list-item.out-of-stock { opacity: 0.6; }
    .list-image { width: 48px; height: 48px; border-radius: var(--radius-sm); overflow: hidden; flex-shrink: 0; background: var(--bg-primary); display: flex; align-items: center; justify-content: center; }
    .list-image img { width: 100%; height: 100%; object-fit: cover; }
    .no-image-sm { font-size: 1.4rem; }
    .list-info { flex: 1; min-width: 0; }
    .list-name { display: block; font-weight: 700; color: var(--text-primary); font-size: 0.95rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .list-cat { font-size: 0.75rem; color: var(--text-tertiary); }
    .list-stock { font-size: 0.8rem; color: var(--text-secondary); width: 80px; text-align: center; }
    .low-text { color: #f59e0b; font-weight: 700; }
    .list-price { width: 90px; text-align: right; font-weight: 700; color: var(--accent-primary); font-size: 1rem; }
    .list-qty { width: 130px; flex-shrink: 0; }
    .btn-add-sm { padding: 6px 16px; background: var(--accent-primary); color: white; border: none; border-radius: var(--radius-sm); cursor: pointer; font-weight: 600; font-size: 0.85rem; white-space: nowrap; }

    /* Order Summary Panel */
    .order-summary {
      background: var(--surface-card); border: 1px solid var(--border-color);
      border-radius: var(--radius-lg); padding: 20px;
      display: flex; flex-direction: column; gap: 14px;
      position: sticky; top: 16px; max-height: calc(100vh - 120px); overflow-y: auto;
    }
    .summary-title { margin: 0; font-size: 1.2rem; font-weight: 800; color: var(--text-primary); }

    .form-group { display: flex; flex-direction: column; gap: 6px; }
    .form-group label { font-size: 0.82rem; font-weight: 600; color: var(--text-secondary); }
    .form-select, .form-input {
      padding: 9px 12px; border: 1px solid var(--border-color);
      border-radius: var(--radius-sm); background: var(--bg-primary);
      color: var(--text-primary); font-size: 0.9rem; width: 100%;
    }

    .selected-employee {
      display: flex; align-items: center; gap: 10px;
      background: rgba(var(--accent-primary-rgb),0.05); border-radius: var(--radius-md);
      padding: 10px 12px; border: 1px solid rgba(var(--accent-primary-rgb),0.2);
    }
    .emp-mini-photo { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; }
    .emp-mini-initials {
      width: 40px; height: 40px; border-radius: 50%; background: var(--accent-primary);
      display: flex; align-items: center; justify-content: center; color: white; font-weight: 700; font-size: 0.9rem;
    }
    .emp-mini-info { display: flex; flex-direction: column; }
    .emp-mini-name { font-weight: 700; font-size: 0.9rem; color: var(--text-primary); }
    .emp-mini-role { font-size: 0.75rem; color: var(--text-secondary); }

    .cart-items { display: flex; flex-direction: column; gap: 8px; min-height: 60px; }
    .cart-empty { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 20px; color: var(--text-tertiary); font-size: 1.5rem; }
    .cart-empty p { margin: 0; font-size: 0.85rem; }
    .cart-item {
      display: flex; align-items: center; gap: 8px;
      padding: 8px; background: var(--bg-primary); border-radius: var(--radius-sm);
      border: 1px solid var(--border-color);
    }
    .cart-item-img { width: 36px; height: 36px; border-radius: 6px; overflow: hidden; flex-shrink: 0; background: var(--surface-card); display: flex; align-items: center; justify-content: center; font-size: 1rem; }
    .cart-item-img img { width: 100%; height: 100%; object-fit: cover; }
    .no-img-xs { font-size: 0.9rem; }
    .cart-item-info { flex: 1; min-width: 0; }
    .cart-item-name { display: block; font-weight: 600; font-size: 0.85rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .cart-item-price { font-size: 0.75rem; color: var(--text-secondary); }
    .cart-item-total { font-weight: 700; font-size: 0.9rem; color: var(--accent-primary); white-space: nowrap; }
    .remove-btn { background: none; border: none; cursor: pointer; color: var(--text-tertiary); font-size: 0.8rem; padding: 4px; border-radius: 4px; transition: color 0.15s; }
    .remove-btn:hover { color: #ef4444; }

    .summary-total { display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-top: 2px solid var(--border-color); }
    .summary-total span:first-child { font-weight: 600; color: var(--text-secondary); }
    .total-amount { font-size: 1.4rem; font-weight: 800; color: var(--text-primary); }

    .empty-products { grid-column: 1/-1; display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 48px; color: var(--text-tertiary); font-size: 2rem; }
    .empty-products p { font-size: 0.9rem; margin: 0; }

    /* History */
    .order-history { display: flex; flex-direction: column; gap: 16px; }
    .history-filters { display: flex; gap: 12px; flex-wrap: wrap; }
    .status-select { padding: 10px 14px; border: 1px solid var(--border-color); border-radius: var(--radius-md); background: var(--bg-primary); color: var(--text-primary); }
    .orders-table-wrap { overflow-x: auto; border-radius: var(--radius-md); border: 1px solid var(--border-color); }
    .orders-table { width: 100%; border-collapse: collapse; }
    .orders-table th, .orders-table td { padding: 12px 16px; border-bottom: 1px solid var(--border-color); text-align: left; }
    .orders-table th { background: rgba(0,0,0,0.02); font-weight: 600; color: var(--text-secondary); font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.5px; }
    .order-name-cell { display: flex; align-items: center; gap: 8px; }
    .order-thumb { width: 36px; height: 36px; border-radius: 6px; overflow: hidden; }
    .order-thumb img { width: 100%; height: 100%; object-fit: cover; }
    .emp-cell { display: flex; align-items: center; gap: 6px; }
    .emp-xs { width: 28px; height: 28px; border-radius: 50%; object-fit: cover; }
    .demo-badge { background: #8b5cf6; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.65rem; }
    .total-cell { font-weight: 700; color: var(--accent-primary); }
    .status-badge { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 0.78rem; font-weight: 700; }
    .status-badge.pending { background: rgba(245,158,11,0.15); color: #f59e0b; }
    .status-badge.billed { background: rgba(16,185,129,0.15); color: #10b981; }
    .action-btn { background: none; border: none; cursor: pointer; font-size: 1rem; opacity: 0.6; transition: opacity 0.2s; }
    .action-btn:hover { opacity: 1; }
    .empty-row { text-align: center; padding: 32px; color: var(--text-tertiary); }

    /* Toast */
    .toast {
      position: fixed; bottom: 24px; right: 24px; z-index: 9999;
      background: #10b981; color: white; padding: 14px 20px; border-radius: var(--radius-md);
      font-weight: 600; box-shadow: 0 8px 24px rgba(16,185,129,0.3);
      animation: slideIn 0.3s ease;
    }
    @keyframes slideIn { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

    @media (max-width: 900px) {
      .create-order-layout { grid-template-columns: 1fr; }
      .order-summary { position: static; max-height: none; }
    }
    @media (max-width: 600px) {
      .product-grid { grid-template-columns: repeat(2, 1fr) !important; }
    }
  `]
})
export class OrdersComponent implements OnInit {
  activeView: 'create' | 'history' = 'create';
  products: Product[] = [];
  filteredProducts: Product[] = [];
  employees: Employee[] = [];
  orders: Order[] = [];
  filteredOrders: Order[] = [];

  searchTerm = '';
  historySearch = '';
  statusFilter = '';
  viewMode: 'grid' | 'list' = 'grid';
  gridCols = 3;

  cartItems: OrderItem[] = [];
  selectedEmployeeId = '';
  selectedEmployee: Employee | null = null;
  orderName = '';
  grandTotal = 0;

  showToast = false;
  toastMessage = '';

  constructor(private state: BillingStateService) {}

  ngOnInit() {
    this.state.products$.subscribe(p => {
      this.products = p.filter(x => !x.isHidden);
      this.filterProducts();
    });
    this.state.employees$.subscribe(e => this.employees = e);
    this.state.orders$.subscribe(o => {
      this.orders = [...o].reverse();
      this.filterOrders();
    });
  }

  filterProducts() {
    const term = this.searchTerm.toLowerCase();
    this.filteredProducts = term
      ? this.products.filter(p => p.name.toLowerCase().includes(term) || (p.category || '').toLowerCase().includes(term))
      : [...this.products];
  }

  filterOrders() {
    let result = [...this.orders];
    if (this.historySearch) {
      const term = this.historySearch.toLowerCase();
      result = result.filter(o => o.name.toLowerCase().includes(term) || (o.employeeName || '').toLowerCase().includes(term));
    }
    if (this.statusFilter) {
      result = result.filter(o => o.status === this.statusFilter);
    }
    this.filteredOrders = result;
  }

  getQty(productId: string): number {
    return this.cartItems.find(i => i.productId === productId)?.quantity || 0;
  }

  incrementQty(p: Product) {
    const existing = this.cartItems.find(i => i.productId === p.id);
    if (existing) {
      existing.quantity++;
      existing.total = existing.quantity * existing.unitPrice;
    } else {
      this.cartItems.push({
        productId: p.id,
        productName: p.name,
        productImage: p.imageUrl,
        quantity: 1,
        unitPrice: p.price,
        total: p.price
      });
    }
    this.calculateTotal();
  }

  decrementQty(p: Product) {
    const idx = this.cartItems.findIndex(i => i.productId === p.id);
    if (idx === -1) return;
    if (this.cartItems[idx].quantity <= 1) {
      this.cartItems.splice(idx, 1);
    } else {
      this.cartItems[idx].quantity--;
      this.cartItems[idx].total = this.cartItems[idx].quantity * this.cartItems[idx].unitPrice;
    }
    this.calculateTotal();
  }

  removeFromCart(productId: string) {
    this.cartItems = this.cartItems.filter(i => i.productId !== productId);
    this.calculateTotal();
  }

  calculateTotal() {
    this.grandTotal = this.cartItems.reduce((acc, i) => acc + i.total, 0);
  }

  onEmployeeChange() {
    this.selectedEmployee = this.employees.find(e => e.id === this.selectedEmployeeId) || null;
  }

  getInitials(name: string) {
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  }

  confirmOrder() {
    if (this.cartItems.length === 0 || !this.orderName.trim()) return;

    const firstImage = this.cartItems.find(i => i.productImage)?.productImage;
    const order: Order = {
      id: 'ORD-' + Date.now().toString().slice(-7),
      name: this.orderName.trim(),
      date: new Date().toISOString(),
      employeeId: this.selectedEmployee?.id,
      employeeName: this.selectedEmployee?.name,
      employeePhoto: this.selectedEmployee?.photoUrl,
      items: [...this.cartItems],
      grandTotal: this.grandTotal,
      status: 'pending',
      imageUrl: firstImage
    };

    this.state.addOrder(order);
    this.showSuccessToast(`Order "${order.name}" saved successfully!`);
    this.clearCart();
    this.activeView = 'history';
  }

  clearCart() {
    this.cartItems = [];
    this.grandTotal = 0;
    this.orderName = '';
    this.selectedEmployeeId = '';
    this.selectedEmployee = null;
  }

  deleteOrder(id: string) {
    if (confirm('Delete this order?')) {
      this.state.deleteOrder(id);
    }
  }

  showSuccessToast(msg: string) {
    this.toastMessage = msg;
    this.showToast = true;
    setTimeout(() => this.showToast = false, 3000);
  }
}
