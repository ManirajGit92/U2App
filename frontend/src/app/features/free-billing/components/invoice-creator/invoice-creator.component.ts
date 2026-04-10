import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BillingStateService } from '../../services/billing-state.service';
import { ReceiptPdfService } from '../../services/receipt-pdf.service';
import { Product, Customer, Invoice, InvoiceItem } from '../../models/billing.models';

@Component({
  selector: 'app-invoice-creator',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="invoice-container">
      <div class="invoice-list-toggle">
        <button class="btn" [class.btn-primary]="viewMode==='create'" [class.btn-secondary]="viewMode!=='create'" (click)="viewMode='create'">Create New Invoice</button>
        <button class="btn" [class.btn-primary]="viewMode==='history'" [class.btn-secondary]="viewMode!=='history'" (click)="viewMode='history'">Invoice History</button>
      </div>

      <div *ngIf="viewMode === 'create'" class="invoice-form glass-card">
        <div class="form-row">
          <div class="form-group flex-1">
            <label>Select Customer</label>
            <select [(ngModel)]="selectedCustomerId" class="input-field">
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

        <div class="add-item-section">
          <h3>Add Product</h3>
          <div class="add-item-grid">
            <select [(ngModel)]="curItem.productId" (change)="onProductSelect()" class="input-field">
              <option value="">-- Choose Product --</option>
              <option *ngFor="let p of availableProducts" [value]="p.id">{{ p.name }} (₹{{ p.price }} | Stock: {{ p.stock }})</option>
            </select>
            <input type="number" [(ngModel)]="curItem.quantity" class="input-field" placeholder="Qty" min="1" (change)="calcCurrentItem()">
            <select [(ngModel)]="curItem.discountMode" class="input-field" (change)="calcCurrentItem()">
              <option value="FIXED">Fixed Discount (₹)</option>
              <option value="PERCENTAGE">Percentage (%)</option>
            </select>
            <input type="number" [(ngModel)]="curItem.discountValue" class="input-field" placeholder="Discount" min="0" (change)="calcCurrentItem()">
            <input type="number" [(ngModel)]="curItem.taxRate" class="input-field" placeholder="Tax %" min="0" (change)="calcCurrentItem()">
            <button class="btn btn-secondary" (click)="addItem()" [disabled]="!curItem.productId">Add</button>
          </div>
        </div>

        <div class="items-table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Qty</th>
                <th>Unit Price</th>
                <th>Disc.</th>
                <th>Tax</th>
                <th>Total</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let item of invoiceItems; let i = index">
                <td>{{ item.productName }}</td>
                <td>{{ item.quantity }}</td>
                <td>₹{{ item.unitPrice }}</td>
                <td>₹{{ item.discountValue | number:'1.2-2' }}</td>
                <td>₹{{ item.taxAmount | number:'1.2-2' }} ({{ item.taxRate }}%)</td>
                <td class="font-bold">₹{{ item.total | number:'1.2-2' }}</td>
                <td><button class="text-danger" style="background:none;border:none;cursor:pointer" (click)="removeItem(i)">✕</button></td>
              </tr>
              <tr *ngIf="invoiceItems.length === 0">
                <td colspan="7" style="text-align:center; padding: 20px;">No items added to invoice.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="invoice-summary">
          <div class="summary-row"><span>Sub Total:</span> <span>₹{{ subTotal | number:'1.2-2' }}</span></div>
          <div class="summary-row"><span>Total Tax:</span> <span>₹{{ taxTotal | number:'1.2-2' }}</span></div>
          <div class="summary-row"><span>Total Discount:</span> <span>-₹{{ discountTotal | number:'1.2-2' }}</span></div>
          <div class="summary-row grand-total"><span>Grand Total:</span> <span>₹{{ grandTotal | number:'1.2-2' }}</span></div>
        </div>

        <div class="form-group" style="margin-top: 24px;">
          <label>Additional Notes (Printed on Receipt)</label>
          <textarea [(ngModel)]="notes" class="input-field" style="height: 60px;"></textarea>
        </div>

        <div class="form-actions">
          <button class="btn btn-primary btn-lg" (click)="finalizeInvoice()" [disabled]="invoiceItems.length === 0 || !selectedCustomerId">Confirm & Generate Receipt</button>
        </div>
      </div>

      <!-- History Mode -->
      <div *ngIf="viewMode === 'history'" class="invoice-history glass-card">
        <h3>Invoice History</h3>
        <table class="data-table">
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
            <tr *ngFor="let inv of pastInvoices">
              <td>{{ inv.id }}</td>
              <td>{{ inv.date | date:'short' }}</td>
              <td>{{ inv.customerName }}</td>
              <td>{{ inv.items.length }}</td>
              <td class="font-bold text-primary">₹{{ inv.grandTotal | number:'1.2-2' }}</td>
              <td>{{ inv.paymentMethod }}</td>
              <td>
                <button class="btn btn-sm btn-secondary" (click)="downloadReceipt(inv)">📥 PDF</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `,
  styles: [`
    .invoice-container { display: flex; flex-direction: column; gap: 24px; }
    .invoice-list-toggle { display: flex; gap: 12px; }
    .invoice-form, .invoice-history { padding: 32px; border-radius: var(--radius-lg); }
    .form-row { display: flex; gap: 24px; margin-bottom: 24px; }
    .flex-1 { flex: 1; }
    .form-group { display: flex; flex-direction: column; gap: 8px; }
    .form-group label { font-size: 0.9rem; color: var(--text-secondary); font-weight: 500; }
    .input-field { padding: 10px; border: 1px solid var(--border-color); border-radius: var(--radius-sm); background: var(--bg-primary); color: var(--text-primary); }
    
    .add-item-section { background: rgba(0,0,0,0.03); padding: 20px; border-radius: var(--radius-md); margin-bottom: 24px; }
    .add-item-section h3 { margin-top: 0; margin-bottom: 16px; font-size: 1.1rem; }
    .add-item-grid { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr 1fr auto; gap: 12px; align-items: center; }
    
    .items-table-wrapper { overflow-x: auto; margin-bottom: 24px; border: 1px solid var(--border-color); border-radius: var(--radius-md); }
    .data-table { width: 100%; border-collapse: collapse; text-align: left; }
    .data-table th, .data-table td { padding: 12px 16px; border-bottom: 1px solid var(--border-color); }
    .data-table th { background: rgba(0,0,0,0.02); font-weight: 600; color: var(--text-secondary); }
    .font-bold { font-weight: 700; }
    .text-primary { color: var(--accent-primary); }
    .text-danger { color: #ef4444; }

    .invoice-summary { display: flex; flex-direction: column; gap: 12px; align-items: flex-end; padding-top: 16px; }
    .summary-row { display: flex; justify-content: space-between; width: 300px; font-size: 1rem; color: var(--text-secondary); }
    .grand-total { font-size: 1.4rem; font-weight: 800; color: var(--text-primary); margin-top: 8px; padding-top: 8px; border-top: 2px solid var(--border-color); }
    
    .form-actions { display: flex; justify-content: flex-end; margin-top: 32px; }
    .btn-lg { padding: 12px 24px; font-size: 1.1rem; }
    .btn-sm { padding: 6px 12px; font-size: 0.85rem; }
    
    @media (max-width: 900px) {
      .add-item-grid { grid-template-columns: 1fr; }
      .form-row { flex-direction: column; }
    }
  `]
})
export class InvoiceCreatorComponent implements OnInit {
  viewMode: 'create' | 'history' = 'create';
  
  customers: Customer[] = [];
  availableProducts: Product[] = [];
  pastInvoices: Invoice[] = [];

  // Form
  selectedCustomerId = '';
  paymentMethod = 'Cash';
  notes = '';
  invoiceItems: InvoiceItem[] = [];
  
  subTotal = 0;
  discountTotal = 0;
  taxTotal = 0;
  grandTotal = 0;

  curItem = {
    productId: '',
    quantity: 1,
    discountMode: 'FIXED',
    discountValue: 0,
    taxRate: 0
  };

  constructor(
    private state: BillingStateService,
    private pdfService: ReceiptPdfService
  ) {}

  ngOnInit() {
    this.state.customers$.subscribe(c => {
      this.customers = c;
      if (c.length && !this.selectedCustomerId) this.selectedCustomerId = c[0].id;
    });
    this.state.products$.subscribe(p => this.availableProducts = p.filter(x => x.stock > 0 && !x.isHidden));
    this.state.invoices$.subscribe(i => this.pastInvoices = i.reverse());
  }

  onProductSelect() {
    this.calcCurrentItem();
  }

  calcCurrentItem() {
    // optional logic before add
  }

  addItem() {
    const p = this.availableProducts.find(x => x.id === this.curItem.productId);
    if (!p) return;

    if (this.curItem.quantity > p.stock) {
      alert(`Cannot add more than available stock (${p.stock})`);
      return;
    }

    const unitPrice = p.price;
    const qty = this.curItem.quantity;
    const totalBeforeTaxAndDiscount = unitPrice * qty;

    let dVal = 0;
    if (this.curItem.discountMode === 'PERCENTAGE') {
      dVal = (totalBeforeTaxAndDiscount * this.curItem.discountValue) / 100;
    } else {
      dVal = this.curItem.discountValue; // fixed
    }

    const totalBeforeTax = totalBeforeTaxAndDiscount - dVal;
    const tVal = (totalBeforeTax * this.curItem.taxRate) / 100;
    const finalTotal = totalBeforeTax + tVal;

    this.invoiceItems.push({
      productId: p.id,
      productName: p.name,
      quantity: qty,
      unitPrice: unitPrice,
      discountMode: this.curItem.discountMode as any,
      discountValue: dVal,
      taxRate: this.curItem.taxRate,
      taxAmount: tVal,
      totalBeforeTax: totalBeforeTax,
      total: finalTotal
    });

    this.calculateTotals();

    // reset
    this.curItem = { productId: '', quantity: 1, discountMode: 'FIXED', discountValue: 0, taxRate: 0 };
  }

  removeItem(index: number) {
    this.invoiceItems.splice(index, 1);
    this.calculateTotals();
  }

  calculateTotals() {
    this.subTotal = this.invoiceItems.reduce((acc, item) => acc + (item.unitPrice * item.quantity), 0);
    this.discountTotal = this.invoiceItems.reduce((acc, item) => acc + item.discountValue, 0);
    this.taxTotal = this.invoiceItems.reduce((acc, item) => acc + item.taxAmount, 0);
    this.grandTotal = this.invoiceItems.reduce((acc, item) => acc + item.total, 0);
  }

  finalizeInvoice() {
    const customer = this.customers.find(c => c.id === this.selectedCustomerId);
    if (!customer) return;

    const invoice: Invoice = {
      id: 'INV-' + Date.now().toString().slice(-6),
      customerId: customer.id,
      customerName: customer.name,
      date: new Date().toISOString(),
      items: [...this.invoiceItems],
      subTotal: this.subTotal,
      discountTotal: this.discountTotal,
      taxTotal: this.taxTotal,
      grandTotal: this.grandTotal,
      paymentMethod: this.paymentMethod,
      notes: this.notes
    };

    // Save to State (Updates stock internally)
    this.state.addInvoice(invoice);

    // Download PDF
    this.pdfService.generateReceipt(invoice);

    // Reset Form
    this.invoiceItems = [];
    this.calculateTotals();
    this.notes = '';
    alert('Invoice finalized and Receipt downloading...');
    this.viewMode = 'history';
  }

  downloadReceipt(inv: Invoice) {
    this.pdfService.generateReceipt(inv);
  }
}
