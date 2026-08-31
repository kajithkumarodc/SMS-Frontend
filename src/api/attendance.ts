import api from '../lib/api';
import type { Student } from './students';

export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE';

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
