export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const monthName = (month: number): string => MONTH_NAMES[month - 1] ?? String(month);

/** "September-2026", as on the Proceed To Pay form. */
export const monthYearLabel = (month: number, year: number): string => `${monthName(month)}-${year}`;

export const PAYROLL_STATUS_LABEL = {
  NOT_GENERATED: 'Not Generated',
  GENERATED: 'Generated',
  PAID: 'Paid',
} as const;

/** Rounds to cents so sums of typed amounts never show float noise. */
export const roundMoney = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;
