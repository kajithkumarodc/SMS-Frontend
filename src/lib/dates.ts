import dayjs, { type Dayjs } from 'dayjs';

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

/** Wire format for plain times (`LocalTime`). The backend returns `HH:mm:ss`; `HH:mm` is accepted too. */
export const API_TIME_FORMAT = 'HH:mm';

/** How times are shown and typed. */
export const DISPLAY_TIME_FORMAT = 'hh:mm A';

/** A time-of-day string as a Dayjs (on an arbitrary date), or null. */
export function parseApiTime(value: string | null | undefined): Dayjs | null {
  if (!value) return null;
  const parsed = dayjs(`2000-01-01T${value}`);
  return parsed.isValid() ? parsed : null;
}

/** `14:17:00` -> `02:17 PM`; empty string for null/blank. */
export function formatDisplayTime(value: string | null | undefined): string {
  return parseApiTime(value)?.format(DISPLAY_TIME_FORMAT) ?? '';
}
