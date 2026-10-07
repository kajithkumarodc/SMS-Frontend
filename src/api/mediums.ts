import api from '../lib/api';

/** Medium of instruction (e.g. English Medium). Fees can differ per medium. */
export type Medium = { id: string; name: string; active: boolean };

export async function fetchMediums(): Promise<Medium[]> {
  const { data } = await api.get<Medium[]>('/v1/mediums');
  return data;
}

export async function createMedium(name: string): Promise<Medium> {
  const { data } = await api.post<Medium>('/v1/mediums', { name });
  return data;
}

export async function updateMedium(id: string, input: { name: string; active?: boolean }): Promise<Medium> {
  const { data } = await api.put<Medium>(`/v1/mediums/${id}`, input);
  return data;
}

/** Deletes an unused medium; one in use is deactivated instead and returned. */
export async function deleteMedium(id: string): Promise<Medium | null> {
  const response = await api.delete<Medium>(`/v1/mediums/${id}`);
  return response.status === 204 ? null : response.data;
}
