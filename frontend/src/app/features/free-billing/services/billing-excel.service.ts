import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';
import { BillingDataExport, Product, Customer, Purchase, Invoice, InvoiceItem } from '../models/billing.models';

@Injectable({
  providedIn: 'root'
})
export class BillingExcelService {

  generateTemplate() {
    const wb = XLSX.utils.book_new();

    // 1. Products Sheet
    const productsData = [
      { id: '1', name: 'Sample Item', description: 'Sample Desc', price: 100, stock: 50, imageUrl: '', lowStockThreshold: 10, isHidden: false, category: 'General' }
    ];
    const wsProducts = XLSX.utils.json_to_sheet(productsData);
    XLSX.utils.book_append_sheet(wb, wsProducts, 'Products');

    // 2. Customers Sheet
    const customersData = [
      { id: '1', name: 'John Doe', phone: '1234567890', email: 'john@example.com', address: '123 Ave', totalPurchasedAmount: 0, feedback: '', rating: 5, isHidden: false }
    ];
    const wsCustomers = XLSX.utils.json_to_sheet(customersData);
    XLSX.utils.book_append_sheet(wb, wsCustomers, 'Customers');

    // 3. Purchases Sheet (Inbound)
    const purchasesData = [
      { id: 'PU-1', date: new Date().toISOString(), productId: '1', quantity: 50, costPrice: 80, supplier: 'Supplier A' }
    ];
    const wsPurchases = XLSX.utils.json_to_sheet(purchasesData);
    XLSX.utils.book_append_sheet(wb, wsPurchases, 'Purchases');

    // 4. Invoices Sheet (Outbound Main)
    const invoicesData = [
      { id: 'INV-1', customerId: '1', customerName: 'John Doe', date: new Date().toISOString(), subTotal: 100, discountTotal: 0, taxTotal: 18, grandTotal: 118, paymentMethod: 'Cash', notes: 'Thank You' }
    ];
    const wsInvoices = XLSX.utils.json_to_sheet(invoicesData);
    XLSX.utils.book_append_sheet(wb, wsInvoices, 'Invoices');

    // 5. Invoice Items Sheet (Outbound Items)
    const invoiceItemsData = [
      { invoiceId: 'INV-1', productId: '1', productName: 'Sample Item', quantity: 1, unitPrice: 100, discountMode: 'FIXED', discountValue: 0, taxRate: 18, taxAmount: 18, totalBeforeTax: 100, total: 118 }
    ];
    const wsInvoiceItems = XLSX.utils.json_to_sheet(invoiceItemsData);
    XLSX.utils.book_append_sheet(wb, wsInvoiceItems, 'InvoiceItems');

    // Export
    XLSX.writeFile(wb, 'FreeBilling_Template.xlsx');
  }

  exportData(data: BillingDataExport) {
    const wb = XLSX.utils.book_new();

    const wsProducts = XLSX.utils.json_to_sheet(data.products || []);
    XLSX.utils.book_append_sheet(wb, wsProducts, 'Products');

    const wsCustomers = XLSX.utils.json_to_sheet(data.customers || []);
    XLSX.utils.book_append_sheet(wb, wsCustomers, 'Customers');

    const wsPurchases = XLSX.utils.json_to_sheet(data.purchases || []);
    XLSX.utils.book_append_sheet(wb, wsPurchases, 'Purchases');

    const wsInvoices = XLSX.utils.json_to_sheet(data.invoices || []);
    XLSX.utils.book_append_sheet(wb, wsInvoices, 'Invoices');

    // Flatten invoice items
    const flatInvoiceItems: any[] = [];
    data.invoices?.forEach(inv => {
      inv.items.forEach(item => {
        flatInvoiceItems.push({
          invoiceId: inv.id,
          ...item
        });
      });
    });
    const wsInvoiceItems = XLSX.utils.json_to_sheet(flatInvoiceItems);
    XLSX.utils.book_append_sheet(wb, wsInvoiceItems, 'InvoiceItems');

    const d = new Date();
    const ts = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}_${String(d.getHours()).padStart(2,'0')}${String(d.getMinutes()).padStart(2,'0')}`;
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
          const purchases: Purchase[] = workbook.Sheets['Purchases'] ? XLSX.utils.sheet_to_json(workbook.Sheets['Purchases']) : [];
          
          const rawInvoices: any[] = workbook.Sheets['Invoices'] ? XLSX.utils.sheet_to_json(workbook.Sheets['Invoices']) : [];
          const rawInvoiceItems: any[] = workbook.Sheets['InvoiceItems'] ? XLSX.utils.sheet_to_json(workbook.Sheets['InvoiceItems']) : [];

          // Reconstruct Invoices
          const invoices: Invoice[] = rawInvoices.map(ri => {
            const items = rawInvoiceItems.filter(rii => rii.invoiceId === ri.id).map(rii => {
              // exclude invoiceId from the actual interface
              const { invoiceId, ...rest } = rii;
              return rest as InvoiceItem;
            });
            return {
              ...ri,
              items: items
            } as Invoice;
          });

          // Boolean Parsing defaults via typical xlsx string issues -> "FALSE", etc.
          const cleanProducts = products.map((p: any) => ({
            ...p,
            isHidden: this.parseBoolean(p.isHidden)
          }));
          const cleanCustomers = customers.map((c: any) => ({
            ...c,
            isHidden: this.parseBoolean(c.isHidden)
          }));

          resolve({
            products: cleanProducts,
            customers: cleanCustomers,
            purchases: purchases,
            invoices: invoices
          });
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
