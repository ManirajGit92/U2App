import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BillingStateService } from '../../services/billing-state.service';
import { Employee } from '../../models/billing.models';

@Component({
  selector: 'app-employee-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="emp-container">
      <div class="page-header">
        <div>
          <h2 class="page-title">👥 Employees</h2>
          <p class="page-subtitle">Manage your team members and their roles</p>
        </div>
        <button class="btn btn-primary" (click)="openAddModal()">
          <span>+</span> Add Employee
        </button>
      </div>

      <div class="search-bar">
        <input type="text" class="search-input" placeholder="🔍 Search employees..." [(ngModel)]="searchTerm" (ngModelChange)="filterEmployees()">
      </div>

      <div class="employee-grid">
        <div class="employee-card" *ngFor="let emp of filteredEmployees">
          <div class="emp-avatar">
            <img *ngIf="emp.photoUrl" [src]="emp.photoUrl" [alt]="emp.name" class="emp-photo">
            <div *ngIf="!emp.photoUrl" class="emp-initials">{{ getInitials(emp.name) }}</div>
          </div>
          <div class="emp-info">
            <div class="emp-id-badge">{{ emp.id }}</div>
            <h3 class="emp-name">
              {{ emp.name }}
              <span class="demo-badge" *ngIf="emp.isDemo">Demo</span>
            </h3>
            <p class="emp-role">{{ emp.role || 'Staff' }}</p>
            <div class="emp-contact">
              <span *ngIf="emp.phone">📞 {{ emp.phone }}</span>
              <span *ngIf="emp.email">✉️ {{ emp.email }}</span>
            </div>
          </div>
          <div class="emp-actions">
            <button class="action-btn edit" (click)="openEditModal(emp)" title="Edit">✏️</button>
            <button class="action-btn delete" (click)="deleteEmployee(emp.id)" title="Delete">🗑️</button>
          </div>
        </div>

        <div class="empty-card" *ngIf="filteredEmployees.length === 0">
          <div class="empty-icon">👤</div>
          <p>No employees found</p>
          <button class="btn btn-primary btn-sm" (click)="openAddModal()">Add First Employee</button>
        </div>
      </div>

      <!-- Modal -->
      <div class="modal-overlay" *ngIf="showModal" (click)="onOverlayClick($event)">
        <div class="modal-panel" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>{{ editingEmployee ? 'Edit Employee' : 'Add Employee' }}</h3>
            <button class="modal-close" (click)="showModal = false">✕</button>
          </div>

          <div class="modal-photo-section">
            <div class="photo-preview" (click)="photoInput.click()">
              <img *ngIf="currentForm.photoUrl" [src]="currentForm.photoUrl" alt="Preview" class="preview-img">
              <div *ngIf="!currentForm.photoUrl" class="photo-placeholder">
                <span>📷</span>
                <small>Click to upload photo</small>
              </div>
            </div>
            <input #photoInput type="file" accept="image/*" style="display:none" (change)="onPhotoChange($event)">
            <button class="btn btn-sm btn-secondary" (click)="photoInput.click()">Upload Photo</button>
            <button *ngIf="currentForm.photoUrl" class="btn btn-sm btn-danger" (click)="currentForm.photoUrl = ''">Remove</button>
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label>Employee ID *</label>
              <input type="text" [(ngModel)]="currentForm.id" [disabled]="!!editingEmployee" placeholder="EMP-001">
            </div>
            <div class="form-group">
              <label>Full Name *</label>
              <input type="text" [(ngModel)]="currentForm.name" placeholder="Jane Smith">
            </div>
            <div class="form-group">
              <label>Role / Position</label>
              <input type="text" [(ngModel)]="currentForm.role" placeholder="Sales Executive">
            </div>
            <div class="form-group">
              <label>Phone Number</label>
              <input type="tel" [(ngModel)]="currentForm.phone" placeholder="9876543210">
            </div>
            <div class="form-group full-width">
              <label>Email Address</label>
              <input type="email" [(ngModel)]="currentForm.email" placeholder="jane@example.com">
            </div>
          </div>

          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="showModal = false">Cancel</button>
            <button class="btn btn-primary" (click)="saveEmployee()">
              {{ editingEmployee ? 'Update Employee' : 'Add Employee' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .emp-container { display: flex; flex-direction: column; gap: 20px; }

    .page-header {
      display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px;
    }
    .page-title { margin: 0; font-size: 1.6rem; font-weight: 800; color: var(--text-primary); }
    .page-subtitle { margin: 4px 0 0; color: var(--text-secondary); font-size: 0.9rem; }

    .search-bar { display: flex; gap: 12px; }
    .search-input {
      flex: 1; max-width: 400px; padding: 10px 16px;
      border: 1px solid var(--border-color); border-radius: var(--radius-md);
      background: var(--bg-primary); color: var(--text-primary); font-size: 0.95rem;
    }

    .employee-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px;
    }
    .employee-card {
      background: var(--surface-card); border: 1px solid var(--border-color);
      border-radius: var(--radius-lg); padding: 20px;
      display: flex; flex-direction: column; align-items: center; gap: 12px;
      text-align: center; transition: transform 0.2s, box-shadow 0.2s; position: relative;
    }
    .employee-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.1); }

    .emp-avatar { position: relative; }
    .emp-photo { width: 80px; height: 80px; border-radius: 50%; object-fit: cover; border: 3px solid var(--accent-primary); }
    .emp-initials {
      width: 80px; height: 80px; border-radius: 50%;
      background: linear-gradient(135deg, var(--accent-primary), #a855f7);
      display: flex; align-items: center; justify-content: center;
      font-size: 1.8rem; font-weight: 700; color: white;
    }

    .emp-id-badge {
      display: inline-block; background: rgba(var(--accent-primary-rgb),0.1);
      color: var(--accent-primary); padding: 2px 10px; border-radius: 999px;
      font-size: 0.75rem; font-weight: 700; letter-spacing: 0.5px; margin-bottom: 4px;
    }
    .emp-name { margin: 0; font-size: 1.1rem; font-weight: 700; color: var(--text-primary); display: flex; align-items: center; justify-content: center; gap: 6px; }
    .emp-role { margin: 2px 0 0; font-size: 0.85rem; color: var(--text-secondary); }
    .emp-contact { display: flex; flex-direction: column; gap: 4px; font-size: 0.8rem; color: var(--text-tertiary); }

    .emp-actions {
      display: flex; gap: 8px; position: absolute; top: 12px; right: 12px;
    }
    .action-btn { background: none; border: none; cursor: pointer; font-size: 1rem; opacity: 0.6; transition: opacity 0.2s; padding: 4px; border-radius: 6px; }
    .action-btn:hover { opacity: 1; background: rgba(0,0,0,0.05); }

    .empty-card {
      grid-column: 1/-1; display: flex; flex-direction: column; align-items: center;
      gap: 12px; padding: 48px; color: var(--text-secondary);
      background: var(--surface-card); border: 2px dashed var(--border-color); border-radius: var(--radius-lg);
    }
    .empty-icon { font-size: 3rem; }
    .demo-badge { background: #8b5cf6; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.65rem; }

    /* Modal */
    .modal-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,0.6);
      display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 16px;
    }
    .modal-panel {
      background: var(--surface-card); border-radius: var(--radius-lg);
      width: 100%; max-width: 520px; max-height: 90vh; overflow-y: auto;
      box-shadow: 0 24px 48px rgba(0,0,0,0.2);
    }
    .modal-header {
      display: flex; justify-content: space-between; align-items: center;
      padding: 20px 24px; border-bottom: 1px solid var(--border-color);
    }
    .modal-header h3 { margin: 0; font-size: 1.2rem; font-weight: 700; }
    .modal-close { background: none; border: none; cursor: pointer; font-size: 1.2rem; color: var(--text-secondary); padding: 4px 8px; border-radius: 6px; }
    .modal-close:hover { background: rgba(0,0,0,0.05); }

    .modal-photo-section {
      display: flex; flex-direction: column; align-items: center; gap: 12px;
      padding: 20px 24px; border-bottom: 1px solid var(--border-color);
    }
    .photo-preview {
      width: 100px; height: 100px; border-radius: 50%; overflow: hidden;
      cursor: pointer; border: 3px dashed var(--border-color);
      display: flex; align-items: center; justify-content: center;
      background: var(--bg-primary); transition: border-color 0.2s;
    }
    .photo-preview:hover { border-color: var(--accent-primary); }
    .preview-img { width: 100%; height: 100%; object-fit: cover; }
    .photo-placeholder { display: flex; flex-direction: column; align-items: center; gap: 4px; color: var(--text-tertiary); font-size: 1.5rem; }
    .photo-placeholder small { font-size: 0.7rem; }

    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; padding: 20px 24px; }
    .form-group { display: flex; flex-direction: column; gap: 6px; }
    .full-width { grid-column: 1/-1; }
    .form-group label { font-size: 0.85rem; font-weight: 600; color: var(--text-secondary); }
    .form-group input {
      padding: 10px 12px; border: 1px solid var(--border-color);
      border-radius: var(--radius-sm); background: var(--bg-primary);
      color: var(--text-primary); font-size: 0.95rem;
    }
    .form-group input:focus { outline: none; border-color: var(--accent-primary); }

    .modal-footer {
      display: flex; justify-content: flex-end; gap: 12px;
      padding: 16px 24px; border-top: 1px solid var(--border-color);
    }

    .btn { padding: 10px 20px; border-radius: var(--radius-md); border: none; cursor: pointer; font-size: 0.9rem; font-weight: 600; transition: all 0.2s; }
    .btn-primary { background: var(--accent-primary); color: white; }
    .btn-primary:hover { opacity: 0.9; }
    .btn-secondary { background: var(--bg-primary); border: 1px solid var(--border-color); color: var(--text-primary); }
    .btn-danger { background: rgba(239,68,68,0.1); color: #ef4444; border: 1px solid rgba(239,68,68,0.3); }
    .btn-sm { padding: 6px 14px; font-size: 0.82rem; }

    @media (max-width: 600px) {
      .form-grid { grid-template-columns: 1fr; }
      .employee-grid { grid-template-columns: 1fr; }
    }
  `]
})
export class EmployeeManagementComponent implements OnInit {
  employees: Employee[] = [];
  filteredEmployees: Employee[] = [];
  searchTerm = '';
  showModal = false;
  editingEmployee: Employee | null = null;
  currentForm: Partial<Employee> = {};

  constructor(private state: BillingStateService) {}

  ngOnInit() {
    this.state.employees$.subscribe(data => {
      this.employees = data;
      this.filterEmployees();
    });
  }

  filterEmployees() {
    if (!this.searchTerm) { this.filteredEmployees = [...this.employees]; return; }
    const term = this.searchTerm.toLowerCase();
    this.filteredEmployees = this.employees.filter(e =>
      e.name.toLowerCase().includes(term) ||
      e.id.toLowerCase().includes(term) ||
      (e.role && e.role.toLowerCase().includes(term))
    );
  }

  getInitials(name: string) {
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  }

  openAddModal() {
    this.editingEmployee = null;
    this.currentForm = { id: 'EMP-' + Date.now().toString().slice(-5), name: '', role: '', phone: '', email: '', photoUrl: '' };
    this.showModal = true;
  }

  openEditModal(emp: Employee) {
    this.editingEmployee = emp;
    this.currentForm = { ...emp };
    this.showModal = true;
  }

  onPhotoChange(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => { this.currentForm.photoUrl = e.target?.result as string; };
    reader.readAsDataURL(file);
  }

  saveEmployee() {
    if (!this.currentForm.id || !this.currentForm.name) return;
    const emp = this.currentForm as Employee;
    if (this.editingEmployee) {
      this.state.updateEmployee(emp);
    } else {
      this.state.addEmployee(emp);
    }
    this.showModal = false;
  }

  deleteEmployee(id: string) {
    if (confirm('Delete this employee?')) {
      this.state.deleteEmployee(id);
    }
  }

  onOverlayClick(e: MouseEvent) {
    if ((e.target as HTMLElement).classList.contains('modal-overlay')) {
      this.showModal = false;
    }
  }
}
