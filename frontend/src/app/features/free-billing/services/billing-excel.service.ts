import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';
import { BillingDataExport, Product, Customer, Purchase, Invoice, InvoiceItem, Employee, Order, OrderItem } from '../models/billing.models';

@Injectable({
  providedIn: 'root'
})
export class BillingExcelService {

  generateTemplate() {
    const wb = XLSX.utils.book_new();

    const productsData = [
      { id: '1', name: 'Sample Item', description: 'Sample Desc', price: 100, stock: 50, imageUrl: '', barcode: '', lowStockThreshold: 10, isHidden: false, category: 'General', isDemo: false }
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(productsData), 'Products');

    const customersData = [
      { id: '1', name: 'John Doe', phone: '1234567890', email: 'john@example.com', address: '123 Ave', totalPurchasedAmount: 0, feedback: '', rating: 5, isHidden: false, isDemo: false }
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(customersData), 'Customers');

    const employeesData = [
      { id: 'EMP-001', name: 'Jane Smith', phone: '9876543210', email: 'jane@example.com', role: 'Sales', photoUrl: '', isDemo: false }
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(employeesData), 'Employees');

    const purchasesData = [
      { id: 'PU-1', date: new Date().toISOString(), productId: '1', quantity: 50, costPrice: 80, supplier: 'Supplier A', orderId: '', isDemo: false }
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(purchasesData), 'Purchases');

    const ordersData = [
      { id: 'ORD-1', name: 'Morning Batch', date: new Date().toISOString(), employeeId: 'EMP-001', employeeName: 'Jane Smith', grandTotal: 500, status: 'pending', imageUrl: '', isDemo: false }
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ordersData), 'Orders');

    const orderItemsData = [
      { orderId: 'ORD-1', productId: '1', productName: 'Sample Item', quantity: 5, unitPrice: 100, total: 500, productImage: '' }
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(orderItemsData), 'OrderItems');

    const invoicesData = [
      { id: 'INV-1', customerId: '1', customerName: 'John Doe', date: new Date().toISOString(), subTotal: 100, discountTotal: 0, taxTotal: 18, grandTotal: 118, paymentMethod: 'Cash', notes: 'Thank You', orderId: '', isDemo: false }
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(invoicesData), 'Invoices');

    const invoiceItemsData = [
      { invoiceId: 'INV-1', productId: '1', productName: 'Sample Item', quantity: 1, unitPrice: 100, discountMode: 'FIXED', discountValue: 0, taxRate: 18, taxAmount: 18, totalBeforeTax: 100, total: 118 }
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(invoiceItemsData), 'InvoiceItems');

    XLSX.writeFile(wb, 'FreeBilling_Template.xlsx');
  }

  exportData(data: BillingDataExport) {
    const wb = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.products || []), 'Products');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.customers || []), 'Customers');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.employees || []), 'Employees');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.purchases || []), 'Purchases');

    // Flatten orders
    const flatOrders = (data.orders || []).map(o => ({
      id: o.id, name: o.name, date: o.date, employeeId: o.employeeId, employeeName: o.employeeName,
      grandTotal: o.grandTotal, status: o.status, imageUrl: o.imageUrl || ''
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(flatOrders.length ? flatOrders : [{}]), 'Orders');

    const flatOrderItems: any[] = [];
    data.orders?.forEach(o => {
      o.items.forEach(item => {
        flatOrderItems.push({ orderId: o.id, ...item });
      });
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(flatOrderItems.length ? flatOrderItems : [{}]), 'OrderItems');

    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.invoices || []), 'Invoices');

    const flatInvoiceItems: any[] = [];
    data.invoices?.forEach(inv => {
      inv.items.forEach(item => {
        flatInvoiceItems.push({ invoiceId: inv.id, ...item });
      });
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(flatInvoiceItems.length ? flatInvoiceItems : [{}]), 'InvoiceItems');

    const d = new Date();
    const ts = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}_${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
    XLSX.writeFile(wb, `FreeBilling_Export_${ts}.xlsx`);
  }

  async parseExcelFile(file: File): Promise<BillingDataExport> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });

          const products: Product[] = workbook.Sheets['Products'] ? XLSX.utils.sheet_to_json(workbook.Sheets['Products']) : [];
          const customers: Customer[] = workbook.Sheets['Customers'] ? XLSX.utils.sheet_to_json(workbook.Sheets['Customers']) : [];
          const employees: Employee[] = workbook.Sheets['Employees'] ? XLSX.utils.sheet_to_json(workbook.Sheets['Employees']) : [];
          const purchases: Purchase[] = workbook.Sheets['Purchases'] ? XLSX.utils.sheet_to_json(workbook.Sheets['Purchases']) : [];

          const rawOrders: any[] = workbook.Sheets['Orders'] ? XLSX.utils.sheet_to_json(workbook.Sheets['Orders']) : [];
          const rawOrderItems: any[] = workbook.Sheets['OrderItems'] ? XLSX.utils.sheet_to_json(workbook.Sheets['OrderItems']) : [];
          const orders: Order[] = rawOrders.map(ro => {
            const items = rawOrderItems.filter(oi => oi.orderId === ro.id).map(oi => {
              const { orderId, ...rest } = oi;
              return rest as OrderItem;
            });
            return { ...ro, items } as Order;
          });

          const rawInvoices: any[] = workbook.Sheets['Invoices'] ? XLSX.utils.sheet_to_json(workbook.Sheets['Invoices']) : [];
          const rawInvoiceItems: any[] = workbook.Sheets['InvoiceItems'] ? XLSX.utils.sheet_to_json(workbook.Sheets['InvoiceItems']) : [];
          const invoices: Invoice[] = rawInvoices.map(ri => {
            const items = rawInvoiceItems.filter(rii => rii.invoiceId === ri.id).map(rii => {
              const { invoiceId, ...rest } = rii;
              return rest as InvoiceItem;
            });
            return { ...ri, items } as Invoice;
          });

          const cleanProducts = products.map((p: any) => ({ ...p, isHidden: this.parseBoolean(p.isHidden), isDemo: this.parseBoolean(p.isDemo) }));
          const cleanCustomers = customers.map((c: any) => ({ ...c, isHidden: this.parseBoolean(c.isHidden), isDemo: this.parseBoolean(c.isDemo) }));
          const cleanEmployees = employees.map((e: any) => ({ ...e, isDemo: this.parseBoolean(e.isDemo) }));
          const cleanPurchases = purchases.map((p: any) => ({ ...p, isDemo: this.parseBoolean(p.isDemo) }));
          const cleanOrders = orders.map((o: any) => ({ ...o, isDemo: this.parseBoolean(o.isDemo) }));
          const cleanInvoices = invoices.map((i: any) => ({ ...i, isDemo: this.parseBoolean(i.isDemo) }));

          resolve({ products: cleanProducts, customers: cleanCustomers, employees: cleanEmployees, purchases: cleanPurchases, orders: cleanOrders, invoices: cleanInvoices });
        } catch (error) {
          reject('Invalid Excel format. Please ensure you upload the correct template.');
        }
      };
      reader.onerror = () => reject('Error reading file');
      reader.readAsArrayBuffer(file);
    });
  }

  private parseBoolean(val: any): boolean {
    if (typeof val === 'boolean') return val;
    if (typeof val === 'string') return val.trim().toUpperCase() === 'TRUE';
    return !!val;
  }
}
