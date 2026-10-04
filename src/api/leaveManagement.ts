import api from '../lib/api';

/** PENDING, APPROVED or REJECTED (shown as "Disapproved"). */
export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export type HalfDay = 'FIRST_HALF' | 'SECOND_HALF';

export const LEAVE_STATUS_LABEL: Record<LeaveStatus, string> = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Disapproved',
};

export const HALF_DAY_LABEL: Record<HalfDay, string> = {
  FIRST_HALF: 'First Half',
  SECOND_HALF: 'Second Half',
};

export type LeaveAttachment = { fileName: string; contentType: string; sizeBytes: number };

/** One leave request, as the Approve Leave Request page shows it (`LeaveManagementDtos.LeaveResponse`). */
export type LeaveRequestRow = {
  id: string;
  staffProfileId: string | null;
  staffId: string | null;
  staffName: string | null;
  roleId: string | null;
  roleName: string | null;
  leaveTypeId: string | null;
  leaveTypeName: string;
  halfDay: HalfDay | null;
  fromDate: string;
  toDate: string;
  /** Calendar days, or 0.5 for a half day. */
  days: number;
  applyDate: string;
  reason: string | null;
  note: string | null;
  status: LeaveStatus;
  attachment: LeaveAttachment | null;
  decidedAt: string | null;
  createdAt: string;
  /** Who approves it: Principal, Super Admin, or Super Admin / School Admin. */
  approverLabel: string;
  /** Whether the signed-in user may set its status, edit it and delete it. */
  canDecide: boolean;
};

/** The Add Details form -- mirrors `LeaveManagementDtos.LeaveBody`. */
export type LeaveInput = {
  staffProfileId: string;
  leaveTypeId: string;
  applyDate: string;
  fromDate: string;
  toDate: string;
  halfDay: HalfDay | null;
  reason: string | null;
  note: string | null;
  status: LeaveStatus;
};

export type LeaveOption = { id: string; name: string };
/** `own` is true for the signed-in user themselves: their request is always Pending. */
export type LeaveStaffOption = { id: string; staffId: string; name: string; own: boolean };

/**
 * Who a request from this role is sent to (mirrors the backend's approval flow): a Principal's goes to the Super
 * Admin, a Super Admin's or School Admin's to the other admins, everyone else's to the Principal.
 */
export function approverFor(roleName: string | null | undefined): string {
  if (roleName === 'SUPER_ADMIN' || roleName === 'SCHOOL_ADMIN') return 'Super Admin / School Admin';
  return roleName === 'PRINCIPAL' ? 'Super Admin' : 'Principal';
}
export type LeaveOptions = { roles: LeaveOption[]; leaveTypes: LeaveOption[] };

export async function fetchLeaveOptions(): Promise<LeaveOptions> {
  const { data } = await api.get<LeaveOptions>('/v1/hr/leave-requests/options');
  return data;
}

export async function fetchLeaveStaff(roleId: string): Promise<LeaveStaffOption[]> {
  const { data } = await api.get<LeaveStaffOption[]>('/v1/hr/leave-requests/staff', { params: { roleId } });
  return data;
}

export async function fetchLeaveRequests(): Promise<LeaveRequestRow[]> {
  const { data } = await api.get<LeaveRequestRow[]>('/v1/hr/leave-requests');
  return data;
}

export async function fetchLeaveRequest(id: string): Promise<LeaveRequestRow> {
  const { data } = await api.get<LeaveRequestRow>(`/v1/hr/leave-requests/${id}`);
  return data;
}

export async function createLeaveRequest(input: LeaveInput): Promise<LeaveRequestRow> {
  const { data } = await api.post<LeaveRequestRow>('/v1/hr/leave-requests', input);
  return data;
}

export async function updateLeaveRequest(id: string, input: LeaveInput): Promise<LeaveRequestRow> {
  const { data } = await api.put<LeaveRequestRow>(`/v1/hr/leave-requests/${id}`, input);
  return data;
}

export async function deleteLeaveRequest(id: string): Promise<void> {
  await api.delete(`/v1/hr/leave-requests/${id}`);
}

export async function uploadLeaveAttachment(id: string, file: File): Promise<LeaveRequestRow> {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.put<LeaveRequestRow>(`/v1/hr/leave-requests/${id}/attachment`, form);
  return data;
}

export async function removeLeaveAttachment(id: string): Promise<LeaveRequestRow> {
  const { data } = await api.delete<LeaveRequestRow>(`/v1/hr/leave-requests/${id}/attachment`);
  return data;
}

/** Same-origin link; the auth cookie goes with it. */
export function leaveAttachmentUrl(id: string): string {
  const base = (api.defaults.baseURL ?? '/api').replace(/\/$/, '');
  return `${base}/v1/hr/leave-requests/${id}/attachment`;
}

/** A leave type on the Leave Type page (`LeaveTypeController.LeaveTypeResponse`). */
export type LeaveTypeRow = { id: string; name: string };

export async function fetchLeaveTypes(): Promise<LeaveTypeRow[]> {
  const { data } = await api.get<LeaveTypeRow[]>('/v1/hr/leave-types');
  return data;
}

export async function createLeaveType(name: string): Promise<LeaveTypeRow> {
  const { data } = await api.post<LeaveTypeRow>('/v1/hr/leave-types', { name });
  return data;
}

export async function updateLeaveType(id: string, name: string): Promise<LeaveTypeRow> {
  const { data } = await api.put<LeaveTypeRow>(`/v1/hr/leave-types/${id}`, { name });
  return data;
}

export async function deleteLeaveType(id: string): Promise<void> {
  await api.delete(`/v1/hr/leave-types/${id}`);
}

/** One leave type with the signed-in staff member's entitlement for the year; `null` means no limit is set. */
export type LeaveBalance = {
  leaveTypeId: string;
  name: string;
  allotted: number | null;
  used: number;
  available: number | null;
};

/** The signed-in user as a leave applicant (`LeaveManagementDtos.MyLeaveInfo`). */
export type MyLeaveInfo = {
  staffProfileId: string;
  staffId: string;
  name: string;
  roleName: string | null;
  approverLabel: string;
  year: number;
  balances: LeaveBalance[];
};

/** The signed-in user's own leave requests, whatever their role. */
export async function fetchMyLeaveRequests(): Promise<LeaveRequestRow[]> {
  const { data } = await api.get<LeaveRequestRow[]>('/v1/hr/leave-requests/mine');
  return data;
}

/** Who approves the user's leave and what is left of each leave type. 404 if the account has no staff profile. */
export async function fetchMyLeaveInfo(year?: number): Promise<MyLeaveInfo> {
  const { data } = await api.get<MyLeaveInfo>('/v1/hr/leave-requests/my-info', { params: { year } });
  return data;
}

/** Withdraws the user's own request while it is still Pending. */
export async function cancelLeaveRequest(id: string): Promise<void> {
  await api.post(`/v1/hr/leave-requests/${id}/cancel`);
}
