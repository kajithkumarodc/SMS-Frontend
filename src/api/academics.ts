import api from '../lib/api';

export type SubjectType = 'THEORY' | 'PRACTICAL';

/** A subject with its code and type (`TimetableDtos.SubjectResponse`). */
export type AcademicSubject = { id: string; name: string; code: string | null; type: SubjectType };
export type AcademicSubjectInput = { name: string; code: string | null; type: SubjectType };

export type GroupSection = { id: string; name: string; isDefault: boolean };
export type GroupSubject = { id: string; name: string; code: string | null };

/** A subject group (`TimetableDtos.SubjectGroupResponse`). */
export type SubjectGroup = {
  id: string;
  name: string;
  description: string | null;
  classId: string | null;
  className: string | null;
  sections: GroupSection[];
  subjects: GroupSubject[];
};

export type SubjectGroupInput = {
  name: string;
  classId: string;
  sectionIds: string[];
  subjectIds: string[];
  description: string | null;
};

/** Monday = 1 ... Sunday = 7. */
export const WEEK_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;

/** One period of a timetable (`TimetableDtos.PeriodResponse`); times are `HH:mm:ss`. */
export type Period = {
  id: string;
  sectionId: string;
  subjectGroupId: string;
  dayOfWeek: number;
  subjectId: string;
  subjectName: string | null;
  subjectCode: string | null;
  timeFrom: string;
  timeTo: string;
  staffProfileId: string | null;
  staffName: string | null;
  staffCode: string | null;
  roomNo: string | null;
};

/** One period to save; times are `HH:mm`. */
export type PeriodInput = {
  dayOfWeek: number;
  subjectId: string;
  timeFrom: string;
  timeTo: string;
  staffProfileId: string | null;
  roomNo: string | null;
};

export async function fetchAcademicSubjects(): Promise<AcademicSubject[]> {
  const { data } = await api.get<AcademicSubject[]>('/v1/academics/subjects');
  return data;
}

export async function createAcademicSubject(input: AcademicSubjectInput): Promise<AcademicSubject> {
  const { data } = await api.post<AcademicSubject>('/v1/academics/subjects', input);
  return data;
}

export async function updateAcademicSubject(id: string, input: AcademicSubjectInput): Promise<AcademicSubject> {
  const { data } = await api.put<AcademicSubject>(`/v1/academics/subjects/${id}`, input);
  return data;
}

export async function deleteAcademicSubject(id: string): Promise<void> {
  await api.delete(`/v1/academics/subjects/${id}`);
}

export async function fetchSubjectGroups(sectionId?: string): Promise<SubjectGroup[]> {
  const { data } = await api.get<SubjectGroup[]>('/v1/academics/subject-groups', { params: sectionId ? { sectionId } : undefined });
  return data;
}

export async function createSubjectGroup(input: SubjectGroupInput): Promise<SubjectGroup> {
  const { data } = await api.post<SubjectGroup>('/v1/academics/subject-groups', input);
  return data;
}

export async function updateSubjectGroup(id: string, input: SubjectGroupInput): Promise<SubjectGroup> {
  const { data } = await api.put<SubjectGroup>(`/v1/academics/subject-groups/${id}`, input);
  return data;
}

export async function deleteSubjectGroup(id: string): Promise<void> {
  await api.delete(`/v1/academics/subject-groups/${id}`);
}

/** A section's whole week, or one subject group's periods of it. */
export async function fetchTimetable(sectionId: string, subjectGroupId?: string): Promise<Period[]> {
  const { data } = await api.get<Period[]>('/v1/academics/timetable', { params: { sectionId, subjectGroupId } });
  return data;
}

export async function fetchTeacherTimetable(staffProfileId: string): Promise<Period[]> {
  const { data } = await api.get<Period[]>(`/v1/academics/timetable/teacher/${staffProfileId}`);
  return data;
}

export async function saveTimetable(sectionId: string, subjectGroupId: string, periods: PeriodInput[]): Promise<Period[]> {
  const { data } = await api.put<Period[]>('/v1/academics/timetable', { sectionId, subjectGroupId, periods });
  return data;
}
