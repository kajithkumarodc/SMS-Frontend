import api from '../lib/api';

export type AdmissionCycleStatus = 'DRAFT' | 'OPEN' | 'CLOSED';
export type AdmissionApplicationStatus = 'SUBMITTED' | 'UNDER_REVIEW' | 'WAITLISTED' | 'APPROVED' | 'REJECTED';

export type SchoolOption = { id: string; name: string };
export type ClassOption = { id: string; name: string };

/** Mirrors the backend's `AdmissionDtos.PublicOpenCycleResponse`. */
export type PublicOpenCycle = {
  id: string;
  name: string;
  description: string | null;
  academicYearName: string | null;
  openDate: string;
  closeDate: string;
};

/** Mirrors the backend's `AdmissionDtos.AdmissionCycleResponse`. */
export type AdmissionCycle = {
  id: string;
  schoolId: string;
  academicYearId: string;
  academicYearName: string | null;
  name: string;
  description: string | null;
  openDate: string;
  closeDate: string;
  status: AdmissionCycleStatus;
  createdAt: string;
};

export type AdmissionApplicationSummary = {
  id: string;
  applicationNumber: string;
  applicantName: string;
  applyingClassName: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  admissionCycleName: string | null;
  submittedAt: string;
  status: AdmissionApplicationStatus;
  reviewedByName: string | null;
  updatedAt: string;
};

export type AdmissionApplicationDocument = {
  id: string;
  documentType: string;
  originalFilename: string;
  contentType: string;
  fileSizeBytes: number;
  uploadedAt: string;
};

/** Mirrors the backend's `AdmissionDtos.AdmissionApplicationDetailResponse`. */
export type AdmissionApplicationDetail = {
  id: string;
  applicationNumber: string;
  admissionCycleId: string;
  admissionCycleName: string | null;
  status: AdmissionApplicationStatus;

  firstName: string;
  middleName: string | null;
  lastName: string;
  dateOfBirth: string;
  gender: string | null;
  bloodGroup: string | null;
  nationality: string | null;
  religion: string | null;
  motherTongue: string | null;
  category: string | null;

  applyingClassId: string | null;
  applyingClassName: string | null;
  previousSchoolName: string | null;
  previousSchoolClass: string | null;
  previousSchoolAdmissionNumber: string | null;
  previousSchoolAddress: string | null;
  admissionSource: string | null;

  guardianName: string | null;
  guardianRelationship: string | null;
  guardianPhone: string | null;
  guardianAlternatePhone: string | null;
  guardianEmail: string | null;
  guardianOccupation: string | null;
  fatherName: string | null;
  fatherMobile: string | null;
  fatherEmail: string | null;
  fatherOccupation: string | null;
  motherName: string | null;
  motherMobile: string | null;
  motherEmail: string | null;
  motherOccupation: string | null;

  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  pincode: string | null;

  reviewedAt: string | null;
  reviewedByName: string | null;
  reviewerNotes: string | null;
  convertedStudentId: string | null;
  convertedGuardianUserId: string | null;

  documents: AdmissionApplicationDocument[];
  submittedAt: string;
  updatedAt: string;
};

export type ApprovalResult = {
  application: AdmissionApplicationDetail;
  studentId: string;
  studentAdmissionNumber: string;
  guardianUserId: string;
  guardianUserCreated: boolean;
  portalInvitationSent: boolean;
};

export type StatusLookupResult = {
  applicationNumber: string;
  admissionCycleName: string | null;
  status: AdmissionApplicationStatus;
  submittedAt: string;
  updatedAt: string;
  message: string;
};

type PagedModel<T> = {
  content: T[];
  page: { size: number; number: number; totalElements: number; totalPages: number };
};

// --- Public ------------------------------------------------------------

export async function fetchPublicSchools(): Promise<SchoolOption[]> {
  const { data } = await api.get<SchoolOption[]>('/v1/public/admissions/schools');
  return data;
}

export async function fetchPublicClasses(schoolId: string): Promise<ClassOption[]> {
  const { data } = await api.get<ClassOption[]>(`/v1/public/admissions/schools/${schoolId}/classes`);
  return data;
}

export async function fetchPublicOpenCycle(schoolId: string): Promise<PublicOpenCycle> {
  const { data } = await api.get<PublicOpenCycle>(`/v1/public/admissions/schools/${schoolId}/open-cycle`);
  return data;
}

export type SubmitApplicationInput = {
  admissionCycleId: string;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  dateOfBirth: string;
  gender?: string | null;
  bloodGroup?: string | null;
  nationality?: string | null;
  religion?: string | null;
  motherTongue?: string | null;
  category?: string | null;
  applyingClassId?: string | null;
  previousSchoolName?: string | null;
  previousSchoolClass?: string | null;
  previousSchoolAdmissionNumber?: string | null;
  previousSchoolAddress?: string | null;
  guardianName?: string | null;
  guardianRelationship?: string | null;
  guardianPhone?: string | null;
  guardianAlternatePhone?: string | null;
  guardianEmail: string;
  guardianOccupation?: string | null;
  fatherName?: string | null;
  fatherMobile?: string | null;
  fatherEmail?: string | null;
  fatherOccupation?: string | null;
  motherName?: string | null;
  motherMobile?: string | null;
  motherEmail?: string | null;
  motherOccupation?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  pincode?: string | null;
};

export type SubmitApplicationResult = { applicationNumber: string; message: string };

export async function submitPublicApplication(input: SubmitApplicationInput): Promise<SubmitApplicationResult> {
  const { data } = await api.post<SubmitApplicationResult>('/v1/public/admissions/applications', input);
  return data;
}

export async function uploadPublicApplicationDocument(
  applicationNumber: string,
  email: string,
  documentType: string,
  file: File,
): Promise<void> {
  const form = new FormData();
  form.append('email', email);
  form.append('documentType', documentType);
  form.append('file', file);
  await api.post(`/v1/public/admissions/applications/${applicationNumber}/documents`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}

export async function fetchPublicApplicationStatus(
  applicationNumber: string,
  email: string,
): Promise<StatusLookupResult> {
  const { data } = await api.post<StatusLookupResult>('/v1/public/admissions/status', { applicationNumber, email });
  return data;
}

export async function activateAccount(token: string, newPassword: string): Promise<void> {
  await api.post('/v1/auth/activate', { token, newPassword });
}

// --- Admin: cycles -------------------------------------------------------

export async function fetchAdmissionCycles(): Promise<AdmissionCycle[]> {
  const { data } = await api.get<AdmissionCycle[]>('/v1/admission-cycles');
  return data;
}

export type CreateAdmissionCycleInput = {
  schoolId: string;
  academicYearId: string;
  name: string;
  description?: string | null;
  openDate: string;
  closeDate: string;
};

export async function createAdmissionCycle(input: CreateAdmissionCycleInput): Promise<AdmissionCycle> {
  const { data } = await api.post<AdmissionCycle>('/v1/admission-cycles', input);
  return data;
}

export async function openAdmissionCycle(id: string): Promise<AdmissionCycle> {
  const { data } = await api.post<AdmissionCycle>(`/v1/admission-cycles/${id}/open`);
  return data;
}

export async function closeAdmissionCycle(id: string): Promise<AdmissionCycle> {
  const { data } = await api.post<AdmissionCycle>(`/v1/admission-cycles/${id}/close`);
  return data;
}

// --- Admin: applications ---------------------------------------------

export type AdmissionApplicationFilter = {
  q?: string;
  status?: AdmissionApplicationStatus;
  admissionCycleId?: string;
  applyingClassId?: string;
  from?: string;
  to?: string;
  page: number;
  size: number;
};

export async function fetchAdmissionApplications(
  filter: AdmissionApplicationFilter,
): Promise<PagedModel<AdmissionApplicationSummary>> {
  const { data } = await api.get<PagedModel<AdmissionApplicationSummary>>('/v1/admission-applications', {
    params: filter,
  });
  return data;
}

export async function fetchAdmissionApplication(id: string): Promise<AdmissionApplicationDetail> {
  const { data } = await api.get<AdmissionApplicationDetail>(`/v1/admission-applications/${id}`);
  return data;
}

export async function startReviewApplication(id: string): Promise<AdmissionApplicationDetail> {
  const { data } = await api.post<AdmissionApplicationDetail>(`/v1/admission-applications/${id}/start-review`);
  return data;
}

export async function rejectApplication(id: string, notes: string): Promise<AdmissionApplicationDetail> {
  const { data } = await api.post<AdmissionApplicationDetail>(`/v1/admission-applications/${id}/reject`, { notes });
  return data;
}

export async function waitlistApplication(id: string, notes?: string): Promise<AdmissionApplicationDetail> {
  const { data } = await api.post<AdmissionApplicationDetail>(`/v1/admission-applications/${id}/waitlist`, { notes });
  return data;
}

export async function reopenApplication(id: string, notes?: string): Promise<AdmissionApplicationDetail> {
  const { data } = await api.post<AdmissionApplicationDetail>(`/v1/admission-applications/${id}/reopen`, { notes });
  return data;
}

export async function approveApplication(id: string, notes?: string): Promise<ApprovalResult> {
  const { data } = await api.post<ApprovalResult>(`/v1/admission-applications/${id}/approve`, { notes });
  return data;
}

export async function fetchApplicationDocuments(id: string): Promise<AdmissionApplicationDocument[]> {
  const { data } = await api.get<AdmissionApplicationDocument[]>(`/v1/admission-applications/${id}/documents`);
  return data;
}

export async function uploadApplicationDocument(
  id: string,
  documentType: string,
  file: File,
  notes?: string,
): Promise<AdmissionApplicationDocument> {
  const form = new FormData();
  form.append('file', file);
  form.append('documentType', documentType);
  if (notes) form.append('notes', notes);
  const { data } = await api.post<AdmissionApplicationDocument>(
    `/v1/admission-applications/${id}/documents`,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return data;
}

export function applicationDocumentDownloadUrl(id: string, documentId: string): string {
  const base = (api.defaults.baseURL ?? '/api').replace(/\/$/, '');
  return `${base}/v1/admission-applications/${id}/documents/${documentId}/download`;
}

export async function deleteApplicationDocument(id: string, documentId: string): Promise<void> {
  await api.delete(`/v1/admission-applications/${id}/documents/${documentId}`);
}
