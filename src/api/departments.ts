import api from '../lib/api';

/** A department on the Department page (`DepartmentController.DepartmentResponse`). */
export type DepartmentRow = { id: string; name: string };

export async function fetchDepartments(): Promise<DepartmentRow[]> {
  const { data } = await api.get<DepartmentRow[]>('/v1/hr/departments');
  return data;
}

export async function createDepartment(name: string): Promise<DepartmentRow> {
  const { data } = await api.post<DepartmentRow>('/v1/hr/departments', { name });
  return data;
}

export async function updateDepartment(id: string, name: string): Promise<DepartmentRow> {
  const { data } = await api.put<DepartmentRow>(`/v1/hr/departments/${id}`, { name });
  return data;
}

export async function deleteDepartment(id: string): Promise<void> {
  await api.delete(`/v1/hr/departments/${id}`);
}
