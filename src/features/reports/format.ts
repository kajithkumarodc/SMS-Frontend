const AMOUNT_FORMAT = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Money amount, symbol-free (the tenant's currency isn't exposed yet). */
export function formatAmount(amount: number): string {
  return AMOUNT_FORMAT.format(amount);
}

const LONG_DATE = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });
const SHORT_DATE = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });

function parse(iso: string): Date {
  return new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
}

/** e.g. "2 Mar 2026" — for tables. */
export function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = parse(iso);
  return Number.isNaN(d.getTime()) ? iso : LONG_DATE.format(d);
}

/** e.g. "Mar 2" — for chart axis ticks. */
export function formatShortDate(iso: string): string {
  const d = parse(iso);
  return Number.isNaN(d.getTime()) ? iso : SHORT_DATE.format(d);
}
