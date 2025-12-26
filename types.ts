
export interface ProductVariant {
  id: string;
  name: string; // e.g. "Rojo / S"
  price: number;
  stock: number;
  sku: string;
}

export type ProductType = 'PRODUCT' | 'SERVICE' | 'SUPPLY';
export type MeasurementUnit = 'PIECE' | 'KG' | 'GRAM' | 'LITER' | 'METER';

export interface Product {
  id: string;
  name: string;
  price: number; // Sales Price
  stock: number; // For simple products
  category: string;
  sku: string; // Master SKU
  description?: string;
  
  // Advanced Features
  type?: ProductType;
  unit: MeasurementUnit; // Sales unit (how it's sold)
  
  // Presentation / Net Content Details
  presentationValue?: number; // e.g. 600
  presentationUnit?: string; // e.g. 'ml', 'g', 'kg'

  isActive: boolean; // For disabling products
  cost?: number; // Last purchase cost
  taxRate: number; // Per product tax (0, 8, 16, etc.)
  hasVariants: boolean;
  variants?: ProductVariant[];

  // Third Party Logic
  isConsignment?: boolean; // If true, revenue belongs to a third party
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  notes: string;
  creditLimit: number;
  currentDebt: number;
  hasUnlimitedCredit?: boolean;
  clientType?: 'INDIVIDUAL' | 'BUSINESS';
}

export interface Supplier {
  id: string;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
}

export interface PurchaseItem {
    productId: string;
    variantId?: string;
    variantName?: string;
    name: string;
    quantity: number;
    unitCost: number; 
    total: number;
    type?: ProductType;
}

export interface Purchase {
    id: string;
    supplierId: string;
    supplierName: string;
    date: string;
    items: PurchaseItem[];
    total: number;
    status: 'COMPLETED' | 'CANCELLED';
    notes?: string;
}

export interface CartItem extends Product {
  quantity: number;
  originalPrice?: number;
  variantId?: string; 
  variantName?: string; 
  finalTax?: number; 
}

export interface Transaction {
  id: string;
  date: string;
  
  subtotal: number;
  taxAmount: number; 
  discount: number;
  shipping: number;
  total: number;
  
  items: CartItem[];
  paymentMethod: 'cash' | 'card' | 'transfer' | 'split' | 'credit';
  
  paymentStatus: 'paid' | 'pending' | 'partial' | 'refunded';
  amountPaid: number;
  dueDate?: string;
  
  transferReference?: string;
  isTransferConfirmed?: boolean;

  splitDetails?: { 
    cash: number;
    other: number;
  };
  customerId?: string;
  customerName?: string; 
  status: 'completed' | 'cancelled' | 'returned'; 
  
  originalTransactionId?: string; 
  isReturn?: boolean; 
  returnedItems?: { itemId: string, variantId?: string, quantity: number }[]; 
}

export interface Order {
  id: string;
  customerId?: string;
  customerName: string;
  date: string;
  deliveryDate?: string;
  items: CartItem[];
  total: number;
  status: 'PENDING' | 'IN_PROGRESS' | 'READY' | 'COMPLETED';
  notes?: string;
  priority: 'NORMAL' | 'HIGH';
}

export type BudgetCategory = 'OPERATIONAL' | 'INVESTMENT' | 'PROFIT' | 'SALES' | 'EQUITY' | 'THIRD_PARTY' | 'OTHER';

export interface ZReportData {
    openingFund: number;
    grossSales: number; 
    cashSales: number;
    cardSales: number;
    transferSales: number;
    creditSales: number;
    expenses: number;
    withdrawals: number;
    expectedCash: number;
    declaredCash: number;
    difference: number;
    timestamp: string;
}

export interface CashMovement {
  id: string;
  type: 'OPEN' | 'CLOSE' | 'EXPENSE' | 'DEPOSIT' | 'WITHDRAWAL';
  amount: number;
  description: string;
  date: string;
  
  // High level financial bucket
  category?: BudgetCategory;
  // User defined tag (e.g. "Luz", "Renta", "Proveedor X")
  subCategory?: string; 

  customerId?: string;
  
  isZCut?: boolean;
  zReportData?: ZReportData; 
}

export interface BusinessInsight {
  analysis: string;
  recommendations: string[];
}

export interface BudgetConfig {
  expensesPercentage: number;
  investmentPercentage: number;
  profitPercentage: number;
}

export interface SequenceConfig {
  customerStart: number;
  ticketStart: number;
  orderStart: number;
  productStart: number;
}

export interface ProductionDocConfig {
    title: string;
    showPrices: boolean;
    showCustomerContact: boolean;
    showDates: boolean;
    customFooter: string;
}

export interface BusinessSettings {
  name: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  taxId: string;
  currency: string;
  taxRate: number; 
  enableTax: boolean; 
  logo: string | null;
  receiptLogo: string | null;
  receiptHeader: string;
  receiptFooter: string;
  ticketPaperWidth: '58mm' | '80mm';
  invoicePadding: number; // New: Padding/Margin for letter invoice (in mm approx)
  bluetoothPrinterName?: string | null; // NEW: Stores name of connected BT printer
  theme: 'light' | 'dark';
  budgetConfig: BudgetConfig; 
  notificationsEnabled: boolean; 
  sequences: SequenceConfig;
  productionDoc: ProductionDocConfig;
  googleWebAppUrl?: string; 
  enableCloudSync?: boolean;
  cloudSecret?: string; 
}

export type UserRole = 'ADMIN' | 'MANAGER' | 'CASHIER';

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  salt: string;
  fullName: string;
  role: UserRole;
  active: boolean;
  lastLogin?: string;
  lastActive?: string;
  failedLoginAttempts?: number;
  lockoutUntil?: string;
  recoveryCode?: string;
  securityQuestion?: string;
  securityAnswerHash?: string;
  isTwoFactorEnabled?: boolean;
  twoFactorSecret?: string;
}

export interface UserInvite {
    code: string;
    role: UserRole;
    createdAt: string;
    createdBy: string; 
}

export interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  action: 'LOGIN' | 'SALE' | 'INVENTORY' | 'SETTINGS' | 'USER_MGMT' | 'SECURITY' | 'CASH' | 'ORDER' | 'CRM' | 'RECOVERY';
  details: string;
  timestamp: string;
}

export interface ToastNotification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  duration?: number;
}

export enum AppView {
  DASHBOARD = 'DASHBOARD',
  POS = 'POS',
  ORDERS = 'ORDERS',
  INVENTORY = 'INVENTORY',
  CUSTOMERS = 'CUSTOMERS',
  SUPPLIERS = 'SUPPLIERS',
  HISTORY = 'HISTORY', 
  CASH = 'CASH',
  REPORTS = 'REPORTS',
  SETTINGS = 'SETTINGS',
  USERS = 'USERS'
}
