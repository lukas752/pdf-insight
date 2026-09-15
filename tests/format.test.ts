import { describe, expect, it } from 'vitest';
import { formatAmount, formatDate, formatRelativeTime } from '../src/lib/format';

describe('formatAmount', () => {
  it('formats PLN with Polish grouping and the zł symbol', () => {
    const text = formatAmount({ value: 12500, currency: 'PLN', context: 'x' });
    expect(text.replace(/\s/g, ' ')).toContain('12 500,00');
    expect(text).toContain('zł');
  });

  it('falls back to a plain rendering for an invalid currency code', () => {
    expect(formatAmount({ value: 10, currency: '???', context: 'x' })).toContain('???');
  });
});

describe('formatDate', () => {
  it('renders an ISO date in Polish', () => {
    expect(formatDate('2026-10-01')).toBe('1 października 2026');
  });

  it('returns the input when it is not a date', () => {
    expect(formatDate('nieznana')).toBe('nieznana');
  });
});

describe('formatRelativeTime', () => {
  const now = new Date('2026-09-15T12:00:00Z');

  it('describes past moments in Polish', () => {
    expect(formatRelativeTime('2026-09-15T11:59:40Z', now)).toBe('przed chwilą');
    expect(formatRelativeTime('2026-09-15T11:45:00Z', now)).toBe('15 min temu');
    expect(formatRelativeTime('2026-09-15T09:00:00Z', now)).toBe('3 godz. temu');
    expect(formatRelativeTime('2026-09-14T09:00:00Z', now)).toBe('1 dzień temu');
    expect(formatRelativeTime('2026-09-10T09:00:00Z', now)).toBe('5 dni temu');
  });
});
