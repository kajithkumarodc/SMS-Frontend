import { AxiosError } from 'axios';
import api from '../lib/api';

export type UserStatus = 'ACTIVE' | 'INACTIVE';

/** Mirrors the backend's `UserDtos.UserResponse`. */
export type AppUser = {
  id: string;
  email: string;
  fullName: string;
  status: UserStatus;
  mustChangePassword: boolean;
  roles: string[];
};

export type CreateUserInput = {
  email: string;
  fullName: string;
  initialPassword?: string;
  roleIds: string[];
};

export type CreateUserResult = {
  user: AppUser;
  /** Present only when no `initialPassword` was given -- shown to the admin once. */
  generatedPassword: string | null;
};

/**
 * Thrown when the backend rejects a create with 409 -- a user with that email
 * already exists. `message` is safe to show inline on the email field.
 */
export class DuplicateEmailError extends Error {
  constructor() {
    super('A user with this email already exists');
    this.name = 'DuplicateEmailError';
  }
}

function throwIfDuplicateEmail(error: unknown): never {
  if ((error as AxiosError).response?.status === 409) throw new DuplicateEmailError();
  throw error;
}

/** All users. SCHOOL_ADMIN/SUPER_ADMIN only. */
export async function fetchUsers(): Promise<AppUser[]> {
  const { data } = await api.get<AppUser[]>('/v1/users');
  return data;
}

export async function createUser(input: CreateUserInput): Promise<CreateUserResult> {
  try {
    const { data } = await api.post<CreateUserResult>('/v1/users', input);
    return data;
  } catch (error) {
    throwIfDuplicateEmail(error);
  }
}

export type UpdateUserInput = {
  fullName: string;
  status: UserStatus;
  roleIds: string[];
};

export async function updateUser(id: string, input: UpdateUserInput): Promise<AppUser> {
  const { data } = await api.put<AppUser>(`/v1/users/${id}`, input);
  return data;
}

/** Forces a new temporary password for the user. Returned once -- no email/SMS provider required. */
export async function resetUserPassword(id: string): Promise<string> {
  const { data } = await api.patch<{ temporaryPassword: string }>(`/v1/users/${id}/reset-password`);
  return data.temporaryPassword;
}

/** Thrown when the backend rejects a self-service password change with 400 (wrong current password). */
export class WrongCurrentPasswordError extends Error {
  constructor() {
    super('Current password is incorrect');
    this.name = 'WrongCurrentPasswordError';
  }
}

export async function changeOwnPassword(currentPassword: string, newPassword: string): Promise<void> {
  try {
    await api.post('/v1/me/change-password', { currentPassword, newPassword });
  } catch (error) {
    if ((error as AxiosError).response?.status === 400) throw new WrongCurrentPasswordError();
    throw error;
  }
}
