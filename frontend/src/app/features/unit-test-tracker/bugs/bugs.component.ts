import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Bug, UnitTestService } from '../unit-test.service';

@Component({
  selector: 'app-bugs',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="bugs-container">
      <div class="toolbar">
        <h2>Bug Tracking</h2>
        <div class="search-filters">
          <input type="text" placeholder="Search Bug ID, Task ID..." [(ngModel)]="searchTerm" (ngModelChange)="applyFilters()" class="input-modern search-input">
          <select [(ngModel)]="filterSeverity" (ngModelChange)="applyFilters()" class="input-modern">
            <option value="">All Severities</option>
            <option value="Critical">Critical</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
          <select [(ngModel)]="filterStatus" (ngModelChange)="applyFilters()" class="input-modern">
            <option value="">All Statuses</option>
            <option value="Open">Open</option>
            <option value="In Progress">In Progress</option>
            <option value="Resolved">Resolved</option>
            <option value="Closed">Closed</option>
          </select>
          <div class="height-controls">
            <button class="icon-btn" (click)="adjustHeight(-50)" title="Decrease Table Height">➖</button>
            <span class="height-label">Height</span>
            <button class="icon-btn" (click)="adjustHeight(50)" title="Increase Table Height">➕</button>
          </div>
        </div>
      </div>

      <div class="table-card" [style.height.px]="tableHeight">
        <div class="table-responsive">
          <table class="modern-table">
            <thead>
              <tr>
                <th (click)="setSort('id')">Bug ID <span class="sort-icon" *ngIf="sortCol === 'id'">{{ sortDesc ? '↓' : '↑' }}</span></th>
                <th (click)="setSort('testCaseId')">Test Case <span class="sort-icon" *ngIf="sortCol === 'testCaseId'">{{ sortDesc ? '↓' : '↑' }}</span></th>
                <th (click)="setSort('severity')">Severity <span class="sort-icon" *ngIf="sortCol === 'severity'">{{ sortDesc ? '↓' : '↑' }}</span></th>
                <th (click)="setSort('status')">Status <span class="sort-icon" *ngIf="sortCol === 'status'">{{ sortDesc ? '↓' : '↑' }}</span></th>
                <th (click)="setSort('assignedTo')">Assigned To <span class="sort-icon" *ngIf="sortCol === 'assignedTo'">{{ sortDesc ? '↓' : '↑' }}</span></th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let bug of filteredData">
                <ng-container *ngIf="editingId !== bug.id">
                  <td class="id-col">{{ bug.id }}</td>
                  <td class="tc-col">{{ bug.testCaseId }}</td>
                  <td><span class="badge" [ngClass]="'badge-' + (bug.severity | lowercase)">{{ bug.severity }}</span></td>
                  <td>
                    <span class="status-indicator" [ngClass]="'status-' + (bug.status | lowercase | slice:0:4)"></span> 
                    {{ bug.status }}
                  </td>
                  <td>{{ bug.assignedTo || 'Unassigned' }}</td>
                  <td class="actions-cell">
                    <button class="icon-btn edit" (click)="startEdit(bug)">✏️</button>
                  </td>
                </ng-container>

                <ng-container *ngIf="editingId === bug.id">
                  <td class="id-col">{{ bug.id }}</td>
                  <td class="tc-col">{{ bug.testCaseId }}</td>
                  <td>
                    <select [(ngModel)]="editData.severity" class="input-inline">
                      <option value="Critical">Critical</option>
                      <option value="High">High</option>
                      <option value="Medium">Medium</option>
                      <option value="Low">Low</option>
                    </select>
                  </td>
                  <td>
                    <select [(ngModel)]="editData.status" class="input-inline">
                      <option value="Open">Open</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Resolved">Resolved</option>
                      <option value="Closed">Closed</option>
                    </select>
                  </td>
                  <td><input type="text" [(ngModel)]="editData.assignedTo" class="input-inline" placeholder="Assignee"></td>
                  <td class="actions-cell">
                    <button class="icon-btn save" (click)="saveEdit()">💾</button>
                    <button class="icon-btn cancel" (click)="cancelEdit()">❌</button>
                  </td>
                </ng-container>
              </tr>
              <tr *ngIf="filteredData.length === 0">
                 <td colspan="6" class="empty-state">No bugs found. Great job!</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .bugs-container {
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
    .search-filters { display: flex; gap: 1rem; flex-wrap: wrap; }
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
    
    .height-controls {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      background: var(--bg-tertiary);
      padding: 0.35rem 0.75rem;
      border-radius: 6px;
      border: 1px solid var(--border-color);
    }
    .height-label {
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--text-secondary);
      text-transform: uppercase;
    }
    
    .table-card {
      background: var(--bg-secondary);
      border-radius: 12px;
      box-shadow: var(--shadow-sm);
      border: 1px solid var(--border-color);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      min-height: 200px;
      transition: height 0.3s ease;
    }
    .table-responsive { flex: 1; overflow: auto; }
    .modern-table { width: 100%; border-collapse: collapse; text-align: left; min-width: 800px; }
    .modern-table thead { position: sticky; top: 0; background: var(--bg-tertiary); z-index: 2; box-shadow: 0 1px 2px var(--border-color); }
    .modern-table th { padding: 1rem; font-size: 0.85rem; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; cursor: pointer; }
    .modern-table td { padding: 0.8rem 1rem; border-bottom: 1px solid var(--border-color); font-size: 0.9rem; color: var(--text-primary); vertical-align: middle; }
    .modern-table tbody tr:hover { background: var(--bg-tertiary); }
    
    .id-col { font-weight: 700; color: #ef4444 !important; font-family: monospace; width: 120px; }
    .tc-col { font-weight: 600; color: #64748b !important; font-family: monospace; }
    
    .badge { padding: 0.25rem 0.6rem; border-radius: 20px; font-size: 0.75rem; font-weight: 600; }
    .badge-critical { background: #fee2e2; color: #7f1d1d; }
    .badge-high { background: #ffedd5; color: #9a3412; }
    .badge-medium { background: #fef3c7; color: #b45309; }
    .badge-low { background: #e0f2fe; color: #0369a1; }
    
    .status-indicator { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 6px; }
    .status-open { background: #ef4444; }
    .status-in-p { background: #f59e0b; }
    .status-reso { background: #10b981; }
    .status-clos { background: #6b7280; }

    .input-inline { width: 100%; padding: 0.4rem; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 0.85rem; }
    
    .actions-cell { white-space: nowrap; width: 80px; }
    .icon-btn { background: none; border: none; font-size: 1.1rem; cursor: pointer; opacity: 0.7; transition: opacity 0.2s, transform 0.2s; padding: 0 0.4rem; }
    .icon-btn:hover { opacity: 1; transform: scale(1.1); }
    .empty-state { text-align: center; padding: 3rem !important; color: var(--text-tertiary); font-style: italic; }
  `]
})
export class BugsComponent implements OnInit {
  unitTestService = inject(UnitTestService);

  allData: Bug[] = [];
  filteredData: Bug[] = [];

  searchTerm = '';
  filterSeverity = '';
  filterStatus = '';
  
  sortCol: keyof Bug = 'id';
  sortDesc = false;

  editingId: string | null = null;
  editData!: Bug;
  tableHeight = 450;

  ngOnInit() {
    this.unitTestService.state$.subscribe(state => {
      this.allData = state.bugs;
      this.tableHeight = state.tableHeight;
      this.applyFilters();
    });
  }

  applyFilters() {
    let data = [...this.allData];
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      data = data.filter(b => b.id.toLowerCase().includes(term) || b.testCaseId.toLowerCase().includes(term));
    }
    if (this.filterSeverity) {
      data = data.filter(b => b.severity === this.filterSeverity);
    }
    if (this.filterStatus) {
      data = data.filter(b => b.status === this.filterStatus);
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

  setSort(col: keyof Bug) {
    if (this.sortCol === col) this.sortDesc = !this.sortDesc;
    else { this.sortCol = col; this.sortDesc = false; }
    this.applyFilters();
  }

  startEdit(bug: Bug) {
    this.editingId = bug.id;
    this.editData = { ...bug };
  }

  saveEdit() {
    this.unitTestService.updateBug(this.editData);
    this.editingId = null;
  }

  cancelEdit() {
    this.editingId = null;
  }

  adjustHeight(delta: number) {
    const newHeight = Math.max(200, this.tableHeight + delta);
    this.unitTestService.updateTableHeight(newHeight);
  }
}
