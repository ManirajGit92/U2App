import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BillingStateService } from '../../services/billing-state.service';
import { Product } from '../../models/billing.models';

@Component({
  selector: 'app-product-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="crud-container">
      <div class="actions-header">
        <input type="text" class="search-input" placeholder="Search products..." [(ngModel)]="searchTerm" (ngModelChange)="filterProducts()">
        <button class="btn btn-primary" (click)="openAddModal()">+ Add Product</button>
      </div>

      <div class="table-card glass-card">
        <table class="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Category</th>
              <th>Price</th>
              <th>Stock</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let p of filteredProducts">
              <td>{{ p.id }}</td>
              <td>{{ p.name }}</td>
              <td>{{ p.category || '-' }}</td>
              <td>₹{{ p.price | number:'1.2-2' }}</td>
              <td>
                <span [class.text-danger]="p.stock <= p.lowStockThreshold">{{ p.stock }}</span>
              </td>
              <td>
                <span class="badge" [class.badge-danger]="p.isHidden" [class.badge-success]="!p.isHidden">
                  {{ p.isHidden ? 'Hidden' : 'Visible' }}
                </span>
              </td>
              <td class="actions-cell">
                <button class="action-btn edit" (click)="openEditModal(p)">✏️</button>
                <button class="action-btn delete" (click)="deleteProduct(p.id)">🗑️</button>
              </td>
            </tr>
            <tr *ngIf="filteredProducts.length === 0">
              <td colspan="7" class="empty-state">No products found.</td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <!-- Modal (Simplified HTML for brevity; ideally a separate component if it grows) -->
      <div class="modal-overlay" *ngIf="showModal">
        <div class="modal glass-card">
          <h3>{{ editingProduct ? 'Edit' : 'Add' }} Product</h3>
          <div class="form-grid">
            <div class="form-group">
              <label>ID</label>
              <input type="text" [(ngModel)]="currentForm.id" [disabled]="!!editingProduct">
            </div>
            <div class="form-group">
              <label>Name</label>
              <input type="text" [(ngModel)]="currentForm.name">
            </div>
            <div class="form-group">
              <label>Category</label>
              <input type="text" [(ngModel)]="currentForm.category">
            </div>
            <div class="form-group">
              <label>Price</label>
              <input type="number" [(ngModel)]="currentForm.price">
            </div>
            <div class="form-group">
              <label>Stock</label>
              <input type="number" [(ngModel)]="currentForm.stock">
            </div>
            <div class="form-group">
              <label>Low Stock Threshold</label>
              <input type="number" [(ngModel)]="currentForm.lowStockThreshold">
            </div>
            <div class="form-group" style="grid-column: 1 / -1">
              <label>Description</label>
              <textarea [(ngModel)]="currentForm.description"></textarea>
            </div>
            <div class="form-check" style="grid-column: 1 / -1">
              <input type="checkbox" id="isHidden" [(ngModel)]="currentForm.isHidden">
              <label for="isHidden">Hide Product (Soft Delete)</label>
            </div>
          </div>
          <div class="modal-actions">
            <button class="btn btn-secondary" (click)="showModal = false">Cancel</button>
            <button class="btn btn-primary" (click)="saveProduct()">Save</button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .crud-container {
      display: flex;
      flex-direction: column;
      gap: 24px;
    }
    .actions-header {
      display: flex;
      justify-content: space-between;
      gap: 16px;
    }
    .search-input {
      flex: 1;
      max-width: 300px;
      padding: 10px 16px;
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      background: var(--bg-primary);
      color: var(--text-primary);
    }
    .table-card {
      overflow-x: auto;
      border-radius: var(--radius-md);
    }
    .data-table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
    }
    .data-table th, .data-table td {
      padding: 16px;
      border-bottom: 1px solid var(--border-color);
    }
    .data-table th {
      background: rgba(0,0,0,0.02);
      font-weight: 600;
      color: var(--text-secondary);
    }
    .text-danger {
      color: #ef4444;
      font-weight: 700;
    }
    .badge {
      padding: 4px 8px;
      border-radius: 999px;
      font-size: 0.8rem;
      font-weight: 600;
    }
    .badge-success { background: rgba(16,185,129,0.1); color: #10b981; }
    .badge-danger { background: rgba(239,68,68,0.1); color: #ef4444; }
    .actions-cell {
      display: flex;
      gap: 8px;
    }
    .action-btn {
      background: none;
      border: none;
      cursor: pointer;
      font-size: 1.1rem;
      opacity: 0.7;
      transition: opacity 0.2s;
    }
    .action-btn:hover { opacity: 1; }
    .empty-state { text-align: center; color: var(--text-tertiary); padding: 32px !important; }

    /* Modal */
    .modal-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,0.5);
      display: flex; align-items: center; justify-content: center; z-index: 100;
    }
    .modal {
      background: var(--surface-card); width: 100%; max-width: 600px;
      padding: 32px; border-radius: var(--radius-lg);
    }
    .form-grid {
      display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 24px 0;
    }
    .form-group { display: flex; flex-direction: column; gap: 6px; }
    .form-group label { font-size: 0.85rem; color: var(--text-secondary); }
    .form-group input, .form-group textarea {
      padding: 10px; border: 1px solid var(--border-color); border-radius: var(--radius-sm);
      background: var(--bg-primary); color: var(--text-primary);
    }
    .form-check { display: flex; align-items: center; gap: 8px; }
    .modal-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 24px; }
  `]
})
export class ProductManagementComponent implements OnInit {
  products: Product[] = [];
  filteredProducts: Product[] = [];
  searchTerm = '';

  showModal = false;
  editingProduct: Product | null = null;
  currentForm: any = {};

  constructor(private state: BillingStateService) {}

  ngOnInit() {
    this.state.products$.subscribe(data => {
      this.products = data;
      this.filterProducts();
    });
  }

  filterProducts() {
    if (!this.searchTerm) {
      this.filteredProducts = [...this.products];
      return;
    }
    const term = this.searchTerm.toLowerCase();
    this.filteredProducts = this.products.filter(p => 
      p.name.toLowerCase().includes(term) || 
      p.id.toLowerCase().includes(term) ||
      (p.category && p.category.toLowerCase().includes(term))
    );
  }

  openAddModal() {
    this.editingProduct = null;
    this.currentForm = {
      id: 'PRD-' + Date.now().toString().slice(-6),
      name: '', category: '', price: 0, stock: 0, lowStockThreshold: 10, isHidden: false, description: ''
    };
    this.showModal = true;
  }

  openEditModal(p: Product) {
    this.editingProduct = p;
    this.currentForm = { ...p };
    this.showModal = true;
  }

  saveProduct() {
    if (!this.currentForm.id || !this.currentForm.name) return;
    
    if (this.editingProduct) {
      this.state.updateProduct(this.currentForm);
    } else {
      this.state.addProduct(this.currentForm);
    }
    this.showModal = false;
  }

  deleteProduct(id: string) {
    if (confirm('Are you sure you want to completely delete this product? Consider hiding it instead.')) {
      this.state.deleteProduct(id);
    }
  }
}
