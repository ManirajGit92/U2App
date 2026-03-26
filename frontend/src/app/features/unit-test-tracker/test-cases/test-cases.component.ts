import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TestCase, UnitTestService } from '../unit-test.service';

@Component({
  selector: 'app-test-cases',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="test-cases-container">
      <!-- Toolbar -->
      <div class="toolbar">
        <div class="search-filters">
          <input type="text" placeholder="Search ID, Title..." [(ngModel)]="searchTerm" (ngModelChange)="applyFilters()" class="input-modern search-input">
          
          <select [(ngModel)]="filterModule" (ngModelChange)="applyFilters()" class="input-modern">
            <option value="">All Modules</option>
            <option *ngFor="let mod of uniqueModules" [value]="mod">{{ mod }}</option>
          </select>

          <select [(ngModel)]="filterPriority" (ngModelChange)="applyFilters()" class="input-modern">
            <option value="">All Priorities</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
        </div>

        <button class="btn btn-primary" (click)="startAdd()">+ New Test Case</button>
      </div>

      <!-- Table Section -->
      <div class="table-card">
        <div class="table-responsive">
          <table class="modern-table">
            <thead>
              <tr>
                <th (click)="setSort('id')">ID <span class="sort-icon" *ngIf="sortCol === 'id'">{{ sortDesc ? '↓' : '↑' }}</span></th>
                <th (click)="setSort('module')">Module <span class="sort-icon" *ngIf="sortCol === 'module'">{{ sortDesc ? '↓' : '↑' }}</span></th>
                <th (click)="setSort('title')">Title <span class="sort-icon" *ngIf="sortCol === 'title'">{{ sortDesc ? '↓' : '↑' }}</span></th>
                <th>Steps</th>
                <th>Expected Result</th>
                <th (click)="setSort('priority')">Priority <span class="sort-icon" *ngIf="sortCol === 'priority'">{{ sortDesc ? '↓' : '↑' }}</span></th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <!-- Add New Row -->
              <tr *ngIf="isAdding" class="edit-row">
                <td><input type="text" [(ngModel)]="newTestCase.id" class="input-inline" placeholder="TC-XXX"></td>
                <td><input type="text" [(ngModel)]="newTestCase.module" class="input-inline"></td>
                <td><input type="text" [(ngModel)]="newTestCase.title" class="input-inline"></td>
                <td><textarea [(ngModel)]="newTestCase.steps" class="input-inline" rows="2"></textarea></td>
                <td><textarea [(ngModel)]="newTestCase.expectedResult" class="input-inline" rows="2"></textarea></td>
                <td>
                  <select [(ngModel)]="newTestCase.priority" class="input-inline">
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </td>
                <td class="actions-cell">
                  <button class="icon-btn save" (click)="saveAdd()">💾</button>
                  <button class="icon-btn cancel" (click)="cancelAdd()">❌</button>
                </td>
              </tr>

              <!-- Data Rows -->
              <tr *ngFor="let tc of paginatedData">
                <ng-container *ngIf="editingId !== tc.id">
                  <td class="id-col">{{ tc.id }}</td>
                  <td>{{ tc.module }}</td>
                  <td class="title-col">{{ tc.title }}</td>
                  <td class="steps-col"><div class="truncate-text" [title]="tc.steps">{{ tc.steps }}</div></td>
                  <td class="steps-col"><div class="truncate-text" [title]="tc.expectedResult">{{ tc.expectedResult }}</div></td>
                  <td>
                    <span class="badge" [ngClass]="'badge-' + (tc.priority | lowercase)">{{ tc.priority }}</span>
                  </td>
                  <td class="actions-cell">
                    <button class="icon-btn edit" (click)="startEdit(tc)">✏️</button>
                    <button class="icon-btn delete" (click)="deleteTc(tc.id)">🗑️</button>
                  </td>
                </ng-container>

                <!-- Edit Row -->
                <ng-container *ngIf="editingId === tc.id">
                  <td>{{ tc.id }}</td>
                  <td><input type="text" [(ngModel)]="editTestCaseData.module" class="input-inline"></td>
                  <td><input type="text" [(ngModel)]="editTestCaseData.title" class="input-inline"></td>
                  <td><textarea [(ngModel)]="editTestCaseData.steps" class="input-inline" rows="2"></textarea></td>
                  <td><textarea [(ngModel)]="editTestCaseData.expectedResult" class="input-inline" rows="2"></textarea></td>
                  <td>
                    <select [(ngModel)]="editTestCaseData.priority" class="input-inline">
                      <option value="High">High</option>
                      <option value="Medium">Medium</option>
                      <option value="Low">Low</option>
                    </select>
                  </td>
                  <td class="actions-cell">
                    <button class="icon-btn save" (click)="saveEdit()">💾</button>
                    <button class="icon-btn cancel" (click)="cancelEdit()">❌</button>
                  </td>
                </ng-container>
              </tr>
              
              <tr *ngIf="paginatedData.length === 0 && !isAdding">
                <td colspan="7" class="empty-state">No test cases found.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        <div class="pagination">
          <div class="page-size">
            Rows per page:
            <select [(ngModel)]="pageSize" (ngModelChange)="onPageSizeChange()">
              <option [value]="10">10</option>
              <option [value]="25">25</option>
              <option [value]="50">50</option>
              <option [value]="100">100</option>
            </select>
          </div>
          <div class="page-controls">
            <span class="page-info">{{ startIndex + 1 }} - {{ endIndex }} of {{ filteredData.length }}</span>
            <button class="icon-btn" [disabled]="currentPage === 1" (click)="setPage(1)">⏮</button>
            <button class="icon-btn" [disabled]="currentPage === 1" (click)="setPage(currentPage - 1)">◀</button>
            <button class="icon-btn" [disabled]="currentPage === totalPages" (click)="setPage(currentPage + 1)">▶</button>
            <button class="icon-btn" [disabled]="currentPage === totalPages" (click)="setPage(totalPages)">⏭</button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .test-cases-container {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      height: 100%;
    }

    /* Toolbar */
    .toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: white;
      padding: 1rem 1.5rem;
      border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
      border: 1px solid rgba(0,0,0,0.05);
      flex-wrap: wrap;
      gap: 1rem;
    }
    .search-filters {
      display: flex;
      gap: 1rem;
      flex-wrap: wrap;
    }
    .input-modern {
      padding: 0.6rem 1rem;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      font-size: 0.9rem;
      color: #374151;
      background: #f9fafb;
      transition: border-color 0.2s;
      outline: none;
    }
    .input-modern:focus {
      border-color: #3b82f6;
      background: white;
    }
    .search-input {
      width: 250px;
    }

    .btn {
      padding: 0.6rem 1.2rem;
      border: none;
      border-radius: 6px;
      font-weight: 600;
      cursor: pointer;
    }
    .btn-primary { background: #3b82f6; color: white; }
    .btn-primary:hover { background: #2563eb; }

    /* Table */
    .table-card {
      background: white;
      border-radius: 12px;
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
      border: 1px solid rgba(0,0,0,0.05);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      flex: 1; /* take remaining height */
    }
    .table-responsive {
      flex: 1;
      overflow: auto;
    }
    .modern-table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      min-width: 900px;
    }
    .modern-table thead {
      position: sticky;
      top: 0;
      background: #f8fafc;
      z-index: 2;
      box-shadow: 0 1px 2px rgba(0,0,0,0.05);
    }
    .modern-table th {
      padding: 1rem;
      font-size: 0.85rem;
      font-weight: 600;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      cursor: pointer;
      user-select: none;
      white-space: nowrap;
    }
    .modern-table th:hover { background: #f1f5f9; }
    .modern-table td {
      padding: 0.8rem 1rem;
      border-bottom: 1px solid #e2e8f0;
      font-size: 0.9rem;
      color: #1e293b;
      vertical-align: middle;
    }
    .modern-table tbody tr:hover {
      background: #f8fafc;
    }
    .modern-table tbody tr.edit-row {
      background: #eff6ff;
    }

    /* Cell Widths & Formatting */
    .id-col { font-weight: 600; font-family: monospace; color: #3b82f6 !important; }
    .title-col { font-weight: 500; }
    .steps-col { max-width: 250px; }
    .truncate-text {
      white-space: pre-wrap;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      text-overflow: ellipsis;
      color: #64748b;
      font-size: 0.85rem;
    }

    /* Badges */
    .badge {
      padding: 0.25rem 0.6rem;
      border-radius: 20px;
      font-size: 0.75rem;
      font-weight: 600;
    }
    .badge-high { background: #fee2e2; color: #b91c1c; }
    .badge-medium { background: #fef3c7; color: #b45309; }
    .badge-low { background: #e0f2fe; color: #0369a1; }

    /* Inline Inputs */
    .input-inline {
      width: 100%;
      padding: 0.4rem;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      font-family: inherit;
      font-size: 0.85rem;
    }
    textarea.input-inline {
      resize: vertical;
      min-height: 40px;
    }

    /* Actions */
    .actions-cell {
      white-space: nowrap;
      width: 100px;
    }
    .icon-btn {
      background: none;
      border: none;
      font-size: 1.1rem;
      cursor: pointer;
      opacity: 0.7;
      transition: opacity 0.2s, transform 0.2s;
      padding: 0.2rem 0.4rem;
    }
    .icon-btn:hover { opacity: 1; transform: scale(1.1); }
    .icon-btn:disabled { opacity: 0.3; cursor: not-allowed; transform: none; }

    .empty-state {
      text-align: center;
      padding: 3rem !important;
      color: #64748b;
      font-style: italic;
    }

    /* Pagination */
    .pagination {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem 1.5rem;
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
      font-size: 0.9rem;
      color: #475569;
    }
    .page-controls {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .page-info { margin-right: 1rem; }
    .page-size select { margin-left: 0.5rem; padding: 0.2rem; border-radius: 4px; border: 1px solid #cbd5e1; }
  `]
})
export class TestCasesComponent implements OnInit {
  unitTestService = inject(UnitTestService);

  allData: TestCase[] = [];
  filteredData: TestCase[] = [];
  paginatedData: TestCase[] = [];
  uniqueModules: string[] = [];

  // Filters
  searchTerm = '';
  filterModule = '';
  filterPriority = '';

  // Sort
  sortCol: keyof TestCase = 'id';
  sortDesc = false;

  // Pagination
  pageSize = 10;
  currentPage = 1;

  // Editing logic
  editingId: string | null = null;
  editTestCaseData!: TestCase;

  // Adding logic
  isAdding = false;
  newTestCase: TestCase = this.getEmptyTestCase();

  ngOnInit() {
    this.unitTestService.state$.subscribe(state => {
      this.allData = state.testCases;
      // Extract unique modules
      this.uniqueModules = Array.from(new Set(this.allData.map(tc => tc.module))).filter(m => m);
      this.applyFilters();
    });
  }

  applyFilters() {
    let data = [...this.allData];

    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      data = data.filter(tc => 
        tc.id.toLowerCase().includes(term) || 
        tc.title.toLowerCase().includes(term) ||
        tc.module.toLowerCase().includes(term)
      );
    }

    if (this.filterModule) {
      data = data.filter(tc => tc.module === this.filterModule);
    }

    if (this.filterPriority) {
      data = data.filter(tc => tc.priority === this.filterPriority);
    }

    // Sort
    data.sort((a, b) => {
      const valA = a[this.sortCol] || '';
      const valB = b[this.sortCol] || '';
      if (valA < valB) return this.sortDesc ? 1 : -1;
      if (valA > valB) return this.sortDesc ? -1 : 1;
      return 0;
    });

    this.filteredData = data;
    this.currentPage = 1; // reset page on filter
    this.updatePagination();
  }

  setSort(col: keyof TestCase) {
    if (this.sortCol === col) {
      this.sortDesc = !this.sortDesc;
    } else {
      this.sortCol = col;
      this.sortDesc = false;
    }
    this.applyFilters();
  }

  // --- Pagination ---
  get totalPages() {
    return Math.ceil(this.filteredData.length / this.pageSize) || 1;
  }
  get startIndex() {
    return (this.currentPage - 1) * this.pageSize;
  }
  get endIndex() {
    return Math.min(this.startIndex + this.pageSize, this.filteredData.length);
  }

  onPageSizeChange() {
    this.currentPage = 1;
    this.updatePagination();
  }

  setPage(page: number) {
    this.currentPage = page;
    this.updatePagination();
  }

  updatePagination() {
    this.paginatedData = this.filteredData.slice(this.startIndex, this.endIndex);
  }

  // --- CRUD ---
  getEmptyTestCase(): TestCase {
    return { id: '', module: '', title: '', steps: '', expectedResult: '', priority: 'Medium' };
  }

  startAdd() {
    this.isAdding = true;
    this.newTestCase = this.getEmptyTestCase();
    // Pre-fill ID logic: find highest TC-XXX and increment
    const ids = this.allData.map(t => parseInt(t.id.replace('TC-', '')) || 0);
    const maxId = ids.length ? Math.max(...ids) : 0;
    this.newTestCase.id = `TC-${(maxId + 1).toString().padStart(3, '0')}`;
  }

  saveAdd() {
    if (!this.newTestCase.id || !this.newTestCase.title) return alert('ID and Title are required');
    if (this.allData.find(t => t.id === this.newTestCase.id)) return alert('ID already exists');
    
    this.unitTestService.addTestCase(this.newTestCase);
    this.isAdding = false;
  }

  cancelAdd() {
    this.isAdding = false;
  }

  startEdit(tc: TestCase) {
    this.editingId = tc.id;
    this.editTestCaseData = { ...tc };
  }

  saveEdit() {
    this.unitTestService.updateTestCase(this.editTestCaseData);
    this.editingId = null;
  }

  cancelEdit() {
    this.editingId = null;
  }

  deleteTc(id: string) {
    if (confirm(`Delete test case ${id} and all related executions and bugs?`)) {
      this.unitTestService.deleteTestCase(id);
    }
  }
}
