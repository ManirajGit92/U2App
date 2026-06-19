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
      <div class="page-header">
        <div>
          <h2 class="page-title">📦 Products</h2>
          <p class="page-subtitle">Manage your product catalog and inventory</p>
        </div>
        <button class="btn btn-primary" (click)="openAddModal()">+ Add Product</button>
      </div>

      <div class="actions-header">
        <input type="text" class="search-input" placeholder="🔍 Search products..." [(ngModel)]="searchTerm" (ngModelChange)="filterProducts()">
      </div>

      <div class="table-card">
        <table class="data-table">
          <thead>
            <tr>
              <th>Image</th>
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
              <td>
                <div class="product-thumb">
                  <img *ngIf="p.imageUrl" [src]="p.imageUrl" [alt]="p.name">
                  <div *ngIf="!p.imageUrl" class="thumb-placeholder">📦</div>
                </div>
              </td>
              <td class="id-cell">{{ p.id }}</td>
              <td class="name-cell">
                {{ p.name }}
                <span class="demo-badge" *ngIf="p.isDemo">Demo</span>
              </td>
              <td>{{ p.category || '-' }}</td>
              <td class="price-cell">₹{{ p.price | number:'1.2-2' }}</td>
              <td>
                <span [class.text-danger]="p.stock <= p.lowStockThreshold" [class.text-success]="p.stock > p.lowStockThreshold">
                  {{ p.stock }}
                  <span class="low-badge" *ngIf="p.stock <= p.lowStockThreshold && p.stock > 0">⚠️ Low</span>
                  <span class="out-badge" *ngIf="p.stock === 0">❌ Out</span>
                </span>
              </td>
              <td>
                <span class="badge" [class.badge-danger]="p.isHidden" [class.badge-success]="!p.isHidden">
                  {{ p.isHidden ? 'Hidden' : 'Visible' }}
                </span>
              </td>
              <td class="actions-cell">
                <button class="action-btn edit" (click)="openEditModal(p)" title="Edit">✏️</button>
                <button class="action-btn delete" (click)="deleteProduct(p.id)" title="Delete">🗑️</button>
              </td>
            </tr>
            <tr *ngIf="filteredProducts.length === 0">
              <td colspan="8" class="empty-state">No products found.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Modal -->
      <div class="modal-overlay" *ngIf="showModal" (click)="onOverlayClick($event)">
        <div class="modal-panel" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>{{ editingProduct ? 'Edit' : 'Add' }} Product</h3>
            <button class="modal-close" (click)="showModal = false">✕</button>
          </div>

          <!-- Image Upload -->
          <div class="image-upload-section">
            <div class="image-preview-box" (click)="imageInput.click()">
              <img *ngIf="currentForm.imageUrl" [src]="currentForm.imageUrl" alt="Preview" class="preview-img">
              <div *ngIf="!currentForm.imageUrl" class="image-placeholder">
                <span>🖼️</span>
                <small>Click to upload product image</small>
              </div>
            </div>
            <input #imageInput type="file" accept="image/*" style="display:none" (change)="onImageChange($event)">
            <div class="image-actions">
              <button class="btn btn-sm btn-secondary" (click)="imageInput.click()">Upload Image</button>
              <button *ngIf="currentForm.imageUrl" class="btn btn-sm btn-danger" (click)="currentForm.imageUrl = ''">Remove</button>
            </div>
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label>ID *</label>
              <input type="text" [(ngModel)]="currentForm.id" [disabled]="!!editingProduct" placeholder="PRD-001">
            </div>
            <div class="form-group">
              <label>Name *</label>
              <input type="text" [(ngModel)]="currentForm.name" placeholder="Product Name">
            </div>
            <div class="form-group">
              <label>Category</label>
              <input type="text" [(ngModel)]="currentForm.category" placeholder="General">
            </div>
            <div class="form-group">
              <label>Price (₹) *</label>
              <input type="number" [(ngModel)]="currentForm.price" min="0">
            </div>
            <div class="form-group">
              <label>Stock</label>
              <input type="number" [(ngModel)]="currentForm.stock" min="0">
            </div>
            <div class="form-group">
              <label>Low Stock Threshold</label>
              <input type="number" [(ngModel)]="currentForm.lowStockThreshold" min="0">
            </div>
            <div class="form-group">
              <label>Barcode / QR Value</label>
              <input type="text" [(ngModel)]="currentForm.barcode" placeholder="Optional">
            </div>
            <div class="form-group full-width">
              <label>Description</label>
              <textarea [(ngModel)]="currentForm.description" rows="2"></textarea>
            </div>
            <div class="form-check full-width">
              <input type="checkbox" id="isHidden" [(ngModel)]="currentForm.isHidden">
              <label for="isHidden">Hide Product (Soft Delete)</label>
            </div>
          </div>

          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="showModal = false">Cancel</button>
            <button class="btn btn-primary" (click)="saveProduct()">{{ editingProduct ? 'Update' : 'Add' }} Product</button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .crud-container { display: flex; flex-direction: column; gap: 20px; }
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px; }
    .page-title { margin: 0; font-size: 1.6rem; font-weight: 800; color: var(--text-primary); }
    .page-subtitle { margin: 4px 0 0; color: var(--text-secondary); font-size: 0.9rem; }

    .actions-header { display: flex; gap: 12px; }
    .search-input { flex: 1; max-width: 380px; padding: 10px 16px; border: 1px solid var(--border-color); border-radius: var(--radius-md); background: var(--bg-primary); color: var(--text-primary); }

    .table-card { overflow-x: auto; border: 1px solid var(--border-color); border-radius: var(--radius-md); background: var(--surface-card); }
    .data-table { width: 100%; border-collapse: collapse; }
    .data-table th, .data-table td { padding: 10px 14px; border-bottom: 1px solid var(--border-color); text-align: left; vertical-align: middle; }
    .data-table th { background: rgba(0,0,0,0.02); font-weight: 700; color: var(--text-secondary); font-size: 0.82rem; text-transform: uppercase; letter-spacing: 0.4px; }
    .data-table tr:last-child td { border-bottom: none; }

    .product-thumb { width: 44px; height: 44px; border-radius: 8px; overflow: hidden; background: var(--bg-primary); display: flex; align-items: center; justify-content: center; font-size: 1.3rem; }
    .product-thumb img { width: 100%; height: 100%; object-fit: cover; }
    .thumb-placeholder { font-size: 1.3rem; }

    .id-cell { font-family: monospace; font-size: 0.82rem; color: var(--text-secondary); }
    .name-cell { font-weight: 700; color: var(--text-primary); }
    .price-cell { font-weight: 700; color: var(--accent-primary); }
    .text-danger { color: #ef4444; font-weight: 700; }
    .text-success { color: #10b981; font-weight: 600; }
    .low-badge, .out-badge { font-size: 0.7rem; margin-left: 4px; }

    .badge { padding: 3px 10px; border-radius: 999px; font-size: 0.78rem; font-weight: 700; }
    .badge-success { background: rgba(16,185,129,0.1); color: #10b981; }
    .badge-danger { background: rgba(239,68,68,0.1); color: #ef4444; }
    .actions-cell { display: flex; gap: 6px; }
    .action-btn { background: none; border: none; cursor: pointer; font-size: 1.1rem; opacity: 0.6; transition: opacity 0.2s; padding: 4px; border-radius: 6px; }
    .action-btn:hover { opacity: 1; background: rgba(0,0,0,0.05); }
    .empty-state { text-align: center; color: var(--text-tertiary); padding: 32px !important; }
    .demo-badge { background: #8b5cf6; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.65rem; margin-left: 6px; vertical-align: middle; }

    /* Modal */
    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 16px; }
    .modal-panel { background: var(--surface-card); width: 100%; max-width: 580px; max-height: 90vh; overflow-y: auto; border-radius: var(--radius-lg); box-shadow: 0 24px 48px rgba(0,0,0,0.2); }
    .modal-header { display: flex; justify-content: space-between; align-items: center; padding: 18px 22px; border-bottom: 1px solid var(--border-color); }
    .modal-header h3 { margin: 0; font-size: 1.15rem; font-weight: 700; }
    .modal-close { background: none; border: none; cursor: pointer; font-size: 1.2rem; color: var(--text-secondary); padding: 4px 8px; border-radius: 6px; }
    .modal-close:hover { background: rgba(0,0,0,0.05); }

    .image-upload-section { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 16px 22px; border-bottom: 1px solid var(--border-color); }
    .image-preview-box { width: 140px; height: 140px; border-radius: var(--radius-md); border: 2px dashed var(--border-color); overflow: hidden; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: border-color 0.2s; background: var(--bg-primary); }
    .image-preview-box:hover { border-color: var(--accent-primary); }
    .preview-img { width: 100%; height: 100%; object-fit: cover; }
    .image-placeholder { display: flex; flex-direction: column; align-items: center; gap: 6px; color: var(--text-tertiary); font-size: 2rem; }
    .image-placeholder small { font-size: 0.72rem; text-align: center; }
    .image-actions { display: flex; gap: 8px; }

    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; padding: 18px 22px; }
    .form-group { display: flex; flex-direction: column; gap: 5px; }
    .full-width { grid-column: 1/-1; }
    .form-group label { font-size: 0.82rem; font-weight: 600; color: var(--text-secondary); }
    .form-group input, .form-group textarea { padding: 9px 12px; border: 1px solid var(--border-color); border-radius: var(--radius-sm); background: var(--bg-primary); color: var(--text-primary); font-size: 0.9rem; }
    .form-group input:focus, .form-group textarea:focus { outline: none; border-color: var(--accent-primary); }
    .form-group input:disabled { opacity: 0.5; cursor: not-allowed; }
    .form-check { display: flex; align-items: center; gap: 8px; font-size: 0.9rem; }

    .modal-footer { display: flex; justify-content: flex-end; gap: 10px; padding: 14px 22px; border-top: 1px solid var(--border-color); }

    .btn { padding: 9px 18px; border-radius: var(--radius-md); border: none; cursor: pointer; font-weight: 600; font-size: 0.9rem; transition: all 0.2s; }
    .btn-primary { background: var(--accent-primary); color: white; }
    .btn-secondary { background: var(--bg-primary); border: 1px solid var(--border-color); color: var(--text-primary); }
    .btn-danger { background: rgba(239,68,68,0.1); color: #ef4444; border: 1px solid rgba(239,68,68,0.3); }
    .btn-sm { padding: 6px 12px; font-size: 0.82rem; }

    @media (max-width: 600px) {
      .form-grid { grid-template-columns: 1fr; }
    }
  `]
})
export class ProductManagementComponent implements OnInit {
  products: Product[] = [];
  filteredProducts: Product[] = [];
  searchTerm = '';
  showModal = false;
  editingProduct: Product | null = null;
  currentForm: Partial<Product> & { barcode?: string } = {};

  constructor(private state: BillingStateService) {}

  ngOnInit() {
    this.state.products$.subscribe(data => {
      this.products = data;
      this.filterProducts();
    });
  }

  filterProducts() {
    if (!this.searchTerm) { this.filteredProducts = [...this.products]; return; }
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
      name: '', category: '', price: 0, stock: 0,
      lowStockThreshold: 10, isHidden: false, description: '', imageUrl: '', barcode: ''
    };
    this.showModal = true;
  }

  openEditModal(p: Product) {
    this.editingProduct = p;
    this.currentForm = { ...p };
    this.showModal = true;
  }

  onImageChange(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => { this.currentForm.imageUrl = e.target?.result as string; };
    reader.readAsDataURL(file);
  }

  saveProduct() {
    if (!this.currentForm.id || !this.currentForm.name) return;
    const product = this.currentForm as Product;
    if (this.editingProduct) {
      this.state.updateProduct(product);
    } else {
      this.state.addProduct(product);
    }
    this.showModal = false;
  }

  deleteProduct(id: string) {
    if (confirm('Delete this product? Consider hiding it instead.')) {
      this.state.deleteProduct(id);
    }
  }

  onOverlayClick(e: MouseEvent) {
    if ((e.target as HTMLElement).classList.contains('modal-overlay')) {
      this.showModal = false;
    }
  }
}
