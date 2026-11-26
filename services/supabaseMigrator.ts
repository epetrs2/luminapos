import { supabase } from './supabaseClient';
import { Product, Customer, Supplier, BusinessSettings } from '../types';

export interface MigrationReport {
  categories: number;
  products: number;
  variants: number;
  customers: number;
  suppliers: number;
  errors: string[];
}

/**
 * Migrates existing local/Google Sheets data into Supabase PostgreSQL safely (idempotent upserts).
 */
export const migrateLocalDataToSupabase = async (data: {
  categories?: string[];
  products?: Product[];
  customers?: Customer[];
  suppliers?: Supplier[];
  settings?: BusinessSettings;
}): Promise<MigrationReport> => {
  const report: MigrationReport = { categories: 0, products: 0, variants: 0, customers: 0, suppliers: 0, errors: [] };
  if (!supabase) {
    report.errors.push('Supabase no está configurado.');
    return report;
  }

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
            price: Number.isFinite(p.price) ? Math.max(0, p.price) : 0,
            cost: Number.isFinite(p.cost) ? Math.max(0, p.cost || 0) : 0,
            stock: Number.isFinite(p.stock) ? p.stock : 0,
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
      report.products += 1;

      if (p.hasVariants && p.variants && p.variants.length > 0) {
        const variantRows = p.variants.map(v => ({
          legacy_id: v.id,
          product_id: insertedProd.id,
          name: v.name,
          sku: v.sku || null,
          price: Number.isFinite(v.price) ? Math.max(0, v.price) : 0,
          stock: Number.isFinite(v.stock) ? v.stock : 0,
        }));
        const { error: vErr } = await supabase.from('product_variants').upsert(variantRows, { onConflict: 'legacy_id' });
        if (vErr) report.errors.push(`Variantes de ${p.name}: ${vErr.message}`);
        else report.variants += variantRows.length;
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
      credit_limit: Number.isFinite(c.creditLimit) ? Math.max(0, c.creditLimit) : 0,
      current_debt: Number.isFinite(c.currentDebt) ? Math.max(0, c.currentDebt) : 0,
      has_unlimited_credit: Boolean(c.hasUnlimitedCredit),
    }));
    const { error } = await supabase.from('customers').upsert(custRows, { onConflict: 'code' });
    if (error) report.errors.push(`Clientes: ${error.message}`);
    else report.customers = custRows.length;
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
    const { error } = await supabase.from('suppliers').upsert(supRows, { onConflict: 'legacy_id' });
    if (error) report.errors.push(`Proveedores: ${error.message}`);
    else report.suppliers = supRows.length;
  }

  // 5. Business Settings
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

  return report;
};
