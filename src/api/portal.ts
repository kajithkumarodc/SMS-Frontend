import { AxiosError } from 'axios';
import api from '../lib/api';
import type { AttendanceStatus } from './attendance';
import type { StudentExamResult } from './exams';

export type PortalStudent = {
  id: string;
  fullName: string;
  admissionNumber: string;
  dateOfBirth: string | null;
  guardianName: string | null;
  guardianContact: string | null;
  status: string;
  sectionId: string | null;
};

export type PortalAttendanceEntry = {
  date: string; // YYYY-MM-DD
  status: AttendanceStatus;
};

type PagedModel<T> = {
  content: T[];
  page: { size: number; number: number; totalElements: number; totalPages: number };
};

/** Thrown when a STUDENT account has no student record linked to it yet (backend 404). */
export class NoLinkedStudentError extends Error {
  constructor() {
    super('no linked student');
    this.name = 'NoLinkedStudentError';
  }
}

/** Thrown when a PARENT asks for a child that is not linked to their account (backend 404). */
export class ChildNotFoundError extends Error {
  constructor() {
    super('child not found');
    this.name = 'ChildNotFoundError';
  }
}

function is404(error: unknown): boolean {
  return (error as AxiosError)?.response?.status === 404;
}

/** STUDENT: the caller's own student record. */
export async function fetchMyStudent(): Promise<PortalStudent> {
  try {
    const { data } = await api.get<PortalStudent>('/v1/me/student');
    return data;
  } catch (error) {
    if (is404(error)) throw new NoLinkedStudentError();
    throw error;
  }
}

/** STUDENT: the caller's own attendance history, most recent first. */
export async function fetchMyAttendance(): Promise<PortalAttendanceEntry[]> {
  try {
    const { data } = await api.get<PagedModel<PortalAttendanceEntry>>('/v1/me/student/attendance', {
      params: { size: 200 },
    });
    return data.content;
  } catch (error) {
    if (is404(error)) throw new NoLinkedStudentError();
    throw error;
  }
}

/** PARENT: every student linked to the caller (may be empty). */
export async function fetchMyChildren(): Promise<PortalStudent[]> {
  const { data } = await api.get<PortalStudent[]>('/v1/me/children');
  return data;
}

/** PARENT: one of the caller's own children's attendance. */
export async function fetchChildAttendance(studentId: string): Promise<PortalAttendanceEntry[]> {
  try {
    const { data } = await api.get<PagedModel<PortalAttendanceEntry>>(
      `/v1/me/children/${studentId}/attendance`,
      { params: { size: 200 } },
    );
    return data.content;
  } catch (error) {
    if (is404(error)) throw new ChildNotFoundError();
    throw error;
  }
}

/** STUDENT: the caller's own exam results. Ownership-scoped — resolved from the caller's own login. */
export async function fetchMyExamResults(): Promise<StudentExamResult[]> {
  try {
    const { data } = await api.get<StudentExamResult[]>('/v1/me/student/results');
    return data;
  } catch (error) {
    if (is404(error)) throw new NoLinkedStudentError();
    throw error;
  }
}

/** PARENT: one of the caller's own children's exam results. 404 (ChildNotFoundError) if not their child. */
export async function fetchChildExamResults(studentId: string): Promise<StudentExamResult[]> {
  try {
    const { data } = await api.get<StudentExamResult[]>(`/v1/me/children/${studentId}/results`);
    return data;
  } catch (error) {
    if (is404(error)) throw new ChildNotFoundError();
    throw error;
  }
}
