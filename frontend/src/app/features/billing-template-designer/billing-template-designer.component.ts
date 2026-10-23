import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { BillingTemplateStateService } from './services/billing-template-state.service';
import { InvoicePrintPdfService } from './services/invoice-print-pdf.service';
import {
  InvoiceTemplate,
  TemplateCategory,
  InvoiceTotals,
  InvoiceItem,
} from './models/billing-template.models';
import { TemplateGalleryComponent } from './components/template-gallery/template-gallery.component';
import { TemplateAccordionComponent } from './components/template-accordion/template-accordion.component';
import { InvoicePreviewComponent } from './components/invoice-preview/invoice-preview.component';
import { TemplateSettingsComponent } from './components/template-settings/template-settings.component';
import { ItemEditModalComponent } from './components/item-edit-modal/item-edit-modal.component';
import { InvoiceGeneratorModalComponent } from './components/invoice-generator-modal/invoice-generator-modal.component';
import {
  AddCategoryModalComponent,
  CreateTemplateModalComponent,
  PageSetupModalComponent,
  FullscreenPreviewModalComponent,
} from './components/dialogs/designer-modals.component';

@Component({
  selector: 'app-billing-template-designer',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TemplateGalleryComponent,
    TemplateAccordionComponent,
    InvoicePreviewComponent,
    TemplateSettingsComponent,
    ItemEditModalComponent,
    InvoiceGeneratorModalComponent,
    AddCategoryModalComponent,
    CreateTemplateModalComponent,
    PageSetupModalComponent,
    FullscreenPreviewModalComponent,
  ],
  template: `
    <div class="billmaster-app" [class.sidebar-collapsed]="sidebarCollapsed">
      <!-- TOP NAVIGATION BAR -->
      <header class="top-nav">
        <div class="nav-left">
          <button class="menu-toggle-btn" (click)="toggleSidebar()" title="Toggle Sidebar">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>

          <!-- BillMaster Brand -->
          <div class="brand-wrap" (click)="navigateToHome()">
            <div class="brand-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2.5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="9" y1="13" x2="15" y2="13"></line>
                <line x1="9" y1="17" x2="13" y2="17"></line>
              </svg>
            </div>
            <span class="brand-name">BillMaster</span>
          </div>

          <!-- Top Search Bar -->
          <div class="search-box">
            <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input
              type="text"
              class="search-input"
              [(ngModel)]="searchQuery"
              (ngModelChange)="onSearchChange($event)"
              placeholder="Search templates, invoices, customers..."
            />
          </div>
        </div>

        <div class="nav-right">
          <!-- Back to U2Tools Portal -->
          <button class="btn-u2tools" (click)="navigateToHome()" title="Return to U2Tools dashboard">
            <span>💡</span>
            <span>U2Tools Portal</span>
          </button>

          <!-- Notifications -->
          <div class="notification-wrap" title="3 unread notifications">
            <button class="icon-circle-btn">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
              </svg>
            </button>
            <span class="notif-badge">3</span>
          </div>

          <!-- Help -->
          <button class="icon-circle-btn" (click)="showHelpToast()" title="Help & Guides">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
          </button>

          <!-- User Avatar -->
          <div class="user-profile">
            <div class="avatar-circle">M</div>
            <span class="user-name">Maniraj</span>
          </div>
        </div>
      </header>

      <!-- MAIN APP CONTAINER (Sidebar + Workspace) -->
      <div class="app-body">
        <!-- LEFT SIDEBAR -->
        <aside class="left-sidebar" [class.collapsed]="sidebarCollapsed">
          <nav class="sidebar-menu">
            <button
              *ngFor="let item of sidebarItems"
              class="sidebar-item"
              [class.active]="activeSidebarKey === item.key"
              (click)="onSidebarClick(item.key)"
              [title]="sidebarCollapsed ? item.label : ''"
            >
              <span class="item-icon">{{ item.icon }}</span>
              <span class="item-label" *ngIf="!sidebarCollapsed">{{ item.label }}</span>
            </button>
          </nav>

          <div class="sidebar-bottom">
            <button class="collapse-toggle-btn" (click)="toggleSidebar()">
              <span class="collapse-arrow" [class.flipped]="sidebarCollapsed">‹</span>
              <span *ngIf="!sidebarCollapsed">Collapse</span>
            </button>
          </div>
        </aside>

        <!-- MAIN CONTENT AREA -->
        <main class="main-workspace">
          <!-- PAGE TITLE & HERO HEADER -->
          <div class="workspace-header">
            <div class="header-titles">
              <div class="title-with-pill">
                <span class="category-icon-large">🏛️</span>
                <h1 class="page-title">Billing Templates</h1>
              </div>
              <p class="page-subtitle">
                Choose a template or create your own. Save as favorite for quick access.
              </p>
            </div>

            <div class="header-actions">
              <button class="btn-create-template" (click)="openCreateModal()">
                <span class="plus-sign">+</span>
                <span>Create New Template</span>
              </button>
            </div>
          </div>

          <!-- TEMPLATE GALLERY (Categories & Templates Carousel) -->
          <app-template-gallery
            [categories]="categories"
            [templates]="templates"
            [activeTemplate]="activeTemplate"
            [selectedCategory]="activeCategory"
            [searchQuery]="searchQuery"
            (selectCategory)="onSelectCategory($event)"
            (selectTemplate)="onSelectTemplate($event)"
            (toggleFavorite)="onToggleFavorite($event)"
            (addCategoryClicked)="openAddCategoryModal()"
            (createNewClicked)="openCreateModal()"
          ></app-template-gallery>

          <!-- 3-PANEL DESIGNER WORKSPACE -->
          <div class="designer-grid" *ngIf="activeTemplate">
            <!-- LEFT PANEL: Collapsible Accordions (1 to 10) -->
            <div class="designer-left-col">
              <app-template-accordion
                [template]="activeTemplate"
                [categories]="categories"
                (templateChanged)="onTemplateChanged($event)"
                (applyDefaultPreset)="onApplyDefaultPreset()"
                (saveAsDefaultPreset)="onSaveAsDefaultPreset()"
                (setAsDefaultClicked)="onSetAsDefault($event)"
              ></app-template-accordion>
            </div>

            <!-- CENTER PANEL: Live Invoice Preview & Interactive Edit -->
            <div class="designer-center-col">
              <app-invoice-preview
                [template]="activeTemplate"
                [totals]="totals"
                (templateChanged)="onTemplateChanged($event)"
                (editItem)="openEditItemModal($event)"
                (addRowClicked)="openAddItemModal()"
                (duplicateRowClicked)="onDuplicateItem()"
                (editLayoutClicked)="onEditLayoutTriggered()"
                (colorsClicked)="onColorsTriggered()"
                (fontsClicked)="onFontsTriggered()"
                (pageSetupClicked)="openPageSetupModal()"
                (previewFullscreenClicked)="openFullscreenPreviewModal()"
                (generateInvoiceClicked)="openInvoiceGeneratorModal()"
                (exportJsonClicked)="onExportTemplate(activeTemplate)"
                (printInvoice)="onPrintInvoice($event)"
                (downloadPdf)="onDownloadPdf()"
              ></app-invoice-preview>
            </div>

            <!-- RIGHT PANEL: Template Settings (Content, Design, Advanced) -->
            <div class="designer-right-col">
              <app-template-settings
                #settingsComp
                [template]="activeTemplate"
                (templateChanged)="onTemplateChanged($event)"
                (saveTemplateChanges)="onSaveTemplateChanges()"
                (duplicateTemplate)="onDuplicateTemplate($event)"
                (deleteTemplate)="onDeleteTemplate($event)"
                (exportTemplate)="onExportTemplate($event)"
                (importTemplate)="onImportTemplate($event)"
                (resetDefaults)="onResetDefaults()"
              ></app-template-settings>
            </div>
          </div>
        </main>
      </div>

      <!-- MODALS -->
      <!-- 1. Edit / Add Item Modal -->
      <app-item-edit-modal
        [isOpen]="isItemModalOpen"
        [item]="selectedItemForEdit"
        [isNew]="isNewItemMode"
        [currencySymbol]="activeTemplate?.tableSettings?.currencySymbol || 'INR'"
        (close)="isItemModalOpen = false"
        (save)="onSaveItem($event)"
      ></app-item-edit-modal>

      <!-- 2. Add Category Modal -->
      <app-add-category-modal
        [isOpen]="isCategoryModalOpen"
        (close)="isCategoryModalOpen = false"
        (saveCategory)="onSaveCategory($event)"
      ></app-add-category-modal>

      <!-- 3. Create Template Modal -->
      <app-create-template-modal
        [isOpen]="isCreateModalOpen"
        [categories]="categories"
        [defaultCategory]="activeCategory"
        (close)="isCreateModalOpen = false"
        (create)="onCreateTemplate($event)"
      ></app-create-template-modal>

      <!-- 4. Page Setup Modal -->
      <app-page-setup-modal
        [isOpen]="isPageSetupModalOpen"
        [template]="activeTemplate"
        (close)="isPageSetupModalOpen = false"
      ></app-page-setup-modal>

      <!-- 5. Fullscreen Preview Modal -->
      <app-fullscreen-preview-modal
        [isOpen]="isFullscreenPreviewOpen"
        (close)="isFullscreenPreviewOpen = false"
        (print)="onPrintInvoice('billing-invoice-sheet')"
      >
        <div class="fullscreen-invoice-wrapper" *ngIf="activeTemplate">
          <!-- Cloned sheet inside fullscreen -->
          <div
            class="invoice-sheet"
            [style.font-family]="activeTemplate.fontFamily"
            [style.font-size.pt]="activeTemplate.fontSize"
          >
            <!-- Reuses same sheet classes -->
            <div class="sheet-header">
              <div class="header-left-col">
                <div class="business-brand-row">
                  <div class="business-logo-box" *ngIf="activeTemplate.showFields.logo && activeTemplate.businessInfo.logoUrl">
                    <img [src]="activeTemplate.businessInfo.logoUrl" alt="Logo" class="brand-logo-img" />
                  </div>
                  <div class="business-text-info">
                    <h1 class="brand-name" [style.color]="activeTemplate.colorTheme">
                      {{ activeTemplate.businessInfo.name }}
                    </h1>
                    <h2 class="brand-tagline">{{ activeTemplate.businessInfo.tagline }}</h2>
                    <div class="brand-subtagline">{{ activeTemplate.businessInfo.subTagline }}</div>
                  </div>
                </div>
                <div class="brand-contacts">
                  <div class="contact-line">📍 {{ activeTemplate.businessInfo.address }}</div>
                  <div class="contact-line">📞 {{ activeTemplate.businessInfo.phone }}</div>
                  <div class="contact-line">✉️ {{ activeTemplate.businessInfo.email }}</div>
                </div>
              </div>
              <div class="header-right-col">
                <div class="tax-reg-table">
                  <div class="tax-reg-row"><span class="reg-label">GSTIN</span><span>:</span><span class="reg-val">{{ activeTemplate.businessInfo.gstin }}</span></div>
                  <div class="tax-reg-row"><span class="reg-label">PAN</span><span>:</span><span class="reg-val">{{ activeTemplate.businessInfo.pan }}</span></div>
                  <div class="tax-reg-row"><span class="reg-label">Reg. No.</span><span>:</span><span class="reg-val">{{ activeTemplate.businessInfo.regNo }}</span></div>
                </div>
                <div class="header-stage-photo-box" *ngIf="activeTemplate.showFields.headerImage && activeTemplate.businessInfo.headerImageUrl">
                  <img [src]="activeTemplate.businessInfo.headerImageUrl" alt="Stage" class="header-stage-img" />
                </div>
              </div>
            </div>

            <div class="invoice-banner" [style.background]="activeTemplate.colorTheme">
              <div class="banner-title-text">{{ activeTemplate.invoiceDetails.invoiceTitle }}</div>
            </div>

            <div class="bill-details-grid">
              <div class="bill-to-card">
                <div class="section-badge" [style.color]="activeTemplate.colorTheme">Bill To</div>
                <div class="detail-row"><span class="detail-key">Name</span><span>:</span><span class="detail-val font-semibold">{{ activeTemplate.customerInfo.name }}</span></div>
                <div class="detail-row"><span class="detail-key">Address</span><span>:</span><span class="detail-val">{{ activeTemplate.customerInfo.address }}</span></div>
                <div class="detail-row"><span class="detail-key">Phone</span><span>:</span><span class="detail-val">{{ activeTemplate.customerInfo.phone }}</span></div>
              </div>
              <div class="invoice-meta-card">
                <div class="detail-row"><span class="detail-key">Invoice No.</span><span>:</span><span class="detail-val font-semibold">{{ activeTemplate.invoiceDetails.invoiceNo }}</span></div>
                <div class="detail-row"><span class="detail-key">Invoice Date</span><span>:</span><span class="detail-val">{{ activeTemplate.invoiceDetails.invoiceDate }}</span></div>
                <div class="detail-row"><span class="detail-key">Booking Date</span><span>:</span><span class="detail-val">{{ activeTemplate.invoiceDetails.bookingDate }}</span></div>
                <div class="detail-row"><span class="detail-key">Event Type</span><span>:</span><span class="detail-val">{{ activeTemplate.invoiceDetails.eventType }}</span></div>
                <div class="detail-row"><span class="detail-key">Hall Name</span><span>:</span><span class="detail-val">{{ activeTemplate.invoiceDetails.hallName }}</span></div>
              </div>
            </div>

            <table class="invoice-table">
              <thead>
                <tr [style.background]="activeTemplate.colorTheme" style="color: #ffffff;">
                  <th class="col-sno">S.No</th>
                  <th>Description</th>
                  <th>HSN/SAC</th>
                  <th>Qty / Duration</th>
                  <th class="text-right">Rate</th>
                  <th class="text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let item of activeTemplate.items; let i = index">
                  <td class="text-center">{{ i + 1 }}</td>
                  <td>{{ item.description }}</td>
                  <td class="text-center">{{ item.hsnSac }}</td>
                  <td class="text-center">{{ item.qtyDuration }}</td>
                  <td class="text-right">{{ item.rate | number:'1.2-2' }}</td>
                  <td class="text-right">{{ item.amount | number:'1.2-2' }}</td>
                </tr>
              </tbody>
            </table>

            <div class="summary-grid">
              <div class="summary-left">
                <div class="amount-in-words-card">
                  <div class="words-label">Amount in Words:</div>
                  <div class="words-val">{{ totals.amountInWords }}</div>
                </div>
              </div>
              <div class="summary-right">
                <div class="totals-table">
                  <div class="total-row"><span>Sub Total</span><span>{{ totals.subTotal | number:'1.2-2' }}</span></div>
                  <div class="total-row" *ngIf="activeTemplate.taxSettings.taxMode === 'gst'">
                    <span>CGST @ {{ activeTemplate.taxSettings.cgstRate }}%</span><span>{{ totals.cgstAmount | number:'1.2-2' }}</span>
                  </div>
                  <div class="total-row" *ngIf="activeTemplate.taxSettings.taxMode === 'gst'">
                    <span>SGST @ {{ activeTemplate.taxSettings.sgstRate }}%</span><span>{{ totals.sgstAmount | number:'1.2-2' }}</span>
                  </div>
                  <div class="grand-total-pill" [style.background]="activeTemplate.secondaryColor || activeTemplate.colorTheme">
                    <span>Grand Total (INR)</span><span>{{ totals.grandTotal | number:'1.2-2' }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </app-fullscreen-preview-modal>

      <!-- 6. Customer Invoice Generator Modal -->
      <app-invoice-generator-modal
        [isOpen]="isInvoiceGeneratorModalOpen"
        [template]="activeTemplate"
        (close)="isInvoiceGeneratorModalOpen = false"
      ></app-invoice-generator-modal>

      <!-- TOAST NOTIFICATION -->
      <div class="toast-notification animate-slide-up" *ngIf="toastMessage">
        <span class="toast-icon">{{ toastIcon }}</span>
        <span class="toast-text">{{ toastMessage }}</span>
      </div>
    </div>
  `,
  styles: [`
    /* GLOBAL WRAPPER */
    .billmaster-app {
      display: flex;
      flex-direction: column;
      height: 100vh;
      width: 100vw;
      background: #f1f5f9;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      overflow: hidden;
      color: #1e293b;
    }

    /* TOP NAVBAR */
    .top-nav {
      height: 60px;
      background: #ffffff;
      border-bottom: 1px solid #e2e8f0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 20px;
      z-index: 50;
      flex-shrink: 0;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
    }

    .nav-left {
      display: flex;
      align-items: center;
      gap: 18px;
      flex: 1;
    }

    .menu-toggle-btn {
      background: none;
      border: none;
      cursor: pointer;
      color: #64748b;
      padding: 6px;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.15s;
    }

    .menu-toggle-btn:hover {
      background: #f1f5f9;
      color: #1e293b;
    }

    .brand-wrap {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
    }

    .brand-icon {
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .brand-name {
      font-size: 1.25rem;
      font-weight: 800;
      color: #1e293b;
      letter-spacing: -0.5px;
    }

    .search-box {
      display: flex;
      align-items: center;
      gap: 8px;
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 6px 14px;
      width: 380px;
      max-width: 42vw;
      transition: all 0.2s;
    }

    .search-box:focus-within {
      background: #ffffff;
      border-color: #3b82f6;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
    }

    .search-icon {
      color: #94a3b8;
    }

    .search-input {
      border: none;
      background: transparent;
      outline: none;
      width: 100%;
      font-size: 0.84rem;
      color: #1e293b;
    }

    .nav-right {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .btn-u2tools {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 8px;
      font-size: 0.82rem;
      font-weight: 600;
      color: #1d4ed8;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-u2tools:hover {
      background: #dbeafe;
      border-color: #93c5fd;
    }

    .notification-wrap {
      position: relative;
    }

    .icon-circle-btn {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      border: 1px solid #e2e8f0;
      background: #ffffff;
      color: #64748b;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s;
    }

    .icon-circle-btn:hover {
      background: #f8fafc;
      color: #1e293b;
      border-color: #cbd5e1;
    }

    .notif-badge {
      position: absolute;
      top: -2px;
      right: -2px;
      width: 18px;
      height: 18px;
      background: #ef4444;
      color: #ffffff;
      border-radius: 50%;
      font-size: 0.65rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 2px solid #ffffff;
    }

    .user-profile {
      display: flex;
      align-items: center;
      gap: 8px;
      padding-left: 6px;
      border-left: 1px solid #e2e8f0;
    }

    .avatar-circle {
      width: 34px;
      height: 34px;
      border-radius: 50%;
      background: #1e293b;
      color: #ffffff;
      font-weight: 700;
      font-size: 0.85rem;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .user-name {
      font-size: 0.85rem;
      font-weight: 600;
      color: #334155;
    }

    /* BODY LAYOUT (SIDEBAR + MAIN) */
    .app-body {
      display: flex;
      flex: 1;
      overflow: hidden;
    }

    /* SIDEBAR */
    .left-sidebar {
      width: 220px;
      background: #0f172a;
      color: #94a3b8;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      flex-shrink: 0;
      transition: width 0.25s ease;
      z-index: 40;
    }

    .left-sidebar.collapsed {
      width: 64px;
    }

    .sidebar-menu {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 14px 10px;
    }

    .sidebar-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 14px;
      border-radius: 8px;
      border: none;
      background: transparent;
      color: #94a3b8;
      font-size: 0.85rem;
      font-weight: 500;
      cursor: pointer;
      width: 100%;
      text-align: left;
      transition: all 0.2s;
    }

    .sidebar-item:hover {
      background: rgba(255, 255, 255, 0.06);
      color: #ffffff;
    }

    .sidebar-item.active {
      background: #2563eb;
      color: #ffffff;
      font-weight: 600;
      box-shadow: 0 2px 6px rgba(37, 99, 235, 0.4);
    }

    .item-icon {
      font-size: 1.15rem;
      min-width: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .item-label {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .sidebar-bottom {
      padding: 14px 10px;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
    }

    .collapse-toggle-btn {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 14px;
      background: none;
      border: none;
      color: #94a3b8;
      font-size: 0.84rem;
      cursor: pointer;
      border-radius: 6px;
      transition: all 0.2s;
    }

    .collapse-toggle-btn:hover {
      color: #ffffff;
      background: rgba(255, 255, 255, 0.05);
    }

    .collapse-arrow {
      font-size: 1.3rem;
      font-weight: bold;
      transition: transform 0.2s;
    }

    .collapse-arrow.flipped {
      transform: rotate(180deg);
    }

    /* MAIN WORKSPACE */
    .main-workspace {
      flex: 1;
      overflow-y: auto;
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      background: #f1f5f9;
    }

    /* WORKSPACE HEADER */
    .workspace-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 16px;
    }

    .title-with-pill {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .category-icon-large {
      font-size: 1.6rem;
    }

    .page-title {
      font-size: 1.6rem;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.5px;
      margin: 0;
    }

    .page-subtitle {
      font-size: 0.88rem;
      color: #64748b;
      margin: 4px 0 0;
    }

    .btn-create-template {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 18px;
      background: #2563eb;
      color: #ffffff;
      border: none;
      border-radius: 8px;
      font-size: 0.88rem;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(37, 99, 235, 0.3);
      transition: all 0.2s;
    }

    .btn-create-template:hover {
      background: #1d4ed8;
      box-shadow: 0 4px 14px rgba(37, 99, 235, 0.4);
      transform: translateY(-1px);
    }

    .plus-sign {
      font-size: 1.2rem;
      line-height: 1;
    }

    /* 3-COLUMN DESIGNER GRID */
    .designer-grid {
      display: grid;
      grid-template-columns: 290px minmax(0, 1fr) 320px;
      gap: 16px;
      align-items: start;
      width: 100%;
      min-width: 0;
    }

    .designer-left-col {
      position: sticky;
      top: 16px;
      max-height: calc(100vh - 110px);
      overflow-y: auto;
      padding-right: 4px;
      display: flex;
      flex-direction: column;
      scrollbar-width: thin;
      scrollbar-color: #cbd5e1 transparent;
    }

    .designer-left-col::-webkit-scrollbar {
      width: 5px;
    }

    .designer-left-col::-webkit-scrollbar-track {
      background: transparent;
    }

    .designer-left-col::-webkit-scrollbar-thumb {
      background: #cbd5e1;
      border-radius: 4px;
    }

    .designer-left-col::-webkit-scrollbar-thumb:hover {
      background: #94a3b8;
    }

    .designer-center-col {
      min-width: 0;
    }

    .designer-right-col {
      position: sticky;
      top: 16px;
      max-height: calc(100vh - 110px);
      display: flex;
      flex-direction: column;
    }

    /* Fullscreen invoice clone styling */
    .fullscreen-invoice-wrapper {
      background: #ffffff;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
      border-radius: 4px;
      padding: 30px;
      max-width: 820px;
      width: 100%;
    }

    /* TOAST NOTIFICATION */
    .toast-notification {
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: #0f172a;
      color: #ffffff;
      padding: 12px 20px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      gap: 10px;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.25);
      z-index: 3000;
      font-size: 0.88rem;
      font-weight: 500;
    }

    .toast-icon {
      font-size: 1.1rem;
    }

    /* Responsive */
    @media (min-width: 1441px) {
      .designer-grid {
        grid-template-columns: 300px minmax(0, 1fr) 330px;
        gap: 16px;
      }
    }

    @media (max-width: 1440px) and (min-width: 1101px) {
      .main-workspace {
        padding: 16px 20px;
        gap: 14px;
      }
      .designer-grid {
        grid-template-columns: 275px minmax(0, 1fr) 310px;
        gap: 12px;
      }
    }

    @media (max-width: 1200px) and (min-width: 1025px) {
      .left-sidebar:not(.collapsed) {
        width: 64px;
      }
      .left-sidebar:not(.collapsed) .item-label,
      .left-sidebar:not(.collapsed) .collapse-toggle-btn span:not(.collapse-arrow) {
        display: none;
      }
    }

    @media (max-width: 1100px) and (min-width: 769px) {
      .main-workspace {
        padding: 14px 16px;
      }
      .designer-grid {
        grid-template-columns: 260px minmax(0, 1fr);
        gap: 14px;
      }
      .designer-right-col {
        grid-column: 1 / -1;
        position: static;
        max-height: none;
      }
      .designer-left-col {
        position: static;
        max-height: none;
        overflow-y: visible;
      }
    }

    @media (max-width: 768px) {
      .top-nav {
        padding: 0 12px;
        height: 54px;
      }
      .search-box {
        display: none;
      }
      .btn-u2tools span:last-child {
        display: none;
      }
      .main-workspace {
        padding: 12px;
        gap: 12px;
      }
      .workspace-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 10px;
      }
      .designer-grid {
        grid-template-columns: 1fr;
        gap: 14px;
      }
      .designer-left-col,
      .designer-right-col {
        position: static;
        max-height: none;
        overflow-y: visible;
      }
    }
  `]
})
export class BillingTemplateDesignerComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private stateService = inject(BillingTemplateStateService);
  private printPdfService = inject(InvoicePrintPdfService);

  private sub = new Subscription();

  templates: InvoiceTemplate[] = [];
  categories: TemplateCategory[] = [];
  activeTemplate: InvoiceTemplate | null = null;
  activeCategory = 'Mahal Templates';
  searchQuery = '';
  totals!: InvoiceTotals;

  sidebarCollapsed = false;
  activeSidebarKey = 'templates';

  sidebarItems = [
    { key: 'dashboard', label: 'Dashboard', icon: '🏠' },
    { key: 'invoices', label: 'Invoices', icon: '📄' },
    { key: 'templates', label: 'Billing Templates', icon: '📋' },
    { key: 'customers', label: 'Customers', icon: '👥' },
    { key: 'items', label: 'Items / Services', icon: '📦' },
    { key: 'default_settings', label: 'Default Settings', icon: '⚙️' },
    { key: 'reports', label: 'Reports', icon: '📊' },
    { key: 'settings', label: 'Settings', icon: '🔧' },
  ];

  // Modals state
  isItemModalOpen = false;
  selectedItemForEdit: InvoiceItem | null = null;
  isNewItemMode = false;

  isCategoryModalOpen = false;
  isCreateModalOpen = false;
  isPageSetupModalOpen = false;
  isFullscreenPreviewOpen = false;
  isInvoiceGeneratorModalOpen = false;

  // Toast
  toastMessage = '';
  toastIcon = '✅';
  private toastTimer: any;

  ngOnInit(): void {
    this.sub.add(
      this.stateService.templates$.subscribe((tpls) => {
        this.templates = tpls;
        this.refreshTotals();
      })
    );

    this.sub.add(
      this.stateService.categories$.subscribe((cats) => {
        this.categories = cats;
      })
    );

    this.sub.add(
      this.stateService.activeTemplate$.subscribe((active) => {
        this.activeTemplate = active;
        this.refreshTotals();
      })
    );

    this.sub.add(
      this.stateService.activeCategory$.subscribe((cat) => {
        this.activeCategory = cat;
      })
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
    if (this.toastTimer) clearTimeout(this.toastTimer);
  }

  refreshTotals(): void {
    if (this.activeTemplate) {
      this.totals = this.stateService.calculateTotals(this.activeTemplate);
    }
  }

  toggleSidebar(): void {
    this.sidebarCollapsed = !this.sidebarCollapsed;
  }

  navigateToHome(): void {
    this.router.navigate(['/']);
  }

  onSidebarClick(key: string): void {
    this.activeSidebarKey = key;
    if (key === 'dashboard') {
      this.showToast('Navigating to Dashboard overview...', '📊');
    } else if (key === 'invoices') {
      this.openInvoiceGeneratorModal();
    } else if (key === 'default_settings') {
      this.onApplyDefaultPreset();
    } else if (key === 'items') {
      this.openAddItemModal();
    } else {
      this.showToast(`Switched to ${key.replace('_', ' ')} module.`, 'ℹ️');
    }
  }

  onSearchChange(query: string): void {
    this.searchQuery = query;
    this.stateService.setSearchQuery(query);
  }

  onSelectCategory(categoryName: string): void {
    this.activeCategory = categoryName;
    this.stateService.setActiveCategory(categoryName);
  }

  onSelectTemplate(templateId: string): void {
    this.stateService.selectTemplate(templateId);
    this.showToast('Template loaded in live designer', '✨');
  }

  onToggleFavorite(templateId: string): void {
    this.stateService.toggleFavorite(templateId);
  }

  onSetAsDefault(templateId: string): void {
    this.stateService.setAsDefault(templateId);
    this.showToast('Template set as primary default', '⭐');
  }

  onTemplateChanged(updated: InvoiceTemplate): void {
    this.activeTemplate = updated;
    this.refreshTotals();
  }

  onSaveTemplateChanges(): void {
    if (!this.activeTemplate) return;
    this.stateService.saveTemplate(this.activeTemplate);
    this.showToast('Template changes successfully saved!', '💾');
  }

  onDuplicateTemplate(templateId: string): void {
    const cloned = this.stateService.duplicateTemplate(templateId);
    if (cloned) {
      this.showToast(`Duplicated: ${cloned.name}`, '📑');
    }
  }

  onDeleteTemplate(templateId: string): void {
    if (confirm('Are you sure you want to delete this template?')) {
      const ok = this.stateService.deleteTemplate(templateId);
      if (ok) {
        this.showToast('Template deleted successfully', '🗑️');
      } else {
        alert('Cannot delete the only remaining template.');
      }
    }
  }

  onExportTemplate(template: InvoiceTemplate): void {
    this.stateService.exportTemplateAsJson(template);
    this.showToast('Template exported to JSON file', '⬇️');
  }

  onImportTemplate(jsonString: string): void {
    try {
      const imported = this.stateService.importTemplateFromJson(jsonString);
      this.showToast(`Imported "${imported.name}" successfully`, '⬆️');
    } catch (e) {
      alert('Invalid template JSON file. Please check format.');
    }
  }

  onResetDefaults(): void {
    if (confirm('Reset all templates to factory defaults? Any custom templates will be re-initialized.')) {
      this.stateService.resetToDefaultTemplates();
      this.showToast('All templates reset to defaults', '🔄');
    }
  }

  onApplyDefaultPreset(): void {
    this.stateService.applyDefaultPresetToActiveTemplate();
    this.showToast('Applied stored business details preset', '⚡');
  }

  onSaveAsDefaultPreset(): void {
    if (!this.activeTemplate) return;
    this.stateService.saveDefaultPreset({
      businessInfo: { ...this.activeTemplate.businessInfo },
      paymentDetails: { ...this.activeTemplate.paymentDetails },
      termsAndConditions: [...this.activeTemplate.termsAndConditions],
      notesRemarks: this.activeTemplate.notesRemarks,
    });
    this.showToast('Current business info saved as standard default preset!', '✅');
  }

  // Row operations
  openAddItemModal(): void {
    this.isNewItemMode = true;
    this.selectedItemForEdit = null;
    this.isItemModalOpen = true;
  }

  openEditItemModal(item: InvoiceItem): void {
    this.isNewItemMode = false;
    this.selectedItemForEdit = item;
    this.isItemModalOpen = true;
  }

  onSaveItem(item: InvoiceItem): void {
    if (!this.activeTemplate) return;

    if (this.isNewItemMode) {
      item.sNo = this.activeTemplate.items.length + 1;
      this.activeTemplate.items.push(item);
    } else {
      const idx = this.activeTemplate.items.findIndex((i) => i.id === item.id);
      if (idx !== -1) {
        this.activeTemplate.items[idx] = item;
      }
    }
    this.refreshTotals();
    this.showToast(this.isNewItemMode ? 'Item added to invoice' : 'Item updated', '📝');
  }

  onDuplicateItem(): void {
    if (!this.activeTemplate || this.activeTemplate.items.length === 0) return;
    const last = this.activeTemplate.items[this.activeTemplate.items.length - 1];
    const clone: InvoiceItem = {
      ...last,
      id: 'item-' + Date.now(),
      sNo: this.activeTemplate.items.length + 1,
      description: `${last.description} (Copy)`,
    };
    this.activeTemplate.items.push(clone);
    this.refreshTotals();
    this.showToast('Row duplicated', '📑');
  }

  // Category & Create Template Modals
  openAddCategoryModal(): void {
    this.isCategoryModalOpen = true;
  }

  onSaveCategory(data: { name: string; icon: string }): void {
    this.stateService.addCategory(data.name, data.icon);
    this.showToast(`Category "${data.name}" added`, '📁');
  }

  openCreateModal(): void {
    this.isCreateModalOpen = true;
  }

  onCreateTemplate(data: { name: string; category: string; description: string }): void {
    const created = this.stateService.createTemplate(data.category, data.name);
    if (data.description) {
      created.description = data.description;
      this.stateService.saveTemplate(created);
    }
    this.showToast(`Created "${created.name}"`, '✨');
  }

  openPageSetupModal(): void {
    this.isPageSetupModalOpen = true;
  }

  openFullscreenPreviewModal(): void {
    this.isFullscreenPreviewOpen = true;
  }

  openInvoiceGeneratorModal(): void {
    this.isInvoiceGeneratorModalOpen = true;
  }

  // Toolbar shortcuts
  onEditLayoutTriggered(): void {
    this.showToast('Choose Layout style in the right settings tab', '🎨');
  }

  onColorsTriggered(): void {
    this.showToast('Adjust palette under Color Theme section', '🎨');
  }

  onFontsTriggered(): void {
    this.showToast('Change font and size under Font Style section', '🔤');
  }

  // Print & PDF
  onPrintInvoice(elementId: string): void {
    this.printPdfService.printInvoice(elementId);
  }

  onDownloadPdf(): void {
    if (!this.activeTemplate) return;
    this.printPdfService.downloadPdf(this.activeTemplate, this.totals, 'billing-invoice-sheet');
    this.showToast('Generating and downloading PDF...', '📄');
  }

  showHelpToast(): void {
    this.showToast('Tip: Use live toolbar to print, download, or edit invoice rows inline!', '💡');
  }

  showToast(message: string, icon = '✅'): void {
    this.toastMessage = message;
    this.toastIcon = icon;
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.toastMessage = '';
    }, 3500);
  }
}
