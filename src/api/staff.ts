import { AxiosError } from 'axios';
import api from '../lib/api';

export type StaffProfileStatus = 'ACTIVE' | 'INACTIVE';

/** A staff member's HR profile. Mirrors the backend's `StaffDtos.StaffProfileResponse`. */
export type StaffProfile = {
  id: string;
  userId: string;
  email: string;
  fullName: string;
  employeeCode: string;
  department: string | null;
  designation: string | null;
  dateOfJoining: string; // YYYY-MM-DD
  salaryAmount: number;
  status: StaffProfileStatus;
  createdAt: string;
};

/** A user in the tenant with no staff profile yet (`StaffDtos.EligibleUserResponse`). */
export type EligibleUser = {
  id: string;
  email: string;
  fullName: string;
  roles: string[];
};

export type LeaveRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

/** One leave request. Mirrors the backend's `LeaveDtos.LeaveRequestResponse`. */
export type LeaveRequest = {
  id: string;
  staffUserId: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  status: LeaveRequestStatus;
  reason: string | null;
  createdAt: string;
};

/** All staff profiles for the caller's tenant. SCHOOL_ADMIN only. */
export async function fetchStaffProfiles(): Promise<StaffProfile[]> {
  const { data } = await api.get<StaffProfile[]>('/v1/staff');
  return data;
}

/** Users in the tenant with no staff profile yet -- the "Add staff profile" picker. */
export async function fetchEligibleUsers(): Promise<EligibleUser[]> {
  const { data } = await api.get<EligibleUser[]>('/v1/staff/eligible-users');
  return data;
}

export type CreateStaffProfileInput = {
  userId: string;
  employeeCode: string;
  department?: string | null;
  designation?: string | null;
  dateOfJoining: string;
  salaryAmount: number;
};

/**
 * Thrown when the backend rejects a create with 409 -- either the chosen user
 * already has a profile, or the employee code is already used in the tenant.
 * `message` is safe to show inline on the employee code field.
 */
export class DuplicateStaffProfileError extends Error {
  constructor() {
    super('That employee code is already in use, or this user already has a profile');
    this.name = 'DuplicateStaffProfileError';
  }
}

export async function createStaffProfile(input: CreateStaffProfileInput): Promise<StaffProfile> {
  try {
    const { data } = await api.post<StaffProfile>('/v1/staff', input);
    return data;
  } catch (error) {
    if ((error as AxiosError).response?.status === 409) throw new DuplicateStaffProfileError();
    throw error;
  }
}

export type UpdateStaffProfileInput = {
  department?: string | null;
  designation?: string | null;
  dateOfJoining: string;
  salaryAmount: number;
  status: StaffProfileStatus;
};

export async function updateStaffProfile(id: string, input: UpdateStaffProfileInput): Promise<StaffProfile> {
  const { data } = await api.put<StaffProfile>(`/v1/staff/${id}`, input);
  return data;
}

/** Thrown when the caller's account has no staff profile linked yet (backend 404). */
export class NoLinkedStaffProfileError extends Error {
  constructor() {
    super('no linked staff profile');
    this.name = 'NoLinkedStaffProfileError';
  }
}

function is404(error: unknown): boolean {
  return (error as AxiosError)?.response?.status === 404;
}

/** SCHOOL_ADMIN or TEACHER: the caller's own staff profile. 404 (NoLinkedStaffProfileError) if none. */
export async function fetchOwnStaffProfile(): Promise<StaffProfile> {
  try {
    const { data } = await api.get<StaffProfile>('/v1/me/staff-profile');
    return data;
  } catch (error) {
    if (is404(error)) throw new NoLinkedStaffProfileError();
    throw error;
  }
}

export type CreateLeaveRequestInput = {
  leaveType: string;
  startDate: string;
  endDate: string;
  reason?: string | null;
};

/** File a leave request against a staff profile -- the staff member themselves, or a SCHOOL_ADMIN on their behalf. */
export async function createLeaveRequest(
  staffProfileId: string,
  input: CreateLeaveRequestInput,
): Promise<LeaveRequest> {
  const { data } = await api.post<LeaveRequest>(`/v1/staff/${staffProfileId}/leave-requests`, input);
  return data;
}

export type LeaveRequestFilter = {
  staffUserId?: string;
  status?: LeaveRequestStatus;
};

/** SCHOOL_ADMIN: every leave request in the tenant, optionally filtered by staff member and/or status. */
export async function fetchLeaveRequests(filter: LeaveRequestFilter = {}): Promise<LeaveRequest[]> {
  const { data } = await api.get<LeaveRequest[]>('/v1/leave-requests', { params: filter });
  return data;
}

/** Approve or reject a leave request. SCHOOL_ADMIN only. */
export async function decideLeaveRequest(
  id: string,
  status: 'APPROVED' | 'REJECTED',
): Promise<LeaveRequest> {
  const { data } = await api.patch<LeaveRequest>(`/v1/leave-requests/${id}`, { status });
  return data;
}

/** SCHOOL_ADMIN or TEACHER: the caller's own leave request history (empty if none, never a 404). */
export async function fetchOwnLeaveRequests(): Promise<LeaveRequest[]> {
  const { data } = await api.get<LeaveRequest[]>('/v1/me/leave-requests');
  return data;
}
