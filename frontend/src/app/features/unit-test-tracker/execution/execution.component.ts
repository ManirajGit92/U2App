import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TestExecution, UnitTestService, Bug } from '../unit-test.service';

@Component({
  selector: 'app-execution',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="execution-container">
      <div class="toolbar">
        <h2>Test Execution Runner</h2>
        <div class="search-filters">
          <input type="text" placeholder="Search ID, Tester..." [(ngModel)]="searchTerm" (ngModelChange)="applyFilters()" class="input-modern search-input">
          <select [(ngModel)]="filterStatus" (ngModelChange)="applyFilters()" class="input-modern">
            <option value="">All Statuses</option>
            <option value="Pass">Pass</option>
            <option value="Fail">Fail</option>
            <option value="Pending">Pending</option>
          </select>
        </div>
      </div>

      <div class="table-card">
        <div class="table-responsive">
          <table class="modern-table">
            <thead>
              <tr>
                <th (click)="setSort('id')">Test ID <span class="sort-icon" *ngIf="sortCol === 'id'">{{ sortDesc ? '↓' : '↑' }}</span></th>
                <th (click)="setSort('status')">Status <span class="sort-icon" *ngIf="sortCol === 'status'">{{ sortDesc ? '↓' : '↑' }}</span></th>
                <th (click)="setSort('testerName')">Tester <span class="sort-icon" *ngIf="sortCol === 'testerName'">{{ sortDesc ? '↓' : '↑' }}</span></th>
                <th>Comments</th>
                <th (click)="setSort('executionDate')">Date <span class="sort-icon" *ngIf="sortCol === 'executionDate'">{{ sortDesc ? '↓' : '↑' }}</span></th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let exec of filteredData">
                <ng-container *ngIf="editingId !== exec.id">
                  <td class="id-col">{{ exec.id }}</td>
                  <td>
                    <span class="badge" [ngClass]="'badge-' + (exec.status | lowercase)">{{ exec.status }}</span>
                  </td>
                  <td>{{ exec.testerName || '-' }}</td>
                  <td class="comments-col"><div class="truncate-text" [title]="exec.comments">{{ exec.comments || '-' }}</div></td>
                  <td>{{ exec.executionDate || '-' }}</td>
                  <td class="actions-cell">
                    <button class="btn btn-sm btn-outline" (click)="startEdit(exec)">Execute</button>
                  </td>
                </ng-container>

                <ng-container *ngIf="editingId === exec.id">
                  <td class="id-col">{{ exec.id }}</td>
                  <td>
                    <select [(ngModel)]="editData.status" class="input-inline">
                      <option value="Pass">Pass</option>
                      <option value="Fail">Fail</option>
                      <option value="Pending">Pending</option>
                    </select>
                  </td>
                  <td><input type="text" [(ngModel)]="editData.testerName" class="input-inline" placeholder="Name"></td>
                  <td><textarea [(ngModel)]="editData.comments" class="input-inline" rows="1" placeholder="Execution notes..."></textarea></td>
                  <td><input type="date" [(ngModel)]="editData.executionDate" class="input-inline"></td>
                  <td class="actions-cell">
                    <button class="icon-btn save" (click)="saveEdit()">💾</button>
                    <button class="icon-btn cancel" (click)="cancelEdit()">❌</button>
                  </td>
                </ng-container>
              </tr>
              <tr *ngIf="filteredData.length === 0">
                 <td colspan="6" class="empty-state">No execution records found.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      
      <!-- Auto Bug Modal logic (Simulated via window.confirm for simplicity) -->
    </div>
  `,
  styles: [`
    .execution-container {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      height: 100%;
    }
    .toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: var(--bg-secondary);
      padding: 1rem 1.5rem;
      border-radius: 12px;
      box-shadow: var(--shadow-sm);
      border: 1px solid var(--border-color);
      flex-wrap: wrap;
      gap: 1rem;
    }
    .toolbar h2 { margin: 0; font-size: 1.25rem; color: var(--text-primary); }
    .search-filters { display: flex; gap: 1rem; }
    .input-modern {
      padding: 0.6rem 1rem;
      border: 1px solid var(--border-color);
      border-radius: 6px;
      font-size: 0.9rem;
      color: var(--text-primary);
      background: var(--bg-input);
      outline: none;
    }
    .input-modern:focus { border-color: var(--accent-primary); background: var(--bg-secondary); }
    
    .table-card {
      background: var(--bg-secondary);
      border-radius: 12px;
      box-shadow: var(--shadow-sm);
      border: 1px solid var(--border-color);
      flex: 1;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .table-responsive { flex: 1; overflow: auto; }
    .modern-table { width: 100%; border-collapse: collapse; text-align: left; min-width: 800px; }
    .modern-table thead { position: sticky; top: 0; background: var(--bg-tertiary); z-index: 2; box-shadow: 0 1px 2px var(--border-color); }
    .modern-table th { padding: 1rem; font-size: 0.85rem; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; cursor: pointer; }
    .modern-table td { padding: 0.8rem 1rem; border-bottom: 1px solid var(--border-color); font-size: 0.9rem; color: var(--text-primary); vertical-align: middle; }
    .modern-table tbody tr:hover { background: var(--bg-tertiary); }
    
    .id-col { font-weight: 600; font-family: monospace; color: var(--accent-primary) !important; width: 120px; }
    .comments-col { max-width: 300px; }
    .truncate-text { white-space: pre-wrap; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; color: var(--text-secondary); font-size: 0.85rem; }
    
    .badge { padding: 0.25rem 0.6rem; border-radius: 20px; font-size: 0.75rem; font-weight: 600; }
    .badge-pass { background: rgba(52,211,153,0.15); color: var(--success); }
    .badge-fail { background: rgba(239,68,68,0.15); color: var(--danger); }
    .badge-pending { background: var(--bg-tertiary); color: var(--text-tertiary); }
    
    .input-inline { width: 100%; padding: 0.4rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-input); color: var(--text-primary); font-family: inherit; font-size: 0.85rem; }
    
    .actions-cell { white-space: nowrap; width: 120px; }
    .btn-sm { padding: 0.4rem 0.8rem; font-size: 0.8rem; font-weight: 600; cursor: pointer; border-radius: 4px; border: 1px solid transparent; }
    .btn-outline { background: transparent; border-color: var(--accent-primary); color: var(--accent-primary); }
    .btn-outline:hover { background: var(--accent-surface); }
    
    .icon-btn { background: none; border: none; font-size: 1.1rem; cursor: pointer; opacity: 0.7; transition: opacity 0.2s, transform 0.2s; padding: 0 0.4rem; }
    .icon-btn:hover { opacity: 1; transform: scale(1.1); }
    .empty-state { text-align: center; padding: 3rem !important; color: var(--text-tertiary); font-style: italic; }
  `]
})
export class ExecutionComponent implements OnInit {
  unitTestService = inject(UnitTestService);

  allData: TestExecution[] = [];
  filteredData: TestExecution[] = [];

  searchTerm = '';
  filterStatus = '';
  
  sortCol: keyof TestExecution = 'id';
  sortDesc = false;

  editingId: string | null = null;
  editData!: TestExecution;
  originalStatus: string = '';

  ngOnInit() {
    this.unitTestService.state$.subscribe(state => {
      this.allData = state.executions;
      this.applyFilters();
    });
  }

  applyFilters() {
    let data = [...this.allData];
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      data = data.filter(e => e.id.toLowerCase().includes(term) || (e.testerName || '').toLowerCase().includes(term));
    }
    if (this.filterStatus) {
      data = data.filter(e => e.status === this.filterStatus);
    }
    data.sort((a, b) => {
      const valA = a[this.sortCol] || '';
      const valB = b[this.sortCol] || '';
      if (valA < valB) return this.sortDesc ? 1 : -1;
      if (valA > valB) return this.sortDesc ? -1 : 1;
      return 0;
    });
    this.filteredData = data;
  }

  setSort(col: keyof TestExecution) {
    if (this.sortCol === col) this.sortDesc = !this.sortDesc;
    else { this.sortCol = col; this.sortDesc = false; }
    this.applyFilters();
  }

  startEdit(exec: TestExecution) {
    this.editingId = exec.id;
    this.originalStatus = exec.status;
    this.editData = { ...exec };
    if (!this.editData.executionDate) {
      this.editData.executionDate = new Date().toISOString().split('T')[0];
    }
  }

  saveEdit() {
    this.unitTestService.updateExecution(this.editData);
    
    // Auto Bug Creation logic
    if (this.editData.status === 'Fail' && this.originalStatus !== 'Fail') {
      const createBug = confirm(`Test ${this.editData.id} failed. Do you want to automatically log a bug for this?`);
      if (createBug) {
        // Generate BUG id
        const currentState = (this.unitTestService as any).stateSubject.value; // Accessing internal state for id generation
        const bugIds = currentState.bugs.map((b: Bug) => parseInt(b.id.replace('BUG-', '')) || 0);
        const maxId = bugIds.length ? Math.max(...bugIds) : 0;
        const newBugId = `BUG-${(maxId + 1).toString().padStart(3, '0')}`;
        
        const newBug: Bug = {
          id: newBugId,
          testCaseId: this.editData.id,
          severity: 'High',
          status: 'Open',
          assignedTo: 'Unassigned'
        };
        this.unitTestService.addBug(newBug);
        alert(`Bug ${newBugId} created successfully.`);
      }
    }
    
    this.editingId = null;
  }

  cancelEdit() {
    this.editingId = null;
  }
}
