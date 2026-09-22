import api from '../lib/api';

export type DashboardCounts = {
  schools: number;
  users: number;
  students: number;
  staff: number;
  maleStudents: number;
  femaleStudents: number;
};

/** Basic student info the backend returns for STUDENT (self) and PARENT (each child). */
export type DashboardStudentInfo = {
  id: string;
  fullName: string;
  admissionNumber: string;
  status: string;
  sectionId: string | null;
};

export type DashboardAttendanceSummary = {
  present: number;
  absent: number;
  late: number;
  total: number;
};

/** A recent school-wide announcement, trimmed for the dashboard. Same for every role. */
export type DashboardAnnouncement = {
  id: string;
  title: string;
  body: string;
  createdAt: string; // ISO timestamp
};

/** One class/subject a teacher is assigned to teach, with the sections it covers. */
export type DashboardTeacherAssignment = {
  className: string | null;
  subjectName: string | null;
  sectionNames: string[];
};

/** TEACHER: assigned classes/sections/subjects and roster size. */
export type DashboardTeacherInfo = {
  assignedClassCount: number;
  assignedSubjectCount: number;
  studentCount: number;
  assignments: DashboardTeacherAssignment[];
};

export type DashboardSummary = {
  userId: string;
  roles: string[];
  /** false = real role-specific data below; true = nothing to show for this role yet. */
  placeholder: boolean;
  /** Present only when placeholder is true — explains what is still to come. */
  note: string | null;
  /** SCHOOL_ADMIN. */
  counts: DashboardCounts | null;
  /** STUDENT: the caller's own record. */
  student: DashboardStudentInfo | null;
  /** STUDENT: the caller's own attendance tally. */
  attendance: DashboardAttendanceSummary | null;
  /** PARENT: linked children (may be an empty array). */
  children: DashboardStudentInfo[] | null;
  /** TEACHER: assigned classes/sections/subjects. */
  teacher: DashboardTeacherInfo | null;
  /** The 2-3 most recent school-wide announcements — present for every role. */
  announcements: DashboardAnnouncement[];
};

export async function fetchDashboardSummary(): Promise<DashboardSummary> {
  const { data } = await api.get<DashboardSummary>('/v1/dashboard/summary');
  return data;
}
