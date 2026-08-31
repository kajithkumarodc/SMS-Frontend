import { AxiosError } from 'axios';
import api from '../lib/api';

export type StudentStatus = 'ACTIVE' | 'INACTIVE';

export type Student = {
  id: string;
  schoolId: string;
  fullName: string;
  admissionNumber: string;
  dateOfBirth: string | null;
  guardianName: string | null;
  guardianContact: string | null;
  status: StudentStatus;
  sectionId: string | null;
  createdAt: string;
};

/** Shape of Spring's `PagedModel` response. */
export type StudentsPage = {
  content: Student[];
  page: {
    size: number;
    number: number;
    totalElements: number;
    totalPages: number;
  };
};

export type FetchStudentsParams = {
  /** Zero-based page index, as the backend expects. */
  page: number;
  size: number;
};

export async function fetchStudents(params: FetchStudentsParams): Promise<StudentsPage> {
  const { data } = await api.get<StudentsPage>('/v1/students', { params });
  return data;
}

export type CreateStudentInput = {
  schoolId: string;
  fullName: string;
  admissionNumber: string;
  dateOfBirth?: string | null;
  guardianName?: string | null;
  guardianContact?: string | null;
};

/**
 * Thrown when the backend rejects a create with 409 because the admission
 * number is already used within the tenant. `message` is safe to show inline.
 */
export class DuplicateAdmissionNumberError extends Error {
  constructor() {
    super('This admission number is already in use');
    this.name = 'DuplicateAdmissionNumberError';
  }
}

export async function createStudent(input: CreateStudentInput): Promise<Student> {
  try {
    const { data } = await api.post<Student>('/v1/students', input);
    return data;
  } catch (error) {
    if ((error as AxiosError).response?.status === 409) {
      throw new DuplicateAdmissionNumberError();
    }
    throw error;
  }
}

export type UpdateStudentInput = {
  fullName: string;
  guardianName?: string | null;
  guardianContact?: string | null;
  status: StudentStatus;
};

/** Edit a student's mutable fields. admission_number is immutable server-side and not sent. */
export async function updateStudent(id: string, input: UpdateStudentInput): Promise<Student> {
  const { data } = await api.put<Student>(`/v1/students/${id}`, input);
  return data;
}

/** Deactivate (soft delete) or reactivate a student. No row is removed. */
export async function changeStudentStatus(id: string, status: StudentStatus): Promise<Student> {
  const { data } = await api.patch<Student>(`/v1/students/${id}/status`, { status });
  return data;
}

/** Assign / reassign a student to a section (SCHOOL_ADMIN only server-side). */
export async function assignStudentSection(id: string, sectionId: string): Promise<Student> {
  const { data } = await api.patch<Student>(`/v1/students/${id}/section`, { sectionId });
  return data;
}

export type SchoolOption = {
  id: string;
  name: string;
};

/**
 * Minimal schools directory for the enrolment form's school picker.
 * Follow-up: replace with a real schools/campus module and management UI.
 */
export async function fetchSchools(): Promise<SchoolOption[]> {
  const { data } = await api.get<SchoolOption[]>('/v1/schools');
  return data;
}
