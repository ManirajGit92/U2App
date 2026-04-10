export interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  stock: number;
  imageUrl?: string;
  lowStockThreshold: number;
  isHidden: boolean;
  category?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  totalPurchasedAmount: number;
  feedback?: string;
  rating?: number;
  isHidden: boolean;
}

export interface Purchase {
  id: string;
  date: string;
  productId: string;
  quantity: number;
  costPrice: number;
  supplier?: string;
}

export interface InvoiceItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  discountMode: 'PERCENTAGE' | 'FIXED';
  discountValue: number;
  taxRate: number; // e.g., 18 for 18% GST
  taxAmount: number;
  totalBeforeTax: number;
  total: number;
}

export interface Invoice {
  id: string;
  customerId: string;
  customerName: string; // snapshot for history
  date: string;
  items: InvoiceItem[];
  subTotal: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
  paymentMethod: string;
  notes?: string;
}

export interface BillingDataExport {
  products: Product[];
  customers: Customer[];
  purchases: Purchase[];
  invoices: Invoice[];
}
