import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { LifeTrackerService, CategoryType } from './life-tracker.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-category-view',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="category-header">
      <div class="header-info">
        <h2>{{ category }} Tracking</h2>
        <p class="text-tertiary">Manage and analyze your {{ category.toLowerCase() }} data.</p>
      </div>
      <button class="btn btn-primary" (click)="toggleForm()">
        {{ showForm() ? '✖ Close Form' : '➕ Add New Entry' }}
      </button>
    </div>

    <!-- Controls -->
    <div class="controls-row glass-card">
      <div class="search-box">
        <span class="icon">🔍</span>
        <input type="text" [(ngModel)]="searchTerm" placeholder="Search entries...">
      </div>
      <div class="filter-info">
        Showing {{ filteredEntries().length }} of {{ allEntries().length }} entries
      </div>
    </div>

    <!-- Form -->
    <div class="form-card glass-card" *ngIf="showForm()">
      <h3 style="margin-bottom: 1.5rem">{{ isEditing() ? 'Edit' : 'Add New' }} Entry</h3>
      <div class="form-grid">
        <div class="form-group" *ngFor="let field of fields">
          <label>{{ field.label }}</label>
          <input *ngIf="['text', 'number', 'date', 'time'].includes(field.type)"
                 [type]="field.type" [(ngModel)]="newEntry[field.key]" [placeholder]="field.label">
          <select *ngIf="field.type === 'select'" [(ngModel)]="newEntry[field.key]">
            <option *ngFor="let opt of field.options" [value]="opt">{{ opt }}</option>
          </select>
          <textarea *ngIf="field.type === 'textarea'" [(ngModel)]="newEntry[field.key]"></textarea>
        </div>
      </div>
      <div class="form-actions">
        <button class="btn btn-secondary" (click)="toggleForm()">Cancel</button>
        <button class="btn btn-primary" (click)="saveEntry()">{{ isEditing() ? 'Update' : 'Save' }} Entry</button>
      </div>
    </div>

    <!-- Table -->
    <div class="table-container glass-card">
      <table>
        <thead>
          <tr>
            <th *ngFor="let field of fields" (click)="toggleSort(field.key)" class="sortable">
              {{ field.label }}
              <span class="sort-icon" *ngIf="sortKey() === field.key">
                {{ sortDirection() === 'asc' ? '▲' : '▼' }}
              </span>
            </th>
            <th style="text-align: right">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let entry of filteredEntries(); let i = index">
            <td *ngFor="let field of fields">
              <ng-container [ngSwitch]="field.type">
                 <span *ngSwitchCase="'number'" class="badge-num">{{ entry[field.key] }}</span>
                 <span *ngSwitchDefault>{{ entry[field.key] }}</span>
              </ng-container>
            </td>
            <td style="text-align: right">
              <div class="actions">
                <button class="icon-btn edit" (click)="editEntry(entry)">✏️</button>
                <button class="icon-btn delete" (click)="removeEntry(entry.id)">🗑️</button>
              </div>
            </td>
          </tr>
          <tr *ngIf="filteredEntries().length === 0">
            <td [attr.colspan]="fields.length + 1" style="text-align: center; padding: 3rem; color: var(--text-tertiary);">
               No entries found matching your search.
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  `,
  styles: [`
    .category-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
    .header-info h2 { margin-bottom: 0.25rem; }
    
    .controls-row { padding: 1rem 1.5rem; margin-bottom: 1.5rem; display: flex; justify-content: space-between; align-items: center; }
    .search-box { display: flex; align-items: center; gap: 0.75rem; background: var(--bg-secondary); padding: 0.5rem 1rem; border-radius: 50px; border: 1px solid var(--border-color); width: 300px; }
    .search-box input { border: none; background: transparent; outline: none; color: var(--text-primary); width: 100%; font-size: 0.9rem; }
    .filter-info { font-size: 0.85rem; color: var(--text-tertiary); }

    .form-card { padding: 2rem; margin-bottom: 2rem; border: 1px solid var(--accent-primary); background: rgba(var(--accent-rgb), 0.02); }
    .form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem; }
    .form-group label { display: block; margin-bottom: 0.5rem; font-size: 0.9rem; font-weight: 600; }
    .form-group input, .form-group select, .form-group textarea { width: 100%; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: 8px; background: var(--bg-secondary); color: var(--text-primary); }
    .form-actions { margin-top: 2rem; display: flex; justify-content: flex-end; gap: 1rem; }

    .table-container { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 1.25rem 1rem; border-bottom: 1px solid var(--border-color); }
    th { font-weight: 700; color: var(--text-tertiary); text-transform: uppercase; font-size: 0.75rem; letter-spacing: 0.5px; }
    th.sortable { cursor: pointer; user-select: none; }
    th.sortable:hover { color: var(--accent-primary); }
    .sort-icon { margin-left: 0.5rem; font-size: 0.6rem; }

    .actions { display: flex; justify-content: flex-end; gap: 0.5rem; }
    .icon-btn { width: 32px; height: 32px; border-radius: 6px; display: flex; align-items: center; justify-content: center; transition: all 0.2s; border: 1px solid var(--border-color); }
    .icon-btn.edit:hover { background: rgba(var(--accent-rgb), 0.1); color: var(--accent-primary); border-color: var(--accent-primary); }
    .icon-btn.delete:hover { background: rgba(239, 68, 68, 0.1); color: #ef4444; border-color: #ef4444; }

    .badge-num { background: rgba(var(--accent-rgb), 0.1); color: var(--accent-primary); padding: 0.25rem 0.5rem; border-radius: 4px; font-weight: 700; font-family: monospace; }
  `]
})
export class CategoryViewComponent implements OnInit {
  route = inject(ActivatedRoute);
  service = inject(LifeTrackerService);
  
  category: CategoryType = 'Routines';
  allEntries = signal<any[]>([]);
  showForm = signal(false);
  isEditing = signal(false);
  editId: string | null = null;
  newEntry: any = {};
  fields: any[] = [];
  
  searchTerm = signal('');
  sortKey = signal<string | null>('date');
  sortDirection = signal<'asc' | 'desc'>('desc');

  filteredEntries = computed(() => {
    let result = [...this.allEntries()];
    
    // Search
    const term = this.searchTerm().toLowerCase().trim();
    if (term) {
      result = result.filter(e => 
        Object.values(e).some(val => String(val).toLowerCase().includes(term))
      );
    }

    // Sort
    const key = this.sortKey();
    if (key) {
      const dir = this.sortDirection() === 'asc' ? 1 : -1;
      result.sort((a, b) => {
        const valA = a[key];
        const valB = b[key];
        if (typeof valA === 'number' && typeof valB === 'number') return (valA - valB) * dir;
        return String(valA).localeCompare(String(valB)) * dir;
      });
    }

    return result;
  });

  ngOnInit() {
    this.route.params.subscribe(params => {
      this.category = params['type'] as CategoryType;
      this.setupFields();
      this.loadEntries();
      this.showForm.set(false);
      this.isEditing.set(false);
    });
  }

  setupFields() {
    const today = new Date().toISOString().split('T')[0];
    this.newEntry = { date: today };

    switch (this.category) {
      case 'Routines':
        this.fields = [
          { key: 'date', label: 'Date', type: 'date' },
          { key: 'time', label: 'Time', type: 'time' },
          { key: 'task', label: 'Task', type: 'text' },
          { key: 'frequency', label: 'Frequency', type: 'select', options: ['Daily', 'Weekly', 'Monthly'] }
        ];
        break;
      case 'Expenses':
        this.fields = [
          { key: 'date', label: 'Date', type: 'date' },
          { key: 'category', label: 'Category', type: 'text' },
          { key: 'description', label: 'Description', type: 'text' },
          { key: 'amount', label: 'Amount ($)', type: 'number' }
        ];
        break;
      case 'Diet':
        this.fields = [
          { key: 'date', label: 'Date', type: 'date' },
          { key: 'type', label: 'Type', type: 'select', options: ['Breakfast', 'Lunch', 'Dinner', 'Snack'] },
          { key: 'food', label: 'Food Items', type: 'text' },
          { key: 'calories', label: 'Calories', type: 'number' },
          { key: 'water', label: 'Water (glasses)', type: 'number' }
        ];
        break;
      case 'Fitness':
        this.fields = [
          { key: 'date', label: 'Date', type: 'date' },
          { key: 'activity', label: 'Activity', type: 'text' },
          { key: 'duration', label: 'Duration (m)', type: 'number' },
          { key: 'steps', label: 'Steps', type: 'number' },
          { key: 'intensity', label: 'Intensity', type: 'select', options: ['Low', 'Medium', 'High'] }
        ];
        break;
      case 'MentalHealth':
        this.fields = [
          { key: 'date', label: 'Date', type: 'date' },
          { key: 'mood', label: 'Mood (1-10)', type: 'number' },
          { key: 'sleep', label: 'Sleep (h)', type: 'number' },
          { key: 'reflection', label: 'Reflection', type: 'textarea' }
        ];
        break;
      case 'Relationships':
        this.fields = [
          { key: 'date', label: 'Date', type: 'date' },
          { key: 'name', label: 'Name', type: 'text' },
          { key: 'type', label: 'Type', type: 'select', options: ['Family', 'Friend', 'Partner', 'Colleague'] },
          { key: 'satisfaction', label: 'Satisfaction (1-10)', type: 'number' }
        ];
        break;
      case 'Investments':
        this.fields = [
          { key: 'date', label: 'Date', type: 'date' },
          { key: 'asset', label: 'Asset Name', type: 'text' },
          { key: 'type', label: 'Type', type: 'select', options: ['Stock', 'Crypto', 'Real Estate', 'Savings'] },
          { key: 'amount', label: 'Amount ($)', type: 'number' },
          { key: 'riskLevel', label: 'Risk', type: 'select', options: ['Low', 'Medium', 'High'] }
        ];
        break;
    }
  }

  loadEntries() {
    let obs$: Observable<any[]>;
    switch (this.category) {
      case 'Routines': obs$ = this.service.routines$; break;
      case 'Expenses': obs$ = this.service.expenses$; break;
      case 'Diet': obs$ = this.service.diet$; break;
      case 'Fitness': obs$ = this.service.fitness$; break;
      case 'MentalHealth': obs$ = this.service.mentalHealth$; break;
      case 'Relationships': obs$ = this.service.relationships$; break;
      case 'Investments': obs$ = this.service.investments$; break;
      default: return;
    }
    obs$.subscribe((data: any[]) => this.allEntries.set(data));
  }

  toggleForm() {
    this.showForm.set(!this.showForm());
    if (!this.showForm()) {
       this.isEditing.set(false);
       this.editId = null;
       this.setupFields();
    }
  }

  toggleSort(key: string) {
    if (this.sortKey() === key) {
      this.sortDirection.set(this.sortDirection() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortKey.set(key);
      this.sortDirection.set('asc');
    }
  }

  editEntry(entry: any) {
    this.isEditing.set(true);
    this.editId = entry.id;
    this.newEntry = { ...entry };
    this.showForm.set(true);
  }

  saveEntry() {
    if (this.isEditing() && this.editId) {
      this.service.updateEntry(this.category, this.editId, this.newEntry);
    } else {
      this.service.addEntry(this.category, this.newEntry);
    }
    this.toggleForm();
  }

  removeEntry(id: string) {
    if (confirm('Are you sure you want to delete this entry?')) {
      this.service.removeEntry(this.category, id);
    }
  }
}
