const DATE_FORMAT = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });

/** Format a `YYYY-MM-DD` (or ISO) date string for display; falls back to the raw value. */
export function formatDate(iso: string): string {
  const parsed = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  return Number.isNaN(parsed.getTime()) ? iso : DATE_FORMAT.format(parsed);
}

/** True when a loan's due date is in the past and it hasn't been returned. */
export function isOverdue(dueDate: string, returnedDate: string | null): boolean {
  if (returnedDate) return false;
  const due = new Date(`${dueDate}T23:59:59`);
  return !Number.isNaN(due.getTime()) && due.getTime() < Date.now();
}
