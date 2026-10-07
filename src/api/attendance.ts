import api from '../lib/api';
import type { Student } from './students';

export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'HOLIDAY' | 'HALF_DAY';

export type AttendanceRecord = {
  id: string;
  studentId: string;
  date: string; // ISO date, YYYY-MM-DD
  status: AttendanceStatus;
  markedBy: string;
  createdAt: string;
};

type PagedModel<T> = {
  content: T[];
  page: { size: number; number: number; totalElements: number; totalPages: number };
};

/** Students assigned to a section — the marking roster. 404 if the section is not in the tenant. */
export async function fetchSectionRoster(sectionId: string): Promise<Student[]> {
  const { data } = await api.get<PagedModel<Student>>(`/v1/sections/${sectionId}/students`, {
    params: { size: 200 },
  });
  return data.content;
}

/** Attendance already marked for a section on a date (may be partial / empty). */
export async function fetchSectionAttendance(
  sectionId: string,
  date: string,
): Promise<AttendanceRecord[]> {
  const { data } = await api.get<PagedModel<AttendanceRecord>>('/v1/attendance', {
    params: { sectionId, date },
  });
  return data.content;
}

export type MarkAttendanceInput = {
  studentId: string;
  date: string;
  status: AttendanceStatus;
};

/** Upsert one student's attendance for a date. */
export async function markAttendance(input: MarkAttendanceInput): Promise<AttendanceRecord> {
  const { data } = await api.post<AttendanceRecord>('/v1/attendance', input);
  return data;
}

/** One student's full attendance history, most recent first. */
export async function fetchStudentAttendanceHistory(studentId: string): Promise<AttendanceRecord[]> {
  const { data } = await api.get<PagedModel<AttendanceRecord>>(
    `/v1/attendance/student/${studentId}`,
    { params: { size: 200 } },
  );
  return data.content;
}

/** One student on the Student Attendance page and the mark saved for the day, if any (`AttendanceDtos.RosterRow`). */
export type StudentAttendanceRow = {
  studentId: string;
  admissionNumber: string;
  rollNumber: string | null;
  fullName: string;
  status: AttendanceStatus | null;
  date: string | null;
  source: string;
  /** `HH:mm:ss`, or null. */
  entryTime: string | null;
  exitTime: string | null;
  note: string | null;
};

export type StudentAttendanceEntry = {
  studentId: string;
  status: AttendanceStatus;
  /** `HH:mm` */
  entryTime: string | null;
  exitTime: string | null;
  note: string | null;
};

export async function fetchAttendanceRoster(sectionId: string, date: string): Promise<StudentAttendanceRow[]> {
  const { data } = await api.get<StudentAttendanceRow[]>('/v1/attendance/roster', { params: { sectionId, date } });
  return data;
}

export async function saveSectionAttendance(sectionId: string, date: string, entries: StudentAttendanceEntry[]): Promise<number> {
  const { data } = await api.put<{ saved: number }>('/v1/attendance/bulk', { sectionId, date, entries });
  return data.saved;
}
