import { Injectable } from '@angular/core';
import { Product, Customer, Employee, Order, Invoice, Purchase, BillingDataExport } from '../models/billing.models';

@Injectable({
  providedIn: 'root'
})
export class DemoDataService {

  getDemoData(): BillingDataExport {
    const today = new Date();
    const d = (daysAgo: number) => {
      const date = new Date(today);
      date.setDate(date.getDate() - daysAgo);
      return date.toISOString().split('T')[0];
    };

    const products: Product[] = [
      {
        id: 'PROD-001',
        name: 'MacBook Pro 16"',
        description: 'Apple M3 Max, 36GB RAM, 1TB SSD',
        price: 3499.00,
        stock: 12,
        barcode: '194253123456',
        lowStockThreshold: 5,
        isHidden: false,
        category: 'Laptops',
        isDemo: true
      },
      {
        id: 'PROD-002',
        name: 'iPhone 15 Pro',
        description: '256GB, Natural Titanium',
        price: 1099.00,
        stock: 24,
        barcode: '194253789012',
        lowStockThreshold: 10,
        isHidden: false,
        category: 'Smartphones',
        isDemo: true
      },
      {
        id: 'PROD-003',
        name: 'Sony WH-1000XM5',
        description: 'Wireless Noise Cancelling Headphones',
        price: 348.00,
        stock: 8,
        barcode: '454873613245',
        lowStockThreshold: 5,
        isHidden: false,
        category: 'Audio',
        isDemo: true
      },
      {
        id: 'PROD-004',
        name: 'Samsung Odyssey G9',
        description: '49" Curved Gaming Monitor',
        price: 1299.00,
        stock: 3,
        barcode: '880164312345',
        lowStockThreshold: 4,
        isHidden: false,
        category: 'Monitors',
        isDemo: true
      },
      {
        id: 'PROD-005',
        name: 'Logitech MX Master 3S',
        description: 'Wireless Performance Mouse',
        price: 99.00,
        stock: 45,
        barcode: '097855123456',
        lowStockThreshold: 10,
        isHidden: false,
        category: 'Accessories',
        isDemo: true
      }
    ];

    const customers: Customer[] = [
      {
        id: 'CUST-001',
        name: 'Acme Corp',
        phone: '555-0101',
        email: 'purchasing@acmecorp.com',
        address: '123 Tech Boulevard',
        totalPurchasedAmount: 4598.00,
        isHidden: false,
        isDemo: true
      },
      {
        id: 'CUST-002',
        name: 'Jane Smith',
        phone: '555-0102',
        email: 'jane.smith@example.com',
        totalPurchasedAmount: 1099.00,
        isHidden: false,
        isDemo: true
      }
    ];

    const employees: Employee[] = [
      {
        id: 'EMP-001',
        name: 'Alex Johnson',
        role: 'Store Manager',
        email: 'alex@example.com',
        phone: '555-1001',
        isDemo: true
      },
      {
        id: 'EMP-002',
        name: 'Sam Lee',
        role: 'Sales Associate',
        email: 'sam@example.com',
        phone: '555-1002',
        isDemo: true
      }
    ];

    const orders: Order[] = [
      {
        id: 'ORD-001',
        name: 'Acme Bulk Order',
        date: d(2),
        employeeId: 'EMP-001',
        employeeName: 'Alex Johnson',
        items: [
          { productId: 'PROD-001', productName: 'MacBook Pro 16"', quantity: 1, unitPrice: 3499.00, total: 3499.00, isDemo: true },
          { productId: 'PROD-004', productName: 'Samsung Odyssey G9', quantity: 1, unitPrice: 1299.00, total: 1299.00, isDemo: true }
        ],
        grandTotal: 4798.00,
        status: 'pending',
        isDemo: true
      }
    ];

    const invoices: Invoice[] = [
      {
        id: 'INV-001',
        customerId: 'CUST-002',
        customerName: 'Jane Smith',
        date: d(5),
        items: [
          { productId: 'PROD-002', productName: 'iPhone 15 Pro', quantity: 1, unitPrice: 1099.00, discountMode: 'FIXED', discountValue: 0, taxRate: 0, taxAmount: 0, totalBeforeTax: 1099.00, total: 1099.00, isDemo: true }
        ],
        subTotal: 1099.00,
        discountTotal: 0,
        taxTotal: 0,
        grandTotal: 1099.00,
        paymentMethod: 'Credit Card',
        isDemo: true
      }
    ];

    const purchases: Purchase[] = [
      {
        id: 'PUR-001',
        date: d(30),
        productId: 'PROD-001',
        quantity: 15,
        costPrice: 3000.00,
        supplier: 'Apple Inc',
        isDemo: true
      },
      {
        id: 'PUR-002',
        date: d(30),
        productId: 'PROD-002',
        quantity: 30,
        costPrice: 900.00,
        supplier: 'Apple Inc',
        isDemo: true
      }
    ];

    return {
      products,
      customers,
      employees,
      orders,
      invoices,
      purchases
    };
  }
}
