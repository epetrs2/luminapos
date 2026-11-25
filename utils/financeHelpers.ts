// Pure, deterministic helpers for currency math, local dates, IDs, and HTML escaping.
// Used across POS, Orders, SalesHistory, Customers, CashRegister, Reports, Dashboard, and printService.

/**
 * Rounds a monetary amount to 2 decimal places safely, avoiding IEEE-754 float drift
 * (e.g., 0.1 + 0.2 = 0.30000000000000004 -> 0.3).
 */
export const roundCurrency = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
};

/**
 * Rounds fractional stock quantities (KG, LITER, METER) to 3 decimal places safely.
 */
export const roundQty = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
};

/**
 * Safe percentage calculation: returns 0 instead of NaN/Infinity/50000% when denominator <= 0.
 */
export const safePercent = (part: number, total: number): number => {
  if (!Number.isFinite(part) || !Number.isFinite(total) || total <= 0) return 0;
  return roundCurrency((part / total) * 100);
};

/**
 * Parses a 'YYYY-MM-DD' date string strictly as LOCAL midnight (00:00:00),
 * preventing the classic UTC off-by-one-day bug in Americas timezones.
 */
export const parseLocalDate = (dateStr: string): Date => {
  if (!dateStr) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr.trim());
  if (match) {
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1;
    const day = parseInt(match[3], 10);
    return new Date(year, month, day, 0, 0, 0, 0);
  }
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }
  return parsed;
};

/**
 * Formats a Date as local 'YYYY-MM-DD' (safe for <input type="date">).
 */
export const formatLocalDateInput = (date: Date = new Date()): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/**
 * Formats a Date as local 'YYYY-MM-DDTHH:mm' (safe for <input type="datetime-local">).
 */
export const formatLocalDateTimeInput = (date: Date = new Date()): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d}T${hh}:${mm}`;
};

/**
 * Adds whole local calendar days without DST 23h/25h millisecond drift.
 */
export const addLocalDays = (date: Date, days: number): Date => {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate() + days, 0, 0, 0, 0);
  return result;
};

/**
 * Adds months while clamping the day-of-month to the target month's last day
 * (e.g., Jan 31 + 1 month -> Feb 28/29, NOT Mar 3).
 */
export const addMonthsClamped = (year: number, monthIndex: number, day: number, deltaMonths: number): Date => {
  const targetFirst = new Date(year, monthIndex + deltaMonths, 1, 0, 0, 0, 0);
  const lastDayOfMonth = new Date(targetFirst.getFullYear(), targetFirst.getMonth() + 1, 0).getDate();
  const clampedDay = Math.min(Math.max(1, day), lastDayOfMonth);
  return new Date(targetFirst.getFullYear(), targetFirst.getMonth(), clampedDay, 0, 0, 0, 0);
};

/**
 * Composite key for cart/order/return items so variants of the same product never collide.
 */
export const getCartItemKey = (item: { id: string; variantId?: string }): string => {
  return item.variantId ? `${item.id}::${item.variantId}` : item.id;
};

/**
 * Generates a unique ID safely even in insecure HTTP LAN contexts where crypto.randomUUID is unavailable.
 */
export const generateId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
};

/**
 * Escapes untrusted strings before interpolating into HTML print templates (prevents XSS).
 */
export const escapeHtml = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

/**
 * Computes the current physical cash register balance from cash movements (excluding VIRTUAL channel).
 * Single source of truth shared between Dashboard.tsx and CashRegister.tsx.
 */
export const computePhysicalCashBalance = (
  cashMovements: Array<{ type: string; amount: number; date: string; channel?: string }>
): { isOpen: boolean; balance: number; sessionStartDate: Date | null } => {
  const physical = cashMovements
    .filter(m => m.channel !== 'VIRTUAL')
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const lastCloseIndex = physical.findIndex(m => m.type === 'CLOSE');
  const sessionMovements = lastCloseIndex === -1 ? physical : physical.slice(0, lastCloseIndex);
  const openMove = sessionMovements.find(m => m.type === 'OPEN');
  const isOpen = !!openMove;

  const rawBalance = sessionMovements.reduce((acc, m) => {
    const amt = Number.isFinite(m.amount) ? m.amount : 0;
    if (m.type === 'OPEN' || m.type === 'DEPOSIT') return acc + amt;
    if (m.type === 'EXPENSE' || m.type === 'WITHDRAWAL') return acc - amt;
    return acc;
  }, 0);

  return {
    isOpen,
    balance: roundCurrency(rawBalance),
    sessionStartDate: openMove ? new Date(openMove.date) : null
  };
};
