import { BusinessSettings, Customer, Transaction } from '../types';

const DEFAULT_BUSINESS_NAMES = new Set(['', 'mi negocio', 'luminapos', 'lumina pos']);

export const isDefaultBusinessName = (name?: string | null): boolean => {
  return DEFAULT_BUSINESS_NAMES.has((name || '').trim().toLowerCase());
};

/**
 * Safely merges remote Supabase business_settings into local settings.
 * - On a fresh device (local is default "Mi Negocio" / no logo), remote Zajtain data wins completely.
 * - On a configured device (local is "Zajtain" + logo), an unconfigured/default remote row NEVER wipes local identity or logo!
 * - Always preserves local-only fields like accountingCutoffDate if remote doesn't supply them.
 */
export const mergeRemoteSettings = (
  local: BusinessSettings,
  remote?: Partial<BusinessSettings>
): BusinessSettings => {
  if (!remote) return local;

  const localIsConfigured = !isDefaultBusinessName(local.name) || Boolean(local.logo);
  const remoteIsDefault = isDefaultBusinessName(remote.name) && !remote.logo && !remote.receiptLogo;

  if (localIsConfigured && remoteIsDefault) {
    return local;
  }

  return {
    ...local,
    ...remote,
    name: !isDefaultBusinessName(remote.name) ? (remote.name as string) : local.name,
    logo: remote.logo ?? local.logo ?? null,
    receiptLogo: remote.receiptLogo ?? local.receiptLogo ?? null,
    address: remote.address || local.address || '',
    phone: remote.phone || local.phone || '',
    email: remote.email || local.email || '',
    website: remote.website || local.website || '',
    taxId: remote.taxId || local.taxId || '',
    receiptHeader: remote.receiptHeader || local.receiptHeader || '',
    receiptFooter: remote.receiptFooter || local.receiptFooter || 'Gracias por su preferencia',
    accountingCutoffDate: remote.accountingCutoffDate ?? local.accountingCutoffDate,
  };
};

/**
 * Safely merges remote Supabase transactions with local transactions.
 * - Preserves local deliverySignature and excludeFromReports if remote doesn't have them.
 * - ONLY preserves/rescues local-only transactions that are explicitly queued in pendingTxIds
 *   (genuinely failed offline writes), preventing legacy renamed/empty-ID rows from ever duplicating!
 */
export const mergeTransactionsSafely = (
  localTxs: Transaction[],
  remoteTxs: Transaction[],
  pendingTxIds: string[]
): { merged: Transaction[]; toUpload: Transaction[] } => {
  const localById = new Map<string, Transaction>();
  localTxs.forEach(lt => {
    if (lt.id) localById.set(lt.id, lt);
  });

  const remoteById = new Map<string, Transaction>();
  const dedupedRemote: Transaction[] = [];
  remoteTxs.forEach(rt => {
    if (!rt.id || remoteById.has(rt.id)) return;
    const lt = localById.get(rt.id);
    const enriched: Transaction = {
      ...rt,
      deliverySignature: rt.deliverySignature || lt?.deliverySignature,
      excludeFromReports: rt.excludeFromReports ?? lt?.excludeFromReports,
    };
    remoteById.set(rt.id, enriched);
    dedupedRemote.push(enriched);
  });

  const pendingSet = new Set(pendingTxIds);
  const toUpload: Transaction[] = [];
  const seenLocal = new Set<string>();

  localTxs.forEach(lt => {
    if (!lt.id || remoteById.has(lt.id) || seenLocal.has(lt.id)) return;
    if (pendingSet.has(lt.id)) {
      seenLocal.add(lt.id);
      toUpload.push(lt);
    }
  });

  return {
    merged: [...toUpload, ...dedupedRemote],
    toUpload,
  };
};

/**
 * Normalizes a customer identifier to a canonical trimmed string for reliable map lookups.
 */
export const normalizeId = (id?: string | number | null): string => {
  if (id === undefined || id === null) return '';
  return String(id).trim();
};

/**
 * Resolves a customer UUID from a lookup map using canonical code, raw ID, or case-insensitive name fallback.
 */
export const resolveCustomerUuidFromMaps = (
  customerId: string | number | undefined | null,
  customerName: string | undefined | null,
  codeToUuid: Map<string, string>,
  nameToUuid: Map<string, string>
): string | null => {
  const normId = normalizeId(customerId);
  if (normId) {
    const byCode = codeToUuid.get(normId);
    if (byCode) return byCode;
  }
  const normName = (customerName || '').trim().toLowerCase();
  if (normName && normName !== 'cliente general') {
    const byName = nameToUuid.get(normName);
    if (byName) return byName;
  }
  return null;
};

/**
 * Generates deterministic, unique ticket numbers for migration (handles empty IDs and duplicates cleanly).
 */
export const sanitizeMigrationTicketNumber = (
  rawId: string | undefined | null,
  status: string | undefined,
  index: number,
  seenTickets: Set<string>
): string => {
  let ticketNumber = normalizeId(rawId);
  if (!ticketNumber) {
    ticketNumber = `LEGACY-RET-${index + 1}`;
  }
  if (seenTickets.has(ticketNumber)) {
    let suffix = index + 1;
    let candidate = `${ticketNumber}-${status || 'dup'}-${suffix}`;
    while (seenTickets.has(candidate)) {
      suffix += 1;
      candidate = `${ticketNumber}-${status || 'dup'}-${suffix}`;
    }
    ticketNumber = candidate;
  }
  seenTickets.add(ticketNumber);
  return ticketNumber;
};

/**
 * Sanitizes BusinessSettings for Supabase PostgreSQL so NOT NULL JSONB columns
 * and CHECK constraints (ticket_paper_width, theme, invoice_padding) NEVER reject the write.
 */
export const sanitizeBusinessSettingsForSupabase = (s: Partial<BusinessSettings>) => {
  const validPaperWidth = s.ticketPaperWidth === '80mm' ? '80mm' : '58mm';
  const validTheme = s.theme === 'dark' ? 'dark' : 'light';
  const rawPadding = Number(s.invoicePadding);
  const validPadding = Number.isFinite(rawPadding) && rawPadding >= 0 ? Math.round(rawPadding) : 10;

  return {
    id: 1,
    name: (s.name || '').trim() || 'Mi Negocio',
    address: s.address || '',
    phone: s.phone || '',
    email: s.email || '',
    website: s.website || '',
    tax_id: s.taxId || '',
    currency: s.currency || 'MXN',
    tax_rate: Number.isFinite(Number(s.taxRate)) ? Number(s.taxRate) : 0,
    enable_tax: Boolean(s.enableTax),
    logo_url: s.logo ?? null,
    receipt_logo_url: s.receiptLogo ?? null,
    receipt_header: s.receiptHeader || '',
    receipt_footer: s.receiptFooter || 'Gracias por su preferencia',
    ticket_paper_width: validPaperWidth,
    invoice_padding: validPadding,
    theme: validTheme,
    budget_config: s.budgetConfig || { expensesPercentage: 50, investmentPercentage: 30, profitPercentage: 20 },
    sound_config: s.soundConfig || { enabled: true, volume: 0.5, saleSound: 'SUCCESS', errorSound: 'ERROR', clickSound: 'POP', notificationSound: 'NOTE' },
    security_config: s.securityConfig || { autoLockMinutes: 0, blurAppOnBackground: false },
    print_config: s.printConfig || { customerCopyBehavior: 'ASK' },
    production_doc: s.productionDoc || { title: 'Orden de Producción', showPrices: false, showCustomerContact: true, showDates: true, customFooter: '' },
  };
};

/**
 * Deduplicates customer list for safe batch upsert into Supabase.
 */
export const prepareCustomersForMigration = (customers: Customer[]) => {
  const seenCodes = new Set<string>();
  return customers.map((c, idx) => {
    const originalId = normalizeId(c.id);
    let code = originalId || `C-LEG-${idx + 1}`;
    if (seenCodes.has(code)) {
      code = `${code}-${idx + 1}`;
    }
    seenCodes.add(code);
    return {
      originalId,
      code,
      customer: c,
    };
  });
};
