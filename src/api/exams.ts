import api from '../lib/api';

export type Exam = {
  id: string;
  classId: string;
  subjectId: string;
  name: string;
  examDate: string; // YYYY-MM-DD
  maxMarks: number;
  createdAt: string;
};

export type ExamMark = {
  id: string;
  examId: string;
  studentId: string;
  marksObtained: number;
  createdAt: string;
  updatedAt: string;
};

export type StudentExamResult = {
  examId: string;
  examName: string;
  examDate: string;
  subjectId: string;
  maxMarks: number;
  marksObtained: number;
};

/** Exams for one class, newest first. 404 if the class is not in the caller's tenant. */
export async function fetchExams(classId: string): Promise<Exam[]> {
  const { data } = await api.get<Exam[]>('/v1/exams', { params: { classId } });
  return data;
}

export type CreateExamInput = {
  classId: string;
  subjectId: string;
  name: string;
  examDate: string;
  maxMarks: number;
};

export async function createExam(input: CreateExamInput): Promise<Exam> {
  const { data } = await api.post<Exam>('/v1/exams', input);
  return data;
}

/** The gradebook: every recorded mark for an exam. */
export async function fetchExamMarks(examId: string): Promise<ExamMark[]> {
  const { data } = await api.get<ExamMark[]>(`/v1/exams/${examId}/marks`);
  return data;
}

/** Record (or correct) one student's marks. Upsert — 201 on first entry, 200 on a correction. */
export async function recordExamMark(
  examId: string,
  input: { studentId: string; marksObtained: number },
): Promise<ExamMark> {
  const { data } = await api.post<ExamMark>(`/v1/exams/${examId}/marks`, input);
  return data;
}

// A student's own results are read through the ownership-scoped portal endpoints
// (`fetchMyExamResults` / `fetchChildExamResults` in api/portal.ts). The staff-only
// `GET /v1/exams/student/{id}` endpoint has no frontend caller yet.
