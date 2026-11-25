import { describe, it, expect } from 'vitest';
import {
  roundCurrency,
  roundQty,
  safePercent,
  parseLocalDate,
  formatLocalDateInput,
  addLocalDays,
  addMonthsClamped,
  getCartItemKey,
  generateId,
  escapeHtml,
  computePhysicalCashBalance,
} from '../utils/financeHelpers';

describe('financeHelpers', () => {
  it('rounds currency safely without float drift', () => {
    expect(roundCurrency(0.1 + 0.2)).toBe(0.3);
    expect(roundCurrency(10.005)).toBe(10.01);
    expect(roundCurrency(NaN)).toBe(0);
    expect(roundQty(0.1 + 0.2)).toBe(0.3);
  });

  it('safePercent avoids NaN, Infinity, and 50000% bugs when total <= 0', () => {
    expect(safePercent(500, 0)).toBe(0);
    expect(safePercent(500, -100)).toBe(0);
    expect(safePercent(25, 100)).toBe(25);
    expect(safePercent(1, 3)).toBe(33.33);
  });

  it('parseLocalDate parses YYYY-MM-DD in local timezone without UTC shift', () => {
    const d = parseLocalDate('2026-02-04');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(1);
    expect(d.getDate()).toBe(4);
    expect(d.getHours()).toBe(0);
    expect(formatLocalDateInput(d)).toBe('2026-02-04');
  });

  it('addMonthsClamped clamps month-end dates properly (Jan 31 -> Feb 28)', () => {
    const feb = addMonthsClamped(2026, 0, 31, 1);
    expect(formatLocalDateInput(feb)).toBe('2026-02-28');
    const febLeap = addMonthsClamped(2024, 0, 31, 1);
    expect(formatLocalDateInput(febLeap)).toBe('2024-02-29');
  });

  it('addLocalDays adds calendar days cleanly', () => {
    const start = parseLocalDate('2026-03-07');
    const next = addLocalDays(start, 14);
    expect(formatLocalDateInput(next)).toBe('2026-03-21');
  });

  it('getCartItemKey distinguishes variants of the same product', () => {
    expect(getCartItemKey({ id: 'p1' })).toBe('p1');
    expect(getCartItemKey({ id: 'p1', variantId: 'v1' })).toBe('p1::v1');
    expect(getCartItemKey({ id: 'p1', variantId: 'v2' })).not.toBe(getCartItemKey({ id: 'p1', variantId: 'v1' }));
  });

  it('escapeHtml neutralizes XSS payloads', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    expect(escapeHtml(null)).toBe('');
  });

  it('generateId produces unique non-empty IDs', () => {
    const a = generateId();
    const b = generateId();
    expect(a.length).toBeGreaterThan(8);
    expect(a).not.toBe(b);
  });

  it('computePhysicalCashBalance ignores VIRTUAL channel and stops at last CLOSE', () => {
    const movements = [
      { type: 'OPEN', amount: 500, date: '2026-02-04T09:00:00Z', channel: 'CASH' },
      { type: 'DEPOSIT', amount: 200, date: '2026-02-04T10:00:00Z', channel: 'CASH' },
      { type: 'DEPOSIT', amount: 999, date: '2026-02-04T10:05:00Z', channel: 'VIRTUAL' },
      { type: 'EXPENSE', amount: 50, date: '2026-02-04T11:00:00Z', channel: 'CASH' },
      { type: 'CLOSE', amount: 1000, date: '2026-02-03T20:00:00Z', channel: 'CASH' },
      { type: 'OPEN', amount: 1000, date: '2026-02-03T09:00:00Z', channel: 'CASH' },
    ];
    const res = computePhysicalCashBalance(movements);
    expect(res.isOpen).toBe(true);
    expect(res.balance).toBe(650);
  });
});
