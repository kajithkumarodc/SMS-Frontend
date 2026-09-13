const DATE_FORMAT = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });

/** Format a `YYYY-MM-DD` (or ISO) date string for display; falls back to the raw value. */
export function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const parsed = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  return Number.isNaN(parsed.getTime()) ? iso : DATE_FORMAT.format(parsed);
}

const AMOUNT_FORMAT = new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Format a salary/pay amount. The tenant's currency isn't exposed yet, so this stays symbol-free. */
export function formatAmount(amount: number): string {
  return AMOUNT_FORMAT.format(amount);
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** "March 2026" from a 1-12 month + year, as returned by the payroll API. */
export function formatMonthYear(month: number, year: number): string {
  return `${MONTH_NAMES[month - 1] ?? month} ${year}`;
}
