import { Component, OnInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BillingStateService } from '../../services/billing-state.service';
import { ReceiptPdfService } from '../../services/receipt-pdf.service';
import { BarcodeScanService } from '../../services/barcode-scan.service';
import { OcrScanService } from '../../services/ocr-scan.service';
import { Product, Customer, Invoice, InvoiceItem, Order } from '../../models/billing.models';

@Component({
  selector: 'app-billing',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="billing-wrapper">
      <!-- Saved Orders Accordion -->
      <div class="saved-orders-panel">
        <button class="accordion-toggle" (click)="ordersExpanded = !ordersExpanded">
          <span>📋 Saved Orders ({{ savedOrders.length }})</span>
          <span class="chevron" [class.open]="ordersExpanded">›</span>
        </button>
        <div class="orders-accordion" [class.expanded]="ordersExpanded">
          <div class="orders-scroll">
            <div class="no-orders" *ngIf="savedOrders.length === 0">
              <span>📋</span>
              <p>No saved orders yet. Create orders in the Orders section.</p>
            </div>
            <div class="order-card" *ngFor="let o of savedOrders"
                 [class.active]="activeOrderId === o.id"
                 [class.billed]="o.status === 'billed'"
                 (click)="loadOrder(o)">
              <div class="order-card-thumb">
                <img *ngIf="o.imageUrl" [src]="o.imageUrl" [alt]="o.name">
                <div *ngIf="!o.imageUrl" class="order-thumb-placeholder">🛍️</div>
              </div>
              <div class="order-card-info">
                <span class="order-card-name">{{ o.name }} <span class="demo-badge" *ngIf="o.isDemo">Demo</span></span>
                <span class="order-card-date">{{ o.date | date:'MMM d, yyyy' }}</span>
                <div class="order-card-meta">
                  <div class="emp-chip" *ngIf="o.employeePhoto">
                    <img [src]="o.employeePhoto" [alt]="o.employeeName" class="emp-chip-img">
                    <span>{{ o.employeeName }}</span>
                  </div>
                  <span class="order-card-total">₹{{ o.grandTotal | number:'1.2-2' }}</span>
                </div>
              </div>
              <span class="order-status-dot" [class.billed]="o.status === 'billed'" title="{{ o.status }}"></span>
            </div>
          </div>
        </div>
      </div>

      <!-- Main Billing Area -->
      <div class="billing-main">
        <div class="billing-toolbar">
          <div class="billing-tabs">
            <button class="tab-btn" [class.active]="viewMode === 'create'" (click)="viewMode = 'create'">
              🧾 Create Bill
            </button>
            <button class="tab-btn" [class.active]="viewMode === 'history'" (click)="viewMode = 'history'">
              📜 History
            </button>
          </div>
          <div class="scan-actions" *ngIf="viewMode === 'create'">
            <button class="scan-btn barcode-btn" (click)="openBarcodeScanner()" title="Scan Barcode / QR Code">
              🔲 Scan
            </button>
            <button class="scan-btn ocr-btn" (click)="ocrFileInput.click()" title="Detect Products from Image">
              📷 Detect
            </button>
            <input #ocrFileInput type="file" accept="image/*" style="display:none" (change)="onOcrImageSelect($event)">
          </div>
        </div>

        <!-- CREATE BILL MODE -->
        <div *ngIf="viewMode === 'create'" class="bill-form">
          <div class="form-row">
            <div class="form-group flex-1">
              <label>Customer</label>
              <select [(ngModel)]="selectedCustomerId" class="input-field">
                <option value="">-- Select Customer --</option>
                <option *ngFor="let c of customers" [value]="c.id">{{ c.name }} ({{ c.phone }})</option>
              </select>
            </div>
            <div class="form-group flex-1">
              <label>Payment Method</label>
              <select [(ngModel)]="paymentMethod" class="input-field">
                <option value="Cash">Cash</option>
                <option value="Card">Card</option>
                <option value="UPI">UPI</option>
                <option value="Bank Transfer">Bank Transfer</option>
              </select>
            </div>
          </div>

          <!-- Linked Order Banner -->
          <div class="linked-order-banner" *ngIf="linkedOrder">
            <span>📋 Loaded from order: <strong>{{ linkedOrder.name }}</strong></span>
            <button class="clear-link-btn" (click)="clearLinkedOrder()">✕ Clear</button>
          </div>

          <!-- Add Product Row -->
          <div class="add-item-section">
            <h4>Add Product</h4>
            <div class="add-item-grid">
              <select [(ngModel)]="curItem.productId" (change)="onProductSelect()" class="input-field">
                <option value="">-- Choose Product --</option>
                <option *ngFor="let p of allProducts" [value]="p.id">
                  {{ p.name }} (₹{{ p.price }} | Stock: {{ p.stock }})
                </option>
              </select>
              <input type="number" [(ngModel)]="curItem.quantity" class="input-field" placeholder="Qty" min="1">
              <select [(ngModel)]="curItem.discountMode" class="input-field">
                <option value="FIXED">Fixed Disc (₹)</option>
                <option value="PERCENTAGE">% Disc</option>
              </select>
              <input type="number" [(ngModel)]="curItem.discountValue" class="input-field" placeholder="Discount" min="0">
              <input type="number" [(ngModel)]="curItem.taxRate" class="input-field" placeholder="Tax %" min="0">
              <button class="btn btn-secondary" (click)="addItem()" [disabled]="!curItem.productId">Add</button>
            </div>
          </div>

          <!-- Bill Items Table -->
          <div class="items-table-wrapper">
            <table class="bill-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Qty</th>
                  <th>Unit Price</th>
                  <th>Discount</th>
                  <th>Tax</th>
                  <th>Total</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let item of invoiceItems; let i = index" [class.out-of-stock-row]="item['outOfStock']">
                  <td>
                    <div class="item-name-cell">
                      {{ item.productName }}
                      <span *ngIf="item['outOfStock']" class="oos-badge">Not in Stock</span>
                    </div>
                  </td>
                  <td>{{ item.quantity }}</td>
                  <td>₹{{ item.unitPrice }}</td>
                  <td>₹{{ item.discountValue | number:'1.2-2' }}</td>
                  <td>₹{{ item.taxAmount | number:'1.2-2' }} ({{ item.taxRate }}%)</td>
                  <td class="item-total">₹{{ item.total | number:'1.2-2' }}</td>
                  <td><button class="remove-item-btn" (click)="removeItem(i)">✕</button></td>
                </tr>
                <tr *ngIf="invoiceItems.length === 0">
                  <td colspan="7" class="empty-row">No items added. Use the form above, scan a barcode, or load a saved order.</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Totals -->
          <div class="bill-summary">
            <div class="summary-row"><span>Sub Total:</span><span>₹{{ subTotal | number:'1.2-2' }}</span></div>
            <div class="summary-row"><span>Total Discount:</span><span>-₹{{ discountTotal | number:'1.2-2' }}</span></div>
            <div class="summary-row"><span>Total Tax:</span><span>₹{{ taxTotal | number:'1.2-2' }}</span></div>
            <div class="summary-row grand-total"><span>Grand Total:</span><span>₹{{ grandTotal | number:'1.2-2' }}</span></div>
          </div>

          <div class="form-group" style="margin-top:12px">
            <label>Notes</label>
            <textarea [(ngModel)]="notes" class="input-field notes-area" placeholder="Additional notes printed on receipt..."></textarea>
          </div>

          <div class="bill-actions">
            <button class="btn btn-primary btn-confirm" (click)="finalizeInvoice()" [disabled]="invoiceItems.length === 0 || !selectedCustomerId">
              ✅ Confirm & Generate Receipt
            </button>
          </div>
        </div>

        <!-- HISTORY MODE -->
        <div *ngIf="viewMode === 'history'" class="invoice-history">
          <div class="history-search">
            <input type="text" [(ngModel)]="historySearch" (ngModelChange)="filterInvoices()" class="input-field" placeholder="🔍 Search invoices...">
          </div>
          <div class="history-table-wrap">
            <table class="bill-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Items</th>
                  <th>Total</th>
                  <th>Method</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let inv of filteredInvoices">
                  <td class="inv-id">{{ inv.id }} <span class="demo-badge" *ngIf="inv.isDemo">Demo</span></td>
                  <td>{{ inv.date | date:'short' }}</td>
                  <td>{{ inv.customerName }}</td>
                  <td>{{ inv.items.length }}</td>
                  <td class="item-total">₹{{ inv.grandTotal | number:'1.2-2' }}</td>
                  <td>{{ inv.paymentMethod }}</td>
                  <td><button class="btn btn-sm btn-secondary" (click)="downloadReceipt(inv)">📥 PDF</button></td>
                </tr>
                <tr *ngIf="filteredInvoices.length === 0">
                  <td colspan="7" class="empty-row">No billing history.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Barcode Scanner Modal -->
      <div class="modal-overlay" *ngIf="showScanModal" (click)="closeScanModal()">
        <div class="scan-modal" (click)="$event.stopPropagation()">
          <div class="scan-modal-header">
            <h3>🔲 Scan Barcode / QR Code</h3>
            <button class="modal-close" (click)="closeScanModal()">✕</button>
          </div>
          <div class="video-wrapper">
            <video #scanVideo class="scan-video" playsinline autoplay muted></video>
            <div class="scan-overlay-frame"></div>
          </div>
          <p class="scan-hint">Point the camera at a barcode or QR code</p>
          <div class="scan-status" [class.success]="scanSuccess" *ngIf="scanStatusMsg">{{ scanStatusMsg }}</div>
        </div>
      </div>

      <!-- OCR Processing Overlay -->
      <div class="modal-overlay" *ngIf="isProcessingOcr">
        <div class="ocr-modal">
          <div class="ocr-spinner"></div>
          <h3>Detecting Products...</h3>
          <p>Extracting text from image using OCR</p>
        </div>
      </div>

      <!-- Toast -->
      <div class="toast" *ngIf="showToast">{{ toastMessage }}</div>
    </div>
  `,
  styles: [`
    .billing-wrapper { display: flex; flex-direction: column; gap: 16px; }

    /* Saved Orders Accordion */
    .saved-orders-panel { background: var(--surface-card); border: 1px solid var(--border-color); border-radius: var(--radius-lg); overflow: hidden; }
    .accordion-toggle {
      width: 100%; display: flex; justify-content: space-between; align-items: center;
      padding: 14px 20px; background: none; border: none; cursor: pointer;
      font-size: 1rem; font-weight: 700; color: var(--text-primary); transition: background 0.2s;
    }
    .accordion-toggle:hover { background: rgba(0,0,0,0.03); }
    .chevron { font-size: 1.4rem; transition: transform 0.3s; display: inline-block; transform: rotate(90deg); }
    .chevron.open { transform: rotate(-90deg); }
    .orders-accordion { max-height: 0; overflow: hidden; transition: max-height 0.4s ease; }
    .orders-accordion.expanded { max-height: 260px; }
    .orders-scroll { display: flex; gap: 12px; padding: 12px 16px 16px; overflow-x: auto; }
    .no-orders { padding: 20px; text-align: center; color: var(--text-tertiary); font-size: 0.9rem; }
    .order-card {
      flex-shrink: 0; width: 200px; background: var(--bg-primary); border: 2px solid var(--border-color);
      border-radius: var(--radius-md); padding: 12px; cursor: pointer; transition: all 0.2s; position: relative;
      display: flex; flex-direction: column; gap: 8px;
    }
    .order-card:hover { border-color: var(--accent-primary); transform: translateY(-2px); }
    .order-card.active { border-color: var(--accent-primary); background: rgba(var(--accent-primary-rgb),0.05); }
    .order-card.billed { opacity: 0.6; }
    .order-card-thumb { width: 100%; height: 80px; border-radius: var(--radius-sm); overflow: hidden; background: var(--surface-card); display: flex; align-items: center; justify-content: center; font-size: 2rem; }
    .order-card-thumb img { width: 100%; height: 100%; object-fit: cover; }
    .order-thumb-placeholder { font-size: 2rem; }
    .order-card-info { display: flex; flex-direction: column; gap: 3px; }
    .order-card-name { font-weight: 700; font-size: 0.9rem; color: var(--text-primary); }
    .demo-badge { background: #8b5cf6; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.65rem; margin-left: 6px; vertical-align: middle; }
    .order-card-date { font-size: 0.75rem; color: var(--text-tertiary); }
    .order-card-meta { display: flex; justify-content: space-between; align-items: center; }
    .emp-chip { display: flex; align-items: center; gap: 4px; font-size: 0.75rem; color: var(--text-secondary); }
    .emp-chip-img { width: 18px; height: 18px; border-radius: 50%; object-fit: cover; }
    .order-card-total { font-weight: 700; font-size: 0.9rem; color: var(--accent-primary); }
    .order-status-dot { position: absolute; top: 10px; right: 10px; width: 10px; height: 10px; border-radius: 50%; background: #f59e0b; }
    .order-status-dot.billed { background: #10b981; }

    /* Main Billing */
    .billing-main { background: var(--surface-card); border: 1px solid var(--border-color); border-radius: var(--radius-lg); overflow: hidden; }
    .billing-toolbar { display: flex; justify-content: space-between; align-items: center; padding: 12px 20px; border-bottom: 1px solid var(--border-color); flex-wrap: wrap; gap: 10px; }
    .billing-tabs { display: flex; gap: 4px; }
    .tab-btn { padding: 8px 18px; border-radius: var(--radius-md); border: none; cursor: pointer; font-weight: 600; font-size: 0.9rem; transition: all 0.2s; background: transparent; color: var(--text-secondary); }
    .tab-btn.active { background: var(--accent-primary); color: white; }
    .scan-actions { display: flex; gap: 8px; }
    .scan-btn { padding: 8px 14px; border: none; border-radius: var(--radius-md); cursor: pointer; font-weight: 700; font-size: 0.85rem; transition: all 0.2s; }
    .barcode-btn { background: rgba(99,102,241,0.1); color: #6366f1; }
    .barcode-btn:hover { background: rgba(99,102,241,0.2); }
    .ocr-btn { background: rgba(168,85,247,0.1); color: #a855f7; }
    .ocr-btn:hover { background: rgba(168,85,247,0.2); }

    /* Bill Form */
    .bill-form { padding: 20px; display: flex; flex-direction: column; gap: 16px; }
    .form-row { display: flex; gap: 16px; flex-wrap: wrap; }
    .flex-1 { flex: 1; min-width: 200px; }
    .form-group { display: flex; flex-direction: column; gap: 6px; }
    .form-group label { font-size: 0.82rem; font-weight: 600; color: var(--text-secondary); }
    .input-field { padding: 9px 12px; border: 1px solid var(--border-color); border-radius: var(--radius-sm); background: var(--bg-primary); color: var(--text-primary); font-size: 0.9rem; width: 100%; }
    .input-field:focus { outline: none; border-color: var(--accent-primary); }

    .linked-order-banner {
      display: flex; justify-content: space-between; align-items: center;
      padding: 10px 14px; background: rgba(var(--accent-primary-rgb),0.08);
      border: 1px solid rgba(var(--accent-primary-rgb),0.3); border-radius: var(--radius-md);
      font-size: 0.9rem; color: var(--text-primary);
    }
    .clear-link-btn { background: none; border: none; cursor: pointer; color: var(--text-secondary); font-size: 0.85rem; }
    .clear-link-btn:hover { color: #ef4444; }

    .add-item-section { background: rgba(0,0,0,0.03); border-radius: var(--radius-md); padding: 14px; }
    .add-item-section h4 { margin: 0 0 10px; font-size: 0.95rem; color: var(--text-secondary); }
    .add-item-grid { display: grid; grid-template-columns: 2fr 0.8fr 1.2fr 1fr 0.8fr auto; gap: 10px; align-items: end; }

    .items-table-wrapper { overflow-x: auto; border: 1px solid var(--border-color); border-radius: var(--radius-md); }
    .bill-table { width: 100%; border-collapse: collapse; }
    .bill-table th, .bill-table td { padding: 10px 12px; border-bottom: 1px solid var(--border-color); text-align: left; }
    .bill-table th { background: rgba(0,0,0,0.02); font-size: 0.82rem; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.4px; }
    .item-total { font-weight: 700; color: var(--accent-primary); }
    .item-name-cell { display: flex; flex-direction: column; gap: 2px; }
    .oos-badge { display: inline-block; background: rgba(239,68,68,0.1); color: #ef4444; font-size: 0.7rem; font-weight: 700; padding: 2px 6px; border-radius: 4px; }
    .out-of-stock-row { background: rgba(239,68,68,0.03); }
    .remove-item-btn { background: none; border: none; cursor: pointer; color: var(--text-tertiary); font-size: 0.9rem; padding: 4px 6px; border-radius: 4px; transition: color 0.15s; }
    .remove-item-btn:hover { color: #ef4444; }
    .empty-row { text-align: center; padding: 24px; color: var(--text-tertiary); font-size: 0.9rem; }

    .bill-summary { display: flex; flex-direction: column; gap: 8px; align-items: flex-end; padding-top: 12px; }
    .summary-row { display: flex; justify-content: space-between; width: 280px; font-size: 0.95rem; color: var(--text-secondary); }
    .grand-total { font-size: 1.4rem; font-weight: 800; color: var(--text-primary); padding-top: 8px; margin-top: 4px; border-top: 2px solid var(--border-color); }
    .notes-area { height: 60px; resize: vertical; }

    .bill-actions { display: flex; justify-content: flex-end; }
    .btn-confirm { padding: 12px 28px; font-size: 1rem; }

    /* History */
    .invoice-history { padding: 20px; }
    .history-search { margin-bottom: 12px; }
    .history-table-wrap { overflow-x: auto; border: 1px solid var(--border-color); border-radius: var(--radius-md); }
    .inv-id { font-family: monospace; font-size: 0.85rem; color: var(--text-secondary); }

    /* Scan Modal */
    .modal-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,0.7);
      display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 16px;
    }
    .scan-modal {
      background: var(--surface-card); border-radius: var(--radius-lg); width: 100%; max-width: 480px;
      box-shadow: 0 24px 48px rgba(0,0,0,0.3);
    }
    .scan-modal-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid var(--border-color); }
    .scan-modal-header h3 { margin: 0; font-size: 1.1rem; }
    .modal-close { background: none; border: none; cursor: pointer; font-size: 1.2rem; color: var(--text-secondary); }
    .video-wrapper { position: relative; background: #000; margin: 0; aspect-ratio: 4/3; overflow: hidden; }
    .scan-video { width: 100%; height: 100%; object-fit: cover; }
    .scan-overlay-frame {
      position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%);
      width: 200px; height: 200px; border: 2px solid rgba(99,102,241,0.8);
      box-shadow: 0 0 0 2000px rgba(0,0,0,0.4);
    }
    .scan-hint { text-align: center; padding: 12px; font-size: 0.85rem; color: var(--text-secondary); margin: 0; }
    .scan-status { text-align: center; padding: 8px 16px 16px; font-weight: 600; color: #ef4444; }
    .scan-status.success { color: #10b981; }

    .ocr-modal {
      background: var(--surface-card); border-radius: var(--radius-lg); padding: 40px;
      text-align: center; display: flex; flex-direction: column; align-items: center; gap: 16px;
    }
    .ocr-spinner {
      width: 48px; height: 48px; border: 4px solid rgba(99,102,241,0.2);
      border-top-color: #6366f1; border-radius: 50%; animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .toast {
      position: fixed; bottom: 24px; right: 24px; z-index: 9999;
      background: var(--surface-card); color: var(--text-primary);
      border: 1px solid var(--border-color); padding: 14px 20px; border-radius: var(--radius-md);
      font-weight: 600; box-shadow: 0 8px 24px rgba(0,0,0,0.15);
      animation: slideUp 0.3s ease;
    }
    @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

    .btn { padding: 9px 18px; border-radius: var(--radius-md); border: none; cursor: pointer; font-weight: 600; font-size: 0.9rem; transition: all 0.2s; }
    .btn-primary { background: var(--accent-primary); color: white; }
    .btn-primary:hover:not(:disabled) { opacity: 0.9; }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-secondary { background: var(--bg-primary); border: 1px solid var(--border-color); color: var(--text-primary); }
    .btn-sm { padding: 6px 12px; font-size: 0.82rem; }

    @media (max-width: 900px) {
      .add-item-grid { grid-template-columns: 1fr 1fr; }
      .form-row { flex-direction: column; }
    }
    @media (max-width: 600px) {
      .add-item-grid { grid-template-columns: 1fr; }
    }
  `]
})
export class BillingComponent implements OnInit, OnDestroy {
  @ViewChild('scanVideo') scanVideoRef!: ElementRef<HTMLVideoElement>;

  viewMode: 'create' | 'history' = 'create';
  customers: Customer[] = [];
  allProducts: Product[] = [];
  pastInvoices: Invoice[] = [];
  filteredInvoices: Invoice[] = [];
  savedOrders: Order[] = [];
  ordersExpanded = true;

  selectedCustomerId = '';
  paymentMethod = 'Cash';
  notes = '';
  invoiceItems: (InvoiceItem & { outOfStock?: boolean })[] = [];
  subTotal = 0;
  discountTotal = 0;
  taxTotal = 0;
  grandTotal = 0;

  linkedOrder: Order | null = null;
  activeOrderId: string | null = null;
  historySearch = '';

  curItem = { productId: '', quantity: 1, discountMode: 'FIXED', discountValue: 0, taxRate: 0 };

  // Scanning
  showScanModal = false;
  scanStatusMsg = '';
  scanSuccess = false;
  isProcessingOcr = false;
  showToast = false;
  toastMessage = '';

  constructor(
    private state: BillingStateService,
    private pdfService: ReceiptPdfService,
    private barcodeService: BarcodeScanService,
    private ocrService: OcrScanService
  ) {}

  ngOnInit() {
    this.state.customers$.subscribe(c => {
      this.customers = c;
      if (c.length && !this.selectedCustomerId) this.selectedCustomerId = c[0].id;
    });
    this.state.products$.subscribe(p => this.allProducts = p);
    this.state.invoices$.subscribe(i => {
      this.pastInvoices = [...i].reverse();
      this.filterInvoices();
    });
    this.state.orders$.subscribe(o => {
      this.savedOrders = [...o].reverse();
    });
  }

  ngOnDestroy() {
    this.barcodeService.stopScan();
  }

  filterInvoices() {
    if (!this.historySearch) { this.filteredInvoices = [...this.pastInvoices]; return; }
    const term = this.historySearch.toLowerCase();
    this.filteredInvoices = this.pastInvoices.filter(i =>
      i.id.toLowerCase().includes(term) ||
      i.customerName.toLowerCase().includes(term)
    );
  }

  loadOrder(order: Order) {
    this.linkedOrder = order;
    this.activeOrderId = order.id;
    this.invoiceItems = [];

    order.items.forEach(item => {
      const product = this.allProducts.find(p => p.id === item.productId);
      const inStock = product ? product.stock > 0 : false;
      const unitPrice = item.unitPrice;
      const total = unitPrice * item.quantity;

      this.invoiceItems.push({
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice,
        discountMode: 'FIXED',
        discountValue: 0,
        taxRate: 0,
        taxAmount: 0,
        totalBeforeTax: total,
        total,
        outOfStock: !inStock
      } as any);
    });

    this.calculateTotals();
    this.viewMode = 'create';
    this.toast(`Loaded order: ${order.name}`);
  }

  clearLinkedOrder() {
    this.linkedOrder = null;
    this.activeOrderId = null;
  }

  onProductSelect() { /* can pre-fill tax/price */ }

  addItem() {
    const p = this.allProducts.find(x => x.id === this.curItem.productId);
    if (!p) return;

    const inStock = p.stock > 0;
    const unitPrice = p.price;
    const qty = this.curItem.quantity;
    const baseTotal = unitPrice * qty;

    let dVal = 0;
    if (this.curItem.discountMode === 'PERCENTAGE') {
      dVal = (baseTotal * this.curItem.discountValue) / 100;
    } else {
      dVal = this.curItem.discountValue;
    }
    const totalBeforeTax = baseTotal - dVal;
    const tVal = (totalBeforeTax * this.curItem.taxRate) / 100;
    const finalTotal = totalBeforeTax + tVal;

    this.invoiceItems.push({
      productId: p.id,
      productName: p.name,
      quantity: qty,
      unitPrice,
      discountMode: this.curItem.discountMode as any,
      discountValue: dVal,
      taxRate: this.curItem.taxRate,
      taxAmount: tVal,
      totalBeforeTax,
      total: finalTotal,
      outOfStock: !inStock
    } as any);

    this.calculateTotals();
    this.curItem = { productId: '', quantity: 1, discountMode: 'FIXED', discountValue: 0, taxRate: 0 };
  }

  removeItem(i: number) {
    this.invoiceItems.splice(i, 1);
    this.calculateTotals();
  }

  calculateTotals() {
    this.subTotal = this.invoiceItems.reduce((a, i) => a + i.unitPrice * i.quantity, 0);
    this.discountTotal = this.invoiceItems.reduce((a, i) => a + i.discountValue, 0);
    this.taxTotal = this.invoiceItems.reduce((a, i) => a + i.taxAmount, 0);
    this.grandTotal = this.invoiceItems.reduce((a, i) => a + i.total, 0);
  }

  finalizeInvoice() {
    const customer = this.customers.find(c => c.id === this.selectedCustomerId);
    if (!customer || this.invoiceItems.length === 0) return;

    const invoice: Invoice = {
      id: 'INV-' + Date.now().toString().slice(-6),
      customerId: customer.id,
      customerName: customer.name,
      date: new Date().toISOString(),
      items: this.invoiceItems.map(i => {
        const { outOfStock, ...rest } = i as any;
        return rest as InvoiceItem;
      }),
      subTotal: this.subTotal,
      discountTotal: this.discountTotal,
      taxTotal: this.taxTotal,
      grandTotal: this.grandTotal,
      paymentMethod: this.paymentMethod,
      notes: this.notes,
      orderId: this.linkedOrder?.id
    };

    this.state.addInvoice(invoice);
    this.pdfService.generateReceipt(invoice);

    this.invoiceItems = [];
    this.calculateTotals();
    this.notes = '';
    this.linkedOrder = null;
    this.activeOrderId = null;

    this.toast('Bill finalized! Receipt downloading...');
    setTimeout(() => this.viewMode = 'history', 1000);
  }

  downloadReceipt(inv: Invoice) {
    this.pdfService.generateReceipt(inv);
  }

  // --- Barcode Scanning ---
  async openBarcodeScanner() {
    this.showScanModal = true;
    this.scanStatusMsg = '';
    this.scanSuccess = false;

    // Wait for modal + video element to render
    setTimeout(async () => {
      if (!this.scanVideoRef?.nativeElement) return;
      await this.barcodeService.startScan(
        this.scanVideoRef.nativeElement,
        (value) => this.onBarcodeDetected(value),
        (err) => { this.scanStatusMsg = 'Camera error: ' + (err?.message || err); }
      );
    }, 300);
  }

  onBarcodeDetected(value: string) {
    this.barcodeService.stopScan();
    const product = this.allProducts.find(p => p.id === value || p.barcode === value);

    if (product) {
      this.addProductToBill(product);
      this.scanSuccess = true;
      this.scanStatusMsg = `✅ Added: ${product.name}`;
    } else {
      this.scanStatusMsg = `⚠️ No product found for barcode: ${value}`;
    }

    setTimeout(() => this.closeScanModal(), 2000);
  }

  closeScanModal() {
    this.barcodeService.stopScan();
    this.showScanModal = false;
    this.scanStatusMsg = '';
  }

  addProductToBill(p: Product, qty = 1) {
    const inStock = p.stock > 0;
    const total = p.price * qty;
    this.invoiceItems.push({
      productId: p.id,
      productName: p.name,
      quantity: qty,
      unitPrice: p.price,
      discountMode: 'FIXED',
      discountValue: 0,
      taxRate: 0,
      taxAmount: 0,
      totalBeforeTax: total,
      total,
      outOfStock: !inStock
    } as any);
    this.calculateTotals();
  }

  // --- OCR Detection ---
  async onOcrImageSelect(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    this.isProcessingOcr = true;
    try {
      const lines = await this.ocrService.detectTextFromImage(file);
      let matched = 0;

      lines.forEach(line => {
        const product = this.allProducts.find(p =>
          p.name.toLowerCase().includes(line.toLowerCase()) ||
          line.toLowerCase().includes(p.name.toLowerCase())
        );
        if (product) {
          this.addProductToBill(product);
          matched++;
        }
      });

      this.toast(matched > 0 ? `📷 Detected & added ${matched} product(s)` : '📷 No matching products detected in image');
    } catch (e) {
      this.toast('❌ OCR failed: ' + (e as any)?.message);
    } finally {
      this.isProcessingOcr = false;
      (event.target as HTMLInputElement).value = '';
    }
  }

  toast(msg: string) {
    this.toastMessage = msg;
    this.showToast = true;
    setTimeout(() => this.showToast = false, 3500);
  }
}
