import { supabase } from './supabaseClient';
import {
  Product,
  Customer,
  Supplier,
  Transaction,
  CashMovement,
  Order,
  Purchase,
  BusinessSettings,
} from '../types';
import { roundCurrency, roundQty } from '../utils/financeHelpers';

const isSignedIn = async (): Promise<boolean> => {
  if (!supabase) return false;
  const { data } = await supabase.auth.getSession();
  return Boolean(data.session);
};

const resolveCustomerUuid = async (customerCode?: string): Promise<string | null> => {
  if (!supabase || !customerCode) return null;
  const { data } = await supabase.from('customers').select('id').eq('code', customerCode).maybeSingle();
  return data?.id || null;
};

const resolveProductUuid = async (legacyId?: string): Promise<string | null> => {
  if (!supabase || !legacyId) return null;
  const { data } = await supabase.from('products').select('id').eq('legacy_id', legacyId).maybeSingle();
  return data?.id || null;
};

const resolveVariantUuid = async (legacyId?: string): Promise<string | null> => {
  if (!supabase || !legacyId) return null;
  const { data } = await supabase.from('product_variants').select('id').eq('legacy_id', legacyId).maybeSingle();
  return data?.id || null;
};

export const sbAddCategory = async (name: string) => {
  if (!supabase || !(await isSignedIn())) return;
  await supabase.from('categories').upsert({ name: name.trim() }, { onConflict: 'name' });
};

export const sbRemoveCategory = async (name: string) => {
  if (!supabase || !(await isSignedIn())) return;
  await supabase.from('categories').delete().eq('name', name);
};

export const sbUpsertProduct = async (p: Product) => {
  if (!supabase || !(await isSignedIn())) return;
  const { data: prodRow, error } = await supabase
    .from('products')
    .upsert(
      {
        legacy_id: p.id,
        name: p.name,
        sku: p.sku || `SKU-${p.id}`,
        category: p.category || 'General',
        type: p.type || 'PRODUCT',
        unit: p.unit || 'PIECE',
        presentation_value: p.presentationValue ?? null,
        price: roundCurrency(Math.max(0, p.price || 0)),
        cost: roundCurrency(Math.max(0, p.cost || 0)),
        stock: roundQty(p.stock || 0),
        tax_rate: Number.isFinite(p.taxRate) ? p.taxRate : 0,
        has_variants: Boolean(p.hasVariants),
        is_consignment: Boolean(p.isConsignment),
        is_active: p.isActive !== false,
        description: p.description || null,
      },
      { onConflict: 'legacy_id' }
    )
    .select('id')
    .single();

  if (error || !prodRow) {
    console.warn('sbUpsertProduct error:', error?.message);
    return;
  }

  if (p.hasVariants && p.variants && p.variants.length > 0) {
    const variantRows = p.variants.map(v => ({
      legacy_id: v.id,
      product_id: prodRow.id,
      name: v.name,
      sku: v.sku || null,
      price: roundCurrency(Math.max(0, v.price || 0)),
      stock: roundQty(v.stock || 0),
    }));
    const { error: vErr } = await supabase.from('product_variants').upsert(variantRows, { onConflict: 'legacy_id' });
    if (vErr) console.warn('sbUpsertProduct variants error:', vErr.message);
  }
};

export const sbDeleteProduct = async (legacyId: string) => {
  if (!supabase || !(await isSignedIn())) return;
  await supabase.from('products').delete().eq('legacy_id', legacyId);
};

export const sbUpsertCustomer = async (c: Customer) => {
  if (!supabase || !(await isSignedIn())) return;
  const { error } = await supabase.from('customers').upsert(
    {
      code: c.id,
      name: c.name,
      email: c.email || '',
      phone: c.phone || '',
      address: c.address || '',
      notes: c.notes || '',
      client_type: c.clientType || 'INDIVIDUAL',
      credit_limit: roundCurrency(Math.max(0, c.creditLimit || 0)),
      current_debt: roundCurrency(Math.max(0, c.currentDebt || 0)),
      has_unlimited_credit: Boolean(c.hasUnlimitedCredit),
    },
    { onConflict: 'code' }
  );
  if (error) console.warn('sbUpsertCustomer error:', error.message);
};

export const sbDeleteCustomer = async (code: string) => {
  if (!supabase || !(await isSignedIn())) return;
  await supabase.from('customers').delete().eq('code', code);
};

export const sbUpsertSupplier = async (s: Supplier) => {
  if (!supabase || !(await isSignedIn())) return;
  const { error } = await supabase.from('suppliers').upsert(
    {
      legacy_id: s.id,
      name: s.name,
      contact_person: s.contactPerson || '',
      email: s.email || '',
      phone: s.phone || '',
      address: s.address || '',
    },
    { onConflict: 'legacy_id' }
  );
  if (error) console.warn('sbUpsertSupplier error:', error.message);
};

export const sbDeleteSupplier = async (legacyId: string) => {
  if (!supabase || !(await isSignedIn())) return;
  await supabase.from('suppliers').delete().eq('legacy_id', legacyId);
};

export const sbSaveTransaction = async (tx: Transaction) => {
  if (!supabase || !(await isSignedIn())) return;
  const customerUuid = await resolveCustomerUuid(tx.customerId);
  const paymentMethod = ['cash', 'card', 'transfer', 'split', 'credit'].includes(tx.paymentMethod)
    ? tx.paymentMethod
    : 'cash';
  const paymentStatus = ['paid', 'pending', 'partial'].includes(tx.paymentStatus)
    ? tx.paymentStatus
    : 'paid';
  const status = ['completed', 'cancelled', 'returned'].includes(tx.status || 'completed')
    ? tx.status || 'completed'
    : 'completed';

  const { data: txRow, error } = await supabase
    .from('transactions')
    .upsert(
      {
        ticket_number: tx.id,
        date: tx.date || new Date().toISOString(),
        customer_id: customerUuid,
        customer_name: (tx as any).customerName || null,
        subtotal: roundCurrency(tx.subtotal || 0),
        tax_amount: roundCurrency(tx.taxAmount || 0),
        discount: roundCurrency(tx.discount || 0),
        shipping: roundCurrency(tx.shipping || 0),
        total: roundCurrency(tx.total || 0),
        payment_method: paymentMethod,
        payment_status: paymentStatus,
        amount_paid: roundCurrency(tx.amountPaid || 0),
        tendered_amount: tx.tenderedAmount != null ? roundCurrency(tx.tenderedAmount) : null,
        split_details: tx.splitDetails || null,
        status,
      },
      { onConflict: 'ticket_number' }
    )
    .select('id')
    .single();

  if (error || !txRow) {
    console.warn('sbSaveTransaction error:', error?.message);
    return;
  }

  if (tx.items && tx.items.length > 0) {
    await supabase.from('transaction_items').delete().eq('transaction_id', txRow.id);
    const itemsToInsert = await Promise.all(
      tx.items.map(async it => ({
        transaction_id: txRow.id,
        product_id: await resolveProductUuid(it.id),
        variant_id: await resolveVariantUuid(it.variantId),
        variant_name: it.variantName || null,
        name: it.name || 'Producto',
        sku: it.sku || '',
        category: it.category || 'General',
        unit: it.unit || 'PIECE',
        is_consignment: Boolean(it.isConsignment),
        quantity: Math.max(0.001, roundQty(it.quantity || 1)),
        price: roundCurrency(Math.max(0, it.price || 0)),
        tax_rate: Number.isFinite(it.taxRate) ? it.taxRate : 0,
      }))
    );
    const { error: itemErr } = await supabase.from('transaction_items').insert(itemsToInsert);
    if (itemErr) console.warn('sbSaveTransaction items error:', itemErr.message);
  }
};

export const sbUpdateTransaction = async (ticketNumber: string, updates: Partial<Transaction>) => {
  if (!supabase || !(await isSignedIn())) return;
  const patch: Record<string, any> = {};
  if (updates.status !== undefined) patch.status = updates.status;
  if (updates.paymentStatus !== undefined) patch.payment_status = updates.paymentStatus;
  if (updates.amountPaid !== undefined) patch.amount_paid = roundCurrency(updates.amountPaid);
  if (updates.total !== undefined) patch.total = roundCurrency(updates.total);
  if (Object.keys(patch).length === 0) return;

  const { error } = await supabase.from('transactions').update(patch).eq('ticket_number', ticketNumber);
  if (error) console.warn('sbUpdateTransaction error:', error.message);
};

export const sbSaveCashMovement = async (m: CashMovement) => {
  if (!supabase || !(await isSignedIn())) return;
  const customerUuid = await resolveCustomerUuid(m.customerId);
  const validType = ['OPEN', 'CLOSE', 'EXPENSE', 'DEPOSIT', 'WITHDRAWAL'].includes(m.type)
    ? m.type
    : 'DEPOSIT';
  const validChannel = m.channel === 'VIRTUAL' ? 'VIRTUAL' : 'CASH';

  const { error } = await supabase.from('cash_movements').insert({
    customer_id: customerUuid,
    type: validType,
    amount: roundCurrency(Math.max(0, m.amount || 0)),
    description: m.description || '',
    category: m.category || 'OTHER',
    sub_category: m.subCategory || null,
    channel: validChannel,
    is_z_cut: Boolean(m.isZCut),
    z_report_data: m.zReportData || null,
    date: m.date || new Date().toISOString(),
  });
  if (error) console.warn('sbSaveCashMovement error:', error.message);
};

export const sbDeleteCashMovement = async (id: string) => {
  if (!supabase || !(await isSignedIn())) return;
  // Only delete if id looks like a UUID
  if (/^[0-9a-f-]{36}$/i.test(id)) {
    await supabase.from('cash_movements').delete().eq('id', id);
  }
};

export const sbUpsertOrder = async (o: Order) => {
  if (!supabase || !(await isSignedIn())) return;
  const customerUuid = await resolveCustomerUuid(o.customerId);
  const { data: ordRow, error } = await supabase
    .from('orders')
    .upsert(
      {
        order_number: o.id,
        customer_id: customerUuid,
        customer_name: o.customerName || 'Cliente General',
        date: o.date || new Date().toISOString(),
        delivery_date: o.deliveryDate ? o.deliveryDate.slice(0, 10) : null,
        total: roundCurrency(o.total || 0),
        status: o.status || 'PENDING',
        priority: o.priority || 'NORMAL',
        notes: o.notes || null,
      },
      { onConflict: 'order_number' }
    )
    .select('id')
    .single();

  if (error || !ordRow) {
    console.warn('sbUpsertOrder error:', error?.message);
    return;
  }

  if (o.items && o.items.length > 0) {
    await supabase.from('order_items').delete().eq('order_id', ordRow.id);
    const itemsToInsert = await Promise.all(
      o.items.map(async it => ({
        order_id: ordRow.id,
        product_id: await resolveProductUuid(it.id),
        variant_id: await resolveVariantUuid(it.variantId),
        variant_name: it.variantName || null,
        name: it.name || 'Producto',
        quantity: Math.max(0.001, roundQty(it.quantity || 1)),
        price: roundCurrency(Math.max(0, it.price || 0)),
      }))
    );
    await supabase.from('order_items').insert(itemsToInsert);
  }
};

export const sbUpdateOrderStatus = async (orderNumber: string, status: Order['status']) => {
  if (!supabase || !(await isSignedIn())) return;
  await supabase.from('orders').update({ status }).eq('order_number', orderNumber);
};

export const sbDeleteOrder = async (orderNumber: string) => {
  if (!supabase || !(await isSignedIn())) return;
  await supabase.from('orders').delete().eq('order_number', orderNumber);
};

export const sbSavePurchase = async (p: Purchase, channel: 'CASH' | 'VIRTUAL' = 'CASH') => {
  if (!supabase || !(await isSignedIn())) return;
  let supplierUuid: string | null = null;
  if (p.supplierId) {
    const { data } = await supabase.from('suppliers').select('id').eq('legacy_id', p.supplierId).maybeSingle();
    supplierUuid = data?.id || null;
  }

  const { data: purchRow, error } = await supabase
    .from('purchases')
    .insert({
      supplier_id: supplierUuid,
      supplier_name: p.supplierName || 'Proveedor',
      date: p.date || new Date().toISOString(),
      total: roundCurrency(Math.max(0, p.total || 0)),
      channel,
      status: 'COMPLETED',
      notes: p.notes || null,
    })
    .select('id')
    .single();

  if (error || !purchRow) {
    console.warn('sbSavePurchase error:', error?.message);
    return;
  }

  if (p.items && p.items.length > 0) {
    const itemsToInsert = [];
    for (const it of p.items) {
      const productUuid = await resolveProductUuid(it.productId);
      if (!productUuid) continue;
      itemsToInsert.push({
        purchase_id: purchRow.id,
        product_id: productUuid,
        variant_id: await resolveVariantUuid(it.variantId),
        variant_name: it.variantName || null,
        name: (it as any).name || (it as any).productName || 'Producto',
        quantity: Math.max(0.001, roundQty(it.quantity || 1)),
        unit_cost: roundCurrency(Math.max(0, it.unitCost || 0)),
        total: roundCurrency(Math.max(0, it.total || 0)),
      });
    }
    if (itemsToInsert.length > 0) {
      await supabase.from('purchase_items').insert(itemsToInsert);
    }
  }
};

export const sbUpdateSettings = async (s: BusinessSettings) => {
  if (!supabase || !(await isSignedIn())) return;
  const { error } = await supabase
    .from('business_settings')
    .update({
      name: s.name,
      address: s.address || '',
      phone: s.phone || '',
      email: s.email || '',
      website: s.website || '',
      tax_id: s.taxId || '',
      currency: s.currency || 'MXN',
      tax_rate: s.taxRate || 0,
      enable_tax: Boolean(s.enableTax),
      logo_url: s.logo || null,
      receipt_logo_url: s.receiptLogo || null,
      receipt_header: s.receiptHeader || '',
      receipt_footer: s.receiptFooter || '',
      ticket_paper_width: s.ticketPaperWidth || '58mm',
      invoice_padding: s.invoicePadding || 10,
      theme: s.theme || 'light',
      budget_config: s.budgetConfig,
      sound_config: s.soundConfig,
      security_config: s.securityConfig,
      print_config: s.printConfig,
      production_doc: s.productionDoc,
    })
    .eq('id', 1);
  if (error) console.warn('sbUpdateSettings error:', error.message);
};

// --- USERS, AUTH RECOVERY & ACTIVITY LOGS ---

export const sbAdminUpdateProfile = async (
  targetId: string,
  fullName: string,
  role: 'ADMIN' | 'MANAGER' | 'CASHIER',
  active: boolean
): Promise<{ ok: boolean; message?: string }> => {
  if (!supabase || !(await isSignedIn())) {
    return { ok: false, message: 'Sesión de Supabase no activa.' };
  }

  // Prefer hardened server-side RPC (from migration 005)
  const { error: rpcError } = await supabase.rpc('rpc_admin_update_profile', {
    p_target_id: targetId,
    p_full_name: fullName,
    p_role: role,
    p_active: active,
  });

  if (!rpcError) return { ok: true };

  // Fallback if migration 005 hasn't been executed yet
  if (rpcError.message?.includes('rpc_admin_update_profile')) {
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName, role, active })
      .eq('id', targetId);
    if (error) return { ok: false, message: error.message };
    return { ok: true };
  }

  return { ok: false, message: rpcError.message };
};

export const sbSendPasswordRecovery = async (email: string): Promise<{ ok: boolean; message: string }> => {
  if (!supabase) return { ok: false, message: 'Supabase no configurado.' };
  const redirectTo = typeof window !== 'undefined' ? window.location.origin : undefined;
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
  if (error) return { ok: false, message: error.message };
  return { ok: true, message: `Se envió el enlace de recuperación a ${email.trim()}.` };
};

export const sbSendMagicLink = async (email: string): Promise<{ ok: boolean; message: string }> => {
  if (!supabase) return { ok: false, message: 'Supabase no configurado.' };
  const redirectTo = typeof window !== 'undefined' ? window.location.origin : undefined;
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim(),
    options: { emailRedirectTo: redirectTo, shouldCreateUser: false },
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true, message: `Se envió un Magic Link de acceso rápido a ${email.trim()}.` };
};

export const sbUpdateMyPassword = async (newPassword: string): Promise<{ ok: boolean; message: string }> => {
  if (!supabase) return { ok: false, message: 'Supabase no configurado.' };
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { ok: false, message: error.message };
  return { ok: true, message: 'Contraseña actualizada correctamente.' };
};

export const sbVerifyCurrentUserPassword = async (email: string, password: string): Promise<boolean> => {
  if (!supabase || !email) return false;
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return !error;
};

export const sbLogActivity = async (
  action: string,
  details: string,
  userName: string,
  userRole: string,
  userId?: string
) => {
  if (!supabase || !(await isSignedIn())) return;
  const isUuid = Boolean(userId && /^[0-9a-f-]{36}$/i.test(userId));
  await supabase.from('activity_logs').insert({
    user_id: isUuid ? userId : null,
    user_name: userName,
    user_role: userRole,
    action,
    details,
  });
};
