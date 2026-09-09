import api from '../lib/api';

/** One day of the attendance trend. Mirrors the backend's `ReportDtos.AttendanceTrendPoint`. */
export type AttendanceTrendPoint = {
  date: string; // YYYY-MM-DD
  present: number;
  absent: number;
  late: number;
  total: number;
  /** (present + late) / total * 100, rounded to 2 dp; 0 when nothing was marked. */
  attendancePercentage: number;
};

/** One exam's average performance for a class. Mirrors `ReportDtos.ExamPerformancePoint`. */
export type ExamPerformancePoint = {
  examId: string;
  examName: string;
  subjectId: string;
  examDate: string; // YYYY-MM-DD
  maxMarks: number;
  averageMarks: number;
  studentsGraded: number;
};

export type OverdueInvoice = {
  invoiceId: string;
  studentId: string;
  feeStructureName: string;
  amount: number;
  dueDate: string; // YYYY-MM-DD
};

/** Fee collection summary + the defaulter list. Mirrors `ReportDtos.FeeCollectionReport`. */
export type FeeCollectionReport = {
  totalInvoiced: number;
  totalCollected: number;
  outstanding: number;
  overdueInvoices: OverdueInvoice[];
};

/** Daily attendance percentage over an inclusive date range. SCHOOL_ADMIN only. */
export async function fetchAttendanceTrend(from: string, to: string): Promise<AttendanceTrendPoint[]> {
  const { data } = await api.get<AttendanceTrendPoint[]>('/v1/reports/attendance-trend', {
    params: { from, to },
  });
  return data;
}

/** Average marks per exam for one class, oldest exam first. SCHOOL_ADMIN only. */
export async function fetchAcademicPerformance(classId: string): Promise<ExamPerformancePoint[]> {
  const { data } = await api.get<ExamPerformancePoint[]>('/v1/reports/academic-performance', {
    params: { classId },
  });
  return data;
}

/** Total invoiced vs. collected for the tenant, plus the overdue-invoice defaulter list. SCHOOL_ADMIN only. */
export async function fetchFeeCollection(): Promise<FeeCollectionReport> {
  const { data } = await api.get<FeeCollectionReport>('/v1/reports/fee-collection');
  return data;
}
