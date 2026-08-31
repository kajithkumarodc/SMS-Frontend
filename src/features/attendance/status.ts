import type { AttendanceStatus } from '../../api/attendance';

export const ATTENDANCE_OPTIONS: { label: string; value: AttendanceStatus }[] = [
  { label: 'Present', value: 'PRESENT' },
  { label: 'Absent', value: 'ABSENT' },
  { label: 'Late', value: 'LATE' },
];

/** Ant Design semantic Tag colors — resolved from the active theme, not hardcoded hex. */
export const ATTENDANCE_TAG_COLOR: Record<AttendanceStatus, string> = {
  PRESENT: 'success',
  ABSENT: 'error',
  LATE: 'warning',
};

export function attendanceLabel(status: AttendanceStatus): string {
  return ATTENDANCE_OPTIONS.find((o) => o.value === status)?.label ?? status;
}
