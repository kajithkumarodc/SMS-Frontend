/** The fixed choices on the Add Staff form; `value` is what the backend stores and accepts. */
export type Option = { value: string; label: string };

export const GENDER_OPTIONS: Option[] = [
  { value: 'MALE', label: 'Male' },
  { value: 'FEMALE', label: 'Female' },
  { value: 'OTHER', label: 'Other' },
];

export const MARITAL_STATUS_OPTIONS: Option[] = [
  { value: 'SINGLE', label: 'Single' },
  { value: 'MARRIED', label: 'Married' },
  { value: 'WIDOWED', label: 'Widowed' },
  { value: 'SEPARATED', label: 'Separated' },
  { value: 'NOT_SPECIFIED', label: 'Not Specified' },
];

export const CONTRACT_TYPE_OPTIONS: Option[] = [
  { value: 'PERMANENT', label: 'Permanent' },
  { value: 'PROBATION', label: 'Probation' },
];

/** The label for a stored value, or the value itself when it isn't in the list. */
export function labelFor(options: Option[], value: string | null | undefined): string | null {
  if (!value) return null;
  return options.find((o) => o.value === value)?.label ?? value;
}
