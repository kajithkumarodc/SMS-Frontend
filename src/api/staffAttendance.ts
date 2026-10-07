import api from '../lib/api';
import type { LookupOption } from './staffMembers';

export type StaffAttendanceStatus = 'PRESENT' | 'LATE' | 'ABSENT' | 'HALF_DAY' | 'HOLIDAY' | 'HALF_DAY_SECOND_HALF';

/** The marks on the page, in display order (`StaffAttendanceStatus` on the backend). */
export const STAFF_ATTENDANCE_STATUSES: { value: StaffAttendanceStatus; label: string }[] = [
  { value: 'PRESENT', label: 'Present' },
  { value: 'LATE', label: 'Late' },
  { value: 'ABSENT', label: 'Absent' },
  { value: 'HALF_DAY', label: 'Half Day' },
  { value: 'HOLIDAY', label: 'Holiday' },
  { value: 'HALF_DAY_SECOND_HALF', label: 'Half Day (Second Half)' },
];

/** One staff member and the mark saved for the day, if any (`StaffAttendanceDtos.RosterRow`). */
export type StaffAttendanceRow = {
  staffProfileId: string;
  staffId: string;
  fullName: string;
  roleName: string | null;
  status: StaffAttendanceStatus | null;
  date: string | null;
  source: string;
  /** `HH:mm:ss`, or null. */
  entryTime: string | null;
  exitTime: string | null;
  note: string | null;
};

export type StaffAttendanceEntry = {
  staffProfileId: string;
  status: StaffAttendanceStatus;
  /** `HH:mm` */
  entryTime: string | null;
  exitTime: string | null;
  note: string | null;
};

export async function fetchStaffAttendanceRoles(): Promise<LookupOption[]> {
  const { data } = await api.get<LookupOption[]>('/v1/staff-attendance/roles');
  return data;
}

export async function fetchStaffAttendance(roleId: string, date: string): Promise<StaffAttendanceRow[]> {
  const { data } = await api.get<StaffAttendanceRow[]>('/v1/staff-attendance', { params: { roleId, date } });
  return data;
}

export async function saveStaffAttendance(date: string, entries: StaffAttendanceEntry[]): Promise<number> {
  const { data } = await api.put<{ saved: number }>('/v1/staff-attendance', { date, entries });
  return data.saved;
}
