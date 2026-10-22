import { Component, EventEmitter, Input, Output, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InvoiceItem } from '../../models/billing-template.models';

@Component({
  selector: 'app-item-edit-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal-backdrop animate-fade" *ngIf="isOpen" (click)="close.emit()">
      <div class="modal-dialog" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h3 class="modal-title">{{ isNew ? 'Add Invoice Item' : 'Edit Invoice Item' }}</h3>
          <button class="modal-close-btn" (click)="close.emit()">×</button>
        </div>

        <div class="modal-body" *ngIf="editingItem">
          <div class="form-group">
            <label class="form-label">Item Description <span class="required">*</span></label>
            <input
              type="text"
              class="form-input"
              [(ngModel)]="editingItem.description"
              placeholder="e.g. Mahal Hall Rent (AC), Stage Decoration, Buffet Catering..."
            />
          </div>

          <div class="form-row">
            <div class="form-group col-half">
              <label class="form-label">HSN / SAC Code</label>
              <input
                type="text"
                class="form-input"
                [(ngModel)]="editingItem.hsnSac"
                placeholder="e.g. 996319"
              />
            </div>
            <div class="form-group col-half">
              <label class="form-label">Quantity / Duration</label>
              <input
                type="text"
                class="form-input"
                [(ngModel)]="editingItem.qtyDuration"
                (ngModelChange)="onQtyOrRateChange()"
                placeholder="e.g. 5 Hours, 300 Seats, 1"
              />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group col-half">
              <label class="form-label">Rate ({{ currencySymbol }}) <span class="required">*</span></label>
              <input
                type="number"
                class="form-input"
                [(ngModel)]="editingItem.rate"
                (ngModelChange)="onQtyOrRateChange()"
              />
            </div>
            <div class="form-group col-half">
              <label class="form-label">Total Amount ({{ currencySymbol }})</label>
              <input
                type="number"
                class="form-input"
                [(ngModel)]="editingItem.amount"
              />
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-secondary" (click)="close.emit()">Cancel</button>
          <button class="btn btn-primary" (click)="saveItem()">
            {{ isNew ? 'Add Item' : 'Save Changes' }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.6);
      backdrop-filter: blur(4px);
      z-index: 1050;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
    }

    .modal-dialog {
      background: #ffffff;
      border-radius: 12px;
      width: 100%;
      max-width: 480px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
      overflow: hidden;
      display: flex;
      flex-direction: column;
      animation: modalSlide 0.2s ease-out;
    }

    .modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 18px;
      border-bottom: 1px solid #e2e8f0;
      background: #f8fafc;
    }

    .modal-title {
      margin: 0;
      font-size: 1rem;
      font-weight: 700;
      color: #1e293b;
    }

    .modal-close-btn {
      background: none;
      border: none;
      font-size: 1.4rem;
      color: #64748b;
      cursor: pointer;
      line-height: 1;
      padding: 0;
      transition: color 0.15s;
    }

    .modal-close-btn:hover {
      color: #0f172a;
    }

    .modal-body {
      padding: 18px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .form-row {
      display: flex;
      gap: 12px;
    }

    .col-half {
      flex: 1;
    }

    .form-label {
      font-size: 0.8rem;
      font-weight: 600;
      color: #475569;
    }

    .required {
      color: #ef4444;
    }

    .form-input {
      width: 100%;
      padding: 8px 10px;
      font-size: 0.85rem;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      box-sizing: border-box;
      outline: none;
      transition: border-color 0.2s;
    }

    .form-input:focus {
      border-color: #3b82f6;
      box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15);
    }

    .modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      padding: 12px 18px;
      border-top: 1px solid #e2e8f0;
      background: #f8fafc;
    }

    .btn {
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 0.84rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-secondary {
      background: #ffffff;
      border: 1px solid #cbd5e1;
      color: #475569;
    }

    .btn-secondary:hover {
      background: #f1f5f9;
    }

    .btn-primary {
      background: #2563eb;
      border: none;
      color: #ffffff;
    }

    .btn-primary:hover {
      background: #1d4ed8;
    }

    @keyframes modalSlide {
      from { transform: translateY(12px) scale(0.98); opacity: 0; }
      to { transform: translateY(0) scale(1); opacity: 1; }
    }
  `]
})
export class ItemEditModalComponent implements OnChanges {
  @Input() isOpen = false;
  @Input() item: InvoiceItem | null = null;
  @Input() isNew = false;
  @Input() currencySymbol = 'INR';

  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<InvoiceItem>();

  editingItem: InvoiceItem = {
    id: '',
    sNo: 1,
    description: '',
    hsnSac: '996319',
    qtyDuration: '1',
    rate: 0,
    amount: 0,
  };

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['item'] && this.item) {
      this.editingItem = { ...this.item };
    } else if (this.isNew) {
      this.editingItem = {
        id: 'item-' + Date.now(),
        sNo: 1,
        description: '',
        hsnSac: '996319',
        qtyDuration: '1',
        rate: 0,
        amount: 0,
      };
    }
  }

  onQtyOrRateChange(): void {
    const qtyNum = parseFloat(this.editingItem.qtyDuration) || 1;
    const rateNum = Number(this.editingItem.rate) || 0;
    this.editingItem.amount = qtyNum * rateNum;
  }

  saveItem(): void {
    if (!this.editingItem.description.trim()) {
      alert('Please enter an item description.');
      return;
    }
    this.save.emit(this.editingItem);
    this.close.emit();
  }
}
