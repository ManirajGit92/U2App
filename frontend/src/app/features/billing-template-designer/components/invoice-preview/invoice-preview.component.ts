import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InvoiceTemplate, InvoiceTotals, InvoiceItem } from '../../models/billing-template.models';

@Component({
  selector: 'app-invoice-preview',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="preview-container" *ngIf="template">
      <!-- Toolbar Header -->
      <div class="preview-toolbar">
        <div class="toolbar-left">
          <div class="title-with-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
            <span class="toolbar-title">Template Preview & Edit</span>
          </div>
        </div>

        <div class="toolbar-right">
          <button class="tool-btn" (click)="editLayoutClicked.emit()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="3" y1="9" x2="21" y2="9"></line>
              <line x1="9" y1="21" x2="9" y2="9"></line>
            </svg>
            <span>Edit Layout</span>
          </button>

          <label class="tool-btn file-tool-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <circle cx="8.5" cy="8.5" r="1.5"></circle>
              <polyline points="21 15 16 10 5 21"></polyline>
            </svg>
            <span>Add Logo</span>
            <input type="file" accept="image/*" class="hidden-input" (change)="onLogoPicked($event)" />
          </label>

          <button class="tool-btn" (click)="colorsClicked.emit()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M12 2a10 10 0 0 1 10 10c0 5.52-4.48 10-10 10a9.98 9.98 0 0 1-7.07-2.93"></path>
            </svg>
            <span>Colors</span>
          </button>

          <button class="tool-btn" (click)="fontsClicked.emit()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="4 7 4 4 20 4 20 7"></polyline>
              <line x1="9" y1="20" x2="15" y2="20"></line>
              <line x1="12" y1="4" x2="12" y2="20"></line>
            </svg>
            <span>Fonts</span>
          </button>

          <button class="tool-btn" (click)="pageSetupClicked.emit()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
            <span>Page Setup</span>
          </button>

          <button class="tool-btn" (click)="previewFullscreenClicked.emit()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
            <span>Preview</span>
          </button>

          <!-- Download Dropdown -->
          <div class="download-dropdown-wrap">
            <button class="btn-download" (click)="toggleDownloadDropdown()">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              <span>Download</span>
              <span class="caret">▾</span>
            </button>

            <div class="download-menu" *ngIf="showDownloadMenu">
              <button class="download-item" (click)="onDownloadPdf(); showDownloadMenu = false">
                <span class="menu-icon">📄</span> Download PDF
              </button>
              <button class="download-item" (click)="onPrint(); showDownloadMenu = false">
                <span class="menu-icon">🖨️</span> Print Invoice
              </button>
              <button class="download-item" (click)="generateInvoiceClicked.emit(); showDownloadMenu = false">
                <span class="menu-icon">⚡</span> Generate Customer Invoice
              </button>
              <button class="download-item" (click)="exportJsonClicked.emit(); showDownloadMenu = false">
                <span class="menu-icon">💾</span> Export Template (JSON)
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- INVOICE SHEET PREVIEW -->
      <div class="sheet-viewport">
        <div
          id="billing-invoice-sheet"
          class="invoice-sheet"
          [style.font-family]="template.fontFamily"
          [style.font-size.pt]="template.fontSize"
          [class.accent-border]="template.design.accentBorder"
          [class.compact-spacing]="template.design.compactSpacing"
        >
          <!-- Top Header Section -->
          <div class="sheet-header">
            <!-- Left Header Details -->
            <div class="header-left-col">
              <!-- Logo -->
              <div class="business-brand-row">
                <div class="business-logo-box" *ngIf="template.showFields.logo && template.businessInfo.logoUrl">
                  <img [src]="template.businessInfo.logoUrl" alt="Business Logo" class="brand-logo-img" />
                </div>
                <div class="business-text-info">
                  <h1 class="brand-name" [style.color]="template.colorTheme">
                    {{ template.businessInfo.name }}
                  </h1>
                  <h2 class="brand-tagline">
                    {{ template.businessInfo.tagline }}
                  </h2>
                  <div class="brand-subtagline" *ngIf="template.businessInfo.subTagline">
                    {{ template.businessInfo.subTagline }}
                  </div>
                </div>
              </div>

              <!-- Address & Contacts -->
              <div class="brand-contacts" *ngIf="template.showFields.businessInfo">
                <div class="contact-line">
                  <span class="contact-icon">📍</span>
                  <span>{{ template.businessInfo.address }}</span>
                </div>
                <div class="contact-line" *ngIf="template.businessInfo.phone">
                  <span class="contact-icon">📞</span>
                  <span>{{ template.businessInfo.phone }}</span>
                </div>
                <div class="contact-line" *ngIf="template.businessInfo.email">
                  <span class="contact-icon">✉️</span>
                  <span>{{ template.businessInfo.email }}</span>
                  <span *ngIf="template.businessInfo.website"> | {{ template.businessInfo.website }}</span>
                </div>
              </div>
            </div>

            <!-- Right Tax & Reg Block & Stage Photo -->
            <div class="header-right-col">
              <!-- GSTIN & Reg Details -->
              <div class="tax-reg-table" *ngIf="template.showFields.taxRegistrationBlock">
                <div class="tax-reg-row" *ngIf="template.businessInfo.gstin">
                  <span class="reg-label">GSTIN</span>
                  <span class="reg-sep">:</span>
                  <span class="reg-val">{{ template.businessInfo.gstin }}</span>
                </div>
                <div class="tax-reg-row" *ngIf="template.businessInfo.pan">
                  <span class="reg-label">PAN</span>
                  <span class="reg-sep">:</span>
                  <span class="reg-val">{{ template.businessInfo.pan }}</span>
                </div>
                <div class="tax-reg-row" *ngIf="template.businessInfo.regNo">
                  <span class="reg-label">Registration No.</span>
                  <span class="reg-sep">:</span>
                  <span class="reg-val">{{ template.businessInfo.regNo }}</span>
                </div>
                <div class="tax-reg-row" *ngIf="template.businessInfo.fssaiNo">
                  <span class="reg-label">FSSAI No.</span>
                  <span class="reg-sep">:</span>
                  <span class="reg-val">{{ template.businessInfo.fssaiNo }}</span>
                </div>
              </div>

              <!-- Header Image (Decorated Stage) -->
              <div
                class="header-stage-photo-box"
                *ngIf="template.showFields.headerImage && template.businessInfo.headerImageUrl"
              >
                <img
                  [src]="template.businessInfo.headerImageUrl"
                  alt="Stage Decoration"
                  class="header-stage-img"
                />
              </div>
            </div>
          </div>

          <!-- TAX INVOICE BANNER -->
          <div
            class="invoice-banner"
            *ngIf="template.showFields.bannerTitle"
            [style.background]="getBannerBackground()"
          >
            <div class="banner-ornate-pattern" *ngIf="template.design.bannerBgPattern === 'ornate'"></div>
            <div class="banner-title-text">
              {{ template.invoiceDetails.invoiceTitle }}
            </div>
          </div>

          <!-- Bill To & Event Details Two-Column Grid -->
          <div class="bill-details-grid">
            <!-- Left Column: Bill To -->
            <div class="bill-to-card" *ngIf="template.showFields.customerDetails">
              <div class="section-badge" [style.color]="template.colorTheme">Bill To</div>
              <div class="detail-row">
                <span class="detail-key">Name</span>
                <span class="detail-sep">:</span>
                <span class="detail-val font-semibold">{{ template.customerInfo.name }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-key">Address</span>
                <span class="detail-sep">:</span>
                <span class="detail-val multiline">{{ template.customerInfo.address }}</span>
              </div>
              <div class="detail-row" *ngIf="template.customerInfo.phone">
                <span class="detail-key">Phone</span>
                <span class="detail-sep">:</span>
                <span class="detail-val">{{ template.customerInfo.phone }}</span>
              </div>
              <div class="detail-row" *ngIf="template.customerInfo.gstin">
                <span class="detail-key">GSTIN</span>
                <span class="detail-sep">:</span>
                <span class="detail-val">{{ template.customerInfo.gstin }}</span>
              </div>
            </div>

            <!-- Right Column: Invoice & Event Details -->
            <div class="invoice-meta-card" *ngIf="template.showFields.eventDetails">
              <div class="detail-row">
                <span class="detail-key">Invoice No.</span>
                <span class="detail-sep">:</span>
                <span class="detail-val font-semibold">{{ template.invoiceDetails.invoiceNo }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-key">Invoice Date</span>
                <span class="detail-sep">:</span>
                <span class="detail-val">{{ template.invoiceDetails.invoiceDate }}</span>
              </div>
              <div class="detail-row" *ngIf="template.invoiceDetails.bookingDate">
                <span class="detail-key">Booking Date</span>
                <span class="detail-sep">:</span>
                <span class="detail-val">{{ template.invoiceDetails.bookingDate }}</span>
              </div>
              <div class="detail-row" *ngIf="template.invoiceDetails.eventType">
                <span class="detail-key">Event Type</span>
                <span class="detail-sep">:</span>
                <span class="detail-val">{{ template.invoiceDetails.eventType }}</span>
              </div>
              <div class="detail-row" *ngIf="template.invoiceDetails.eventDate">
                <span class="detail-key">Event Date</span>
                <span class="detail-sep">:</span>
                <span class="detail-val">{{ template.invoiceDetails.eventDate }}</span>
              </div>
              <div class="detail-row" *ngIf="template.invoiceDetails.hallName">
                <span class="detail-key">Hall Name</span>
                <span class="detail-sep">:</span>
                <span class="detail-val">{{ template.invoiceDetails.hallName }}</span>
              </div>
              <div class="detail-row" *ngIf="template.invoiceDetails.eventTime">
                <span class="detail-key">Event Time</span>
                <span class="detail-sep">:</span>
                <span class="detail-val">{{ template.invoiceDetails.eventTime }}</span>
              </div>
              <div class="detail-row" *ngIf="template.invoiceDetails.guestsApprox">
                <span class="detail-key">No. of Guests (Approx.)</span>
                <span class="detail-sep">:</span>
                <span class="detail-val">{{ template.invoiceDetails.guestsApprox }}</span>
              </div>
            </div>
          </div>

          <!-- DYNAMIC ITEMS TABLE -->
          <div class="table-container">
            <table class="invoice-table" [class.striped]="template.tableSettings.stripedRows">
              <thead>
                <tr [style.background]="template.colorTheme" style="color: #ffffff;">
                  <th *ngIf="template.tableSettings.showSNo" class="col-sno">S.No</th>
                  <th class="col-desc">Description</th>
                  <th *ngIf="template.tableSettings.showHsnSac" class="col-hsn">HSN/SAC</th>
                  <th *ngIf="template.tableSettings.showQtyDuration" class="col-qty">Qty / Duration</th>
                  <th *ngIf="template.tableSettings.showRate" class="col-rate text-right">Rate ({{ template.tableSettings.currencySymbol }})</th>
                  <th *ngIf="template.tableSettings.showAmount" class="col-amount text-right">Amount ({{ template.tableSettings.currencySymbol }})</th>
                  <th class="col-actions no-print" *ngIf="template.showFields.tableActions">Action</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  *ngFor="let item of template.items; let idx = index; trackBy: trackByItemId"
                  [class.selected-row]="item.selected"
                >
                  <td *ngIf="template.tableSettings.showSNo" class="text-center">{{ idx + 1 }}</td>
                  <td class="col-desc">
                    <span class="desc-text">{{ item.description }}</span>
                  </td>
                  <td *ngIf="template.tableSettings.showHsnSac" class="text-center">{{ item.hsnSac }}</td>
                  <td *ngIf="template.tableSettings.showQtyDuration" class="text-center">{{ item.qtyDuration }}</td>
                  <td *ngIf="template.tableSettings.showRate" class="text-right">
                    {{ item.rate | number:'1.2-2' }}
                  </td>
                  <td *ngIf="template.tableSettings.showAmount" class="text-right font-medium">
                    {{ item.amount | number:'1.2-2' }}
                  </td>
                  <td class="col-actions no-print text-center" *ngIf="template.showFields.tableActions">
                    <button class="row-btn edit-btn" (click)="editItem.emit(item)" title="Edit item">
                      ✏️
                    </button>
                    <button class="row-btn del-btn" (click)="deleteItem(idx)" title="Delete item">
                      🗑️
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>

            <!-- Table Actions Bar (Below table) -->
            <div class="table-action-btns no-print" *ngIf="template.showFields.tableActions">
              <button class="btn-table-action btn-add-row" (click)="addRowClicked.emit()">
                + Add Row
              </button>
              <button class="btn-table-action btn-outline" (click)="duplicateRowClicked.emit()">
                📑 Duplicate Row
              </button>
              <button class="btn-table-action btn-outline" (click)="deleteSelectedRows()">
                🗑️ Delete Selected
              </button>
            </div>
          </div>

          <!-- Bottom Summary (Amount in Words & Totals) -->
          <div class="summary-grid">
            <!-- Left: Amount in Words & Bank Details -->
            <div class="summary-left">
              <div class="amount-in-words-card" *ngIf="template.showFields.amountInWords">
                <div class="words-label">Amount in Words :</div>
                <div class="words-val">{{ totals.amountInWords }}</div>
              </div>

              <!-- Bank Details -->
              <div class="sheet-payment-box" *ngIf="template.showFields.paymentDetails && template.paymentDetails.bankName">
                <div class="payment-title" [style.color]="template.colorTheme">Bank & Payment Details</div>
                <div class="payment-row">
                  <span>Bank: {{ template.paymentDetails.bankName }} | A/C: {{ template.paymentDetails.accountNumber }}</span>
                </div>
                <div class="payment-row">
                  <span>IFSC: {{ template.paymentDetails.ifscCode }} | UPI: {{ template.paymentDetails.upiId }}</span>
                </div>
              </div>
            </div>

            <!-- Right: Subtotal, Taxes, Grand Total -->
            <div class="summary-right">
              <div class="totals-table">
                <div class="total-row">
                  <span class="total-label">Sub Total</span>
                  <span class="total-val">{{ totals.subTotal | number:'1.2-2' }}</span>
                </div>

                <div class="total-row" *ngIf="totals.discountAmount > 0">
                  <span class="total-label">Discount</span>
                  <span class="total-val text-danger">- {{ totals.discountAmount | number:'1.2-2' }}</span>
                </div>

                <div class="total-row" *ngIf="template.taxSettings.taxMode === 'gst'">
                  <span class="total-label">CGST @ {{ template.taxSettings.cgstRate }}%</span>
                  <span class="total-val">{{ totals.cgstAmount | number:'1.2-2' }}</span>
                </div>

                <div class="total-row" *ngIf="template.taxSettings.taxMode === 'gst'">
                  <span class="total-label">SGST @ {{ template.taxSettings.sgstRate }}%</span>
                  <span class="total-val">{{ totals.sgstAmount | number:'1.2-2' }}</span>
                </div>

                <div class="total-row" *ngIf="template.taxSettings.taxMode === 'igst'">
                  <span class="total-label">IGST @ {{ template.taxSettings.igstRate }}%</span>
                  <span class="total-val">{{ totals.igstAmount | number:'1.2-2' }}</span>
                </div>

                <div class="total-row" *ngIf="totals.additionalCharges > 0">
                  <span class="total-label">{{ template.taxSettings.additionalChargesLabel || 'Extra Charges' }}</span>
                  <span class="total-val">{{ totals.additionalCharges | number:'1.2-2' }}</span>
                </div>

                <!-- Grand Total Pill -->
                <div class="grand-total-pill" [style.background]="template.secondaryColor || template.colorTheme">
                  <span class="grand-label">Grand Total ({{ template.tableSettings.currencySymbol }})</span>
                  <span class="grand-val">{{ totals.grandTotal | number:'1.2-2' }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Terms & Conditions & Signatory Footer -->
          <div class="sheet-footer-section">
            <div class="terms-card" *ngIf="template.showFields.termsConditions && template.termsAndConditions?.length">
              <div class="terms-header">Terms & Conditions:</div>
              <ol class="terms-ol">
                <li *ngFor="let term of template.termsAndConditions">{{ term }}</li>
              </ol>
            </div>

            <div class="signatory-card" *ngIf="template.showFields.signatureBlock">
              <div class="signatory-space"></div>
              <div class="signatory-line">Authorized Signatory</div>
              <div class="signatory-business">For {{ template.businessInfo.name }}</div>
            </div>
          </div>

          <!-- Notes Remarks Note -->
          <div class="sheet-notes-card" *ngIf="template.showFields.notesRemarks && template.notesRemarks">
            <p class="notes-text">{{ template.notesRemarks }}</p>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .preview-container {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
    }

    /* Toolbar */
    .preview-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 16px;
      border-bottom: 1px solid #e2e8f0;
      background: #f8fafc;
      flex-wrap: wrap;
      gap: 10px;
    }

    .title-with-icon {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .toolbar-title {
      font-weight: 700;
      font-size: 0.95rem;
      color: #1e293b;
    }

    .toolbar-right {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }

    .tool-btn {
      display: flex;
      align-items: center;
      gap: 5px;
      padding: 6px 10px;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      font-size: 0.78rem;
      font-weight: 600;
      color: #334155;
      cursor: pointer;
      transition: all 0.2s;
    }

    .tool-btn:hover {
      background: #f1f5f9;
      border-color: #94a3b8;
      color: #1e293b;
    }

    .file-tool-btn {
      position: relative;
    }

    .hidden-input {
      display: none;
    }

    /* Download Dropdown */
    .download-dropdown-wrap {
      position: relative;
    }

    .btn-download {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      background: #2563eb;
      color: #ffffff;
      border: none;
      border-radius: 6px;
      font-size: 0.8rem;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.2s;
      box-shadow: 0 2px 4px rgba(37, 99, 235, 0.25);
    }

    .btn-download:hover {
      background: #1d4ed8;
    }

    .caret {
      font-size: 0.7rem;
    }

    .download-menu {
      position: absolute;
      top: calc(100% + 4px);
      right: 0;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.12);
      min-width: 210px;
      z-index: 100;
      padding: 4px;
      animation: fadeIn 0.15s ease-out;
    }

    .download-item {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background: none;
      border: none;
      font-size: 0.82rem;
      font-weight: 500;
      color: #334155;
      cursor: pointer;
      border-radius: 4px;
      text-align: left;
      transition: background 0.15s;
    }

    .download-item:hover {
      background: #eff6ff;
      color: #1d4ed8;
    }

    .menu-icon {
      font-size: 1rem;
    }

    /* Viewport */
    .sheet-viewport {
      background: #e2e8f0;
      padding: 20px;
      overflow-x: auto;
      display: flex;
      justify-content: center;
      min-height: 800px;
    }

    /* INVOICE SHEET (Matches A4 and Screenshot) */
    .invoice-sheet {
      width: 100%;
      max-width: 820px;
      background: #ffffff;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
      border-radius: 4px;
      padding: 28px 32px;
      color: #1e293b;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .invoice-sheet.accent-border {
      border: 2px solid #2563eb;
    }

    .invoice-sheet.compact-spacing {
      padding: 16px 20px;
      gap: 10px;
    }

    /* Header */
    .sheet-header {
      display: flex;
      justify-content: space-between;
      gap: 20px;
      align-items: flex-start;
    }

    .header-left-col {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .business-brand-row {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .business-logo-box {
      width: 72px;
      height: 60px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .brand-logo-img {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
    }

    .business-text-info {
      display: flex;
      flex-direction: column;
      line-height: 1.2;
    }

    .brand-name {
      font-size: 1.5rem;
      font-weight: 800;
      letter-spacing: 0.5px;
      margin: 0;
      text-transform: uppercase;
    }

    .brand-tagline {
      font-size: 0.82rem;
      font-weight: 700;
      color: #334155;
      letter-spacing: 1px;
      margin: 2px 0 0;
      text-transform: uppercase;
    }

    .brand-subtagline {
      font-size: 0.7rem;
      color: #64748b;
      margin-top: 3px;
    }

    .brand-contacts {
      display: flex;
      flex-direction: column;
      gap: 2px;
      font-size: 0.74rem;
      color: #475569;
      margin-top: 4px;
    }

    .contact-line {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .contact-icon {
      font-size: 0.8rem;
    }

    /* Right Col */
    .header-right-col {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 8px;
      flex-shrink: 0;
    }

    .tax-reg-table {
      font-size: 0.74rem;
      display: flex;
      flex-direction: column;
      gap: 2px;
      color: #334155;
    }

    .tax-reg-row {
      display: grid;
      grid-template-columns: 110px 10px 140px;
    }

    .reg-label {
      font-weight: 600;
      color: #475569;
    }

    .reg-sep {
      text-align: center;
    }

    .reg-val {
      font-weight: 700;
      color: #0f172a;
    }

    .header-stage-photo-box {
      width: 210px;
      height: 85px;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
    }

    .header-stage-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    /* Banner */
    .invoice-banner {
      width: 100%;
      padding: 8px 12px;
      border-radius: 4px;
      text-align: center;
      position: relative;
      overflow: hidden;
      margin-top: 4px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    .banner-ornate-pattern {
      position: absolute;
      inset: 0;
      opacity: 0.15;
      background-image: radial-gradient(#ffffff 2px, transparent 2px);
      background-size: 12px 12px;
      pointer-events: none;
    }

    .banner-title-text {
      color: #ffffff;
      font-size: 0.95rem;
      font-weight: 800;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      position: relative;
      z-index: 2;
    }

    /* Bill Grid */
    .bill-details-grid {
      display: grid;
      grid-template-columns: 1.1fr 0.9fr;
      gap: 20px;
      padding: 10px 0;
      border-bottom: 1px solid #e2e8f0;
    }

    .section-badge {
      font-weight: 800;
      font-size: 0.88rem;
      margin-bottom: 6px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .detail-row {
      display: grid;
      grid-template-columns: 140px 10px 1fr;
      font-size: 0.78rem;
      margin-bottom: 3px;
      line-height: 1.4;
    }

    .detail-key {
      color: #475569;
      font-weight: 500;
    }

    .detail-sep {
      text-align: center;
      color: #64748b;
    }

    .detail-val {
      color: #0f172a;
    }

    .detail-val.multiline {
      white-space: pre-line;
    }

    .font-semibold {
      font-weight: 600;
    }

    .font-medium {
      font-weight: 500;
    }

    /* Items Table */
    .table-container {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .invoice-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.78rem;
    }

    .invoice-table th {
      padding: 8px 10px;
      font-weight: 700;
      text-align: left;
      font-size: 0.76rem;
      letter-spacing: 0.4px;
    }

    .invoice-table td {
      padding: 7px 10px;
      border-bottom: 1px solid #e2e8f0;
      color: #1e293b;
    }

    .invoice-table.striped tbody tr:nth-child(even) {
      background: #f8fafc;
    }

    .invoice-table tbody tr:hover {
      background: #f1f5f9;
    }

    .col-sno { width: 44px; text-align: center; }
    .col-hsn { width: 85px; text-align: center; }
    .col-qty { width: 95px; text-align: center; }
    .col-rate { width: 105px; }
    .col-amount { width: 115px; }
    .col-actions { width: 68px; }

    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .text-danger { color: #dc2626; }

    .row-btn {
      background: none;
      border: none;
      cursor: pointer;
      font-size: 0.85rem;
      padding: 2px 4px;
      border-radius: 4px;
      transition: background 0.15s;
    }

    .row-btn:hover {
      background: #e2e8f0;
    }

    .table-action-btns {
      display: flex;
      gap: 8px;
      padding-top: 4px;
    }

    .btn-table-action {
      padding: 6px 14px;
      border-radius: 6px;
      font-size: 0.76rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-add-row {
      background: #2563eb;
      color: #ffffff;
      border: none;
    }

    .btn-add-row:hover {
      background: #1d4ed8;
    }

    .btn-outline {
      background: #ffffff;
      border: 1px solid #cbd5e1;
      color: #334155;
    }

    .btn-outline:hover {
      background: #f8fafc;
      border-color: #94a3b8;
    }

    /* Summary Grid */
    .summary-grid {
      display: grid;
      grid-template-columns: 1.1fr 0.9fr;
      gap: 20px;
      margin-top: 6px;
      align-items: flex-start;
    }

    .amount-in-words-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 8px 12px;
    }

    .words-label {
      font-size: 0.74rem;
      font-weight: 600;
      color: #475569;
      margin-bottom: 2px;
    }

    .words-val {
      font-size: 0.78rem;
      font-weight: 700;
      color: #0f172a;
    }

    .sheet-payment-box {
      margin-top: 8px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 8px 12px;
      font-size: 0.72rem;
    }

    .payment-title {
      font-weight: 700;
      margin-bottom: 3px;
    }

    .payment-row {
      color: #475569;
      line-height: 1.4;
    }

    /* Totals Table */
    .totals-table {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .total-row {
      display: flex;
      justify-content: space-between;
      padding: 3px 6px;
      font-size: 0.8rem;
      color: #334155;
    }

    .total-label {
      font-weight: 500;
    }

    .total-val {
      font-weight: 600;
      color: #0f172a;
    }

    .grand-total-pill {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 14px;
      border-radius: 6px;
      color: #ffffff;
      margin-top: 6px;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
    }

    .grand-label {
      font-size: 0.84rem;
      font-weight: 700;
      letter-spacing: 0.5px;
    }

    .grand-val {
      font-size: 1.05rem;
      font-weight: 800;
    }

    /* Footer Conditions & Signatory */
    .sheet-footer-section {
      display: grid;
      grid-template-columns: 1.2fr 0.8fr;
      gap: 20px;
      padding-top: 8px;
      border-top: 1px solid #f1f5f9;
    }

    .terms-card {
      font-size: 0.7rem;
      color: #475569;
    }

    .terms-header {
      font-weight: 700;
      color: #1e293b;
      margin-bottom: 4px;
    }

    .terms-ol {
      margin: 0;
      padding-left: 14px;
      line-height: 1.4;
    }

    .signatory-card {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      justify-content: flex-end;
      text-align: right;
    }

    .signatory-space {
      height: 40px;
    }

    .signatory-line {
      font-weight: 700;
      font-size: 0.78rem;
      color: #1e293b;
      border-top: 1px solid #94a3b8;
      padding-top: 4px;
      min-width: 140px;
      text-align: center;
    }

    .signatory-business {
      font-size: 0.68rem;
      color: #64748b;
      margin-top: 2px;
    }

    .sheet-notes-card {
      text-align: center;
      padding: 6px;
      font-size: 0.72rem;
      color: #64748b;
      border-top: 1px dashed #e2e8f0;
      margin-top: 4px;
    }

    .notes-text {
      margin: 0;
      font-style: italic;
    }

    /* Print Styles */
    @media print {
      .no-print {
        display: none !important;
      }
      .sheet-viewport {
        background: none !important;
        padding: 0 !important;
      }
      .invoice-sheet {
        box-shadow: none !important;
        border: none !important;
        width: 100% !important;
        max-width: 100% !important;
        padding: 0 !important;
      }
    }
  `]
})
export class InvoicePreviewComponent {
  @Input() template!: InvoiceTemplate;
  @Input() totals!: InvoiceTotals;

  @Output() templateChanged = new EventEmitter<InvoiceTemplate>();
  @Output() editItem = new EventEmitter<InvoiceItem>();
  @Output() addRowClicked = new EventEmitter<void>();
  @Output() duplicateRowClicked = new EventEmitter<void>();
  @Output() editLayoutClicked = new EventEmitter<void>();
  @Output() colorsClicked = new EventEmitter<void>();
  @Output() fontsClicked = new EventEmitter<void>();
  @Output() pageSetupClicked = new EventEmitter<void>();
  @Output() previewFullscreenClicked = new EventEmitter<void>();
  @Output() generateInvoiceClicked = new EventEmitter<void>();
  @Output() exportJsonClicked = new EventEmitter<void>();
  @Output() printInvoice = new EventEmitter<string>();
  @Output() downloadPdf = new EventEmitter<void>();

  showDownloadMenu = false;

  getBannerBackground(): string {
    const col = this.template.colorTheme || '#1e40af';
    if (this.template.design.bannerBgPattern === 'gradient') {
      return `linear-gradient(135deg, ${col}, ${this.template.secondaryColor || '#1e3a8a'})`;
    }
    return col;
  }

  toggleDownloadDropdown(): void {
    this.showDownloadMenu = !this.showDownloadMenu;
  }

  onPrint(): void {
    this.printInvoice.emit('billing-invoice-sheet');
  }

  onDownloadPdf(): void {
    this.downloadPdf.emit();
  }

  onLogoPicked(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        this.template.businessInfo.logoUrl = e.target?.result as string;
        this.template.showFields.logo = true;
        this.templateChanged.emit(this.template);
      };
      reader.readAsDataURL(file);
    }
  }

  deleteItem(index: number): void {
    if (this.template.items.length <= 1) {
      alert('Invoice must have at least one line item.');
      return;
    }
    this.template.items.splice(index, 1);
    this.recalculateItemNumbers();
    this.templateChanged.emit(this.template);
  }

  deleteSelectedRows(): void {
    const remaining = this.template.items.filter((item) => !item.selected);
    if (remaining.length === 0) {
      alert('Cannot delete all rows. Keep at least one line item.');
      return;
    }
    this.template.items = remaining;
    this.recalculateItemNumbers();
    this.templateChanged.emit(this.template);
  }

  recalculateItemNumbers(): void {
    this.template.items.forEach((item, i) => {
      item.sNo = i + 1;
    });
  }

  trackByItemId(index: number, item: InvoiceItem): string {
    return item.id || String(index);
  }
}
