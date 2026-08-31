import { AxiosError } from 'axios';
import api from '../lib/api';

export type Section = {
  id: string;
  classId: string;
  name: string;
};

export type SchoolClass = {
  id: string;
  schoolId: string;
  name: string;
  sections: Section[];
};

export async function fetchClasses(): Promise<SchoolClass[]> {
  const { data } = await api.get<SchoolClass[]>('/v1/classes');
  return data;
}

/**
 * Thrown when the backend rejects a create with 409 because a class/section with
 * that name already exists in scope. `message` is safe to show inline.
 */
export class DuplicateNameError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DuplicateNameError';
  }
}

export async function createClass(input: { schoolId: string; name: string }): Promise<SchoolClass> {
  try {
    const { data } = await api.post<SchoolClass>('/v1/classes', input);
    return data;
  } catch (error) {
    if ((error as AxiosError).response?.status === 409) {
      throw new DuplicateNameError('A class with this name already exists for this school');
    }
    throw error;
  }
}

export async function createSection(classId: string, name: string): Promise<Section> {
  try {
    const { data } = await api.post<Section>(`/v1/classes/${classId}/sections`, { name });
    return data;
  } catch (error) {
    if ((error as AxiosError).response?.status === 409) {
      throw new DuplicateNameError('A section with this name already exists in this class');
    }
    throw error;
  }
}
