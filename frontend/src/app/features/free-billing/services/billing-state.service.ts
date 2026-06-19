import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Product, Customer, Purchase, Invoice, Employee, Order, BillingDataExport } from '../models/billing.models';
import { FirebaseAuthService } from '../../../core/services/firebase-auth.service';
import { FirebaseSyncService } from '../../../core/services/firebase-sync.service';
import { DemoDataService } from './demo-data.service';

const APP_NAME = 'free-billing';

@Injectable({
  providedIn: 'root',
})
export class BillingStateService {
  private authService = inject(FirebaseAuthService);
  private syncService = inject(FirebaseSyncService);
  private demoService = inject(DemoDataService);
  private productsSub = new BehaviorSubject<Product[]>([]);
  private customersSub = new BehaviorSubject<Customer[]>([]);
  private purchasesSub = new BehaviorSubject<Purchase[]>([]);
  private invoicesSub = new BehaviorSubject<Invoice[]>([]);
  private employeesSub = new BehaviorSubject<Employee[]>([]);
  private ordersSub = new BehaviorSubject<Order[]>([]);

  products$ = this.productsSub.asObservable();
  customers$ = this.customersSub.asObservable();
  purchases$ = this.purchasesSub.asObservable();
  invoices$ = this.invoicesSub.asObservable();
  employees$ = this.employeesSub.asObservable();
  orders$ = this.ordersSub.asObservable();

  constructor() {
    this.loadFromLocalStorage();

    this.syncService.onAuthChange((uid) => {
      if (uid) {
        this.loadFromFirestore();
      } else {
        this.clearData();
      }
    });
  }

  get products() { return this.productsSub.getValue(); }
  get customers() { return this.customersSub.getValue(); }
  get purchases() { return this.purchasesSub.getValue(); }
  get invoices() { return this.invoicesSub.getValue(); }
  get employees() { return this.employeesSub.getValue(); }
  get orders() { return this.ordersSub.getValue(); }

  // Overwrites all data (used when Excel is uploaded)
  initializeData(data: BillingDataExport) {
    this.productsSub.next(data.products || []);
    this.customersSub.next(data.customers || []);
    this.purchasesSub.next(data.purchases || []);
    this.invoicesSub.next(data.invoices || []);
    this.employeesSub.next(data.employees || []);
    this.ordersSub.next(data.orders || []);
    this.saveToLocalStorage();
    this.syncAllToFirestore();
  }

  loadDemoData() {
    const demoData = this.demoService.getDemoData();
    // Merge demo data with existing data, avoiding duplicates if already exists
    this.productsSub.next([...this.products.filter(p => !p.isDemo), ...demoData.products]);
    this.customersSub.next([...this.customers.filter(c => !c.isDemo), ...demoData.customers]);
    this.employeesSub.next([...this.employees.filter(e => !e.isDemo), ...(demoData.employees || [])]);
    this.ordersSub.next([...this.orders.filter(o => !o.isDemo), ...(demoData.orders || [])]);
    this.invoicesSub.next([...this.invoices.filter(i => !i.isDemo), ...demoData.invoices]);
    this.purchasesSub.next([...this.purchases.filter(p => !p.isDemo), ...demoData.purchases]);
    this.saveToLocalStorage();
    this.syncAllToFirestore();
  }

  deleteDemoData() {
    this.productsSub.next(this.products.filter(p => !p.isDemo));
    this.customersSub.next(this.customers.filter(c => !c.isDemo));
    this.employeesSub.next(this.employees.filter(e => !e.isDemo));
    this.ordersSub.next(this.orders.filter(o => !o.isDemo));
    this.invoicesSub.next(this.invoices.filter(i => !i.isDemo));
    this.purchasesSub.next(this.purchases.filter(p => !p.isDemo));
    this.saveToLocalStorage();
    this.syncAllToFirestore();
  }

  // --- Products ---
  addProduct(p: Product) {
    const list = [...this.products, p];
    this.productsSub.next(list);
    this.saveToLocalStorage();
    this.syncToFirestore();
  }

  updateProduct(p: Product) {
    const list = this.products.map((item) => (item.id === p.id ? p : item));
    this.productsSub.next(list);
    this.saveToLocalStorage();
    this.syncToFirestore();
  }

  deleteProduct(id: string) {
    const list = this.products.filter((item) => item.id !== id);
    this.productsSub.next(list);
    this.saveToLocalStorage();
    this.syncToFirestore();
  }

  // --- Customers ---
  addCustomer(c: Customer) {
    const list = [...this.customers, c];
    this.customersSub.next(list);
    this.saveToLocalStorage();
    this.syncToFirestore();
  }

  updateCustomer(c: Customer) {
    const list = this.customers.map((item) => (item.id === c.id ? c : item));
    this.customersSub.next(list);
    this.saveToLocalStorage();
    this.syncToFirestore();
  }

  deleteCustomer(id: string) {
    const list = this.customers.filter((item) => item.id !== id);
    this.customersSub.next(list);
    this.saveToLocalStorage();
    this.syncToFirestore();
  }

  // --- Employees ---
  addEmployee(e: Employee) {
    const list = [...this.employees, e];
    this.employeesSub.next(list);
    this.saveToLocalStorage();
    this.syncToFirestore();
  }

  updateEmployee(e: Employee) {
    const list = this.employees.map((item) => (item.id === e.id ? e : item));
    this.employeesSub.next(list);
    this.saveToLocalStorage();
    this.syncToFirestore();
  }

  deleteEmployee(id: string) {
    const list = this.employees.filter((item) => item.id !== id);
    this.employeesSub.next(list);
    this.saveToLocalStorage();
    this.syncToFirestore();
  }

  // --- Orders ---
  addOrder(o: Order) {
    const list = [...this.orders, o];
    this.ordersSub.next(list);
    this.saveToLocalStorage();
    this.syncToFirestore();
  }

  updateOrder(o: Order) {
    const list = this.orders.map((item) => (item.id === o.id ? o : item));
    this.ordersSub.next(list);
    this.saveToLocalStorage();
    this.syncToFirestore();
  }

  deleteOrder(id: string) {
    const list = this.orders.filter((item) => item.id !== id);
    this.ordersSub.next(list);
    this.saveToLocalStorage();
    this.syncToFirestore();
  }

  markOrderBilled(orderId: string) {
    const order = this.orders.find(o => o.id === orderId);
    if (order) {
      this.updateOrder({ ...order, status: 'billed' });
    }
  }

  // --- Purchases ---
  addPurchase(p: Purchase) {
    const list = [...this.purchases, p];
    this.purchasesSub.next(list);

    // Automatically augment the targeted product's stock
    const targetProduct = this.products.find((x) => x.id === p.productId);
    if (targetProduct) {
      this.updateProduct({ ...targetProduct, stock: targetProduct.stock + p.quantity });
    } else {
      this.saveToLocalStorage();
      this.syncToFirestore();
    }
  }

  // --- Invoices & Sales ---
  addInvoice(inv: Invoice) {
    const list = [...this.invoices, inv];
    this.invoicesSub.next(list);

    // Automatically deplete stock of involved products
    const productUpdates = [...this.products];
    let productsChanged = false;

    const customerUpdates = [...this.customers];
    let customersChanged = false;

    inv.items.forEach((item) => {
      const idx = productUpdates.findIndex((p) => p.id === item.productId);
      if (idx !== -1) {
        productUpdates[idx] = {
          ...productUpdates[idx],
          stock: productUpdates[idx].stock - item.quantity,
        };
        productsChanged = true;
      }
    });

    const cIdx = customerUpdates.findIndex((c) => c.id === inv.customerId);
    if (cIdx !== -1) {
      customerUpdates[cIdx] = {
        ...customerUpdates[cIdx],
        totalPurchasedAmount: (customerUpdates[cIdx].totalPurchasedAmount || 0) + inv.grandTotal,
      };
      customersChanged = true;
    }

    if (productsChanged) this.productsSub.next(productUpdates);
    if (customersChanged) this.customersSub.next(customerUpdates);

    // Mark linked order as billed
    if (inv.orderId) {
      this.markOrderBilled(inv.orderId);
    }

    this.saveToLocalStorage();
    this.syncToFirestore();
  }

  clearData() {
    this.productsSub.next([]);
    this.customersSub.next([]);
    this.purchasesSub.next([]);
    this.invoicesSub.next([]);
    this.employeesSub.next([]);
    this.ordersSub.next([]);
    localStorage.removeItem('free-billing-data');
  }

  getExportData(): BillingDataExport {
    return {
      products: this.products,
      customers: this.customers,
      purchases: this.purchases,
      invoices: this.invoices,
      employees: this.employees,
      orders: this.orders,
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
        this.employeesSub.next(data.employees || []);
        this.ordersSub.next(data.orders || []);
      } catch (e) {
        console.error('Error loading backup billing data', e);
      }
    } else {
      // First time user, auto-load demo data
      this.loadDemoData();
    }
  }

  // --- Firestore Sync ---
  async syncAllToFirestore(): Promise<void> {
    if (!this.authService.isAuthenticated()) return;
    const data = this.getExportData();
    await Promise.all([
      this.syncService.pushToFirestore(APP_NAME, 'products', data.products as unknown as Record<string, unknown>[]),
      this.syncService.pushToFirestore(APP_NAME, 'customers', data.customers as unknown as Record<string, unknown>[]),
      this.syncService.pushToFirestore(APP_NAME, 'purchases', data.purchases as unknown as Record<string, unknown>[]),
      this.syncService.pushToFirestore(APP_NAME, 'invoices', data.invoices as unknown as Record<string, unknown>[]),
      this.syncService.pushToFirestore(APP_NAME, 'employees', (data.employees || []) as unknown as Record<string, unknown>[]),
      this.syncService.pushToFirestore(APP_NAME, 'orders', (data.orders || []) as unknown as Record<string, unknown>[]),
    ]);
  }

  private syncToFirestore(): void {
    this.syncAllToFirestore().catch((e) =>
      console.error('BillingStateService: Firestore sync failed', e),
    );
  }

  async loadFromFirestore(): Promise<void> {
    if (!this.authService.isAuthenticated()) return;
    try {
      const products = await this.syncService.pullFromFirestore<Product>(APP_NAME, 'products');
      const customers = await this.syncService.pullFromFirestore<Customer>(APP_NAME, 'customers');
      const purchases = await this.syncService.pullFromFirestore<Purchase>(APP_NAME, 'purchases');
      const invoices = await this.syncService.pullFromFirestore<Invoice>(APP_NAME, 'invoices');
      const employees = await this.syncService.pullFromFirestore<Employee>(APP_NAME, 'employees');
      const orders = await this.syncService.pullFromFirestore<Order>(APP_NAME, 'orders');

      if (products.length > 0) this.productsSub.next(products);
      if (customers.length > 0) this.customersSub.next(customers);
      if (purchases.length > 0) this.purchasesSub.next(purchases);
      if (invoices.length > 0) this.invoicesSub.next(invoices);
      if (employees.length > 0) this.employeesSub.next(employees);
      if (orders.length > 0) this.ordersSub.next(orders);

      this.saveToLocalStorage();
    } catch (e) {
      console.error('BillingStateService: failed to load from Firestore', e);
    }
  }
}
