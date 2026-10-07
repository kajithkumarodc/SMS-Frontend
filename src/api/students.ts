import { AxiosError } from 'axios';
import api from '../lib/api';

export type StudentStatus = 'ACTIVE' | 'INACTIVE' | 'GRADUATED' | 'LEFT_SCHOOL' | 'TRANSFERRED';

export type Gender = 'MALE' | 'FEMALE' | 'OTHER';
export type GuardianRelationship = 'FATHER' | 'MOTHER' | 'GUARDIAN' | 'OTHER';
export type BloodGroup = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-' | 'UNKNOWN';
export type PreferredLanguage = 'ENGLISH' | 'TAMIL' | 'HINDI' | 'OTHER';

/** Mirrors the backend's `StudentDtos.StudentResponse` (plan Phase 3 -- full admission-form field set). */
export type Student = {
  id: string;
  schoolId: string;
  fullName: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  gender: Gender | null;
  dateOfBirth: string | null;
  admissionNumber: string;
  admissionDate: string | null;
  rollNumber: string | null;
  enrollmentNumber: string | null;
  sectionId: string | null;
  bloodGroup: BloodGroup | null;
  nationality: string | null;
  religion: string | null;
  motherTongue: string | null;
  category: string | null;
  previousSchoolName: string | null;
  previousSchoolClass: string | null;
  previousSchoolAdmissionNumber: string | null;
  previousSchoolAddress: string | null;
  transferCertificateNumber: string | null;
  admissionSource: string | null;
  rteStatus: boolean;
  photoUrl: string | null;
  familyId: string | null;

  guardianName: string | null;
  guardianRelationship: GuardianRelationship | null;
  guardianPhone: string | null;
  guardianAlternatePhone: string | null;
  guardianEmail: string | null;
  guardianOccupation: string | null;
  guardianContact: string | null;

  fatherName: string | null;
  fatherMobile: string | null;
  fatherEmail: string | null;
  fatherOccupation: string | null;
  motherName: string | null;
  motherMobile: string | null;
  motherEmail: string | null;
  motherOccupation: string | null;

  emergencyContactName: string | null;
  emergencyContactRelationship: GuardianRelationship | null;
  emergencyContactMobile: string | null;
  emergencyContactAlternateMobile: string | null;
  emergencyContactAddress: string | null;

  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  currentCountry: string | null;
  pincode: string | null;
  permanentAddressLine1: string | null;
  permanentAddressLine2: string | null;
  permanentCity: string | null;
  permanentState: string | null;
  permanentCountry: string | null;
  permanentPincode: string | null;

  smsNotificationsEnabled: boolean;
  whatsappNotificationsEnabled: boolean;
  emailNotificationsEnabled: boolean;
  preferredLanguage: PreferredLanguage;

  status: StudentStatus;
  transportRouteId: string | null;
  hostelRoomId: string | null;
  createdAt: string;
  extra: StudentExtra;
};

/** Admission-form fields added with the Smart School layout (medium, caste, bank details, ...). */
export type StudentExtra = {
  mediumId: string | null;
  caste: string | null;
  mobileNumber: string | null;
  email: string | null;
  height: string | null;
  weight: string | null;
  measurementDate: string | null;
  medicalHistory: string | null;
  guardianAddress: string | null;
  bankAccountNumber: string | null;
  bankName: string | null;
  ifscCode: string | null;
  note: string | null;
};

export type StudentImportRow = {
  row: number;
  admissionNumber: string | null;
  name: string;
  status: 'IMPORTED' | 'SKIPPED';
  messages: string[];
};
export type StudentImportResult = { imported: number; skipped: number; rows: StudentImportRow[] };

/** Admits every row of a Smart School format CSV into one section. */
export async function importStudents(file: File, sectionId: string, mediumId?: string): Promise<StudentImportResult> {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.post<StudentImportResult>('/v1/students/import', form, {
    params: { sectionId, mediumId },
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

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

/** Search/filter (plan Phase 3 section 4). Every field is optional; omitted = unbounded. */
export type StudentSearchParams = {
  q?: string;
  sectionId?: string;
  classId?: string;
  category?: string;
  gender?: Gender;
  status?: StudentStatus;
  rteStatus?: boolean;
  page: number;
  size: number;
};

export async function searchStudents(params: StudentSearchParams): Promise<StudentsPage> {
  const { data } = await api.get<StudentsPage>('/v1/students', { params });
  return data;
}

/** Every student matching the filters (all pages), for screens that list, sort and export on the client. */
export async function fetchAllStudents(params: Omit<StudentSearchParams, 'page' | 'size'>): Promise<Student[]> {
  const size = 500;
  const all: Student[] = [];
  for (let page = 0; page < 40; page += 1) {
    const result = await searchStudents({ ...params, page, size });
    all.push(...result.content);
    if (page + 1 >= result.page.totalPages) break;
  }
  return all;
}

export type IdentificationLookupEntry = { studentId: string; idType: string; idValue: string };

/** National ID, local ID etc. of many students at once. */
export async function lookupIdentifications(studentIds: string[]): Promise<IdentificationLookupEntry[]> {
  if (studentIds.length === 0) return [];
  const { data } = await api.post<IdentificationLookupEntry[]>('/v1/students/identifications/lookup', { studentIds });
  return data;
}

/** Fields a professional admission form captures (plan Phase 3 section 1). Only schoolId/firstName/lastName/dateOfBirth/admissionNumber are required. */
export type CreateStudentInput = {
  schoolId: string;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  gender?: Gender | null;
  dateOfBirth: string;
  bloodGroup?: BloodGroup | null;
  nationality?: string | null;
  religion?: string | null;
  motherTongue?: string | null;
  category?: string | null;

  admissionNumber: string;
  rollNumber?: string | null;
  enrollmentNumber?: string | null;
  admissionDate?: string | null;
  sectionId?: string | null;
  previousSchoolName?: string | null;
  previousSchoolClass?: string | null;
  previousSchoolAdmissionNumber?: string | null;
  previousSchoolAddress?: string | null;
  transferCertificateNumber?: string | null;
  admissionSource?: string | null;
  rteStatus?: boolean;

  guardianName?: string | null;
  guardianRelationship?: GuardianRelationship | null;
  guardianPhone?: string | null;
  guardianAlternatePhone?: string | null;
  guardianEmail?: string | null;
  guardianOccupation?: string | null;
  guardianContact?: string | null;

  fatherName?: string | null;
  fatherMobile?: string | null;
  fatherEmail?: string | null;
  fatherOccupation?: string | null;
  motherName?: string | null;
  motherMobile?: string | null;
  motherEmail?: string | null;
  motherOccupation?: string | null;

  emergencyContactName?: string | null;
  emergencyContactRelationship?: GuardianRelationship | null;
  emergencyContactMobile?: string | null;
  emergencyContactAlternateMobile?: string | null;
  emergencyContactAddress?: string | null;

  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  currentCountry?: string | null;
  pincode?: string | null;

  permanentSameAsCurrentAddress?: boolean;
  permanentAddressLine1?: string | null;
  permanentAddressLine2?: string | null;
  permanentCity?: string | null;
  permanentState?: string | null;
  permanentCountry?: string | null;
  permanentPincode?: string | null;

  familyId?: string | null;

  smsNotificationsEnabled?: boolean;
  whatsappNotificationsEnabled?: boolean;
  emailNotificationsEnabled?: boolean;
  preferredLanguage?: PreferredLanguage;
  /** Omitted/null on update = leave the extra fields unchanged. */
  extra?: Partial<StudentExtra> | null;
};

/**
 * Thrown when the backend rejects a create with 409 because the admission
 * number is already used. `message` is safe to show inline.
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

/** Every editable field except schoolId/admissionNumber (immutable after admission). */
export type UpdateStudentInput = Omit<CreateStudentInput, 'schoolId' | 'admissionNumber' | 'sectionId' | 'dateOfBirth'> & {
  dateOfBirth?: string | null;
  status: StudentStatus;
};

/** Edit a student's mutable fields. admission_number/schoolId are immutable server-side and not sent. */
export async function updateStudent(id: string, input: UpdateStudentInput): Promise<Student> {
  const { data } = await api.put<Student>(`/v1/students/${id}`, input);
  return data;
}

/** One student's full record (staff only server-side). */
export async function fetchStudent(id: string): Promise<Student> {
  const { data } = await api.get<Student>(`/v1/students/${id}`);
  return data;
}

/** A student row on the Bulk Delete screen; `deletable` is false while dependent history exists. */
export type BulkDeleteCandidate = {
  id: string;
  admissionNumber: string;
  fullName: string;
  className: string;
  /** Null when the student is in a class without sections. */
  sectionName: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  category: string | null;
  status: StudentStatus;
  mobile: string | null;
  deletable: boolean;
  blockReason: string | null;
};

export async function fetchBulkDeleteCandidates(classId: string, sectionId?: string): Promise<BulkDeleteCandidate[]> {
  const { data } = await api.get<BulkDeleteCandidate[]>('/v1/students/bulk-delete/candidates', {
    params: { classId, sectionId },
  });
  return data;
}

export type BulkDeleteResult = {
  deleted: { id: string; admissionNumber: string; fullName: string }[];
  skipped: { id: string; admissionNumber: string | null; fullName: string | null; reason: string }[];
};

/** Permanently deletes students that have no dependent history; the rest come back in `skipped`. */
export async function bulkDeleteStudents(studentIds: string[]): Promise<BulkDeleteResult> {
  const { data } = await api.post<BulkDeleteResult>('/v1/students/bulk-delete', { studentIds });
  return data;
}

/** Deactivate/archive (INACTIVE, GRADUATED, LEFT_SCHOOL, TRANSFERRED) or reactivate a student. No row is removed. */
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

// --- Siblings (plan Phase 3 section 6) -------------------------------

export async function fetchSiblings(studentId: string): Promise<Student[]> {
  const { data } = await api.get<Student[]>(`/v1/students/${studentId}/siblings`);
  return data;
}

export async function linkSibling(studentId: string, siblingId: string): Promise<Student> {
  const { data } = await api.post<Student>(`/v1/students/${studentId}/siblings`, { siblingId });
  return data;
}

// --- Academic history (plan Phase 3 section 7) -----------------------

export type AcademicHistoryEntry = {
  id: string;
  academicYearId: string | null;
  classId: string | null;
  sectionId: string | null;
  recordedAt: string;
};

export async function fetchAcademicHistory(studentId: string): Promise<AcademicHistoryEntry[]> {
  const { data } = await api.get<AcademicHistoryEntry[]>(`/v1/students/${studentId}/academic-history`);
  return data;
}

// --- Identification documents -----------------------------------------

export type StudentIdentification = {
  id: string;
  idType: string;
  idValue: string;
  notes: string | null;
};

export async function fetchIdentifications(studentId: string): Promise<StudentIdentification[]> {
  const { data } = await api.get<StudentIdentification[]>(`/v1/students/${studentId}/identifications`);
  return data;
}

export async function addIdentification(
  studentId: string,
  input: { idType: string; idValue: string; notes?: string },
): Promise<StudentIdentification> {
  const { data } = await api.post<StudentIdentification>(`/v1/students/${studentId}/identifications`, input);
  return data;
}

export async function removeIdentification(studentId: string, identificationId: string): Promise<void> {
  await api.delete(`/v1/students/${studentId}/identifications/${identificationId}`);
}

// --- Documents (plan Phase 3 section 2) -------------------------------

export type StudentDocument = {
  id: string;
  documentType: string;
  originalFilename: string;
  contentType: string;
  fileSizeBytes: number;
  uploadedByUserId: string | null;
  notes: string | null;
  uploadedAt: string;
};

export async function fetchDocuments(studentId: string): Promise<StudentDocument[]> {
  const { data } = await api.get<StudentDocument[]>(`/v1/students/${studentId}/documents`);
  return data;
}

export class UnsupportedFileTypeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsupportedFileTypeError';
  }
}

export async function uploadDocument(
  studentId: string,
  file: File,
  documentType: string,
  notes?: string,
): Promise<StudentDocument> {
  const form = new FormData();
  form.append('file', file);
  form.append('documentType', documentType);
  if (notes) form.append('notes', notes);
  try {
    const { data } = await api.post<StudentDocument>(`/v1/students/${studentId}/documents`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  } catch (error) {
    const status = (error as AxiosError).response?.status;
    const detail = (error as AxiosError<{ detail?: string }>).response?.data?.detail;
    if (status === 400) {
      throw new UnsupportedFileTypeError(detail ?? 'This file could not be uploaded');
    }
    throw error;
  }
}

/** Triggers a browser download of a document via a same-origin authenticated request (cookie-based). */
export function documentDownloadUrl(studentId: string, documentId: string): string {
  const base = (api.defaults.baseURL ?? '/api').replace(/\/$/, '');
  return `${base}/v1/students/${studentId}/documents/${documentId}/download`;
}

export async function deleteDocument(studentId: string, documentId: string): Promise<void> {
  await api.delete(`/v1/students/${studentId}/documents/${documentId}`);
}

// --- Photo ----------------------------------------------------------

export async function uploadStudentPhoto(studentId: string, file: File): Promise<Student> {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.post<Student>(`/v1/students/${studentId}/photo`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export function studentPhotoUrl(studentId: string): string {
  const base = (api.defaults.baseURL ?? '/api').replace(/\/$/, '');
  return `${base}/v1/students/${studentId}/photo`;
}
