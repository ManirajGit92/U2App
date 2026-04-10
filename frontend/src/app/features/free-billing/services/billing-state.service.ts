import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Product, Customer, Purchase, Invoice, BillingDataExport } from '../models/billing.models';

@Injectable({
  providedIn: 'root'
})
export class BillingStateService {
  private productsSub = new BehaviorSubject<Product[]>([]);
  private customersSub = new BehaviorSubject<Customer[]>([]);
  private purchasesSub = new BehaviorSubject<Purchase[]>([]);
  private invoicesSub = new BehaviorSubject<Invoice[]>([]);

  products$ = this.productsSub.asObservable();
  customers$ = this.customersSub.asObservable();
  purchases$ = this.purchasesSub.asObservable();
  invoices$ = this.invoicesSub.asObservable();

  constructor() {
    this.loadFromLocalStorage(); // initial backup fetch if wanted
  }

  get products() { return this.productsSub.getValue(); }
  get customers() { return this.customersSub.getValue(); }
  get purchases() { return this.purchasesSub.getValue(); }
  get invoices() { return this.invoicesSub.getValue(); }

  // Overwrites all data (used when Excel is uploaded)
  initializeData(data: BillingDataExport) {
    this.productsSub.next(data.products || []);
    this.customersSub.next(data.customers || []);
    this.purchasesSub.next(data.purchases || []);
    this.invoicesSub.next(data.invoices || []);
    this.saveToLocalStorage();
  }

  // --- Products ---
  addProduct(p: Product) {
    const list = [...this.products, p];
    this.productsSub.next(list);
    this.saveToLocalStorage();
  }

  updateProduct(p: Product) {
    const list = this.products.map(item => item.id === p.id ? p : item);
    this.productsSub.next(list);
    this.saveToLocalStorage();
  }

  deleteProduct(id: string) {
    const list = this.products.filter(item => item.id !== id);
    this.productsSub.next(list);
    this.saveToLocalStorage();
  }

  // --- Customers ---
  addCustomer(c: Customer) {
    const list = [...this.customers, c];
    this.customersSub.next(list);
    this.saveToLocalStorage();
  }

  updateCustomer(c: Customer) {
    const list = this.customers.map(item => item.id === c.id ? c : item);
    this.customersSub.next(list);
    this.saveToLocalStorage();
  }

  deleteCustomer(id: string) {
    const list = this.customers.filter(item => item.id !== id);
    this.customersSub.next(list);
    this.saveToLocalStorage();
  }

  // --- Purchases ---
  addPurchase(p: Purchase) {
    const list = [...this.purchases, p];
    this.purchasesSub.next(list);
    
    // Automatically augment the targeted product's stock
    const targetProduct = this.products.find(x => x.id === p.productId);
    if (targetProduct) {
      this.updateProduct({ ...targetProduct, stock: targetProduct.stock + p.quantity });
    } else {
      this.saveToLocalStorage(); // fallback
    }
  }

  // --- Invoices & Sales ---
  addInvoice(inv: Invoice) {
    const list = [...this.invoices, inv];
    this.invoicesSub.next(list);

    // Automatically deplete stock of involved products
    const productUpdates = [...this.products];
    let productsChanged = false;

    // And also increment customer purchase count
    const customerUpdates = [...this.customers];
    let customersChanged = false;

    inv.items.forEach(item => {
      const idx = productUpdates.findIndex(p => p.id === item.productId);
      if (idx !== -1) {
        productUpdates[idx] = { ...productUpdates[idx], stock: productUpdates[idx].stock - item.quantity };
        productsChanged = true;
      }
    });

    const cIdx = customerUpdates.findIndex(c => c.id === inv.customerId);
    if (cIdx !== -1) {
      customerUpdates[cIdx] = { 
        ...customerUpdates[cIdx], 
        totalPurchasedAmount: (customerUpdates[cIdx].totalPurchasedAmount || 0) + inv.grandTotal
      };
      customersChanged = true;
    }

    if (productsChanged) this.productsSub.next(productUpdates);
    if (customersChanged) this.customersSub.next(customerUpdates);

    this.saveToLocalStorage();
  }

  clearData() {
    this.productsSub.next([]);
    this.customersSub.next([]);
    this.purchasesSub.next([]);
    this.invoicesSub.next([]);
    localStorage.removeItem('free-billing-data');
  }

  getExportData(): BillingDataExport {
    return {
      products: this.products,
      customers: this.customers,
      purchases: this.purchases,
      invoices: this.invoices
    };
  }

  private saveToLocalStorage() {
    localStorage.setItem('free-billing-data', JSON.stringify(this.getExportData()));
  }

  private loadFromLocalStorage() {
    const dataStr = localStorage.getItem('free-billing-data');
    if (dataStr) {
      try {
        const data: BillingDataExport = JSON.parse(dataStr);
        this.productsSub.next(data.products || []);
        this.customersSub.next(data.customers || []);
        this.purchasesSub.next(data.purchases || []);
        this.invoicesSub.next(data.invoices || []);
      } catch (e) {
        console.error('Error loading backup billing data', e);
      }
    }
  }
}
