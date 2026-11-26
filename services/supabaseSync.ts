import { supabase } from './supabaseClient';
import { Product, Customer, Supplier, Transaction, CashMovement, Order, Purchase, BusinessSettings, User, ActivityLog } from '../types';

export interface SupabaseSnapshot {
  categories: string[];
  products: Product[];
  customers: Customer[];
  suppliers: Supplier[];
  transactions: Transaction[];
  cashMovements: CashMovement[];
  orders: Order[];
  purchases: Purchase[];
  profiles: User[];
  activityLogs: ActivityLog[];
  settingsPartial?: Partial<BusinessSettings>;
}

/**
 * Fetches all core POS tables from Supabase PostgreSQL and maps them to LuminaPOS types.
 */
export const fetchAllFromSupabase = async (): Promise<SupabaseSnapshot | null> => {
  if (!supabase) return null;
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData?.session) return null;

  const [
    catRes,
    prodRes,
    varRes,
    custRes,
    supRes,
    txRes,
    txItemRes,
    cashRes,
    ordRes,
    ordItemRes,
    purchRes,
    purchItemRes,
    profRes,
    logsRes,
    setRes,
  ] = await Promise.all([
    supabase.from('categories').select('name').order('name'),
    supabase.from('products').select('*').order('name'),
    supabase.from('product_variants').select('*'),
    supabase.from('customers').select('*').order('name'),
    supabase.from('suppliers').select('*').order('name'),
    supabase.from('transactions').select('*').order('date', { ascending: false }).limit(500),
    supabase.from('transaction_items').select('*'),
    supabase.from('cash_movements').select('*').order('date', { ascending: false }).limit(500),
    supabase.from('orders').select('*').order('date', { ascending: false }).limit(300),
    supabase.from('order_items').select('*'),
    supabase.from('purchases').select('*').order('date', { ascending: false }).limit(300),
    supabase.from('purchase_items').select('*'),
    supabase.from('profiles').select('*').order('created_at', { ascending: true }),
    supabase.from('activity_logs').select('*').order('timestamp', { ascending: false }).limit(200),
    supabase.from('business_settings').select('*').eq('id', 1).maybeSingle(),
  ]);

  if (prodRes.error) throw new Error(prodRes.error.message);

  const variantsByProd = new Map<string, any[]>();
  (varRes.data || []).forEach(v => {
    const list = variantsByProd.get(v.product_id) || [];
    list.push({
      id: v.legacy_id || v.id,
      name: v.name,
      sku: v.sku || '',
      price: Number(v.price) || 0,
      stock: Number(v.stock) || 0,
    });
    variantsByProd.set(v.product_id, list);
  });

  const products: Product[] = (prodRes.data || []).map(p => ({
    id: p.legacy_id || p.id,
    name: p.name,
    sku: p.sku || '',
    category: p.category || 'General',
    type: p.type || 'PRODUCT',
    unit: p.unit || 'PIECE',
    presentationValue: p.presentation_value != null ? Number(p.presentation_value) : undefined,
    price: Number(p.price) || 0,
    cost: Number(p.cost) || 0,
    stock: Number(p.stock) || 0,
    taxRate: Number(p.tax_rate) || 0,
    hasVariants: Boolean(p.has_variants),
    variants: variantsByProd.get(p.id),
    isConsignment: Boolean(p.is_consignment),
    isActive: p.is_active !== false,
    description: p.description || undefined,
  }));

  const customers: Customer[] = (custRes.data || []).map(c => ({
    id: c.code || c.id,
    name: c.name,
    email: c.email || '',
    phone: c.phone || '',
    address: c.address || '',
    notes: c.notes || '',
    clientType: c.client_type || 'INDIVIDUAL',
    creditLimit: Number(c.credit_limit) || 0,
    currentDebt: Number(c.current_debt) || 0,
    hasUnlimitedCredit: Boolean(c.has_unlimited_credit),
  }));

  const suppliers: Supplier[] = (supRes.data || []).map(s => ({
    id: s.legacy_id || s.id,
    name: s.name,
    contactPerson: s.contact_person || '',
    email: s.email || '',
    phone: s.phone || '',
    address: s.address || '',
  }));

  const txItemsByTx = new Map<string, any[]>();
  (txItemRes.data || []).forEach(it => {
    const list = txItemsByTx.get(it.transaction_id) || [];
    list.push({
      id: it.product_id || it.id,
      variantId: it.variant_id || undefined,
      variantName: it.variant_name || undefined,
      name: it.name,
      sku: it.sku || '',
      category: it.category || 'General',
      unit: it.unit || 'PIECE',
      isConsignment: Boolean(it.is_consignment),
      quantity: Number(it.quantity) || 1,
      price: Number(it.price) || 0,
      taxRate: Number(it.tax_rate) || 0,
      stock: 0,
    });
    txItemsByTx.set(it.transaction_id, list);
  });

  const transactions: Transaction[] = (txRes.data || []).map(t => ({
    id: t.ticket_number || t.id,
    date: t.date,
    subtotal: Number(t.subtotal) || 0,
    taxAmount: Number(t.tax_amount) || 0,
    discount: Number(t.discount) || 0,
    shipping: Number(t.shipping) || 0,
    total: Number(t.total) || 0,
    items: txItemsByTx.get(t.id) || [],
    paymentMethod: t.payment_method,
    paymentStatus: t.payment_status,
    amountPaid: Number(t.amount_paid) || 0,
    tenderedAmount: t.tendered_amount != null ? Number(t.tendered_amount) : undefined,
    splitDetails: t.split_details || undefined,
    customerId: t.customer_id || undefined,
    customerName: t.customer_name || undefined,
    status: t.status || 'completed',
    deliverySignature: t.delivery_signature || undefined,
  }));

  const cashMovements: CashMovement[] = (cashRes.data || []).map(m => ({
    id: m.id,
    type: m.type,
    amount: Number(m.amount) || 0,
    description: m.description || '',
    date: m.date,
    category: m.category || 'OTHER',
    subCategory: m.sub_category || undefined,
    channel: m.channel || 'CASH',
    customerId: m.customer_id || undefined,
    isZCut: Boolean(m.is_z_cut),
    zReportData: m.z_report_data || undefined,
  }));

  const ordItemsByOrd = new Map<string, any[]>();
  (ordItemRes.data || []).forEach(it => {
    const list = ordItemsByOrd.get(it.order_id) || [];
    list.push({
      id: it.product_id || it.id,
      variantId: it.variant_id || undefined,
      variantName: it.variant_name || undefined,
      name: it.name,
      quantity: Number(it.quantity) || 1,
      price: Number(it.price) || 0,
      sku: '',
      category: 'General',
      stock: 0,
    });
    ordItemsByOrd.set(it.order_id, list);
  });

  const orders: Order[] = (ordRes.data || []).map(o => ({
    id: o.order_number || o.id,
    customerId: o.customer_id || undefined,
    customerName: o.customer_name || 'Cliente General',
    date: o.date,
    deliveryDate: o.delivery_date || undefined,
    items: ordItemsByOrd.get(o.id) || [],
    total: Number(o.total) || 0,
    status: o.status || 'PENDING',
    priority: o.priority || 'NORMAL',
    notes: o.notes || undefined,
  }));

  const purchItemsByPurch = new Map<string, any[]>();
  (purchItemRes.data || []).forEach(it => {
    const list = purchItemsByPurch.get(it.purchase_id) || [];
    list.push({
      productId: it.product_id,
      productName: it.name,
      variantId: it.variant_id || undefined,
      variantName: it.variant_name || undefined,
      quantity: Number(it.quantity) || 1,
      unitCost: Number(it.unit_cost) || 0,
      total: Number(it.total) || 0,
    });
    purchItemsByPurch.set(it.purchase_id, list);
  });

  const purchases: Purchase[] = (purchRes.data || []).map(p => ({
    id: p.id,
    date: p.date,
    supplierId: p.supplier_id || '',
    supplierName: p.supplier_name || 'Proveedor',
    items: purchItemsByPurch.get(p.id) || [],
    total: Number(p.total) || 0,
    status: p.status || 'COMPLETED',
    notes: p.notes || undefined,
  }));

  const profiles: User[] = (profRes.data || []).map(p => ({
    id: p.id,
    username: p.username,
    email: p.email || undefined,
    fullName: p.full_name,
    role: p.role || 'CASHIER',
    active: p.active !== false,
    passwordHash: '',
    salt: '',
    lastLogin: p.last_login || undefined,
    lastActive: p.updated_at || p.last_login || undefined,
  }));

  const activityLogs: ActivityLog[] = (logsRes.data || []).map(l => ({
    id: l.id,
    userId: l.user_id || 'system',
    userName: l.user_name || 'Sistema',
    userRole: l.user_role || 'CASHIER',
    action: l.action || 'SETTINGS',
    details: l.details || '',
    timestamp: l.timestamp,
  }));

  const categories = (catRes.data || []).map(c => c.name);
  const s = setRes.data;
  const settingsPartial: Partial<BusinessSettings> | undefined = s
    ? {
        name: s.name,
        address: s.address || '',
        phone: s.phone || '',
        email: s.email || '',
        website: s.website || '',
        taxId: s.tax_id || '',
        currency: s.currency || 'MXN',
        taxRate: Number(s.tax_rate) || 0,
        enableTax: Boolean(s.enable_tax),
        logo: s.logo_url ?? null,
        receiptLogo: s.receipt_logo_url ?? null,
        receiptHeader: s.receipt_header || '',
        receiptFooter: s.receipt_footer || '',
        ticketPaperWidth: s.ticket_paper_width || '58mm',
        invoicePadding: Number(s.invoice_padding) || 10,
        theme: s.theme || 'light',
        budgetConfig: s.budget_config,
        soundConfig: s.sound_config,
        securityConfig: s.security_config,
        printConfig: s.print_config,
        productionDoc: s.production_doc,
      }
    : undefined;

  return { categories, products, customers, suppliers, transactions, cashMovements, orders, purchases, profiles, activityLogs, settingsPartial };
};

/**
 * Subscribes to Supabase Realtime changes across all key POS tables for live multi-device sync.
 */
export const subscribeToSupabaseRealtime = (onRemoteChange: () => void): (() => void) => {
  const client = supabase;
  if (!client) return () => {};

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  const trigger = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => onRemoteChange(), 800);
  };

  const channel = client
    .channel('luminapos-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, trigger)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_logs' }, trigger)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, trigger)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, trigger)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'product_variants' }, trigger)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, trigger)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'suppliers' }, trigger)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, trigger)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, trigger)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'cash_movements' }, trigger)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'purchases' }, trigger)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'business_settings' }, trigger)
    .subscribe();

  return () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    client.removeChannel(channel);
  };
};
