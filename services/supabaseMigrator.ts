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

export interface MigrationReport {
  categories: number;
  products: number;
  variants: number;
  customers: number;
  suppliers: number;
  transactions: number;
  cashMovements: number;
  orders: number;
  purchases: number;
  errors: string[];
}

/**
 * Migrates existing local/Google Sheets/JSON backup data into Supabase PostgreSQL safely.
 * Automatically sanitizes legacy glitches (empty IDs, duplicate ticket numbers, float rounding).
 */
export const migrateLocalDataToSupabase = async (data: {
  categories?: string[];
  products?: Product[];
  customers?: Customer[];
  suppliers?: Supplier[];
  transactions?: Transaction[];
  cashMovements?: CashMovement[];
  orders?: Order[];
  purchases?: Purchase[];
  settings?: BusinessSettings;
}): Promise<MigrationReport> => {
  const report: MigrationReport = {
    categories: 0,
    products: 0,
    variants: 0,
    customers: 0,
    suppliers: 0,
    transactions: 0,
    cashMovements: 0,
    orders: 0,
    purchases: 0,
    errors: [],
  };

  if (!supabase) {
    report.errors.push('Supabase no está configurado.');
    return report;
  }

  const productLegacyToUuid = new Map<string, string>();
  const variantLegacyToUuid = new Map<string, string>();
  const customerCodeToUuid = new Map<string, string>();
  const supplierLegacyToUuid = new Map<string, string>();

  // 1. Categories
  if (data.categories && data.categories.length > 0) {
    const rows = Array.from(new Set(data.categories.map(c => c.trim()).filter(Boolean))).map(name => ({ name }));
    const { error } = await supabase.from('categories').upsert(rows, { onConflict: 'name' });
    if (error) report.errors.push(`Categorías: ${error.message}`);
    else report.categories = rows.length;
  }

  // 2. Products & Variants
  if (data.products && data.products.length > 0) {
    for (const p of data.products) {
      const { data: insertedProd, error } = await supabase
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
            price: roundCurrency(Number.isFinite(p.price) ? Math.max(0, p.price) : 0),
            cost: roundCurrency(Number.isFinite(p.cost) ? Math.max(0, p.cost || 0) : 0),
            stock: roundQty(Number.isFinite(p.stock) ? p.stock : 0),
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

      if (error || !insertedProd) {
        report.errors.push(`Producto ${p.name}: ${error?.message || 'Error desconocido'}`);
        continue;
      }
      productLegacyToUuid.set(p.id, insertedProd.id);
      report.products += 1;

      if (p.hasVariants && p.variants && p.variants.length > 0) {
        const variantRows = p.variants.map(v => ({
          legacy_id: v.id,
          product_id: insertedProd.id,
          name: v.name,
          sku: v.sku || null,
          price: roundCurrency(Number.isFinite(v.price) ? Math.max(0, v.price) : 0),
          stock: roundQty(Number.isFinite(v.stock) ? v.stock : 0),
        }));
        const { data: insertedVars, error: vErr } = await supabase
          .from('product_variants')
          .upsert(variantRows, { onConflict: 'legacy_id' })
          .select('id, legacy_id');
        if (vErr) report.errors.push(`Variantes de ${p.name}: ${vErr.message}`);
        else {
          report.variants += variantRows.length;
          (insertedVars || []).forEach(v => {
            if (v.legacy_id) variantLegacyToUuid.set(v.legacy_id, v.id);
          });
        }
      }
    }
  }

  // 3. Customers
  if (data.customers && data.customers.length > 0) {
    const custRows = data.customers.map(c => ({
      code: c.id,
      name: c.name,
      email: c.email || '',
      phone: c.phone || '',
      address: c.address || '',
      notes: c.notes || '',
      client_type: c.clientType || 'INDIVIDUAL',
      credit_limit: roundCurrency(Number.isFinite(c.creditLimit) ? Math.max(0, c.creditLimit) : 0),
      current_debt: roundCurrency(Number.isFinite(c.currentDebt) ? Math.max(0, c.currentDebt) : 0),
      has_unlimited_credit: Boolean(c.hasUnlimitedCredit),
    }));
    const { data: insertedCusts, error } = await supabase
      .from('customers')
      .upsert(custRows, { onConflict: 'code' })
      .select('id, code');
    if (error) report.errors.push(`Clientes: ${error.message}`);
    else {
      report.customers = custRows.length;
      (insertedCusts || []).forEach(c => customerCodeToUuid.set(c.code, c.id));
    }
  }

  // 4. Suppliers
  if (data.suppliers && data.suppliers.length > 0) {
    const supRows = data.suppliers.map(s => ({
      legacy_id: s.id,
      name: s.name,
      contact_person: s.contactPerson || '',
      email: s.email || '',
      phone: s.phone || '',
      address: s.address || '',
    }));
    const { data: insertedSups, error } = await supabase
      .from('suppliers')
      .upsert(supRows, { onConflict: 'legacy_id' })
      .select('id, legacy_id');
    if (error) report.errors.push(`Proveedores: ${error.message}`);
    else {
      report.suppliers = supRows.length;
      (insertedSups || []).forEach(s => {
        if (s.legacy_id) supplierLegacyToUuid.set(s.legacy_id, s.id);
      });
    }
  }

  // 5. Business Settings (including logos)
  if (data.settings) {
    const s = data.settings;
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
    if (error) report.errors.push(`Configuración: ${error.message}`);
  }

  // 6. Transactions & Items (sanitizing empty IDs and duplicate ticket numbers)
  if (data.transactions && data.transactions.length > 0) {
    const seenTickets = new Set<string>();
    for (let i = 0; i < data.transactions.length; i++) {
      const tx = data.transactions[i];
      let ticketNumber = (tx.id || '').trim();
      if (!ticketNumber) {
        ticketNumber = `LEGACY-RET-${i + 1}`;
      }
      if (seenTickets.has(ticketNumber)) {
        ticketNumber = `${ticketNumber}-${tx.status || 'dup'}-${i + 1}`;
      }
      seenTickets.add(ticketNumber);

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
            ticket_number: ticketNumber,
            date: tx.date || new Date().toISOString(),
            customer_id: tx.customerId ? customerCodeToUuid.get(tx.customerId) || null : null,
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
        report.errors.push(`Venta #${ticketNumber}: ${error?.message || 'Error desconocido'}`);
        continue;
      }
      report.transactions += 1;

      if (tx.items && tx.items.length > 0) {
        await supabase.from('transaction_items').delete().eq('transaction_id', txRow.id);
        const itemRows = tx.items.map(it => ({
          transaction_id: txRow.id,
          product_id: it.id ? productLegacyToUuid.get(it.id) || null : null,
          variant_id: it.variantId ? variantLegacyToUuid.get(it.variantId) || null : null,
          variant_name: it.variantName || null,
          name: it.name || 'Producto',
          sku: it.sku || '',
          category: it.category || 'General',
          unit: it.unit || 'PIECE',
          is_consignment: Boolean(it.isConsignment),
          quantity: Math.max(0.001, roundQty(it.quantity || 1)),
          price: roundCurrency(Math.max(0, it.price || 0)),
          tax_rate: Number.isFinite(it.taxRate) ? it.taxRate : 0,
        }));
        const { error: itErr } = await supabase.from('transaction_items').insert(itemRows);
        if (itErr) report.errors.push(`Items Venta #${ticketNumber}: ${itErr.message}`);
      }
    }
  }

  // 7. Cash Movements (avoid duplicates if re-migrating)
  if (data.cashMovements && data.cashMovements.length > 0) {
    const { count: existingCashCount } = await supabase
      .from('cash_movements')
      .select('id', { count: 'exact', head: true });

    if (!existingCashCount || existingCashCount === 0) {
      const cashRows = data.cashMovements.map(m => ({
        customer_id: m.customerId ? customerCodeToUuid.get(m.customerId) || null : null,
        type: ['OPEN', 'CLOSE', 'EXPENSE', 'DEPOSIT', 'WITHDRAWAL'].includes(m.type) ? m.type : 'DEPOSIT',
        amount: roundCurrency(Math.max(0, Number.isFinite(m.amount) ? m.amount : 0)),
        description: m.description || '',
        category: m.category || 'OTHER',
        sub_category: m.subCategory || null,
        channel: m.channel === 'VIRTUAL' ? 'VIRTUAL' : 'CASH',
        is_z_cut: Boolean(m.isZCut),
        z_report_data: m.zReportData || null,
        date: m.date || new Date().toISOString(),
      }));
      const { error } = await supabase.from('cash_movements').insert(cashRows);
      if (error) report.errors.push(`Movimientos de caja: ${error.message}`);
      else report.cashMovements = cashRows.length;
    }
  }

  // 8. Orders & Order Items
  if (data.orders && data.orders.length > 0) {
    for (let i = 0; i < data.orders.length; i++) {
      const o = data.orders[i];
      const orderNumber = (o.id || '').trim() || `ORD-LEGACY-${i + 1}`;
      const { data: ordRow, error } = await supabase
        .from('orders')
        .upsert(
          {
            order_number: orderNumber,
            customer_id: o.customerId ? customerCodeToUuid.get(o.customerId) || null : null,
            customer_name: o.customerName || 'Cliente General',
            date: o.date || new Date().toISOString(),
            delivery_date: o.deliveryDate ? o.deliveryDate.slice(0, 10) : null,
            total: roundCurrency(o.total || 0),
            status: ['PENDING', 'IN_PROGRESS', 'READY', 'COMPLETED'].includes(o.status) ? o.status : 'PENDING',
            priority: o.priority === 'HIGH' ? 'HIGH' : 'NORMAL',
            notes: o.notes || null,
          },
          { onConflict: 'order_number' }
        )
        .select('id')
        .single();

      if (error || !ordRow) {
        report.errors.push(`Pedido #${orderNumber}: ${error?.message || 'Error'}`);
        continue;
      }
      report.orders += 1;

      if (o.items && o.items.length > 0) {
        await supabase.from('order_items').delete().eq('order_id', ordRow.id);
        const ordItems = o.items.map(it => ({
          order_id: ordRow.id,
          product_id: it.id ? productLegacyToUuid.get(it.id) || null : null,
          variant_id: it.variantId ? variantLegacyToUuid.get(it.variantId) || null : null,
          variant_name: it.variantName || null,
          name: it.name || 'Producto',
          quantity: Math.max(0.001, roundQty(it.quantity || 1)),
          price: roundCurrency(Math.max(0, it.price || 0)),
        }));
        await supabase.from('order_items').insert(ordItems);
      }
    }
  }

  // 9. Purchases & Purchase Items (only if table empty to avoid duplicates)
  if (data.purchases && data.purchases.length > 0) {
    const { count: existingPurchCount } = await supabase
      .from('purchases')
      .select('id', { count: 'exact', head: true });

    if (!existingPurchCount || existingPurchCount === 0) {
      for (const p of data.purchases) {
        const { data: purchRow, error } = await supabase
          .from('purchases')
          .insert({
            supplier_id: p.supplierId ? supplierLegacyToUuid.get(p.supplierId) || null : null,
            supplier_name: p.supplierName || 'Proveedor',
            date: p.date || new Date().toISOString(),
            total: roundCurrency(Math.max(0, p.total || 0)),
            channel: 'CASH',
            status: 'COMPLETED',
            notes: p.notes || null,
          })
          .select('id')
          .single();

        if (error || !purchRow) {
          report.errors.push(`Compra ${p.id}: ${error?.message || 'Error'}`);
          continue;
        }
        report.purchases += 1;

        if (p.items && p.items.length > 0) {
          const pItems = [];
          for (const it of p.items) {
            const productUuid = it.productId ? productLegacyToUuid.get(it.productId) : null;
            if (!productUuid) continue;
            pItems.push({
              purchase_id: purchRow.id,
              product_id: productUuid,
              variant_id: it.variantId ? variantLegacyToUuid.get(it.variantId) || null : null,
              variant_name: it.variantName || null,
              name: (it as any).name || (it as any).productName || 'Producto',
              quantity: Math.max(0.001, roundQty(it.quantity || 1)),
              unit_cost: roundCurrency(Math.max(0, it.unitCost || 0)),
              total: roundCurrency(Math.max(0, it.total || 0)),
            });
          }
          if (pItems.length > 0) {
            await supabase.from('purchase_items').insert(pItems);
          }
        }
      }
    }
  }

  return report;
};
