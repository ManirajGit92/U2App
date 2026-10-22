import { Component, EventEmitter, Input, Output, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InvoiceTemplate, InvoiceTotals } from '../../models/billing-template.models';
import { BillingTemplateStateService } from '../../services/billing-template-state.service';
import { InvoicePrintPdfService } from '../../services/invoice-print-pdf.service';

@Component({
  selector: 'app-invoice-generator-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal-backdrop" *ngIf="isOpen" (click)="close.emit()">
      <div class="modal-dialog modal-lg" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <div class="header-left">
            <span class="header-icon">⚡</span>
            <div>
              <h3 class="modal-title">Generate Customer Invoice</h3>
              <p class="modal-subtitle">Create a client invoice directly from "{{ workingTemplate?.name }}"</p>
            </div>
          </div>
          <button class="modal-close-btn" (click)="close.emit()">×</button>
        </div>

        <div class="modal-body" *ngIf="workingTemplate">
          <!-- Quick Config Controls -->
          <div class="config-grid">
            <div class="config-col">
              <h4 class="col-title">Client Details</h4>
              <div class="form-group">
                <label class="form-label">Client Name</label>
                <input type="text" class="form-input" [(ngModel)]="workingTemplate.customerInfo.name" />
              </div>
              <div class="form-group">
                <label class="form-label">Billing Address</label>
                <textarea rows="2" class="form-input" [(ngModel)]="workingTemplate.customerInfo.address"></textarea>
              </div>
              <div class="form-row">
                <div class="form-group col-half">
                  <label class="form-label">Phone</label>
                  <input type="text" class="form-input" [(ngModel)]="workingTemplate.customerInfo.phone" />
                </div>
                <div class="form-group col-half">
                  <label class="form-label">Client GSTIN</label>
                  <input type="text" class="form-input uppercase" [(ngModel)]="workingTemplate.customerInfo.gstin" />
                </div>
              </div>
            </div>

            <div class="config-col">
              <h4 class="col-title">Invoice Meta</h4>
              <div class="form-row">
                <div class="form-group col-half">
                  <label class="form-label">Invoice Number</label>
                  <input type="text" class="form-input font-bold" [(ngModel)]="workingTemplate.invoiceDetails.invoiceNo" />
                </div>
                <div class="form-group col-half">
                  <label class="form-label">Invoice Date</label>
                  <input type="text" class="form-input" [(ngModel)]="workingTemplate.invoiceDetails.invoiceDate" />
                </div>
              </div>
              <div class="form-row">
                <div class="form-group col-half">
                  <label class="form-label">Event / Booking Date</label>
                  <input type="text" class="form-input" [(ngModel)]="workingTemplate.invoiceDetails.eventDate" />
                </div>
                <div class="form-group col-half">
                  <label class="form-label">Event Type</label>
                  <input type="text" class="form-input" [(ngModel)]="workingTemplate.invoiceDetails.eventType" />
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Hall / Venue Name</label>
                <input type="text" class="form-input" [(ngModel)]="workingTemplate.invoiceDetails.hallName" />
              </div>
            </div>
          </div>

          <!-- Invoice Summary Box -->
          <div class="invoice-calc-box">
            <div class="calc-row">
              <span>Items Count: <strong>{{ workingTemplate.items.length }}</strong></span>
              <span>Subtotal: <strong>₹{{ currentTotals.subTotal | number:'1.2-2' }}</strong></span>
              <span>Tax (GST): <strong>₹{{ currentTotals.totalTax | number:'1.2-2' }}</strong></span>
              <span class="grand-total-text">Grand Total: <strong>₹{{ currentTotals.grandTotal | number:'1.2-2' }}</strong></span>
            </div>
            <div class="calc-words">
              {{ currentTotals.amountInWords }}
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-secondary" (click)="close.emit()">Close</button>
          <button class="btn btn-outline" (click)="onPrint()">🖨️ Print Invoice</button>
          <button class="btn btn-primary" (click)="onDownloadPdf()">⬇️ Download PDF</button>
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
      z-index: 1060;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
    }

    .modal-dialog {
      background: #ffffff;
      border-radius: 12px;
      width: 100%;
      max-width: 720px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    .modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 20px;
      border-bottom: 1px solid #e2e8f0;
      background: #f8fafc;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .header-icon {
      font-size: 1.5rem;
    }

    .modal-title {
      margin: 0;
      font-size: 1.05rem;
      font-weight: 700;
      color: #1e293b;
    }

    .modal-subtitle {
      margin: 2px 0 0;
      font-size: 0.76rem;
      color: #64748b;
    }

    .modal-close-btn {
      background: none;
      border: none;
      font-size: 1.4rem;
      color: #64748b;
      cursor: pointer;
    }

    .modal-body {
      padding: 18px 20px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      max-height: 70vh;
      overflow-y: auto;
    }

    .config-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }

    .config-col {
      display: flex;
      flex-direction: column;
      gap: 10px;
      background: #f8fafc;
      padding: 14px;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
    }

    .col-title {
      margin: 0 0 4px;
      font-size: 0.85rem;
      font-weight: 700;
      color: #2563eb;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .form-row {
      display: flex;
      gap: 10px;
    }

    .col-half {
      flex: 1;
    }

    .form-label {
      font-size: 0.76rem;
      font-weight: 600;
      color: #475569;
    }

    .form-input {
      padding: 7px 10px;
      font-size: 0.82rem;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      outline: none;
      box-sizing: border-box;
      width: 100%;
      font-family: inherit;
    }

    .form-input:focus {
      border-color: #3b82f6;
    }

    .font-bold {
      font-weight: 700;
    }

    .uppercase {
      text-transform: uppercase;
    }

    .invoice-calc-box {
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 8px;
      padding: 12px 16px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .calc-row {
      display: flex;
      justify-content: space-between;
      font-size: 0.85rem;
      color: #1e293b;
      flex-wrap: wrap;
      gap: 8px;
    }

    .grand-total-text {
      color: #1d4ed8;
      font-size: 0.95rem;
    }

    .calc-words {
      font-size: 0.78rem;
      color: #475569;
      font-style: italic;
    }

    .modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      padding: 12px 20px;
      border-top: 1px solid #e2e8f0;
      background: #f8fafc;
    }

    .btn {
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 0.84rem;
      font-weight: 600;
      cursor: pointer;
    }

    .btn-secondary {
      background: #ffffff;
      border: 1px solid #cbd5e1;
      color: #475569;
    }

    .btn-outline {
      background: #ffffff;
      border: 1px solid #2563eb;
      color: #2563eb;
    }

    .btn-primary {
      background: #2563eb;
      border: none;
      color: #ffffff;
    }

    .btn-primary:hover {
      background: #1d4ed8;
    }
  `]
})
export class InvoiceGeneratorModalComponent implements OnInit {
  @Input() isOpen = false;
  @Input() template: InvoiceTemplate | null = null;

  @Output() close = new EventEmitter<void>();

  workingTemplate: InvoiceTemplate | null = null;

  constructor(
    private stateService: BillingTemplateStateService,
    private printPdfService: InvoicePrintPdfService,
  ) {}

  ngOnInit(): void {
    if (this.template) {
      this.workingTemplate = JSON.parse(JSON.stringify(this.template));
    }
  }

  get currentTotals(): InvoiceTotals {
    if (!this.workingTemplate) {
      return {
        subTotal: 0,
        discountAmount: 0,
        taxableAmount: 0,
        cgstAmount: 0,
        sgstAmount: 0,
        igstAmount: 0,
        totalTax: 0,
        additionalCharges: 0,
        grandTotal: 0,
        amountInWords: '',
      };
    }
    return this.stateService.calculateTotals(this.workingTemplate);
  }

  onPrint(): void {
    if (!this.workingTemplate) return;
    this.printPdfService.printInvoice('billing-invoice-sheet');
  }

  onDownloadPdf(): void {
    if (!this.workingTemplate) return;
    this.printPdfService.downloadPdf(this.workingTemplate, this.currentTotals, 'billing-invoice-sheet');
  }
}
