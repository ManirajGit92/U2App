export interface InvoiceItem {
  id: string;
  sNo: number;
  description: string;
  hsnSac: string;
  qtyDuration: string;
  rate: number;
  amount: number;
  selected?: boolean;
}

export interface BusinessInfo {
  name: string;
  tagline: string;
  subTagline: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  gstin: string;
  pan: string;
  regNo: string;
  fssaiNo: string;
  logoUrl?: string;
  headerImageUrl?: string;
}

export interface CustomerInfo {
  name: string;
  address: string;
  phone: string;
  email: string;
  gstin: string;
  placeOfSupply: string;
}

export interface InvoiceDetails {
  invoiceTitle: string;
  invoiceNo: string;
  invoiceDate: string;
  bookingDate: string;
  eventType: string;
  eventDate: string;
  hallName: string;
  eventTime: string;
  guestsApprox: string;
  paymentDueDate?: string;
}

export interface TableSettings {
  showSNo: boolean;
  showHsnSac: boolean;
  showQtyDuration: boolean;
  showRate: boolean;
  showAmount: boolean;
  currencySymbol: string;
  stripedRows: boolean;
}

export interface TaxSettings {
  taxMode: 'gst' | 'igst' | 'none';
  cgstRate: number;
  sgstRate: number;
  igstRate: number;
  discountType: 'flat' | 'percentage';
  discountValue: number;
  additionalCharges: number;
  additionalChargesLabel: string;
  roundOff: boolean;
}

export interface PaymentDetails {
  bankName: string;
  accountName: string;
  accountNumber: string;
  ifscCode: string;
  branch: string;
  upiId: string;
  qrCodeUrl?: string;
  paymentTerms: string;
}

export interface ShowFieldsSettings {
  logo: boolean;
  businessInfo: boolean;
  headerImage: boolean;
  taxRegistrationBlock: boolean;
  bannerTitle: boolean;
  customerDetails: boolean;
  eventDetails: boolean;
  tableActions: boolean;
  amountInWords: boolean;
  taxBreakup: boolean;
  paymentDetails: boolean;
  termsConditions: boolean;
  notesRemarks: boolean;
  signatureBlock: boolean;
}

export interface DesignSettings {
  layoutVariant: 'classic-mahal' | 'elegant-modern' | 'royal-crest' | 'simple-clean' | 'traditional-bordered';
  bannerBgPattern: 'ornate' | 'geometric' | 'solid' | 'gradient';
  headerLayout: 'split-photo' | 'center-logo' | 'left-aligned' | 'compact';
  accentBorder: boolean;
  compactSpacing: boolean;
}

export interface InvoiceTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  isFavorite: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  badge?: string;
  colorTheme: string;
  secondaryColor?: string;
  fontFamily: string;
  fontSize: number;
  pageSize: 'A4' | 'Letter' | 'Legal';
  pageOrientation: 'portrait' | 'landscape';
  businessInfo: BusinessInfo;
  customerInfo: CustomerInfo;
  invoiceDetails: InvoiceDetails;
  items: InvoiceItem[];
  tableSettings: TableSettings;
  taxSettings: TaxSettings;
  paymentDetails: PaymentDetails;
  termsAndConditions: string[];
  notesRemarks: string;
  showFields: ShowFieldsSettings;
  design: DesignSettings;
}

export interface TemplateCategory {
  id: string;
  name: string;
  icon: string;
  count: number;
}

export interface InvoiceTotals {
  subTotal: number;
  discountAmount: number;
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalTax: number;
  additionalCharges: number;
  grandTotal: number;
  amountInWords: string;
}

export interface DefaultInformationPreset {
  businessInfo: BusinessInfo;
  paymentDetails: PaymentDetails;
  termsAndConditions: string[];
  notesRemarks: string;
}
