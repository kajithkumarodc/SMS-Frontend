import dayjs from 'dayjs';

/** Wire format the backend expects and returns for plain dates (`LocalDate`). */
export const API_DATE_FORMAT = 'YYYY-MM-DD';

/** How plain dates are shown and typed in tables, pickers and exports. */
export const DISPLAY_DATE_FORMAT = 'MM/DD/YYYY';

/** `2026-09-29` -> `09/29/2026`; empty string for null/blank. */
export function formatDisplayDate(value: string | null | undefined): string {
  if (!value) return '';
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format(DISPLAY_DATE_FORMAT) : value;
}

export function todayApiDate(): string {
  return dayjs().format(API_DATE_FORMAT);
}
