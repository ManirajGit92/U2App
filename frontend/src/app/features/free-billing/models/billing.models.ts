export interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  stock: number;
  imageUrl?: string;
  barcode?: string;
  lowStockThreshold: number;
  isHidden: boolean;
  category?: string;
  isDemo?: boolean;
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
  isDemo?: boolean;
}

export interface Employee {
  id: string;
  name: string;
  photoUrl?: string;
  phone?: string;
  email?: string;
  role?: string;
  isDemo?: boolean;
}

export interface Purchase {
  id: string;
  date: string;
  productId: string;
  quantity: number;
  costPrice: number;
  supplier?: string;
  orderId?: string; // optional link to an order
  isDemo?: boolean;
}

export interface OrderItem {
  productId: string;
  productName: string;
  productImage?: string;
  quantity: number;
  unitPrice: number;
  total: number;
  isDemo?: boolean;
}

export interface Order {
  id: string;
  name: string;
  date: string;
  employeeId?: string;
  employeeName?: string;
  employeePhoto?: string;
  items: OrderItem[];
  grandTotal: number;
  status: 'pending' | 'billed';
  imageUrl?: string; // thumbnail (first product image or custom)
  isDemo?: boolean;
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
  isDemo?: boolean;
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
  orderId?: string; // optional linked order
  isDemo?: boolean;
}

export interface BillingDataExport {
  products: Product[];
  customers: Customer[];
  purchases: Purchase[];
  invoices: Invoice[];
  employees?: Employee[];
  orders?: Order[];
}
