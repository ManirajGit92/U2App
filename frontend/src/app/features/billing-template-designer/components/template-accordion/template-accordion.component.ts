import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InvoiceTemplate, TemplateCategory } from '../../models/billing-template.models';

@Component({
  selector: 'app-template-accordion',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="accordion-panel" *ngIf="template">
      <!-- Section 1: Template Details -->
      <div class="accordion-item" [class.expanded]="isSectionOpen(1)">
        <button class="accordion-header" (click)="toggleSection(1)">
          <div class="header-left">
            <span class="section-num">1.</span>
            <span class="section-title">Template Details</span>
          </div>
          <span class="chevron" [class.open]="isSectionOpen(1)">›</span>
        </button>

        <div class="accordion-body" *ngIf="isSectionOpen(1)">
          <div class="form-group">
            <label class="form-label">Template Name <span class="required">*</span></label>
            <input
              type="text"
              class="form-input"
              [(ngModel)]="template.name"
              (ngModelChange)="onTemplateChange()"
              placeholder="e.g. Mahal GST Invoice"
            />
          </div>

          <div class="form-group">
            <label class="form-label">Category</label>
            <select
              class="form-select"
              [(ngModel)]="template.category"
              (ngModelChange)="onTemplateChange()"
            >
              <option *ngFor="let cat of categories" [value]="cat.name">{{ cat.name }}</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Description</label>
            <textarea
              class="form-textarea"
              rows="3"
              [(ngModel)]="template.description"
              (ngModelChange)="onTemplateChange()"
              placeholder="Brief description of this billing template..."
            ></textarea>
          </div>

          <div class="checkbox-group">
            <label class="checkbox-label">
              <input
                type="checkbox"
                [(ngModel)]="template.isFavorite"
                (ngModelChange)="onTemplateChange()"
              />
              <span>Set as Favorite</span>
            </label>

            <label class="checkbox-label">
              <input
                type="checkbox"
                [(ngModel)]="template.isDefault"
                (ngModelChange)="onSetAsDefault(template.id)"
              />
              <span>Make as Default</span>
            </label>
          </div>
        </div>
      </div>

      <!-- Section 2: Default Information (Auto Prefill) -->
      <div class="accordion-item" [class.expanded]="isSectionOpen(2)">
        <button class="accordion-header" (click)="toggleSection(2)">
          <div class="header-left">
            <span class="section-num">2.</span>
            <span class="section-title">Default Information (Auto Prefill)</span>
          </div>
          <span class="chevron" [class.open]="isSectionOpen(2)">›</span>
        </button>

        <div class="accordion-body" *ngIf="isSectionOpen(2)">
          <p class="section-hint">
            Store your standard business, bank, and terms presets so every new template automatically prefills with your authentic profile.
          </p>

          <div class="action-btn-row">
            <button class="btn btn-secondary-sm" (click)="applyDefaultPreset.emit()">
              ⚡ Apply Saved Defaults
            </button>
            <button class="btn btn-outline-sm" (click)="saveAsDefaultPreset.emit()">
              💾 Save Current as Default
            </button>
          </div>

          <div class="preset-status-card">
            <div class="preset-row">
              <span class="preset-key">Stored Business:</span>
              <span class="preset-val">{{ template.businessInfo.name }}</span>
            </div>
            <div class="preset-row">
              <span class="preset-key">GSTIN / Tax ID:</span>
              <span class="preset-val">{{ template.businessInfo.gstin || 'Not configured' }}</span>
            </div>
            <div class="preset-row">
              <span class="preset-key">Bank Name:</span>
              <span class="preset-val">{{ template.paymentDetails.bankName || 'Not configured' }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Section 3: Business Information -->
      <div class="accordion-item" [class.expanded]="isSectionOpen(3)">
        <button class="accordion-header" (click)="toggleSection(3)">
          <div class="header-left">
            <span class="section-num">3.</span>
            <span class="section-title">Business Information</span>
          </div>
          <span class="chevron" [class.open]="isSectionOpen(3)">›</span>
        </button>

        <div class="accordion-body" *ngIf="isSectionOpen(3)">
          <div class="form-group">
            <label class="form-label">Business / Hall Name</label>
            <input
              type="text"
              class="form-input"
              [(ngModel)]="template.businessInfo.name"
              (ngModelChange)="onTemplateChange()"
            />
          </div>

          <div class="form-group">
            <label class="form-label">Tagline</label>
            <input
              type="text"
              class="form-input"
              [(ngModel)]="template.businessInfo.tagline"
              (ngModelChange)="onTemplateChange()"
              placeholder="e.g. Banquet & Function Hall"
            />
          </div>

          <div class="form-group">
            <label class="form-label">Offerings / Sub-tagline</label>
            <input
              type="text"
              class="form-input"
              [(ngModel)]="template.businessInfo.subTagline"
              (ngModelChange)="onTemplateChange()"
              placeholder="e.g. Weddings | Engagements | Birthday Functions"
            />
          </div>

          <div class="form-group">
            <label class="form-label">Address</label>
            <textarea
              class="form-textarea"
              rows="2"
              [(ngModel)]="template.businessInfo.address"
              (ngModelChange)="onTemplateChange()"
            ></textarea>
          </div>

          <div class="form-row">
            <div class="form-group col-half">
              <label class="form-label">Phone Numbers</label>
              <input
                type="text"
                class="form-input"
                [(ngModel)]="template.businessInfo.phone"
                (ngModelChange)="onTemplateChange()"
              />
            </div>
            <div class="form-group col-half">
              <label class="form-label">Email Address</label>
              <input
                type="email"
                class="form-input"
                [(ngModel)]="template.businessInfo.email"
                (ngModelChange)="onTemplateChange()"
              />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Website</label>
            <input
              type="text"
              class="form-input"
              [(ngModel)]="template.businessInfo.website"
              (ngModelChange)="onTemplateChange()"
            />
          </div>

          <div class="form-row">
            <div class="form-group col-half">
              <label class="form-label">GSTIN</label>
              <input
                type="text"
                class="form-input uppercase"
                [(ngModel)]="template.businessInfo.gstin"
                (ngModelChange)="onTemplateChange()"
                placeholder="33ABCDE1234F1Z5"
              />
            </div>
            <div class="form-group col-half">
              <label class="form-label">PAN</label>
              <input
                type="text"
                class="form-input uppercase"
                [(ngModel)]="template.businessInfo.pan"
                (ngModelChange)="onTemplateChange()"
                placeholder="ABCDE1234F"
              />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group col-half">
              <label class="form-label">Registration No.</label>
              <input
                type="text"
                class="form-input"
                [(ngModel)]="template.businessInfo.regNo"
                (ngModelChange)="onTemplateChange()"
              />
            </div>
            <div class="form-group col-half">
              <label class="form-label">FSSAI No.</label>
              <input
                type="text"
                class="form-input"
                [(ngModel)]="template.businessInfo.fssaiNo"
                (ngModelChange)="onTemplateChange()"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Section 4: Customer Information -->
      <div class="accordion-item" [class.expanded]="isSectionOpen(4)">
        <button class="accordion-header" (click)="toggleSection(4)">
          <div class="header-left">
            <span class="section-num">4.</span>
            <span class="section-title">Customer Information</span>
          </div>
          <span class="chevron" [class.open]="isSectionOpen(4)">›</span>
        </button>

        <div class="accordion-body" *ngIf="isSectionOpen(4)">
          <div class="form-group">
            <label class="form-label">Customer / Bill To Name</label>
            <input
              type="text"
              class="form-input"
              [(ngModel)]="template.customerInfo.name"
              (ngModelChange)="onTemplateChange()"
              placeholder="e.g. Mr. Ramesh Kumar"
            />
          </div>

          <div class="form-group">
            <label class="form-label">Address</label>
            <textarea
              class="form-textarea"
              rows="3"
              [(ngModel)]="template.customerInfo.address"
              (ngModelChange)="onTemplateChange()"
              placeholder="Customer address, city, state and pincode"
            ></textarea>
          </div>

          <div class="form-row">
            <div class="form-group col-half">
              <label class="form-label">Phone</label>
              <input
                type="text"
                class="form-input"
                [(ngModel)]="template.customerInfo.phone"
                (ngModelChange)="onTemplateChange()"
              />
            </div>
            <div class="form-group col-half">
              <label class="form-label">Email</label>
              <input
                type="email"
                class="form-input"
                [(ngModel)]="template.customerInfo.email"
                (ngModelChange)="onTemplateChange()"
              />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group col-half">
              <label class="form-label">Customer GSTIN</label>
              <input
                type="text"
                class="form-input uppercase"
                [(ngModel)]="template.customerInfo.gstin"
                (ngModelChange)="onTemplateChange()"
                placeholder="Leave blank or - if unregistered"
              />
            </div>
            <div class="form-group col-half">
              <label class="form-label">Place of Supply</label>
              <input
                type="text"
                class="form-input"
                [(ngModel)]="template.customerInfo.placeOfSupply"
                (ngModelChange)="onTemplateChange()"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Section 5: Invoice Details -->
      <div class="accordion-item" [class.expanded]="isSectionOpen(5)">
        <button class="accordion-header" (click)="toggleSection(5)">
          <div class="header-left">
            <span class="section-num">5.</span>
            <span class="section-title">Invoice Details</span>
          </div>
          <span class="chevron" [class.open]="isSectionOpen(5)">›</span>
        </button>

        <div class="accordion-body" *ngIf="isSectionOpen(5)">
          <div class="form-group">
            <label class="form-label">Banner Title</label>
            <input
              type="text"
              class="form-input"
              [(ngModel)]="template.invoiceDetails.invoiceTitle"
              (ngModelChange)="onTemplateChange()"
              placeholder="e.g. TAX INVOICE (MAHAL BOOKING)"
            />
          </div>

          <div class="form-row">
            <div class="form-group col-half">
              <label class="form-label">Invoice No.</label>
              <input
                type="text"
                class="form-input"
                [(ngModel)]="template.invoiceDetails.invoiceNo"
                (ngModelChange)="onTemplateChange()"
              />
            </div>
            <div class="form-group col-half">
              <label class="form-label">Invoice Date</label>
              <input
                type="text"
                class="form-input"
                [(ngModel)]="template.invoiceDetails.invoiceDate"
                (ngModelChange)="onTemplateChange()"
              />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group col-half">
              <label class="form-label">Booking Date</label>
              <input
                type="text"
                class="form-input"
                [(ngModel)]="template.invoiceDetails.bookingDate"
                (ngModelChange)="onTemplateChange()"
              />
            </div>
            <div class="form-group col-half">
              <label class="form-label">Event Date</label>
              <input
                type="text"
                class="form-input"
                [(ngModel)]="template.invoiceDetails.eventDate"
                (ngModelChange)="onTemplateChange()"
              />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Event Type</label>
            <input
              type="text"
              class="form-input"
              [(ngModel)]="template.invoiceDetails.eventType"
              (ngModelChange)="onTemplateChange()"
              placeholder="e.g. Wedding Reception"
            />
          </div>

          <div class="form-group">
            <label class="form-label">Hall / Venue Name</label>
            <input
              type="text"
              class="form-input"
              [(ngModel)]="template.invoiceDetails.hallName"
              (ngModelChange)="onTemplateChange()"
              placeholder="e.g. Main Hall (AC)"
            />
          </div>

          <div class="form-row">
            <div class="form-group col-half">
              <label class="form-label">Event Time</label>
              <input
                type="text"
                class="form-input"
                [(ngModel)]="template.invoiceDetails.eventTime"
                (ngModelChange)="onTemplateChange()"
                placeholder="6:00 PM to 11:00 PM"
              />
            </div>
            <div class="form-group col-half">
              <label class="form-label">No. of Guests (Approx.)</label>
              <input
                type="text"
                class="form-input"
                [(ngModel)]="template.invoiceDetails.guestsApprox"
                (ngModelChange)="onTemplateChange()"
                placeholder="300"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Section 6: Items Table Settings -->
      <div class="accordion-item" [class.expanded]="isSectionOpen(6)">
        <button class="accordion-header" (click)="toggleSection(6)">
          <div class="header-left">
            <span class="section-num">6.</span>
            <span class="section-title">Items Table Settings</span>
          </div>
          <span class="chevron" [class.open]="isSectionOpen(6)">›</span>
        </button>

        <div class="accordion-body" *ngIf="isSectionOpen(6)">
          <div class="toggles-list">
            <label class="checkbox-label">
              <input
                type="checkbox"
                [(ngModel)]="template.tableSettings.showSNo"
                (ngModelChange)="onTemplateChange()"
              />
              <span>Show Serial Number (S.No)</span>
            </label>

            <label class="checkbox-label">
              <input
                type="checkbox"
                [(ngModel)]="template.tableSettings.showHsnSac"
                (ngModelChange)="onTemplateChange()"
              />
              <span>Show HSN / SAC Code Column</span>
            </label>

            <label class="checkbox-label">
              <input
                type="checkbox"
                [(ngModel)]="template.tableSettings.showQtyDuration"
                (ngModelChange)="onTemplateChange()"
              />
              <span>Show Qty / Duration Column</span>
            </label>

            <label class="checkbox-label">
              <input
                type="checkbox"
                [(ngModel)]="template.tableSettings.showRate"
                (ngModelChange)="onTemplateChange()"
              />
              <span>Show Unit Rate Column</span>
            </label>

            <label class="checkbox-label">
              <input
                type="checkbox"
                [(ngModel)]="template.tableSettings.stripedRows"
                (ngModelChange)="onTemplateChange()"
              />
              <span>Zebra Striped Rows</span>
            </label>
          </div>

          <div class="form-group mt-12">
            <label class="form-label">Currency Symbol / Label</label>
            <input
              type="text"
              class="form-input"
              [(ngModel)]="template.tableSettings.currencySymbol"
              (ngModelChange)="onTemplateChange()"
              placeholder="INR"
            />
          </div>
        </div>
      </div>

      <!-- Section 7: Tax & Total -->
      <div class="accordion-item" [class.expanded]="isSectionOpen(7)">
        <button class="accordion-header" (click)="toggleSection(7)">
          <div class="header-left">
            <span class="section-num">7.</span>
            <span class="section-title">Tax & Total</span>
          </div>
          <span class="chevron" [class.open]="isSectionOpen(7)">›</span>
        </button>

        <div class="accordion-body" *ngIf="isSectionOpen(7)">
          <div class="form-group">
            <label class="form-label">GST Tax Mode</label>
            <select
              class="form-select"
              [(ngModel)]="template.taxSettings.taxMode"
              (ngModelChange)="onTemplateChange()"
            >
              <option value="gst">Intra-State GST (CGST + SGST)</option>
              <option value="igst">Inter-State GST (IGST)</option>
              <option value="none">No Tax (Exempted / Non-GST)</option>
            </select>
          </div>

          <div class="form-row" *ngIf="template.taxSettings.taxMode === 'gst'">
            <div class="form-group col-half">
              <label class="form-label">CGST Rate (%)</label>
              <input
                type="number"
                class="form-input"
                [(ngModel)]="template.taxSettings.cgstRate"
                (ngModelChange)="onTemplateChange()"
              />
            </div>
            <div class="form-group col-half">
              <label class="form-label">SGST Rate (%)</label>
              <input
                type="number"
                class="form-input"
                [(ngModel)]="template.taxSettings.sgstRate"
                (ngModelChange)="onTemplateChange()"
              />
            </div>
          </div>

          <div class="form-group" *ngIf="template.taxSettings.taxMode === 'igst'">
            <label class="form-label">IGST Rate (%)</label>
            <input
              type="number"
              class="form-input"
              [(ngModel)]="template.taxSettings.igstRate"
              (ngModelChange)="onTemplateChange()"
            />
          </div>

          <div class="form-row">
            <div class="form-group col-half">
              <label class="form-label">Discount Value</label>
              <input
                type="number"
                class="form-input"
                [(ngModel)]="template.taxSettings.discountValue"
                (ngModelChange)="onTemplateChange()"
              />
            </div>
            <div class="form-group col-half">
              <label class="form-label">Discount Type</label>
              <select
                class="form-select"
                [(ngModel)]="template.taxSettings.discountType"
                (ngModelChange)="onTemplateChange()"
              >
                <option value="flat">Flat Amount (₹)</option>
                <option value="percentage">Percentage (%)</option>
              </select>
            </div>
          </div>

          <div class="checkbox-group">
            <label class="checkbox-label">
              <input
                type="checkbox"
                [(ngModel)]="template.taxSettings.roundOff"
                (ngModelChange)="onTemplateChange()"
              />
              <span>Round off Grand Total</span>
            </label>
          </div>
        </div>
      </div>

      <!-- Section 8: Payment Details -->
      <div class="accordion-item" [class.expanded]="isSectionOpen(8)">
        <button class="accordion-header" (click)="toggleSection(8)">
          <div class="header-left">
            <span class="section-num">8.</span>
            <span class="section-title">Payment Details</span>
          </div>
          <span class="chevron" [class.open]="isSectionOpen(8)">›</span>
        </button>

        <div class="accordion-body" *ngIf="isSectionOpen(8)">
          <div class="form-group">
            <label class="form-label">Bank Name</label>
            <input
              type="text"
              class="form-input"
              [(ngModel)]="template.paymentDetails.bankName"
              (ngModelChange)="onTemplateChange()"
            />
          </div>

          <div class="form-group">
            <label class="form-label">Account Name / Beneficiary</label>
            <input
              type="text"
              class="form-input"
              [(ngModel)]="template.paymentDetails.accountName"
              (ngModelChange)="onTemplateChange()"
            />
          </div>

          <div class="form-row">
            <div class="form-group col-half">
              <label class="form-label">Account Number</label>
              <input
                type="text"
                class="form-input"
                [(ngModel)]="template.paymentDetails.accountNumber"
                (ngModelChange)="onTemplateChange()"
              />
            </div>
            <div class="form-group col-half">
              <label class="form-label">IFSC Code</label>
              <input
                type="text"
                class="form-input uppercase"
                [(ngModel)]="template.paymentDetails.ifscCode"
                (ngModelChange)="onTemplateChange()"
              />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group col-half">
              <label class="form-label">Branch</label>
              <input
                type="text"
                class="form-input"
                [(ngModel)]="template.paymentDetails.branch"
                (ngModelChange)="onTemplateChange()"
              />
            </div>
            <div class="form-group col-half">
              <label class="form-label">UPI ID</label>
              <input
                type="text"
                class="form-input"
                [(ngModel)]="template.paymentDetails.upiId"
                (ngModelChange)="onTemplateChange()"
              />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Payment Terms Policy</label>
            <textarea
              class="form-textarea"
              rows="2"
              [(ngModel)]="template.paymentDetails.paymentTerms"
              (ngModelChange)="onTemplateChange()"
            ></textarea>
          </div>
        </div>
      </div>

      <!-- Section 9: Terms & Conditions -->
      <div class="accordion-item" [class.expanded]="isSectionOpen(9)">
        <button class="accordion-header" (click)="toggleSection(9)">
          <div class="header-left">
            <span class="section-num">9.</span>
            <span class="section-title">Terms & Conditions</span>
          </div>
          <span class="chevron" [class.open]="isSectionOpen(9)">›</span>
        </button>

        <div class="accordion-body" *ngIf="isSectionOpen(9)">
          <div class="terms-list">
            <div *ngFor="let term of template.termsAndConditions; let idx = index; trackBy: trackByIndex" class="term-item">
              <span class="term-bullet">{{ idx + 1 }}.</span>
              <input
                type="text"
                class="form-input term-input"
                [ngModel]="term"
                (ngModelChange)="updateTerm(idx, $event)"
              />
              <button class="term-remove-btn" (click)="removeTerm(idx)" title="Remove term">×</button>
            </div>
          </div>

          <button class="btn btn-outline-sm mt-8" (click)="addTerm()">
            + Add New Term Condition
          </button>
        </div>
      </div>

      <!-- Section 10: Notes / Remarks -->
      <div class="accordion-item" [class.expanded]="isSectionOpen(10)">
        <button class="accordion-header" (click)="toggleSection(10)">
          <div class="header-left">
            <span class="section-num">10.</span>
            <span class="section-title">Notes / Remarks</span>
          </div>
          <span class="chevron" [class.open]="isSectionOpen(10)">›</span>
        </button>

        <div class="accordion-body" *ngIf="isSectionOpen(10)">
          <div class="form-group">
            <label class="form-label">Greeting / Thank You Message</label>
            <textarea
              class="form-textarea"
              rows="3"
              [(ngModel)]="template.notesRemarks"
              (ngModelChange)="onTemplateChange()"
            ></textarea>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .accordion-panel {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .accordion-item {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      overflow: hidden;
      transition: all 0.2s ease;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
    }

    .accordion-item.expanded {
      border-color: #cbd5e1;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
    }

    .accordion-header {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 14px;
      background: #f8fafc;
      border: none;
      cursor: pointer;
      text-align: left;
      transition: background 0.2s;
    }

    .accordion-header:hover {
      background: #f1f5f9;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .section-num {
      font-weight: 700;
      color: #2563eb;
      font-size: 0.88rem;
    }

    .section-title {
      font-weight: 600;
      font-size: 0.88rem;
      color: #1e293b;
    }

    .chevron {
      font-size: 1.2rem;
      color: #64748b;
      transform: rotate(90deg);
      transition: transform 0.2s;
    }

    .chevron.open {
      transform: rotate(-90deg);
    }

    .accordion-body {
      padding: 14px;
      background: #ffffff;
      border-top: 1px solid #f1f5f9;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    /* Forms */
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
      font-size: 0.78rem;
      font-weight: 600;
      color: #475569;
    }

    .required {
      color: #ef4444;
    }

    .form-input, .form-select, .form-textarea {
      width: 100%;
      padding: 7px 10px;
      font-size: 0.82rem;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      background: #ffffff;
      color: #1e293b;
      outline: none;
      transition: border-color 0.2s, box-shadow 0.2s;
      font-family: inherit;
      box-sizing: border-box;
    }

    .form-input:focus, .form-select:focus, .form-textarea:focus {
      border-color: #3b82f6;
      box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15);
    }

    .uppercase {
      text-transform: uppercase;
    }

    .checkbox-group {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding-top: 4px;
    }

    .checkbox-label {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.82rem;
      color: #334155;
      cursor: pointer;
    }

    .checkbox-label input[type="checkbox"] {
      width: 16px;
      height: 16px;
      accent-color: #2563eb;
      cursor: pointer;
    }

    .section-hint {
      font-size: 0.76rem;
      color: #64748b;
      line-height: 1.4;
      margin: 0;
    }

    .action-btn-row {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .btn {
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 0.78rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-secondary-sm {
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      color: #1d4ed8;
    }

    .btn-secondary-sm:hover {
      background: #dbeafe;
    }

    .btn-outline-sm {
      background: #ffffff;
      border: 1px solid #cbd5e1;
      color: #475569;
    }

    .btn-outline-sm:hover {
      background: #f8fafc;
      border-color: #94a3b8;
    }

    .preset-status-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 8px 10px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: 0.76rem;
    }

    .preset-row {
      display: flex;
      justify-content: space-between;
      gap: 8px;
    }

    .preset-key {
      color: #64748b;
      font-weight: 500;
    }

    .preset-val {
      color: #1e293b;
      font-weight: 600;
      text-align: right;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 150px;
    }

    .toggles-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .terms-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .term-item {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .term-bullet {
      font-size: 0.75rem;
      font-weight: 600;
      color: #64748b;
      min-width: 14px;
    }

    .term-input {
      flex-grow: 1;
    }

    .term-remove-btn {
      width: 24px;
      height: 24px;
      background: #fee2e2;
      border: none;
      border-radius: 4px;
      color: #ef4444;
      font-weight: bold;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s;
    }

    .term-remove-btn:hover {
      background: #fecaca;
    }

    .mt-8 { margin-top: 8px; }
    .mt-12 { margin-top: 12px; }
  `]
})
export class TemplateAccordionComponent {
  @Input() template!: InvoiceTemplate;
  @Input() categories: TemplateCategory[] = [];

  @Output() templateChanged = new EventEmitter<InvoiceTemplate>();
  @Output() applyDefaultPreset = new EventEmitter<void>();
  @Output() saveAsDefaultPreset = new EventEmitter<void>();
  @Output() setAsDefaultClicked = new EventEmitter<string>();

  openSections: Record<number, boolean> = { 1: true };

  toggleSection(sectionNum: number): void {
    this.openSections[sectionNum] = !this.openSections[sectionNum];
  }

  isSectionOpen(sectionNum: number): boolean {
    return !!this.openSections[sectionNum];
  }

  onTemplateChange(): void {
    this.templateChanged.emit(this.template);
  }

  onSetAsDefault(id: string): void {
    this.setAsDefaultClicked.emit(id);
  }

  updateTerm(index: number, value: string): void {
    this.template.termsAndConditions[index] = value;
    this.onTemplateChange();
  }

  addTerm(): void {
    this.template.termsAndConditions.push('New booking condition or policy.');
    this.onTemplateChange();
  }

  removeTerm(index: number): void {
    this.template.termsAndConditions.splice(index, 1);
    this.onTemplateChange();
  }

  trackByIndex(index: number): number {
    return index;
  }
}
