import api from '../lib/api';
import type { CreateStudentInput, Student } from './students';

export type EnquiryStatus = 'ACTIVE' | 'FOLLOW_UP' | 'WON' | 'PASSIVE' | 'LOST' | 'DEAD';
export type FollowUpType = 'CALL' | 'EMAIL' | 'SMS' | 'WHATSAPP' | 'VISIT' | 'OTHER';

/** Mirrors the backend's `EnquiryDtos.EnquiryResponse`. */
export type Enquiry = {
  id: string;
  enquiryNumber: string;
  applicantName: string;
  guardianName: string | null;
  phone: string | null;
  email: string | null;
  classId: string | null;
  className: string | null;
  enquiryDate: string;
  sourceId: string | null;
  sourceName: string | null;
  academicYearId: string | null;
  academicYearName: string | null;
  assignedStaffUserId: string | null;
  assignedStaffName: string | null;
  followUpDate: string | null;
  followUpNotes: string | null;
  status: EnquiryStatus;
  remarks: string | null;
  convertedStudentId: string | null;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
};

export type EnquirySource = {
  id: string;
  name: string;
  active: boolean;
};

export type FollowUp = {
  id: string;
  enquiryId: string;
  followUpDate: string;
  followUpType: FollowUpType;
  notes: string | null;
  staffUserId: string | null;
  staffName: string | null;
  nextFollowUpDate: string | null;
  createdAt: string;
};

export type AssignableStaff = {
  id: string;
  fullName: string;
  email: string;
};

/** One row of the "Enquiries by source/class" breakdown. `id` is null for the "Not specified" bucket. */
export type EnquiryGroupCount = {
  id: string | null;
  label: string;
  count: number;
};

export type AcademicYearBadge = {
  id: string;
  name: string;
};

export type EnquirySummary = {
  totalEnquiries: number;
  activeEnquiries: number;
  followUpsDue: number;
  converted: number;
  lost: number;
  bySource: EnquiryGroupCount[];
  byClass: EnquiryGroupCount[];
  academicYear: AcademicYearBadge | null;
  recent: Enquiry[];
};

type PagedModel<T> = {
  content: T[];
  page: { size: number; number: number; totalElements: number; totalPages: number };
};

export type EnquiryFilter = {
  q?: string;
  status?: EnquiryStatus;
  sourceId?: string;
  classId?: string;
  assignedStaffUserId?: string;
  from?: string;
  to?: string;
  includeArchived?: boolean;
  page: number;
  size: number;
};

export async function fetchEnquiries(filter: EnquiryFilter): Promise<PagedModel<Enquiry>> {
  const { data } = await api.get<PagedModel<Enquiry>>('/v1/enquiries', { params: filter });
  return data;
}

export async function fetchEnquiry(id: string): Promise<Enquiry> {
  const { data } = await api.get<Enquiry>(`/v1/enquiries/${id}`);
  return data;
}

export async function fetchEnquirySummary(): Promise<EnquirySummary> {
  const { data } = await api.get<EnquirySummary>('/v1/enquiries/summary');
  return data;
}

export async function fetchAssignableStaff(): Promise<AssignableStaff[]> {
  const { data } = await api.get<AssignableStaff[]>('/v1/enquiries/assignable-staff');
  return data;
}

export async function fetchEnquirySources(): Promise<EnquirySource[]> {
  const { data } = await api.get<EnquirySource[]>('/v1/enquiry-sources');
  return data;
}

export async function createEnquirySource(name: string): Promise<EnquirySource> {
  const { data } = await api.post<EnquirySource>('/v1/enquiry-sources', { name });
  return data;
}

export type CreateEnquiryInput = {
  applicantName: string;
  guardianName?: string | null;
  phone?: string | null;
  email?: string | null;
  classId?: string | null;
  enquiryDate?: string | null;
  sourceId?: string | null;
  assignedStaffUserId?: string | null;
  remarks?: string | null;
  academicYearId?: string | null;
};

export async function createEnquiry(input: CreateEnquiryInput): Promise<Enquiry> {
  const { data } = await api.post<Enquiry>('/v1/enquiries', input);
  return data;
}

export type UpdateEnquiryInput = {
  applicantName: string;
  guardianName?: string | null;
  phone?: string | null;
  email?: string | null;
  classId?: string | null;
  sourceId?: string | null;
  assignedStaffUserId?: string | null;
  remarks?: string | null;
  academicYearId?: string | null;
};

export async function updateEnquiry(id: string, input: UpdateEnquiryInput): Promise<Enquiry> {
  const { data } = await api.put<Enquiry>(`/v1/enquiries/${id}`, input);
  return data;
}

export async function changeEnquiryStatus(id: string, status: EnquiryStatus): Promise<Enquiry> {
  const { data } = await api.patch<Enquiry>(`/v1/enquiries/${id}/status`, { status });
  return data;
}

export async function setEnquiryArchived(id: string, archived: boolean): Promise<Enquiry> {
  const { data } = await api.patch<Enquiry>(`/v1/enquiries/${id}/archive`, { archived });
  return data;
}

export type RecordFollowUpInput = {
  followUpDate: string;
  followUpType: FollowUpType;
  notes?: string | null;
  nextFollowUpDate?: string | null;
};

export async function recordFollowUp(enquiryId: string, input: RecordFollowUpInput): Promise<FollowUp> {
  const { data } = await api.post<FollowUp>(`/v1/enquiries/${enquiryId}/follow-ups`, input);
  return data;
}

export async function fetchFollowUps(enquiryId: string): Promise<FollowUp[]> {
  const { data } = await api.get<FollowUp[]>(`/v1/enquiries/${enquiryId}/follow-ups`);
  return data;
}

export type EnquiryConversionResult = {
  student: Student;
  enquiry: Enquiry;
};

/**
 * Converts an enquiry to a real student admission -- the payload is the same shape the
 * Students module's own admission form uses (schoolId/admissionNumber/dateOfBirth are
 * not on the enquiry and must be supplied here). 409 if already converted or the
 * admission number is taken.
 */
export async function convertEnquiryToStudent(
  enquiryId: string,
  input: CreateStudentInput,
): Promise<EnquiryConversionResult> {
  const { data } = await api.post<EnquiryConversionResult>(`/v1/enquiries/${enquiryId}/convert`, input);
  return data;
}
