import { describe, it, expect } from 'vitest';
import {
  mergeRemoteSettings,
  mergeTransactionsSafely,
  resolveCustomerUuidFromMaps,
  sanitizeBusinessSettingsForSupabase,
  sanitizeMigrationTicketNumber,
  prepareCustomersForMigration,
} from '../utils/syncHelpers';
import { BusinessSettings, Customer, Transaction } from '../types';

const baseSettings: BusinessSettings = {
  name: 'Mi Negocio',
  address: '',
  phone: '',
  email: '',
  website: '',
  taxId: '',
  currency: 'MXN',
  taxRate: 0,
  enableTax: false,
  logo: null,
  receiptLogo: null,
  receiptHeader: '',
  receiptFooter: 'Gracias por su preferencia',
  ticketPaperWidth: '58mm',
  invoicePadding: 10,
  theme: 'light',
  budgetConfig: { expensesPercentage: 50, investmentPercentage: 30, profitPercentage: 20 },
  notificationsEnabled: true,
  soundConfig: { enabled: true, volume: 0.5, saleSound: 'SUCCESS', errorSound: 'ERROR', clickSound: 'POP', notificationSound: 'NOTE' },
  securityConfig: { autoLockMinutes: 0, blurAppOnBackground: false },
  printConfig: { customerCopyBehavior: 'ASK' },
  sequences: { customerStart: 1, ticketStart: 1, orderStart: 1, productStart: 1 },
  productionDoc: { title: 'Orden de Producción', showPrices: false, showCustomerContact: true, showDates: true, customFooter: '' },
};

const zajtainSettings: BusinessSettings = {
  ...baseSettings,
  name: 'Zajtain',
  address: 'CDMX',
  phone: '5512345678',
  logo: 'data:image/png;base64,ZAJTAIN_LOGO',
  receiptLogo: 'data:image/png;base64,ZAJTAIN_RECEIPT',
  accountingCutoffDate: '2026-11-01',
};

const makeTx = (overrides: Partial<Transaction>): Transaction => ({
  id: '1056',
  date: '2026-11-21T14:53:00.000Z',
  items: [],
  subtotal: 1335,
  taxAmount: 0,
  discount: 0,
  shipping: 0,
  total: 1335,
  paymentMethod: 'credit',
  paymentStatus: 'pending',
  amountPaid: 0,
  status: 'completed',
  ...overrides,
});

describe('mergeRemoteSettings', () => {
  it('NEVER overwrites configured local Zajtain settings/logo with default empty remote row', () => {
    const merged = mergeRemoteSettings(zajtainSettings, {
      name: 'Mi Negocio',
      logo: null,
      receiptLogo: null,
      address: '',
      phone: '',
    });
    expect(merged.name).toBe('Zajtain');
    expect(merged.logo).toBe('data:image/png;base64,ZAJTAIN_LOGO');
    expect(merged.receiptLogo).toBe('data:image/png;base64,ZAJTAIN_RECEIPT');
    expect(merged.accountingCutoffDate).toBe('2026-11-01');
  });

  it('hydrates a fresh phone device cleanly when remote has Zajtain logo and details', () => {
    const merged = mergeRemoteSettings(baseSettings, {
      name: 'Zajtain',
      logo: 'data:image/png;base64,ZAJTAIN_LOGO',
      address: 'CDMX',
      phone: '5512345678',
    });
    expect(merged.name).toBe('Zajtain');
    expect(merged.logo).toBe('data:image/png;base64,ZAJTAIN_LOGO');
    expect(merged.address).toBe('CDMX');
  });

  it('preserves local accountingCutoffDate when remote omits it', () => {
    const merged = mergeRemoteSettings(zajtainSettings, {
      name: 'Zajtain',
      logo: 'data:image/png;base64,NEW_LOGO',
    });
    expect(merged.logo).toBe('data:image/png;base64,NEW_LOGO');
    expect(merged.accountingCutoffDate).toBe('2026-11-01');
  });
});

describe('mergeTransactionsSafely', () => {
  it('does NOT duplicate renamed legacy return rows when syncing from Supabase', () => {
    const local = [
      makeTx({ id: '', status: 'returned', total: -59 }),
      makeTx({ id: 'a87ce700-b587-4cee-a8f0-a4c007824b66', status: 'returned', total: -59 }),
      makeTx({ id: '1056' }),
    ];
    const remote = [
      makeTx({ id: 'LEGACY-RET-1', status: 'returned', total: -59 }),
      makeTx({ id: 'LEGACY-RET-2', status: 'returned', total: -59 }),
      makeTx({ id: '1056' }),
    ];

    const { merged, toUpload } = mergeTransactionsSafely(local, remote, []);
    expect(toUpload).toHaveLength(0);
    expect(merged.map(t => t.id)).toEqual(['LEGACY-RET-1', 'LEGACY-RET-2', '1056']);
  });

  it('preserves and queues genuine offline pending transactions for auto-upload', () => {
    const offlineSale = makeTx({
      id: '1058',
      deliverySignature: {
        imageDataUrl: 'data:image/png;base64,SIG',
        signedByName: 'Encargado Tienda',
        signedAt: '2026-11-26T18:00:00.000Z',
      },
    });
    const remote = [makeTx({ id: '1056' })];

    const { merged, toUpload } = mergeTransactionsSafely([offlineSale, makeTx({ id: '1056' })], remote, ['1058']);
    expect(toUpload).toHaveLength(1);
    expect(toUpload[0].id).toBe('1058');
    expect(merged).toHaveLength(2);
    expect(merged[0].deliverySignature?.signedByName).toBe('Encargado Tienda');
  });

  it('preserves local deliverySignature and excludeFromReports when remote lacks them', () => {
    const local = [
      makeTx({
        id: '1056',
        excludeFromReports: true,
        deliverySignature: { imageDataUrl: 'data:image/png;base64,SIG', signedByName: 'Juan', signedAt: '2026-11-26T18:00:00.000Z' },
      }),
    ];
    const remote = [makeTx({ id: '1056' })];

    const { merged } = mergeTransactionsSafely(local, remote, []);
    expect(merged[0].deliverySignature?.signedByName).toBe('Juan');
    expect(merged[0].excludeFromReports).toBe(true);
  });
});

describe('customer & ticket migration helpers', () => {
  it('resolves customer UUID by trimmed string ID, numeric ID, or name fallback', () => {
    const codeToUuid = new Map([['C0001', 'uuid-1'], ['12', 'uuid-12']]);
    const nameToUuid = new Map([['casa de campo', 'uuid-1'], ['my gourmet', 'uuid-12']]);

    expect(resolveCustomerUuidFromMaps(' C0001 ', null, codeToUuid, nameToUuid)).toBe('uuid-1');
    expect(resolveCustomerUuidFromMaps(12, null, codeToUuid, nameToUuid)).toBe('uuid-12');
    expect(resolveCustomerUuidFromMaps(undefined, 'Casa de Campo', codeToUuid, nameToUuid)).toBe('uuid-1');
    expect(resolveCustomerUuidFromMaps(undefined, 'Cliente General', codeToUuid, nameToUuid)).toBeNull();
  });

  it('produces 100% unique deterministic ticket numbers even with empty or duplicate legacy IDs', () => {
    const seen = new Set<string>();
    const ids = [
      sanitizeMigrationTicketNumber('', 'returned', 0, seen),
      sanitizeMigrationTicketNumber('', 'returned', 1, seen),
      sanitizeMigrationTicketNumber('a87ce700', 'returned', 2, seen),
      sanitizeMigrationTicketNumber('a87ce700', 'returned', 3, seen),
      sanitizeMigrationTicketNumber('1056', 'completed', 4, seen),
    ];
    expect(new Set(ids).size).toBe(5);
    expect(ids[4]).toBe('1056');
  });

  it('deduplicates customer codes cleanly without losing originalId mapping', () => {
    const list: Customer[] = [
      { id: 'C0001', name: 'Tienda A', email: '', phone: '', address: '', notes: '', clientType: 'BUSINESS', creditLimit: 0, currentDebt: 0 },
      { id: 'C0001', name: 'Tienda B', email: '', phone: '', address: '', notes: '', clientType: 'BUSINESS', creditLimit: 0, currentDebt: 0 },
      { id: '', name: 'Tienda C', email: '', phone: '', address: '', notes: '', clientType: 'INDIVIDUAL', creditLimit: 0, currentDebt: 0 },
    ];
    const prepared = prepareCustomersForMigration(list);
    expect(new Set(prepared.map(p => p.code)).size).toBe(3);
    expect(prepared[0].code).toBe('C0001');
    expect(prepared[1].code).toBe('C0001-2');
    expect(prepared[2].code).toBe('C-LEG-3');
  });

  it('sanitizes business_settings so NOT NULL JSONB and CHECK constraints never fail in Supabase', () => {
    const sanitized = sanitizeBusinessSettingsForSupabase({
      name: 'Zajtain',
      logo: 'data:image/png;base64,ZAJTAIN',
      receiptLogo: 'data:image/png;base64,RECEIPT',
      ticketPaperWidth: 'invalid' as any,
      theme: 'system' as any,
      invoicePadding: 12.7,
      budgetConfig: undefined,
      soundConfig: undefined,
      securityConfig: undefined,
      printConfig: undefined,
      productionDoc: undefined,
    });

    expect(sanitized.id).toBe(1);
    expect(sanitized.name).toBe('Zajtain');
    expect(sanitized.logo_url).toBe('data:image/png;base64,ZAJTAIN');
    expect(sanitized.receipt_logo_url).toBe('data:image/png;base64,RECEIPT');
    expect(sanitized.ticket_paper_width).toBe('58mm');
    expect(sanitized.theme).toBe('light');
    expect(sanitized.invoice_padding).toBe(13);
    expect(sanitized.budget_config).toBeTruthy();
    expect(sanitized.sound_config).toBeTruthy();
    expect(sanitized.security_config).toBeTruthy();
    expect(sanitized.print_config).toBeTruthy();
    expect(sanitized.production_doc).toBeTruthy();
  });
});
