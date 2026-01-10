
export type BudgetCategory = 'SALES' | 'OPERATIONAL' | 'EQUITY' | 'PROFIT' | 'THIRD_PARTY' | 'LOAN' | 'OTHER';

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
  type: 'OPEN' | 'CLOSE' | 'DEPOSIT' | 'EXPENSE' | 'WITHDRAWAL';
  amount: number;
  description: string;
  date: string;
  category: BudgetCategory;
  subCategory?: string;
  customerId?: string;
  isZCut?: boolean;
  zReportData?: ZReportData;
  channel?: 'CASH' | 'VIRTUAL'; // NEW: Distinguish between physical cash drawer and bank/digital account
}

export type CycleType = 'MONTHLY' | 'FIXED_DAYS';

export interface BudgetConfig {
  expensesPercentage: number;
  investmentPercentage: number;
  profitPercentage: number;
  fiscalStartDate?: string; // ISO Date String (e.g. '2023-12-11')
  cycleType?: CycleType;    // 'MONTHLY' (same day next month) or 'FIXED_DAYS'
  cycleLength?: number;     // If FIXED_DAYS, how many days (e.g. 28)
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

export type SoundType = 'NOTE' | 'CHORD' | 'POP' | 'GLASS' | 'SUCCESS' | 'ERROR' | 'NONE' | 'BEEP' | 'ALERT' | 'RETRO' | 'BELL' | 'GAMING';

export interface SoundConfig {
    enabled: boolean;
    volume: number; // 0.0 to 1.0
    saleSound: SoundType;
    errorSound: SoundType;
    clickSound: SoundType;
    notificationSound: SoundType;
}

export interface SecurityConfig {
    autoLockMinutes: number; // 0 to disable
    blurAppOnBackground: boolean; // Blur screen if user switches tabs
}

export type PrintBehavior = 'ALWAYS' | 'ASK' | 'NEVER';

export interface PrintConfig {
    customerCopyBehavior: PrintBehavior;
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
  soundConfig: SoundConfig; 
  securityConfig: SecurityConfig; // NEW: Security settings
  printConfig: PrintConfig; // NEW: Print preferences
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

export type ProductType = 'PRODUCT' | 'SUPPLY';
export type MeasurementUnit = 'PIECE' | 'KG' | 'GRAM' | 'LITER' | 'METER';

export interface ProductVariant {
  id: string;
  name: string;
  price: number;
  stock: number;
  sku: string;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  price: number;
  cost?: number;
  stock: number;
  taxRate?: number;
  hasVariants?: boolean;
  variants?: ProductVariant[];
  type?: ProductType;
  unit?: MeasurementUnit;
  isActive?: boolean;
  isConsignment?: boolean;
  description?: string;
  presentationValue?: number;
  presentationUnit?: string;
}

export interface CartItem extends Product {
  quantity: number;
  variantId?: string;
  variantName?: string;
  originalPrice?: number;
  finalTax?: number;
}

export interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
  creditLimit: number;
  currentDebt: number;
  hasUnlimitedCredit?: boolean;
  clientType: 'INDIVIDUAL' | 'BUSINESS';
}

export interface Supplier {
  id: string;
  name: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
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
  paymentMethod: 'cash' | 'card' | 'transfer' | 'credit' | 'split';
  paymentStatus: 'paid' | 'pending' | 'partial';
  amountPaid: number;
  tenderedAmount?: number;
  customerId?: string;
  status: 'completed' | 'cancelled' | 'returned';
  splitDetails?: { cash: number; other: number };
  originalTransactionId?: string;
  isReturn?: boolean;
  transferReference?: string;
}

export interface Order {
  id: string;
  customerId: string;
  customerName: string;
  date: string;
  deliveryDate?: string;
  items: CartItem[];
  total: number;
  status: 'PENDING' | 'IN_PROGRESS' | 'READY' | 'COMPLETED';
  notes?: string;
  priority: 'NORMAL' | 'HIGH';
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
  shippingCost?: number;
  total: number;
  status: 'COMPLETED' | 'PENDING';
  notes?: string;
}
