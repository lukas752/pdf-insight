import { messages } from './messages';
import type { Amount } from './schema';

const LOCALE = 'pl-PL';

export function formatAmount(amount: Amount): string {
  try {
    return new Intl.NumberFormat(LOCALE, { style: 'currency', currency: amount.currency }).format(
      amount.value,
    );
  } catch {
    // Unknown currency code – Intl throws a RangeError; fall back to a plain rendering.
    return `${new Intl.NumberFormat(LOCALE).format(amount.value)} ${amount.currency}`;
  }
}

/** ISO date (YYYY-MM-DD) → "1 października 2026"; anything unparsable is returned as-is. */
export function formatDate(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return isoDate;
  }
  return new Intl.DateTimeFormat(LOCALE, { dateStyle: 'long' }).format(date);
}

export function formatLanguage(code: string): string {
  try {
    return new Intl.DisplayNames([LOCALE], { type: 'language' }).of(code) ?? code;
  } catch {
    return code;
  }
}

export function formatRelativeTime(isoDateTime: string, now: Date = new Date()): string {
  const then = new Date(isoDateTime).getTime();
  if (Number.isNaN(then)) {
    return '';
  }
  const minutes = Math.floor((now.getTime() - then) / 60_000);
  if (minutes < 1) {
    return messages.time.justNow;
  }
  if (minutes < 60) {
    return messages.time.minutesAgo(minutes);
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return messages.time.hoursAgo(hours);
  }
  return messages.time.daysAgo(Math.floor(hours / 24));
}
