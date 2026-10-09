import { Component, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FinanceService } from './finance.service';
import { TransactionType } from './finance.models';

@Component({
  selector: 'app-add-transaction-drawer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <aside
      class="transaction-drawer"
      [class.open]="service.isAddDrawerOpen()"
      aria-label="Add or Edit Transaction Drawer"
    >
      <header class="drawer-header">
        <h2>{{ isEditing() ? 'Edit Transaction' : 'Add Transaction' }}</h2>
        <button
          type="button"
          class="btn-close"
          aria-label="Close drawer"
          (click)="service.closeAddDrawer()"
        >
          <i class="pi pi-times"></i>
        </button>
      </header>

      <!-- Type Tabs -->
      <div class="type-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          class="tab-btn expense-tab"
          [class.active]="selectedType() === 'expense'"
          (click)="setType('expense')"
        >
          Expense
        </button>
        <button
          type="button"
          role="tab"
          class="tab-btn income-tab"
          [class.active]="selectedType() === 'income'"
          (click)="setType('income')"
        >
          Income
        </button>
        <button
          type="button"
          role="tab"
          class="tab-btn transfer-tab"
          [class.active]="selectedType() === 'transfer'"
          (click)="setType('transfer')"
        >
          Transfer
        </button>
      </div>

      <form class="drawer-form" (ngSubmit)="saveTransaction()">
        <!-- Date -->
        <div class="form-group">
          <label for="txDate">Date <span class="required">*</span></label>
          <div class="input-icon-wrap">
            <input
              id="txDate"
              type="date"
              [(ngModel)]="date"
              name="date"
              required
              class="form-control"
            />
            <i class="pi pi-calendar input-icon"></i>
          </div>
        </div>

        <!-- Amount -->
        <div class="form-group">
          <label for="txAmount">Amount <span class="required">*</span></label>
          <div class="input-currency-wrap">
            <span class="currency-symbol">₹</span>
            <input
              id="txAmount"
              type="number"
              [(ngModel)]="amount"
              name="amount"
              placeholder="0"
              min="1"
              step="any"
              required
              class="form-control amount-input"
            />
          </div>
        </div>

        <!-- Category -->
        <div class="form-group">
          <label for="txCategory">Category <span class="required">*</span></label>
          <div class="select-wrap">
            <select
              id="txCategory"
              [(ngModel)]="category"
              name="category"
              required
              class="form-control"
            >
              <option *ngFor="let cat of availableCategories()" [value]="cat.name">
                {{ cat.icon }} {{ cat.name }}
              </option>
            </select>
            <i class="pi pi-chevron-down select-chevron"></i>
          </div>
        </div>

        <!-- Description -->
        <div class="form-group">
          <label for="txDesc">Description <span class="required">*</span></label>
          <input
            id="txDesc"
            type="text"
            [(ngModel)]="description"
            name="description"
            placeholder="e.g. Amazon Purchase, Grocery"
            required
            class="form-control"
          />
        </div>

        <!-- Payment Method -->
        <div class="form-group">
          <label for="txPayment">Payment Method</label>
          <div class="select-wrap">
            <select
              id="txPayment"
              [(ngModel)]="paymentMethod"
              name="paymentMethod"
              class="form-control"
            >
              <option value="Credit Card">💳 Credit Card</option>
              <option value="Debit Card">💳 Debit Card</option>
              <option value="UPI">📱 UPI</option>
              <option value="Net Banking">🏦 Net Banking</option>
              <option value="Cash">💵 Cash</option>
            </select>
            <i class="pi pi-chevron-down select-chevron"></i>
          </div>
        </div>

        <!-- Tags -->
        <div class="form-group">
          <label for="tagInput">Tag (Optional)</label>
          <div class="tags-container">
            <span *ngFor="let t of tags; let i = index" class="tag-chip">
              {{ t }}
              <button type="button" class="tag-remove" (click)="removeTag(i)" aria-label="Remove tag">
                ×
              </button>
            </span>
            <input
              id="tagInput"
              type="text"
              [(ngModel)]="newTagInput"
              name="newTagInput"
              placeholder="Add tag and press Enter"
              (keydown.enter)="$event.preventDefault(); addTag()"
              class="tag-inline-input"
            />
          </div>
        </div>

        <!-- Attach Receipt -->
        <div class="form-group">
          <label>Attach Receipt (Optional)</label>
          <div
            class="receipt-dropzone"
            (click)="receiptFileInput.click()"
            (dragover)="$event.preventDefault()"
            (drop)="handleFileDrop($event)"
          >
            <input
              #receiptFileInput
              type="file"
              hidden
              accept="image/png, image/jpeg, application/pdf"
              (change)="handleFileSelect($event)"
            />
            <div class="dropzone-content">
              <i class="pi pi-upload dropzone-icon"></i>
              <p *ngIf="!receiptName" class="dropzone-text">
                Drag & drop or click to upload<br />
                <small>PNG, JPG, PDF (Max 5MB)</small>
              </p>
              <div *ngIf="receiptName" class="receipt-preview">
                <i class="pi pi-file receipt-file-icon"></i>
                <span class="file-name">{{ receiptName }}</span>
                <button
                  type="button"
                  class="btn-clear-receipt"
                  (click)="$event.stopPropagation(); removeReceipt()"
                >
                  <i class="pi pi-trash"></i>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Recurring Toggle -->
        <div class="recurring-row">
          <label class="recurring-label" for="recurringSwitch">Add to Recurring</label>
          <label class="switch">
            <input
              id="recurringSwitch"
              type="checkbox"
              [(ngModel)]="isRecurring"
              name="isRecurring"
            />
            <span class="slider round"></span>
          </label>
        </div>

        <!-- Form Actions -->
        <div class="drawer-actions">
          <button
            type="button"
            class="btn btn-cancel"
            (click)="service.closeAddDrawer()"
          >
            Cancel
          </button>
          <button type="submit" class="btn btn-save">
            {{ isEditing() ? 'Update Transaction' : 'Save Transaction' }}
          </button>
        </div>
      </form>
    </aside>
  `,
  styles: [
    `
      .transaction-drawer {
        background: #ffffff;
        border-radius: 20px;
        padding: 24px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.05);
        border: 1px solid rgba(226, 232, 240, 0.8);
        display: flex;
        flex-direction: column;
        gap: 20px;
        position: relative;
        width: 100%;
        max-width: 380px;
        transition: all 0.3s ease;
      }

      .drawer-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .drawer-header h2 {
        font-size: 1.15rem;
        font-weight: 700;
        color: #0f172a;
        margin: 0;
      }

      .btn-close {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        border: 1px solid #e2e8f0;
        background: #f8fafc;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        color: #64748b;
        transition: all 0.2s ease;
      }

      .btn-close:hover {
        background: #f1f5f9;
        color: #0f172a;
      }

      /* Tabs matching screenshot */
      .type-tabs {
        display: flex;
        background: #f8fafc;
        padding: 4px;
        border-radius: 12px;
        gap: 4px;
      }

      .tab-btn {
        flex: 1;
        padding: 8px 12px;
        border: none;
        background: transparent;
        border-radius: 8px;
        font-size: 0.88rem;
        font-weight: 600;
        color: #64748b;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .tab-btn.expense-tab.active {
        background: #fee2e2;
        color: #ef4444;
      }

      .tab-btn.income-tab.active {
        background: #dcfce7;
        color: #10b981;
      }

      .tab-btn.transfer-tab.active {
        background: #e0e7ff;
        color: #6366f1;
      }

      /* Form controls */
      .drawer-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .form-group {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .form-group label {
        font-size: 0.82rem;
        font-weight: 600;
        color: #334155;
      }

      .required {
        color: #ef4444;
      }

      .form-control {
        width: 100%;
        height: 42px;
        padding: 8px 14px;
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        background: #ffffff;
        font-size: 0.92rem;
        color: #0f172a;
        transition: border-color 0.2s ease, box-shadow 0.2s ease;
      }

      .form-control:focus {
        outline: none;
        border-color: #3b82f6;
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.12);
      }

      .input-icon-wrap,
      .select-wrap {
        position: relative;
        display: flex;
        align-items: center;
      }

      .input-icon {
        position: absolute;
        right: 14px;
        color: #94a3b8;
        pointer-events: none;
      }

      .select-chevron {
        position: absolute;
        right: 14px;
        color: #94a3b8;
        pointer-events: none;
        font-size: 0.75rem;
      }

      select.form-control {
        appearance: none;
        padding-right: 32px;
        cursor: pointer;
      }

      .input-currency-wrap {
        position: relative;
        display: flex;
        align-items: center;
      }

      .currency-symbol {
        position: absolute;
        left: 14px;
        font-weight: 700;
        color: #0f172a;
        font-size: 1rem;
        pointer-events: none;
      }

      .amount-input {
        padding-left: 32px;
        font-size: 1.05rem;
        font-weight: 700;
        color: #0f172a;
      }

      /* Tags */
      .tags-container {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px;
        padding: 6px 10px;
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        background: #ffffff;
        min-height: 42px;
      }

      .tag-chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: #dbeafe;
        color: #2563eb;
        font-size: 0.8rem;
        font-weight: 600;
        padding: 4px 10px;
        border-radius: 16px;
      }

      .tag-remove {
        background: transparent;
        border: none;
        color: #2563eb;
        font-size: 1rem;
        line-height: 1;
        cursor: pointer;
        padding: 0;
      }

      .tag-inline-input {
        border: none;
        outline: none;
        font-size: 0.85rem;
        flex: 1;
        min-width: 110px;
        padding: 4px 0;
        background: transparent;
      }

      /* Receipt dropzone */
      .receipt-dropzone {
        border: 1.5px dashed #cbd5e1;
        border-radius: 12px;
        padding: 16px 12px;
        text-align: center;
        background: #f8fafc;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .receipt-dropzone:hover {
        border-color: #3b82f6;
        background: #f0f7ff;
      }

      .dropzone-icon {
        font-size: 1.35rem;
        color: #64748b;
        margin-bottom: 6px;
      }

      .dropzone-text {
        font-size: 0.8rem;
        color: #64748b;
        margin: 0;
        line-height: 1.4;
      }

      .dropzone-text small {
        color: #94a3b8;
        font-size: 0.72rem;
      }

      .receipt-preview {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        background: #ffffff;
        padding: 6px 12px;
        border-radius: 8px;
        border: 1px solid #e2e8f0;
      }

      .file-name {
        font-size: 0.82rem;
        font-weight: 600;
        color: #0f172a;
        max-width: 180px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .btn-clear-receipt {
        background: transparent;
        border: none;
        color: #ef4444;
        cursor: pointer;
      }

      /* Recurring switch */
      .recurring-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 6px 0;
      }

      .recurring-label {
        font-size: 0.88rem;
        font-weight: 600;
        color: #334155;
      }

      .switch {
        position: relative;
        display: inline-block;
        width: 44px;
        height: 24px;
      }

      .switch input {
        opacity: 0;
        width: 0;
        height: 0;
      }

      .slider {
        position: absolute;
        cursor: pointer;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: #cbd5e1;
        transition: 0.3s;
      }

      .slider:before {
        position: absolute;
        content: '';
        height: 18px;
        width: 18px;
        left: 3px;
        bottom: 3px;
        background-color: white;
        transition: 0.3s;
      }

      input:checked + .slider {
        background-color: #2563eb;
      }

      input:checked + .slider:before {
        transform: translateX(20px);
      }

      .slider.round {
        border-radius: 24px;
      }

      .slider.round:before {
        border-radius: 50%;
      }

      /* Actions matching screenshot */
      .drawer-actions {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-top: 8px;
      }

      .btn {
        flex: 1;
        height: 42px;
        border-radius: 10px;
        font-size: 0.92rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }

      .btn-cancel {
        background: #ffffff;
        border: 1px solid #e2e8f0;
        color: #475569;
      }

      .btn-cancel:hover {
        background: #f8fafc;
        color: #0f172a;
      }

      .btn-save {
        background: #2563eb;
        border: none;
        color: #ffffff;
        box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25);
      }

      .btn-save:hover {
        background: #1d4ed8;
      }
    `,
  ],
})
export class AddTransactionDrawerComponent {
  service = inject(FinanceService);

  selectedType = signal<TransactionType>('expense');
  date = '2026-05-31';
  amount = 2500;
  category = 'Shopping';
  description = 'Amazon Purchase';
  paymentMethod = 'Credit Card';
  tags: string[] = ['Personal'];
  newTagInput = '';
  receiptName: string | null = null;
  isRecurring = false;

  isEditing = computed(() => !!this.service.editingTransaction());

  expenseCategories = [
    { name: 'Shopping', icon: '🛒' },
    { name: 'Housing', icon: '🏠' },
    { name: 'Food', icon: '🍔' },
    { name: 'Transport', icon: '🚗' },
    { name: 'Utilities', icon: '⚡' },
    { name: 'Investment', icon: '📈' },
    { name: 'Entertainment', icon: '🎬' },
    { name: 'Health', icon: '🩺' },
    { name: 'Education', icon: '🎓' },
    { name: 'Others', icon: '📦' },
  ];

  incomeCategories = [
    { name: 'Salary', icon: '💵' },
    { name: 'Freelance', icon: '💻' },
    { name: 'Business', icon: '🏢' },
    { name: 'Investments', icon: '📈' },
    { name: 'Rental', icon: '🏠' },
    { name: 'Others', icon: '🎁' },
  ];

  transferCategories = [
    { name: 'Account Transfer', icon: '⇄' },
    { name: 'Wallet Topup', icon: '📱' },
    { name: 'Investment Deposit', icon: '🏦' },
  ];

  availableCategories = computed(() => {
    switch (this.selectedType()) {
      case 'income':
        return this.incomeCategories;
      case 'transfer':
        return this.transferCategories;
      default:
        return this.expenseCategories;
    }
  });

  constructor() {
    effect(() => {
      const editTx = this.service.editingTransaction();
      if (editTx) {
        this.selectedType.set(editTx.type);
        this.date = editTx.date;
        this.amount = editTx.amount;
        this.category = editTx.category;
        this.description = editTx.description;
        this.paymentMethod = editTx.paymentMethod;
        this.tags = [...(editTx.tags || [])];
        this.receiptName = editTx.receiptName || null;
        this.isRecurring = editTx.isRecurring || false;
      }
    });
  }

  setType(type: TransactionType): void {
    this.selectedType.set(type);
    const cats = this.availableCategories();
    if (cats.length && !cats.some((c) => c.name === this.category)) {
      this.category = cats[0].name;
    }
  }

  addTag(): void {
    const trimmed = this.newTagInput.trim();
    if (trimmed && !this.tags.includes(trimmed)) {
      this.tags.push(trimmed);
      this.newTagInput = '';
    }
  }

  removeTag(idx: number): void {
    this.tags.splice(idx, 1);
  }

  handleFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.receiptName = input.files[0].name;
    }
  }

  handleFileDrop(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer?.files?.length) {
      this.receiptName = event.dataTransfer.files[0].name;
    }
  }

  removeReceipt(): void {
    this.receiptName = null;
  }

  saveTransaction(): void {
    if (!this.description || !this.amount || !this.date) {
      alert('Please fill all required fields');
      return;
    }

    const payload = {
      type: this.selectedType(),
      date: this.date,
      amount: Number(this.amount),
      category: this.category,
      description: this.description,
      paymentMethod: this.paymentMethod,
      tags: [...this.tags],
      receiptName: this.receiptName || undefined,
      isRecurring: this.isRecurring,
    };

    const currentEdit = this.service.editingTransaction();
    if (currentEdit) {
      this.service.updateTransaction(currentEdit.id, payload);
    } else {
      this.service.addTransaction(payload);
    }

    this.service.closeAddDrawer();
  }
}
