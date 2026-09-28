import { AxiosError } from 'axios';
import api from '../lib/api';

export type Section = {
  id: string;
  classId: string;
  name: string;
  /** The hidden whole-class section of a class that has no real sections -- show the class name only. */
  isDefault: boolean;
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

export type Subject = {
  id: string;
  schoolId: string;
  name: string;
};

/** All subjects for the tenant. */
export async function fetchSubjects(): Promise<Subject[]> {
  const { data } = await api.get<Subject[]>('/v1/subjects');
  return data;
}

export async function createSubject(input: { schoolId: string; name: string }): Promise<Subject> {
  try {
    const { data } = await api.post<Subject>('/v1/subjects', input);
    return data;
  } catch (error) {
    if ((error as AxiosError).response?.status === 409) {
      throw new DuplicateNameError('A subject with this name already exists for this school');
    }
    throw error;
  }
}

/** Subjects currently assigned to a class. */
export async function fetchClassSubjects(classId: string): Promise<Subject[]> {
  const { data } = await api.get<Subject[]>(`/v1/classes/${classId}/subjects`);
  return data;
}

/** Assign an existing subject to a class. Returns the assigned subject. */
export async function assignClassSubject(classId: string, subjectId: string): Promise<Subject> {
  const { data } = await api.post<Subject>(`/v1/classes/${classId}/subjects`, { subjectId });
  return data;
}

/** Renames a section; the class and its students are untouched. 409 -> DuplicateNameError. */
export async function renameSection(classId: string, sectionId: string, name: string): Promise<Section> {
  try {
    const { data } = await api.put<Section>(`/v1/classes/${classId}/sections/${sectionId}`, { name });
    return data;
  } catch (error) {
    if ((error as AxiosError).response?.status === 409) {
      throw new DuplicateNameError('A section with this name already exists in this class');
    }
    throw error;
  }
}

/** Deletes an empty section. Rejects with the server's message (409) if students are still in it. */
export async function deleteSection(classId: string, sectionId: string): Promise<void> {
  await api.delete(`/v1/classes/${classId}/sections/${sectionId}`);
}
