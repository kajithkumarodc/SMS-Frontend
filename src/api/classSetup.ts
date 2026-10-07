import api from '../lib/api';
import type { SchoolClass } from './classes';

/** An entry of the Sections list (`ClassSetupController.SectionNameResponse`). */
export type SectionName = { id: string; name: string };

export type ClassSetupInput = { name: string; sectionNames: string[] };

export async function fetchSectionNames(): Promise<SectionName[]> {
  const { data } = await api.get<SectionName[]>('/v1/academics/section-names');
  return data;
}

export async function createSectionName(name: string): Promise<SectionName> {
  const { data } = await api.post<SectionName>('/v1/academics/section-names', { name });
  return data;
}

export async function updateSectionName(id: string, name: string): Promise<SectionName> {
  const { data } = await api.put<SectionName>(`/v1/academics/section-names/${id}`, { name });
  return data;
}

export async function deleteSectionName(id: string): Promise<void> {
  await api.delete(`/v1/academics/section-names/${id}`);
}

/** Creates a class together with the chosen sections. */
export async function createClassWithSections(input: ClassSetupInput): Promise<SchoolClass> {
  const { data } = await api.post<SchoolClass>('/v1/academics/classes', input);
  return data;
}

/** Renames a class and makes its sections exactly the chosen ones. */
export async function updateClassWithSections(id: string, input: ClassSetupInput): Promise<SchoolClass> {
  const { data } = await api.put<SchoolClass>(`/v1/academics/classes/${id}`, input);
  return data;
}

export async function deleteClassById(id: string): Promise<void> {
  await api.delete(`/v1/academics/classes/${id}`);
}
