import api from '../lib/api';
import type { Student } from './students';

/** Mirrors the backend's `TeacherAssignmentService.SectionInfo`. */
export type TeacherSection = {
  id: string;
  name: string;
};

/** Mirrors the backend's `TeacherAssignmentService.AssignmentView`. */
export type TeacherAssignment = {
  classId: string;
  className: string | null;
  subjectId: string;
  subjectName: string | null;
  sections: TeacherSection[];
};

type PagedModel<T> = {
  content: T[];
  page: { size: number; number: number; totalElements: number; totalPages: number };
};

/** TEACHER: the classes/sections/subjects the caller is assigned to teach. */
export async function fetchTeacherAssignments(): Promise<TeacherAssignment[]> {
  const { data } = await api.get<TeacherAssignment[]>('/v1/teacher/assignments');
  return data;
}

/** TEACHER: every student across the caller's assigned sections. */
export async function fetchTeacherStudents(page = 0, size = 50): Promise<PagedModel<Student>> {
  const { data } = await api.get<PagedModel<Student>>('/v1/teacher/students', { params: { page, size } });
  return data;
}

/** SCHOOL_ADMIN: assigns (teacherId set) or unassigns (teacherId null) the teacher for a class/subject pairing. */
export async function assignClassSubjectTeacher(
  classId: string,
  subjectId: string,
  teacherId: string | null,
): Promise<void> {
  await api.patch(`/v1/classes/${classId}/subjects/${subjectId}/teacher`, { teacherId });
}
