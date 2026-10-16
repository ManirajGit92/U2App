import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  Output,
  ViewChild,
  forwardRef,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'app-combobox',
  standalone: true,
  imports: [CommonModule, FormsModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => ComboboxComponent),
      multi: true
    }
  ],
  template: `
    <div
      class="combobox-container"
      [class.is-open]="isOpen"
      [class.is-disabled]="disabled"
      [class.is-invalid]="required && !value && isTouched"
      (click)="$event.stopPropagation()"
    >
      <!-- Main Text Input + Dropdown Toggle Arrow -->
      <div class="combobox-field" [ngClass]="inputClass">
        <input
          #inputEl
          type="text"
          class="combobox-input"
          [placeholder]="placeholder"
          [disabled]="disabled"
          [required]="required"
          [name]="name"
          [value]="value"
          (input)="onInputChange($event)"
          (focus)="onInputFocus()"
          (blur)="onInputBlur()"
          (keydown)="onKeydown($event)"
          autocomplete="off"
        />
        <button
          type="button"
          class="combobox-toggle-btn"
          tabindex="-1"
          [disabled]="disabled"
          (click)="toggleDropdown($event)"
          [title]="isOpen ? 'Close suggestions' : 'Show suggestions'"
          aria-label="Toggle options dropdown"
        >
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" [class.rotated]="isOpen">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
      </div>

      <!-- Dropdown Suggestions Panel -->
      <div class="combobox-dropdown" *ngIf="isOpen" (click)="$event.stopPropagation()">
        <!-- Filter search when many options exist -->
        <div class="dropdown-search-box" *ngIf="options.length > 5">
          <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            #filterSearchInput
            type="text"
            class="dropdown-search-input"
            placeholder="Search options..."
            [(ngModel)]="filterQuery"
            (click)="$event.stopPropagation()"
          />
          <button type="button" class="btn-clear-query" *ngIf="filterQuery" (click)="filterQuery = ''">✕</button>
        </div>

        <!-- Options list -->
        <div class="dropdown-list">
          <div
            *ngFor="let opt of filteredOptions"
            class="dropdown-item"
            [class.selected]="opt === value"
            (mousedown)="selectOption(opt)"
          >
            <span class="item-text">{{ opt }}</span>
            <span class="item-check" *ngIf="opt === value">✓</span>
          </div>

          <div class="dropdown-empty-hint" *ngIf="filteredOptions.length === 0">
            <span *ngIf="!value && !filterQuery">No existing suggestions</span>
            <span *ngIf="value || filterQuery">
              Custom value: "<strong>{{ value || filterQuery }}</strong>" (Enter to keep)
            </span>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: inline-block;
      width: 100%;
      vertical-align: middle;
      font-family: inherit;
    }

    .combobox-container {
      position: relative;
      width: 100%;
      display: flex;
      flex-direction: column;
    }

    .combobox-field {
      position: relative;
      display: flex;
      align-items: center;
      width: 100%;
      background: rgba(255, 255, 255, 0.85);
      border: 1px solid rgba(0, 0, 0, 0.14);
      border-radius: 8px;
      transition: all 0.15s ease-in-out;
    }

    :host-context(body.dark-theme) .combobox-field,
    :host-context(body.theme-jarvis) .combobox-field {
      background: rgba(15, 23, 42, 0.7);
      border-color: rgba(148, 163, 184, 0.25);
      color: #f1f5f9;
    }

    .combobox-container.is-open .combobox-field {
      border-color: #3b82f6;
      box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
    }

    .combobox-input {
      flex: 1;
      width: 100%;
      padding: 0.5rem 0.5rem 0.5rem 0.65rem;
      border: none;
      background: transparent;
      color: inherit;
      font: inherit;
      font-size: 0.88rem;
      outline: none;
      min-width: 0;
    }

    .combobox-toggle-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: transparent;
      border: none;
      color: #718096;
      padding: 0 7px;
      height: 100%;
      cursor: pointer;
      transition: color 0.15s ease;
    }

    .combobox-toggle-btn:hover {
      color: #3b82f6;
    }

    .combobox-toggle-btn svg {
      transition: transform 0.2s ease;
    }

    .combobox-toggle-btn svg.rotated {
      transform: rotate(180deg);
    }

    /* Dropdown suggestions panel */
    .combobox-dropdown {
      position: absolute;
      top: calc(100% + 4px);
      left: 0;
      right: 0;
      z-index: 1050;
      background: #1e293b;
      color: #f1f5f9;
      border: 1px solid rgba(148, 163, 184, 0.25);
      border-radius: 8px;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4);
      max-height: 220px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      animation: dropdownFade 0.15s ease-out;
    }

    :host-context(body.light-theme) .combobox-dropdown,
    :host-context(.light-mode) .combobox-dropdown {
      background: #ffffff;
      color: #1e293b;
      border-color: #cbd5e1;
      box-shadow: 0 8px 20px rgba(0, 0, 0, 0.15);
    }

    @keyframes dropdownFade {
      from { opacity: 0; transform: translateY(-4px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .dropdown-search-box {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 8px;
      border-bottom: 1px solid rgba(148, 163, 184, 0.15);
      background: rgba(0, 0, 0, 0.15);
    }

    :host-context(body.light-theme) .dropdown-search-box {
      background: #f8fafc;
      border-bottom-color: #e2e8f0;
    }

    .dropdown-search-input {
      flex: 1;
      background: transparent;
      border: none;
      color: inherit;
      font-size: 0.78rem;
      outline: none;
    }

    .btn-clear-query {
      background: none;
      border: none;
      color: #94a3b8;
      cursor: pointer;
      font-size: 0.7rem;
    }

    .dropdown-list {
      max-height: 170px;
      overflow-y: auto;
      padding: 4px 0;
      display: flex;
      flex-direction: column;
    }

    .dropdown-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 6px 10px;
      cursor: pointer;
      font-size: 0.82rem;
      transition: background 0.12s ease;
      user-select: none;
    }

    .dropdown-item:hover {
      background: rgba(59, 130, 246, 0.18);
    }

    .dropdown-item.selected {
      background: rgba(59, 130, 246, 0.12);
      font-weight: 700;
      color: #60a5fa;
    }

    .item-text {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .item-check {
      color: #3b82f6;
      font-weight: bold;
      font-size: 0.8rem;
      margin-left: 6px;
    }

    .dropdown-empty-hint {
      padding: 10px;
      font-size: 0.76rem;
      color: #94a3b8;
      text-align: center;
      font-style: italic;
    }

    /* Compact styling for inline table usage */
    :host-context(table) .combobox-field {
      border-radius: 6px;
      min-width: 110px;
    }

    :host-context(table) .combobox-input {
      padding: 0.35rem 0.4rem;
      font-size: 0.82rem;
    }
  `]
})
export class ComboboxComponent implements ControlValueAccessor {
  @Input() options: string[] = [];
  @Input() placeholder = '';
  @Input() disabled = false;
  @Input() required = false;
  @Input() name = '';
  @Input() inputClass = '';

  @Output() valueChange = new EventEmitter<string>();

  @ViewChild('inputEl') inputEl?: ElementRef<HTMLInputElement>;
  @ViewChild('filterSearchInput') filterSearchInput?: ElementRef<HTMLInputElement>;

  private elementRef = inject(ElementRef);

  value = '';
  isOpen = false;
  filterQuery = '';
  isTouched = false;

  private onChange: (val: string) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(val: any): void {
    this.value = val != null ? String(val) : '';
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  setDisabledState?(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  get filteredOptions(): string[] {
    const list = this.options || [];
    const query = (this.filterQuery || this.value || '').toLowerCase().trim();
    if (!query) {
      return list;
    }
    return list.filter(opt => opt && opt.toLowerCase().includes(query));
  }

  onInputChange(event: Event): void {
    const inputVal = (event.target as HTMLInputElement).value;
    this.value = inputVal;
    this.onChange(inputVal);
    this.valueChange.emit(inputVal);
    if (!this.isOpen && this.options.length > 0) {
      this.isOpen = true;
    }
  }

  onInputFocus(): void {
    if (this.options && this.options.length > 0) {
      this.isOpen = true;
    }
  }

  onInputBlur(): void {
    this.isTouched = true;
    this.onTouched();
  }

  toggleDropdown(event: MouseEvent): void {
    event.stopPropagation();
    if (this.disabled) return;
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      this.filterQuery = '';
      setTimeout(() => this.inputEl?.nativeElement.focus(), 0);
    }
  }

  selectOption(opt: string): void {
    this.value = opt;
    this.onChange(opt);
    this.valueChange.emit(opt);
    this.isOpen = false;
    this.filterQuery = '';
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.isOpen = false;
    } else if (event.key === 'Enter') {
      this.isOpen = false;
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.isOpen && !this.elementRef.nativeElement.contains(event.target)) {
      this.isOpen = false;
    }
  }
}
