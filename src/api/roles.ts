import { AxiosError } from 'axios';
import api from '../lib/api';

/** Mirrors the backend's `RoleDtos.RoleResponse`. */
export type AppRole = {
  id: string;
  name: string;
  permissionNames: string[];
};

export type Permission = {
  id: string;
  name: string;
};

export class DuplicateNameError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DuplicateNameError';
  }
}

/** All roles, each with its currently granted permission names. SCHOOL_ADMIN/SUPER_ADMIN only. */
export async function fetchRoles(): Promise<AppRole[]> {
  const { data } = await api.get<AppRole[]>('/v1/roles');
  return data;
}

export async function createRole(name: string): Promise<AppRole> {
  try {
    const { data } = await api.post<AppRole>('/v1/roles', { name });
    return data;
  } catch (error) {
    if ((error as AxiosError).response?.status === 409) {
      throw new DuplicateNameError('A role with this name already exists');
    }
    throw error;
  }
}

/** Replaces the full permission set granted to a role. */
export async function updateRolePermissions(roleId: string, permissionIds: string[]): Promise<void> {
  await api.put(`/v1/roles/${roleId}/permissions`, { permissionIds });
}

/** The permission catalog. Extensible -- an admin may add more from here. */
export async function fetchPermissions(): Promise<Permission[]> {
  const { data } = await api.get<Permission[]>('/v1/permissions');
  return data;
}

export async function createPermission(name: string): Promise<Permission> {
  try {
    const { data } = await api.post<Permission>('/v1/permissions', { name });
    return data;
  } catch (error) {
    if ((error as AxiosError).response?.status === 409) {
      throw new DuplicateNameError('A permission with this name already exists');
    }
    throw error;
  }
}
