import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BillingStateService } from '../../services/billing-state.service';
import { Purchase, Product } from '../../models/billing.models';

@Component({
  selector: 'app-purchase-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="crud-container">
      <div class="actions-header">
        <input type="text" class="search-input" placeholder="Search purchases..." [(ngModel)]="searchTerm" (ngModelChange)="filterPurchases()">
        <button class="btn btn-primary" (click)="openAddModal()">+ Record Inbound Purchase</button>
      </div>

      <div class="table-card glass-card">
        <table class="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Date</th>
              <th>Product</th>
              <th>Qty Added</th>
              <th>Total Cost</th>
              <th>Supplier</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let p of filteredPurchases">
              <td>{{ p.id }}</td>
              <td>{{ p.date | date:'short' }}</td>
              <td>{{ getProductName(p.productId) }}</td>
              <td class="text-success">+{{ p.quantity }}</td>
              <td>₹{{ p.costPrice | number:'1.2-2' }}</td>
              <td>{{ p.supplier || '-' }}</td>
            </tr>
            <tr *ngIf="filteredPurchases.length === 0">
              <td colspan="6" class="empty-state">No purchases recorded.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Add Purchase Modal -->
      <div class="modal-overlay" *ngIf="showModal">
        <div class="modal glass-card">
          <h3>Record Purchase</h3>
          <p class="text-muted text-sm">Recording a purchase will automatically increment the stock of the selected product.</p>
          
          <div class="form-grid">
            <div class="form-group" style="grid-column: 1 / -1">
              <label>Select Product</label>
              <select [(ngModel)]="currentForm.productId" class="search-input" style="width: 100%; max-width: none;">
                <option *ngFor="let prod of products" [value]="prod.id">{{ prod.name }} (Stock: {{ prod.stock }})</option>
              </select>
            </div>
            <div class="form-group">
              <label>Quantity Extracted</label>
              <input type="number" [(ngModel)]="currentForm.quantity" min="1">
            </div>
            <div class="form-group">
              <label>Total Cost Price (₹)</label>
              <input type="number" [(ngModel)]="currentForm.costPrice" min="0">
            </div>
            <div class="form-group" style="grid-column: 1 / -1">
              <label>Supplier Name / Invoice Ref</label>
              <input type="text" [(ngModel)]="currentForm.supplier">
            </div>
          </div>
          
          <div class="modal-actions">
            <button class="btn btn-secondary" (click)="showModal = false">Cancel</button>
            <button class="btn btn-primary" (click)="savePurchase()">Record & Update Stock</button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .crud-container { display: flex; flex-direction: column; gap: 24px; }
    .actions-header { display: flex; justify-content: space-between; gap: 16px; }
    .search-input { flex: 1; max-width: 300px; padding: 10px 16px; border: 1px solid var(--border-color); border-radius: var(--radius-md); background: var(--bg-primary); color: var(--text-primary); }
    .table-card { overflow-x: auto; border-radius: var(--radius-md); }
    .data-table { width: 100%; border-collapse: collapse; text-align: left; }
    .data-table th, .data-table td { padding: 16px; border-bottom: 1px solid var(--border-color); }
    .data-table th { background: rgba(0,0,0,0.02); font-weight: 600; color: var(--text-secondary); }
    .text-success { color: #10b981; font-weight: 700; }
    .text-sm { font-size: 0.85rem; }
    .text-muted { color: var(--text-secondary); margin-bottom: 16px; display: block; }
    .empty-state { text-align: center; color: var(--text-tertiary); padding: 32px !important; }

    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 100; }
    .modal { background: var(--surface-card); width: 100%; max-width: 500px; padding: 32px; border-radius: var(--radius-lg); }
    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 16px 0; }
    .form-group { display: flex; flex-direction: column; gap: 6px; }
    .form-group label { font-size: 0.85rem; color: var(--text-secondary); }
    .form-group input, .form-group select { padding: 10px; border: 1px solid var(--border-color); border-radius: var(--radius-sm); background: var(--bg-primary); color: var(--text-primary); }
    .modal-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 24px; }
  `]
})
export class PurchaseManagementComponent implements OnInit {
  purchases: Purchase[] = [];
  filteredPurchases: Purchase[] = [];
  products: Product[] = [];
  searchTerm = '';

  showModal = false;
  currentForm: any = {};

  constructor(private state: BillingStateService) {}

  ngOnInit() {
    this.state.products$.subscribe(p => this.products = p);
    this.state.purchases$.subscribe(data => {
      this.purchases = data;
      this.filterPurchases();
    });
  }

  getProductName(id: string) {
    const p = this.products.find(x => x.id === id);
    return p ? p.name : id;
  }

  filterPurchases() {
    if (!this.searchTerm) {
      this.filteredPurchases = [...this.purchases];
      return;
    }
    const term = this.searchTerm.toLowerCase();
    this.filteredPurchases = this.purchases.filter(p => 
      p.id.toLowerCase().includes(term) ||
      (p.supplier && p.supplier.toLowerCase().includes(term))
    );
  }

  openAddModal() {
    if (this.products.length === 0) {
      alert('Please add products first before recording a purchase.');
      return;
    }
    this.currentForm = {
      id: 'PUR-' + Date.now().toString().slice(-6),
      date: new Date().toISOString(),
      productId: this.products[0].id,
      quantity: 1,
      costPrice: 0,
      supplier: ''
    };
    this.showModal = true;
  }

  savePurchase() {
    if (!this.currentForm.productId || this.currentForm.quantity <= 0) return;
    this.state.addPurchase(this.currentForm);
    this.showModal = false;
  }
}
