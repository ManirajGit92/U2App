import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface ColumnFilterOption {
  value: string;
  label: string;
  count?: number;
}

@Component({
  selector: 'app-column-filter',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="col-filter-wrapper" (click)="$event.stopPropagation()">
      <!-- Filter Trigger Icon in Column Header -->
      <button
        type="button"
        class="col-filter-btn"
        [class.active]="hasActiveFilter"
        [class.open]="isOpen"
        (click)="toggleOpen($event)"
        [title]="hasActiveFilter ? (selectedCount + ' active on ' + columnLabel) : ('Filter ' + columnLabel)"
        aria-label="Filter column"
      >
        <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
        </svg>
        <span class="active-dot" *ngIf="hasActiveFilter"></span>
        <span class="count-pill" *ngIf="hasActiveFilter">{{ selectedCount }}</span>
      </button>

      <!-- Dropdown Filter Popover -->
      <div class="col-filter-popover" *ngIf="isOpen" (click)="$event.stopPropagation()">
        <!-- Header -->
        <div class="popover-header">
          <div class="header-title">
            <span class="col-name">{{ columnLabel }}</span>
            <span class="col-filter-tag">Filter</span>
          </div>
          <button
            type="button"
            class="btn-clear-link"
            *ngIf="hasActiveFilter"
            (click)="clearFilter()"
            title="Clear filters for this column"
          >
            Clear
          </button>
        </div>

        <!-- Search Input -->
        <div class="popover-search">
          <svg class="search-icon" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            class="search-input"
            [(ngModel)]="searchQuery"
            placeholder="Search values..."
            (keydown.escape)="isOpen = false"
            (click)="$event.stopPropagation()"
          />
          <button
            type="button"
            class="search-clear-btn"
            *ngIf="searchQuery"
            (click)="searchQuery = ''"
            title="Clear search"
          >
            ✕
          </button>
        </div>

        <!-- Select All / Deselect All Controls -->
        <div class="popover-controls">
          <button type="button" class="control-btn" (click)="selectAll()">Select All</button>
          <span class="control-divider">|</span>
          <button type="button" class="control-btn" (click)="deselectAll()">Deselect All</button>
        </div>

        <!-- Scrollable Checkbox List -->
        <div class="popover-list">
          <label
            *ngFor="let opt of filteredOptions"
            class="filter-option-row"
            [class.checked]="isSelected(opt.value)"
          >
            <input
              type="checkbox"
              class="filter-checkbox"
              [checked]="isSelected(opt.value)"
              (change)="toggleOption(opt.value)"
            />
            <span class="option-label" [title]="opt.label">{{ opt.label }}</span>
            <span class="option-count" *ngIf="opt.count !== undefined">{{ opt.count }}</span>
          </label>

          <div class="empty-options" *ngIf="filteredOptions.length === 0">
            <span *ngIf="options.length === 0">No values recorded</span>
            <span *ngIf="options.length > 0">No matches for "{{ searchQuery }}"</span>
          </div>
        </div>

        <!-- Footer -->
        <div class="popover-footer">
          <span class="footer-summary">
            {{ selectedCount }} of {{ options.length }} selected
          </span>
          <button type="button" class="btn-done" (click)="isOpen = false">
            Done
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: inline-flex;
      vertical-align: middle;
      font-family: inherit;
    }

    .col-filter-wrapper {
      position: relative;
      display: inline-flex;
      align-items: center;
    }

    /* Trigger button */
    .col-filter-btn {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      padding: 3px 5px;
      margin-left: 4px;
      background: transparent;
      border: 1px solid transparent;
      border-radius: 4px;
      color: #718096;
      cursor: pointer;
      font-size: 0.75rem;
      transition: all 0.15s ease-in-out;
      line-height: 1;
    }

    .col-filter-btn:hover {
      background: rgba(66, 153, 225, 0.15);
      color: #3182ce;
      border-color: rgba(66, 153, 225, 0.3);
    }

    .col-filter-btn.open {
      background: rgba(66, 153, 225, 0.25);
      color: #2b6cb0;
      border-color: #3182ce;
    }

    .col-filter-btn.active {
      background: #3182ce;
      color: #ffffff;
      border-color: #2b6cb0;
      box-shadow: 0 1px 4px rgba(49, 130, 206, 0.35);
    }

    .count-pill {
      font-size: 0.68rem;
      font-weight: 800;
      line-height: 1;
      padding: 1px 3px;
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.3);
      color: #ffffff;
    }

    /* Dropdown Popover */
    .col-filter-popover {
      position: absolute;
      top: calc(100% + 6px);
      left: 0;
      z-index: 1000;
      width: 230px;
      background: #1e293b;
      color: #f1f5f9;
      border: 1px solid rgba(148, 163, 184, 0.25);
      border-radius: 8px;
      box-shadow: 0 12px 30px rgba(0, 0, 0, 0.45);
      display: flex;
      flex-direction: column;
      font-size: 0.8rem;
      text-transform: none;
      letter-spacing: normal;
      font-weight: normal;
      overflow: hidden;
      animation: popoverFadeIn 0.15s ease-out;
    }

    @keyframes popoverFadeIn {
      from { opacity: 0; transform: translateY(-4px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* Light theme adaptation */
    :host-context(body.light-theme) .col-filter-popover,
    :host-context(.light-mode) .col-filter-popover {
      background: #ffffff;
      color: #1e293b;
      border-color: #cbd5e1;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.18);
    }

    /* Header */
    .popover-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 10px;
      background: rgba(0, 0, 0, 0.2);
      border-bottom: 1px solid rgba(148, 163, 184, 0.15);
    }

    :host-context(body.light-theme) .popover-header {
      background: #f8fafc;
      border-bottom-color: #e2e8f0;
    }

    .header-title {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .col-name {
      font-weight: 700;
      color: inherit;
    }

    .col-filter-tag {
      font-size: 0.65rem;
      padding: 1px 5px;
      border-radius: 4px;
      background: rgba(59, 130, 246, 0.2);
      color: #60a5fa;
      font-weight: 600;
    }

    .btn-clear-link {
      background: none;
      border: none;
      color: #f87171;
      font-size: 0.72rem;
      font-weight: 700;
      cursor: pointer;
      padding: 2px 4px;
      border-radius: 3px;
    }

    .btn-clear-link:hover {
      text-decoration: underline;
      background: rgba(239, 68, 68, 0.1);
    }

    /* Search input */
    .popover-search {
      display: flex;
      align-items: center;
      padding: 6px 8px;
      position: relative;
      border-bottom: 1px solid rgba(148, 163, 184, 0.12);
    }

    .search-icon {
      position: absolute;
      left: 14px;
      color: #94a3b8;
      pointer-events: none;
    }

    .search-input {
      width: 100%;
      padding: 5px 22px 5px 24px;
      border-radius: 5px;
      border: 1px solid rgba(148, 163, 184, 0.2);
      background: rgba(15, 23, 42, 0.6);
      color: inherit;
      font-size: 0.76rem;
      outline: none;
    }

    :host-context(body.light-theme) .search-input {
      background: #f1f5f9;
      border-color: #cbd5e1;
    }

    .search-input:focus {
      border-color: #3b82f6;
    }

    .search-clear-btn {
      position: absolute;
      right: 12px;
      background: none;
      border: none;
      color: #94a3b8;
      cursor: pointer;
      font-size: 0.72rem;
      padding: 0;
      line-height: 1;
    }

    /* Quick controls */
    .popover-controls {
      display: flex;
      align-items: center;
      justify-content: space-around;
      padding: 5px 8px;
      background: rgba(0, 0, 0, 0.1);
      border-bottom: 1px solid rgba(148, 163, 184, 0.1);
      font-size: 0.7rem;
    }

    .control-btn {
      background: none;
      border: none;
      color: #38bdf8;
      font-size: 0.72rem;
      font-weight: 600;
      cursor: pointer;
      padding: 2px 4px;
      border-radius: 3px;
    }

    .control-btn:hover {
      text-decoration: underline;
    }

    .control-divider {
      color: #64748b;
      opacity: 0.5;
    }

    /* List */
    .popover-list {
      max-height: 180px;
      overflow-y: auto;
      padding: 4px 0;
      display: flex;
      flex-direction: column;
    }

    .filter-option-row {
      display: flex;
      align-items: center;
      gap: 7px;
      padding: 4px 10px;
      cursor: pointer;
      transition: background 0.12s ease;
      user-select: none;
    }

    .filter-option-row:hover {
      background: rgba(59, 130, 246, 0.12);
    }

    .filter-option-row.checked {
      background: rgba(59, 130, 246, 0.08);
    }

    .filter-checkbox {
      cursor: pointer;
      width: 13px;
      height: 13px;
      accent-color: #3b82f6;
      margin: 0;
      flex-shrink: 0;
    }

    .option-label {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 0.77rem;
    }

    .option-count {
      font-size: 0.68rem;
      color: #94a3b8;
      background: rgba(148, 163, 184, 0.15);
      padding: 1px 5px;
      border-radius: 8px;
      flex-shrink: 0;
    }

    .empty-options {
      padding: 14px 10px;
      text-align: center;
      color: #94a3b8;
      font-style: italic;
      font-size: 0.74rem;
    }

    /* Footer */
    .popover-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 7px 10px;
      background: rgba(0, 0, 0, 0.2);
      border-top: 1px solid rgba(148, 163, 184, 0.15);
    }

    :host-context(body.light-theme) .popover-footer {
      background: #f8fafc;
      border-top-color: #e2e8f0;
    }

    .footer-summary {
      font-size: 0.68rem;
      color: #94a3b8;
    }

    .btn-done {
      padding: 3px 10px;
      border-radius: 4px;
      background: #3b82f6;
      color: #ffffff;
      border: none;
      font-size: 0.74rem;
      font-weight: 700;
      cursor: pointer;
    }

    .btn-done:hover {
      background: #2563eb;
    }
  `]
})
export class ColumnFilterComponent implements OnChanges {
  @Input() columnLabel = '';
  @Input() options: ColumnFilterOption[] = [];
  @Input() selectedValues: string[] = [];

  @Output() filterChange = new EventEmitter<string[]>();
  @Output() clear = new EventEmitter<void>();

  private elementRef = inject(ElementRef);

  isOpen = false;
  searchQuery = '';
  localSelected = new Set<string>();

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['selectedValues']) {
      this.localSelected = new Set(this.selectedValues || []);
    }
  }

  get hasActiveFilter(): boolean {
    return this.selectedValues && this.selectedValues.length > 0;
  }

  get selectedCount(): number {
    return this.selectedValues?.length || 0;
  }

  get filteredOptions(): ColumnFilterOption[] {
    if (!this.searchQuery.trim()) {
      return this.options;
    }
    const q = this.searchQuery.toLowerCase().trim();
    return this.options.filter(opt =>
      opt.label.toLowerCase().includes(q) || opt.value.toLowerCase().includes(q)
    );
  }

  toggleOpen(event: MouseEvent): void {
    event.stopPropagation();
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      this.localSelected = new Set(this.selectedValues || []);
      this.searchQuery = '';
    }
  }

  isSelected(value: string): boolean {
    return this.localSelected.has(value);
  }

  toggleOption(value: string): void {
    if (this.localSelected.has(value)) {
      this.localSelected.delete(value);
    } else {
      this.localSelected.add(value);
    }
    this.emitChange();
  }

  selectAll(): void {
    for (const opt of this.filteredOptions) {
      this.localSelected.add(opt.value);
    }
    this.emitChange();
  }

  deselectAll(): void {
    if (this.searchQuery.trim()) {
      for (const opt of this.filteredOptions) {
        this.localSelected.delete(opt.value);
      }
    } else {
      this.localSelected.clear();
    }
    this.emitChange();
  }

  clearFilter(): void {
    this.localSelected.clear();
    this.emitChange();
    this.clear.emit();
  }

  private emitChange(): void {
    const arr = Array.from(this.localSelected);
    this.filterChange.emit(arr);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.isOpen && !this.elementRef.nativeElement.contains(event.target)) {
      this.isOpen = false;
    }
  }
}
