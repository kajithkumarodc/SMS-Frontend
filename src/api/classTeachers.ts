import api from '../lib/api';

export type ClassTeacherRef = { staffProfileId: string; name: string | null; staffId: string | null };

/** A section with the teachers in charge of it (`ClassTeacherService.ClassTeacherRow`). */
export type ClassTeacherRow = {
  classId: string;
  className: string | null;
  sectionId: string;
  /** Empty for a class without sections. */
  sectionName: string;
  wholeClass: boolean;
  teachers: ClassTeacherRef[];
};

export async function fetchClassTeachers(): Promise<ClassTeacherRow[]> {
  const { data } = await api.get<ClassTeacherRow[]>('/v1/academics/class-teachers');
  return data;
}

export async function assignClassTeachers(sectionId: string, staffProfileIds: string[]): Promise<ClassTeacherRow> {
  const { data } = await api.put<ClassTeacherRow>(`/v1/academics/class-teachers/${sectionId}`, { staffProfileIds });
  return data;
}

export async function removeClassTeachers(sectionId: string): Promise<void> {
  await api.delete(`/v1/academics/class-teachers/${sectionId}`);
}
