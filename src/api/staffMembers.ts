import api from '../lib/api';
import type { LeaveBalance, LeaveRequestRow } from './leaveManagement';

export type StaffDocumentKind = 'RESUME' | 'JOINING_LETTER' | 'RESIGNATION_LETTER' | 'OTHER';

/** The document slots on the Add Staff form, in display order (`StaffDocumentKind` on the backend). */
export const STAFF_DOCUMENT_KINDS: { kind: StaffDocumentKind; title: string }[] = [
  { kind: 'RESUME', title: 'Resume' },
  { kind: 'JOINING_LETTER', title: 'Joining Letter' },
  { kind: 'RESIGNATION_LETTER', title: 'Resignation Letter' },
  { kind: 'OTHER', title: 'Other Documents' },
];

export type StaffDocumentInfo = {
  kind: StaffDocumentKind;
  title: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
};

/** Mirrors the backend's `StaffDirectoryDtos.StaffMemberResponse`. */
export type StaffMember = {
  id: string;
  userId: string;
  staffId: string;
  firstName: string | null;
  lastName: string | null;
  fullName: string;
  fatherName: string | null;
  motherName: string | null;
  email: string;
  roleId: string | null;
  roleName: string | null;
  designationId: string | null;
  designationName: string | null;
  departmentId: string | null;
  departmentName: string | null;
  gender: 'MALE' | 'FEMALE' | 'OTHER' | null;
  dateOfBirth: string | null;
  dateOfJoining: string | null;
  dateOfLeaving: string | null;
  phone: string | null;
  emergencyContactNumber: string | null;
  maritalStatus: string | null;
  currentAddress: string | null;
  permanentAddress: string | null;
  qualification: string | null;
  workExperience: string | null;
  note: string | null;
  panNumber: string | null;
  epfNo: string | null;
  basicSalary: number | null;
  contractType: string | null;
  workShift: string | null;
  workLocation: string | null;
  medicalLeave: number | null;
  casualLeave: number | null;
  maternityLeave: number | null;
  sickLeave: number | null;
  mandatoryLeave: number | null;
  accountTitle: string | null;
  bankAccountNumber: string | null;
  bankName: string | null;
  ifscCode: string | null;
  bankBranchName: string | null;
  facebookUrl: string | null;
  twitterUrl: string | null;
  linkedinUrl: string | null;
  instagramUrl: string | null;
  hasPhoto: boolean;
  documents: StaffDocumentInfo[];
  status: string;
  createdAt: string;
};

/** A staff member as a card/row in the directory (`StaffCardResponse`). */
export type StaffCard = {
  id: string;
  staffId: string;
  fullName: string;
  phone: string | null;
  email: string;
  workLocation: string | null;
  departmentName: string | null;
  designationName: string | null;
  roleId: string | null;
  roleName: string | null;
  dateOfJoining: string | null;
  hasPhoto: boolean;
  status: string;
};

export type LookupOption = { id: string; name: string };

export type StaffOptions = {
  roles: LookupOption[];
  designations: LookupOption[];
  departments: LookupOption[];
};

/** The Add Staff form -- mirrors `StaffDirectoryDtos.StaffRequest`. */
export type StaffInput = {
  staffId: string;
  roleId: string;
  designationId: string | null;
  departmentId: string | null;
  firstName: string;
  lastName: string | null;
  fatherName: string | null;
  motherName: string | null;
  email: string;
  gender: string;
  dateOfBirth: string;
  dateOfJoining: string | null;
  phone: string | null;
  emergencyContactNumber: string | null;
  maritalStatus: string | null;
  currentAddress: string | null;
  permanentAddress: string | null;
  qualification: string | null;
  workExperience: string | null;
  note: string | null;
  panNumber: string;
  epfNo: string | null;
  basicSalary: number | null;
  contractType: string | null;
  workShift: string | null;
  workLocation: string | null;
  medicalLeave: number | null;
  casualLeave: number | null;
  maternityLeave: number | null;
  sickLeave: number | null;
  mandatoryLeave: number | null;
  accountTitle: string | null;
  bankAccountNumber: string | null;
  bankName: string | null;
  ifscCode: string | null;
  bankBranchName: string | null;
  facebookUrl: string | null;
  twitterUrl: string | null;
  linkedinUrl: string | null;
  instagramUrl: string | null;
};

export type CreatedStaff = { staff: StaffMember; temporaryPassword: string };

export type StaffImportRow = {
  row: number;
  staffId: string | null;
  name: string;
  status: 'IMPORTED' | 'SKIPPED';
  messages: string[];
  email: string | null;
  /** Only on imported rows; shown once. */
  temporaryPassword: string | null;
};

export type StaffImportResult = { imported: number; skipped: number; rows: StaffImportRow[] };

export type StaffDirectoryFilter = {
  roleId?: string;
  q?: string;
  status?: string;
};

export async function fetchStaffOptions(): Promise<StaffOptions> {
  const { data } = await api.get<StaffOptions>('/v1/staff-members/options');
  return data;
}

export async function fetchStaffDirectory(filter: StaffDirectoryFilter): Promise<StaffCard[]> {
  const { data } = await api.get<StaffCard[]>('/v1/staff-members', { params: filter });
  return data;
}

export async function fetchStaffMember(id: string): Promise<StaffMember> {
  const { data } = await api.get<StaffMember>(`/v1/staff-members/${id}`);
  return data;
}

export async function createStaffMember(input: StaffInput): Promise<CreatedStaff> {
  const { data } = await api.post<CreatedStaff>('/v1/staff-members', input);
  return data;
}

export async function updateStaffMember(id: string, input: StaffInput): Promise<StaffMember> {
  const { data } = await api.put<StaffMember>(`/v1/staff-members/${id}`, input);
  return data;
}

export async function uploadStaffPhoto(id: string, file: File): Promise<StaffMember> {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.put<StaffMember>(`/v1/staff-members/${id}/photo`, form);
  return data;
}

export async function removeStaffPhoto(id: string): Promise<StaffMember> {
  const { data } = await api.delete<StaffMember>(`/v1/staff-members/${id}/photo`);
  return data;
}

export async function uploadStaffDocument(id: string, kind: StaffDocumentKind, file: File): Promise<StaffMember> {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.put<StaffMember>(`/v1/staff-members/${id}/documents/${kind}`, form);
  return data;
}

export async function removeStaffDocument(id: string, kind: StaffDocumentKind): Promise<StaffMember> {
  const { data } = await api.delete<StaffMember>(`/v1/staff-members/${id}/documents/${kind}`);
  return data;
}

function apiBase(): string {
  return (api.defaults.baseURL ?? '/api').replace(/\/$/, '');
}

/** Same-origin image link; the auth cookie goes with it. `version` busts the cache after a new upload. */
export function staffPhotoUrl(id: string, version?: string): string {
  return `${apiBase()}/v1/staff-members/${id}/photo${version ? `?v=${encodeURIComponent(version)}` : ''}`;
}

/** Same-origin download link; the auth cookie goes with it. */
export function staffDocumentUrl(id: string, kind: StaffDocumentKind): string {
  return `${apiBase()}/v1/staff-members/${id}/documents/${kind}`;
}

export async function importStaff(
  file: File,
  roleId: string,
  designationId?: string,
  departmentId?: string,
): Promise<StaffImportResult> {
  const form = new FormData();
  form.append('file', file);
  form.append('roleId', roleId);
  if (designationId) form.append('designationId', designationId);
  if (departmentId) form.append('departmentId', departmentId);
  // Large files take a while: each row creates a login.
  const { data } = await api.post<StaffImportResult>('/v1/staff-members/import', form, { timeout: 120000 });
  return data;
}

/** The sample CSV as a blob (needs the auth cookie, so a plain link won't do). */
export async function fetchStaffSampleCsv(): Promise<Blob> {
  const { data } = await api.get<Blob>('/v1/staff-members/import/sample', { responseType: 'blob' });
  return data;
}

// --- Profile tabs and actions --------------------------------------------------------------------

export type StaffPayslip = {
  id: string;
  month: number;
  year: number;
  date: string | null;
  modeLabel: string | null;
  status: 'GENERATED' | 'PAID';
  netSalary: number;
};

/** Totals count paid payrolls only (`StaffProfileTabsService.PayrollSummary`). */
export type StaffPayrollSummary = {
  totalNetPaid: number;
  totalGross: number;
  totalEarning: number;
  totalDeduction: number;
  payslips: StaffPayslip[];
};

export type StaffAttendanceCode = 'PRESENT' | 'LATE' | 'ABSENT' | 'HALF_DAY' | 'HOLIDAY' | 'HALF_DAY_SECOND_HALF';

export type StaffAttendanceSummary = {
  year: number;
  present: number;
  late: number;
  absent: number;
  halfDay: number;
  holiday: number;
  halfDaySecondHalf: number;
  /** "month-day" (e.g. "3-14") to the mark of that day. */
  days: Record<string, StaffAttendanceCode>;
};

export type StaffLeaves = { balances: LeaveBalance[]; requests: LeaveRequestRow[] };

export async function fetchStaffPayroll(id: string): Promise<StaffPayrollSummary> {
  const { data } = await api.get<StaffPayrollSummary>(`/v1/staff-members/${id}/payroll`);
  return data;
}

export async function fetchStaffLeaves(id: string): Promise<StaffLeaves> {
  const { data } = await api.get<StaffLeaves>(`/v1/staff-members/${id}/leaves`);
  return data;
}

export async function fetchStaffAttendance(id: string, year: number): Promise<StaffAttendanceSummary> {
  const { data } = await api.get<StaffAttendanceSummary>(`/v1/staff-members/${id}/attendance`, { params: { year } });
  return data;
}

export async function setStaffActive(id: string, active: boolean): Promise<StaffMember> {
  const { data } = await api.patch<StaffMember>(`/v1/staff-members/${id}/status`, { active });
  return data;
}

export async function resetStaffPassword(id: string): Promise<string> {
  const { data } = await api.post<{ temporaryPassword: string }>(`/v1/staff-members/${id}/reset-password`);
  return data.temporaryPassword;
}
