import api from '../lib/api';

/** A designation on the Designation page (`DesignationController.DesignationResponse`). */
export type DesignationRow = { id: string; name: string };

export async function fetchDesignations(): Promise<DesignationRow[]> {
  const { data } = await api.get<DesignationRow[]>('/v1/hr/designations');
  return data;
}

export async function createDesignation(name: string): Promise<DesignationRow> {
  const { data } = await api.post<DesignationRow>('/v1/hr/designations', { name });
  return data;
}

export async function updateDesignation(id: string, name: string): Promise<DesignationRow> {
  const { data } = await api.put<DesignationRow>(`/v1/hr/designations/${id}`, { name });
  return data;
}

export async function deleteDesignation(id: string): Promise<void> {
  await api.delete(`/v1/hr/designations/${id}`);
}
