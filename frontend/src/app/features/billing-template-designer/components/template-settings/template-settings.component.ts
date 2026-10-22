import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InvoiceTemplate } from '../../models/billing-template.models';

@Component({
  selector: 'app-template-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="settings-panel" *ngIf="template">
      <!-- Panel Header -->
      <div class="settings-panel-header">
        <div class="title-wrap">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
          <span class="panel-title">Template Settings</span>
        </div>
      </div>

      <!-- Settings Tabs -->
      <div class="tabs-nav">
        <button
          class="tab-btn"
          [class.active]="activeTab === 'content'"
          (click)="activeTab = 'content'"
        >
          Content
        </button>
        <button
          class="tab-btn"
          [class.active]="activeTab === 'design'"
          (click)="activeTab = 'design'"
        >
          Design
        </button>
        <button
          class="tab-btn"
          [class.active]="activeTab === 'advanced'"
          (click)="activeTab = 'advanced'"
        >
          Advanced
        </button>
      </div>

      <!-- TAB 1: CONTENT -->
      <div class="tab-content" *ngIf="activeTab === 'content'">
        <!-- Logo & Header Section -->
        <div class="setting-section">
          <div class="section-title-row" (click)="toggleSection('logo')">
            <span class="setting-title">🖼️ Logo & Header</span>
            <span class="collapse-arrow" [class.open]="openSections['logo']">›</span>
          </div>

          <div class="section-body" *ngIf="openSections['logo']">
            <!-- Upload Logo -->
            <div class="field-block">
              <label class="field-label">Upload Logo</label>
              <div class="logo-control-row">
                <div class="logo-preview-box">
                  <img
                    *ngIf="template.businessInfo.logoUrl"
                    [src]="template.businessInfo.logoUrl"
                    alt="Logo"
                    class="logo-thumb-img"
                  />
                  <span *ngIf="!template.businessInfo.logoUrl" class="no-logo-text">No Logo</span>
                </div>
                <div class="logo-actions">
                  <label class="btn-replace">
                    Replace
                    <input
                      type="file"
                      accept="image/*"
                      class="hidden-file-input"
                      (change)="handleLogoUpload($event)"
                    />
                  </label>
                  <button
                    class="btn-trash"
                    (click)="removeLogo()"
                    title="Remove logo"
                    *ngIf="template.businessInfo.logoUrl"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </div>

            <!-- Business Name -->
            <div class="field-block">
              <label class="field-label">Business Name</label>
              <input
                type="text"
                class="field-input"
                [(ngModel)]="template.businessInfo.name"
                (ngModelChange)="onTemplateChange()"
                placeholder="Sri Balaji Mahal"
              />
            </div>

            <!-- Tagline -->
            <div class="field-block">
              <label class="field-label">Tagline</label>
              <input
                type="text"
                class="field-input"
                [(ngModel)]="template.businessInfo.tagline"
                (ngModelChange)="onTemplateChange()"
                placeholder="Banquet & Function Hall"
              />
            </div>

            <!-- Header Image -->
            <div class="field-block">
              <label class="field-label">Header Image (Luxury Stage / Hall)</label>
              <div class="header-image-preview" *ngIf="template.businessInfo.headerImageUrl">
                <img
                  [src]="template.businessInfo.headerImageUrl"
                  alt="Stage"
                  class="stage-thumb-img"
                />
              </div>
              <div class="header-image-actions">
                <label class="btn-change-image">
                  Change Image
                  <input
                    type="file"
                    accept="image/*"
                    class="hidden-file-input"
                    (change)="handleHeaderImageUpload($event)"
                  />
                </label>
                <button
                  class="btn-remove-image"
                  (click)="removeHeaderImage()"
                  *ngIf="template.businessInfo.headerImageUrl"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Show / Hide Fields Section -->
        <div class="setting-section">
          <div class="section-title-row" (click)="toggleSection('fields')">
            <span class="setting-title">👁️ Show / Hide Fields</span>
            <span class="collapse-arrow" [class.open]="openSections['fields']">›</span>
          </div>

          <div class="section-body" *ngIf="openSections['fields']">
            <div class="toggle-grid">
              <label class="switch-row">
                <span>Business Logo</span>
                <input
                  type="checkbox"
                  [(ngModel)]="template.showFields.logo"
                  (ngModelChange)="onTemplateChange()"
                />
              </label>

              <label class="switch-row">
                <span>Header Image Banner</span>
                <input
                  type="checkbox"
                  [(ngModel)]="template.showFields.headerImage"
                  (ngModelChange)="onTemplateChange()"
                />
              </label>

              <label class="switch-row">
                <span>Tax Registration (GST/PAN)</span>
                <input
                  type="checkbox"
                  [(ngModel)]="template.showFields.taxRegistrationBlock"
                  (ngModelChange)="onTemplateChange()"
                />
              </label>

              <label class="switch-row">
                <span>Customer Address Block</span>
                <input
                  type="checkbox"
                  [(ngModel)]="template.showFields.customerDetails"
                  (ngModelChange)="onTemplateChange()"
                />
              </label>

              <label class="switch-row">
                <span>Event & Booking Details</span>
                <input
                  type="checkbox"
                  [(ngModel)]="template.showFields.eventDetails"
                  (ngModelChange)="onTemplateChange()"
                />
              </label>

              <label class="switch-row">
                <span>Amount in Words</span>
                <input
                  type="checkbox"
                  [(ngModel)]="template.showFields.amountInWords"
                  (ngModelChange)="onTemplateChange()"
                />
              </label>

              <label class="switch-row">
                <span>Bank & UPI Details</span>
                <input
                  type="checkbox"
                  [(ngModel)]="template.showFields.paymentDetails"
                  (ngModelChange)="onTemplateChange()"
                />
              </label>

              <label class="switch-row">
                <span>Terms & Conditions</span>
                <input
                  type="checkbox"
                  [(ngModel)]="template.showFields.termsConditions"
                  (ngModelChange)="onTemplateChange()"
                />
              </label>

              <label class="switch-row">
                <span>Authorized Signatory</span>
                <input
                  type="checkbox"
                  [(ngModel)]="template.showFields.signatureBlock"
                  (ngModelChange)="onTemplateChange()"
                />
              </label>
            </div>
          </div>
        </div>

        <!-- Color Theme Section -->
        <div class="setting-section">
          <div class="section-title-row" (click)="toggleSection('color')">
            <span class="setting-title">🎨 Color Theme</span>
            <span class="collapse-arrow" [class.open]="openSections['color']">›</span>
          </div>

          <div class="section-body" *ngIf="openSections['color']">
            <div class="color-palette-grid">
              <button
                *ngFor="let col of colorSwatches"
                class="color-circle"
                [style.background]="col"
                [class.selected]="template.colorTheme === col"
                (click)="setColorTheme(col)"
                [title]="col"
              ></button>

              <!-- Custom Color Picker -->
              <label class="color-circle custom-color-picker" title="Custom Color">
                <span>+</span>
                <input
                  type="color"
                  class="hidden-color-input"
                  [value]="template.colorTheme"
                  (change)="onCustomColorChange($event)"
                />
              </label>
            </div>
          </div>
        </div>

        <!-- Font Style Section -->
        <div class="setting-section">
          <div class="section-title-row" (click)="toggleSection('font')">
            <span class="setting-title">🔤 Font Style</span>
            <span class="collapse-arrow" [class.open]="openSections['font']">›</span>
          </div>

          <div class="section-body" *ngIf="openSections['font']">
            <div class="font-row">
              <div class="field-block flex-2">
                <label class="field-label">Font Family</label>
                <select
                  class="field-select"
                  [(ngModel)]="template.fontFamily"
                  (ngModelChange)="onTemplateChange()"
                >
                  <option value="Poppins">Poppins (Clean & Modern)</option>
                  <option value="Inter">Inter (Professional)</option>
                  <option value="Playfair Display">Playfair Display (Royal Serif)</option>
                  <option value="Montserrat">Montserrat (Geometric)</option>
                  <option value="Roboto">Roboto (Crisp)</option>
                </select>
              </div>

              <div class="field-block flex-1">
                <label class="field-label">Size</label>
                <select
                  class="field-select"
                  [(ngModel)]="template.fontSize"
                  (ngModelChange)="onTemplateChange()"
                >
                  <option [value]="10">10 pt</option>
                  <option [value]="11">11 pt</option>
                  <option [value]="12">12 pt</option>
                  <option [value]="13">13 pt</option>
                  <option [value]="14">14 pt</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- TAB 2: DESIGN -->
      <div class="tab-content" *ngIf="activeTab === 'design'">
        <div class="field-block">
          <label class="field-label">Layout Style Variant</label>
          <select
            class="field-select"
            [(ngModel)]="template.design.layoutVariant"
            (ngModelChange)="onTemplateChange()"
          >
            <option value="classic-mahal">Classic Mahal Banner</option>
            <option value="elegant-modern">Elegant Modern Clean</option>
            <option value="royal-crest">Royal Heritage Crest</option>
            <option value="simple-clean">Simple Professional</option>
            <option value="traditional-bordered">Traditional Double-Border</option>
          </select>
        </div>

        <div class="field-block">
          <label class="field-label">Banner Background Pattern</label>
          <select
            class="field-select"
            [(ngModel)]="template.design.bannerBgPattern"
            (ngModelChange)="onTemplateChange()"
          >
            <option value="ornate">Ornate Traditional Mandala</option>
            <option value="geometric">Geometric Diamond Pattern</option>
            <option value="solid">Clean Solid Fill</option>
            <option value="gradient">Subtle Gradient</option>
          </select>
        </div>

        <div class="field-block">
          <label class="field-label">Header Arrangement</label>
          <select
            class="field-select"
            [(ngModel)]="template.design.headerLayout"
            (ngModelChange)="onTemplateChange()"
          >
            <option value="split-photo">Split: Left Info + Right Photo</option>
            <option value="center-logo">Centered Logo & Details</option>
            <option value="left-aligned">Left Aligned Corporate</option>
            <option value="compact">Compact Single Line</option>
          </select>
        </div>

        <div class="toggle-grid mt-12">
          <label class="switch-row">
            <span>Accent Outer Border</span>
            <input
              type="checkbox"
              [(ngModel)]="template.design.accentBorder"
              (ngModelChange)="onTemplateChange()"
            />
          </label>

          <label class="switch-row">
            <span>Compact Padding & Spacing</span>
            <input
              type="checkbox"
              [(ngModel)]="template.design.compactSpacing"
              (ngModelChange)="onTemplateChange()"
            />
          </label>
        </div>
      </div>

      <!-- TAB 3: ADVANCED -->
      <div class="tab-content" *ngIf="activeTab === 'advanced'">
        <div class="field-block">
          <label class="field-label">Page Setup Standard</label>
          <select
            class="field-select"
            [(ngModel)]="template.pageSize"
            (ngModelChange)="onTemplateChange()"
          >
            <option value="A4">Standard A4 (210 x 297 mm)</option>
            <option value="Letter">US Letter (8.5 x 11 in)</option>
            <option value="Legal">US Legal (8.5 x 14 in)</option>
          </select>
        </div>

        <div class="field-block">
          <label class="field-label">Page Orientation</label>
          <select
            class="field-select"
            [(ngModel)]="template.pageOrientation"
            (ngModelChange)="onTemplateChange()"
          >
            <option value="portrait">Portrait</option>
            <option value="landscape">Landscape</option>
          </select>
        </div>

        <div class="btn-stack mt-16">
          <button class="action-btn" (click)="duplicateTemplate.emit(template.id)">
            📑 Duplicate This Template
          </button>

          <button class="action-btn" (click)="exportTemplate.emit(template)">
            ⬇️ Export Template as JSON
          </button>

          <label class="action-btn-label">
            ⬆️ Import Template from JSON
            <input
              type="file"
              accept=".json"
              class="hidden-file-input"
              (change)="handleJsonImport($event)"
            />
          </label>

          <button class="action-btn delete-btn" (click)="deleteTemplate.emit(template.id)">
            🗑️ Delete Template
          </button>

          <button class="action-btn reset-btn" (click)="resetDefaults.emit()">
            🔄 Reset All to Factory Presets
          </button>
        </div>
      </div>

      <!-- Bottom Save Button -->
      <div class="settings-panel-footer">
        <button class="btn-save-changes" (click)="saveTemplateChanges.emit()">
          Save Template Changes
        </button>
      </div>
    </div>
  `,
  styles: [`
    .settings-panel {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
    }

    .settings-panel-header {
      padding: 14px 16px;
      border-bottom: 1px solid #e2e8f0;
      background: #f8fafc;
    }

    .title-wrap {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .panel-title {
      font-weight: 700;
      font-size: 0.95rem;
      color: #1e293b;
    }

    /* Tabs */
    .tabs-nav {
      display: flex;
      border-bottom: 1px solid #e2e8f0;
      background: #ffffff;
    }

    .tab-btn {
      flex: 1;
      padding: 10px 0;
      font-size: 0.84rem;
      font-weight: 600;
      color: #64748b;
      background: none;
      border: none;
      border-bottom: 2px solid transparent;
      cursor: pointer;
      transition: all 0.2s;
    }

    .tab-btn:hover {
      color: #2563eb;
    }

    .tab-btn.active {
      color: #2563eb;
      border-bottom-color: #2563eb;
      background: #eff6ff;
    }

    /* Tab Content */
    .tab-content {
      padding: 14px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      max-height: calc(100vh - 380px);
      overflow-y: auto;
    }

    .setting-section {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      overflow: hidden;
      background: #ffffff;
    }

    .section-title-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 12px;
      background: #f8fafc;
      cursor: pointer;
      font-weight: 600;
      font-size: 0.82rem;
      color: #1e293b;
      transition: background 0.2s;
    }

    .section-title-row:hover {
      background: #f1f5f9;
    }

    .collapse-arrow {
      font-size: 1.1rem;
      color: #64748b;
      transform: rotate(90deg);
      transition: transform 0.2s;
    }

    .collapse-arrow.open {
      transform: rotate(-90deg);
    }

    .section-body {
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      border-top: 1px solid #f1f5f9;
    }

    .field-block {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .field-label {
      font-size: 0.76rem;
      font-weight: 600;
      color: #475569;
    }

    .field-input, .field-select {
      width: 100%;
      padding: 7px 10px;
      font-size: 0.82rem;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      outline: none;
      box-sizing: border-box;
      transition: border-color 0.2s;
      font-family: inherit;
    }

    .field-input:focus, .field-select:focus {
      border-color: #3b82f6;
      box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15);
    }

    /* Logo Controls */
    .logo-control-row {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .logo-preview-box {
      width: 60px;
      height: 48px;
      border: 1px dashed #cbd5e1;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f8fafc;
      overflow: hidden;
    }

    .logo-thumb-img {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
    }

    .no-logo-text {
      font-size: 0.65rem;
      color: #94a3b8;
    }

    .logo-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .btn-replace {
      display: inline-block;
      padding: 6px 12px;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      font-size: 0.78rem;
      font-weight: 600;
      color: #334155;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-replace:hover {
      background: #f8fafc;
      border-color: #94a3b8;
    }

    .btn-trash {
      width: 32px;
      height: 32px;
      background: #fee2e2;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.9rem;
      transition: background 0.2s;
    }

    .btn-trash:hover {
      background: #fecaca;
    }

    .hidden-file-input {
      display: none;
    }

    /* Header Image Preview */
    .header-image-preview {
      width: 100%;
      height: 64px;
      border-radius: 6px;
      overflow: hidden;
      border: 1px solid #e2e8f0;
      background: #f1f5f9;
    }

    .stage-thumb-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .header-image-actions {
      display: flex;
      gap: 8px;
      margin-top: 4px;
    }

    .btn-change-image {
      padding: 6px 12px;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 6px;
      color: #1d4ed8;
      font-size: 0.78rem;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
    }

    .btn-change-image:hover {
      background: #dbeafe;
    }

    .btn-remove-image {
      padding: 6px 12px;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      color: #ef4444;
      font-size: 0.78rem;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
    }

    .btn-remove-image:hover {
      background: #fee2e2;
    }

    /* Show Hide Switches */
    .toggle-grid {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .switch-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 0.8rem;
      color: #334155;
      cursor: pointer;
    }

    .switch-row input[type="checkbox"] {
      width: 16px;
      height: 16px;
      accent-color: #2563eb;
      cursor: pointer;
    }

    /* Color Palette Grid */
    .color-palette-grid {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .color-circle {
      width: 26px;
      height: 26px;
      border-radius: 50%;
      border: 2px solid #ffffff;
      box-shadow: 0 0 0 1px #cbd5e1;
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
      position: relative;
    }

    .color-circle:hover {
      transform: scale(1.15);
    }

    .color-circle.selected {
      box-shadow: 0 0 0 2.5px #2563eb;
      transform: scale(1.15);
    }

    .custom-color-picker {
      background: #f1f5f9 !important;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #64748b;
      font-size: 1rem;
      font-weight: bold;
    }

    .hidden-color-input {
      opacity: 0;
      position: absolute;
      inset: 0;
      cursor: pointer;
    }

    /* Font Row */
    .font-row {
      display: flex;
      gap: 8px;
    }

    .flex-1 { flex: 1; }
    .flex-2 { flex: 2; }

    /* Button Stacks */
    .btn-stack {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .action-btn, .action-btn-label {
      width: 100%;
      padding: 8px 12px;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      font-size: 0.8rem;
      font-weight: 600;
      color: #334155;
      text-align: center;
      cursor: pointer;
      box-sizing: border-box;
      transition: all 0.2s;
      display: block;
    }

    .action-btn:hover, .action-btn-label:hover {
      background: #f8fafc;
      border-color: #94a3b8;
    }

    .delete-btn {
      color: #ef4444;
      border-color: #fca5a5;
    }

    .delete-btn:hover {
      background: #fee2e2;
    }

    .reset-btn {
      color: #64748b;
    }

    /* Panel Footer */
    .settings-panel-footer {
      padding: 14px;
      background: #ffffff;
      border-top: 1px solid #e2e8f0;
    }

    .btn-save-changes {
      width: 100%;
      padding: 10px 16px;
      background: #2563eb;
      color: #ffffff;
      font-weight: 700;
      font-size: 0.88rem;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;
      box-shadow: 0 2px 6px rgba(37, 99, 235, 0.25);
    }

    .btn-save-changes:hover {
      background: #1d4ed8;
      box-shadow: 0 4px 12px rgba(37, 99, 235, 0.35);
      transform: translateY(-1px);
    }

    .btn-save-changes:active {
      transform: translateY(0);
    }

    .mt-12 { margin-top: 12px; }
    .mt-16 { margin-top: 16px; }
  `]
})
export class TemplateSettingsComponent {
  @Input() template!: InvoiceTemplate;

  @Output() templateChanged = new EventEmitter<InvoiceTemplate>();
  @Output() saveTemplateChanges = new EventEmitter<void>();
  @Output() duplicateTemplate = new EventEmitter<string>();
  @Output() deleteTemplate = new EventEmitter<string>();
  @Output() exportTemplate = new EventEmitter<InvoiceTemplate>();
  @Output() importTemplate = new EventEmitter<string>();
  @Output() resetDefaults = new EventEmitter<void>();

  activeTab: 'content' | 'design' | 'advanced' = 'content';

  openSections: Record<string, boolean> = {
    logo: true,
    fields: true,
    color: true,
    font: true,
  };

  colorSwatches: string[] = [
    '#1e40af', // Royal Blue
    '#7c3aed', // Purple
    '#0d9488', // Emerald Teal
    '#ea580c', // Orange
    '#dc2626', // Crimson Red
    '#854d0e', // Warm Gold / Brown
    '#1f2937', // Charcoal Black
  ];

  toggleSection(key: string): void {
    this.openSections[key] = !this.openSections[key];
  }

  onTemplateChange(): void {
    this.templateChanged.emit(this.template);
  }

  setColorTheme(color: string): void {
    this.template.colorTheme = color;
    this.onTemplateChange();
  }

  onCustomColorChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input && input.value) {
      this.setColorTheme(input.value);
    }
  }

  handleLogoUpload(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        this.template.businessInfo.logoUrl = e.target?.result as string;
        this.onTemplateChange();
      };
      reader.readAsDataURL(file);
    }
  }

  removeLogo(): void {
    this.template.businessInfo.logoUrl = '';
    this.onTemplateChange();
  }

  handleHeaderImageUpload(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        this.template.businessInfo.headerImageUrl = e.target?.result as string;
        this.onTemplateChange();
      };
      reader.readAsDataURL(file);
    }
  }

  removeHeaderImage(): void {
    this.template.businessInfo.headerImageUrl = '';
    this.onTemplateChange();
  }

  handleJsonImport(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        this.importTemplate.emit(text);
      };
      reader.readAsText(file);
    }
  }
}
