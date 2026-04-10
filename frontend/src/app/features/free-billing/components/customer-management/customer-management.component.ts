import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BillingStateService } from '../../services/billing-state.service';
import { Customer } from '../../models/billing.models';

@Component({
  selector: 'app-customer-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="crud-container">
      <div class="actions-header">
        <input type="text" class="search-input" placeholder="Search customers..." [(ngModel)]="searchTerm" (ngModelChange)="filterCustomers()">
        <button class="btn btn-primary" (click)="openAddModal()">+ Add Customer</button>
      </div>

      <div class="table-card glass-card">
        <table class="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Phone</th>
              <th>Email</th>
              <th>Total Purchased</th>
              <th>Rating</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let c of filteredCustomers">
              <td>{{ c.id }}</td>
              <td>{{ c.name }}</td>
              <td>{{ c.phone }}</td>
              <td>{{ c.email || '-' }}</td>
              <td>₹{{ c.totalPurchasedAmount | number:'1.2-2' }}</td>
              <td>{{ c.rating ? c.rating + '⭐' : '-' }}</td>
              <td class="actions-cell">
                <button class="action-btn edit" (click)="openEditModal(c)">✏️</button>
                <button class="action-btn delete" (click)="deleteCustomer(c.id)">🗑️</button>
              </td>
            </tr>
            <tr *ngIf="filteredCustomers.length === 0">
              <td colspan="7" class="empty-state">No customers found.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Modal -->
      <div class="modal-overlay" *ngIf="showModal">
        <div class="modal glass-card">
          <h3>{{ editingCustomer ? 'Edit' : 'Add' }} Customer</h3>
          <div class="form-grid">
            <div class="form-group">
              <label>ID</label>
              <input type="text" [(ngModel)]="currentForm.id" [disabled]="!!editingCustomer">
            </div>
            <div class="form-group">
              <label>Name</label>
              <input type="text" [(ngModel)]="currentForm.name">
            </div>
            <div class="form-group">
              <label>Phone</label>
              <input type="text" [(ngModel)]="currentForm.phone">
            </div>
            <div class="form-group">
              <label>Email</label>
              <input type="email" [(ngModel)]="currentForm.email">
            </div>
            <div class="form-group">
              <label>Rating (1-5)</label>
              <input type="number" min="1" max="5" [(ngModel)]="currentForm.rating">
            </div>
            <div class="form-group" style="grid-column: 1 / -1">
              <label>Address</label>
              <textarea [(ngModel)]="currentForm.address"></textarea>
            </div>
            <div class="form-check" style="grid-column: 1 / -1">
              <input type="checkbox" id="isHidden" [(ngModel)]="currentForm.isHidden">
              <label for="isHidden">Hide Customer</label>
            </div>
          </div>
          <div class="modal-actions">
            <button class="btn btn-secondary" (click)="showModal = false">Cancel</button>
            <button class="btn btn-primary" (click)="saveCustomer()">Save</button>
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
    .actions-cell { display: flex; gap: 8px; }
    .action-btn { background: none; border: none; cursor: pointer; font-size: 1.1rem; opacity: 0.7; transition: opacity 0.2s; }
    .action-btn:hover { opacity: 1; }
    .empty-state { text-align: center; color: var(--text-tertiary); padding: 32px !important; }

    /* Modal */
    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 100; }
    .modal { background: var(--surface-card); width: 100%; max-width: 600px; padding: 32px; border-radius: var(--radius-lg); }
    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 24px 0; }
    .form-group { display: flex; flex-direction: column; gap: 6px; }
    .form-group label { font-size: 0.85rem; color: var(--text-secondary); }
    .form-group input, .form-group textarea { padding: 10px; border: 1px solid var(--border-color); border-radius: var(--radius-sm); background: var(--bg-primary); color: var(--text-primary); }
    .form-check { display: flex; align-items: center; gap: 8px; }
    .modal-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 24px; }
  `]
})
export class CustomerManagementComponent implements OnInit {
  customers: Customer[] = [];
  filteredCustomers: Customer[] = [];
  searchTerm = '';

  showModal = false;
  editingCustomer: Customer | null = null;
  currentForm: any = {};

  constructor(private state: BillingStateService) {}

  ngOnInit() {
    this.state.customers$.subscribe(data => {
      this.customers = data;
      this.filterCustomers();
    });
  }

  filterCustomers() {
    if (!this.searchTerm) {
      this.filteredCustomers = [...this.customers];
      return;
    }
    const term = this.searchTerm.toLowerCase();
    this.filteredCustomers = this.customers.filter(c => 
      c.name.toLowerCase().includes(term) || 
      c.id.toLowerCase().includes(term) ||
      (c.phone && c.phone.includes(term))
    );
  }

  openAddModal() {
    this.editingCustomer = null;
    this.currentForm = {
      id: 'CUST-' + Date.now().toString().slice(-6),
      name: '', phone: '', email: '', address: '', totalPurchasedAmount: 0, rating: null, isHidden: false
    };
    this.showModal = true;
  }

  openEditModal(c: Customer) {
    this.editingCustomer = c;
    this.currentForm = { ...c };
    this.showModal = true;
  }

  saveCustomer() {
    if (!this.currentForm.id || !this.currentForm.name) return;
    
    if (this.editingCustomer) {
      this.state.updateCustomer(this.currentForm);
    } else {
      this.state.addCustomer(this.currentForm);
    }
    this.showModal = false;
  }

  deleteCustomer(id: string) {
    if (confirm('Are you sure you want to completely delete this customer?')) {
      this.state.deleteCustomer(id);
    }
  }
}
