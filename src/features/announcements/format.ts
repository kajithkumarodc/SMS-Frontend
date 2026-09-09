const POSTED_AT = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });

/** e.g. "9 Sep 2026" — when an announcement was posted. */
export function formatPostedAt(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : POSTED_AT.format(d);
}
