import { AxiosError } from 'axios';
import api from '../lib/api';

/** Mirrors the backend's `AcademicsDtos.AcademicYearResponse`. */
export type AcademicYear = {
  id: string;
  name: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  current: boolean;
  createdAt: string;
};

export class DuplicateNameError extends Error {
  constructor() {
    super('An academic year with this name already exists');
    this.name = 'DuplicateNameError';
  }
}

/** All academic years, newest first. SCHOOL_ADMIN/SUPER_ADMIN only. */
export async function fetchAcademicYears(): Promise<AcademicYear[]> {
  const { data } = await api.get<AcademicYear[]>('/v1/academic-years');
  return data;
}

export type CreateAcademicYearInput = {
  name: string;
  startDate: string;
  endDate: string;
};

export async function createAcademicYear(input: CreateAcademicYearInput): Promise<AcademicYear> {
  try {
    const { data } = await api.post<AcademicYear>('/v1/academic-years', input);
    return data;
  } catch (error) {
    if ((error as AxiosError).response?.status === 409) throw new DuplicateNameError();
    throw error;
  }
}

export async function setCurrentAcademicYear(id: string): Promise<AcademicYear> {
  const { data } = await api.patch<AcademicYear>(`/v1/academic-years/${id}/set-current`);
  return data;
}

/** Whichever academic year is current, if any. Any authenticated role may read this. */
export async function fetchCurrentAcademicYear(): Promise<AcademicYear | null> {
  const { data, status } = await api.get<AcademicYear | ''>('/v1/academic-years/current', {
    validateStatus: (s) => s === 200 || s === 204,
  });
  return status === 204 || !data ? null : (data as AcademicYear);
}

export type PromoteStudentsInput = {
  fromSectionId: string;
  toSectionId: string;
  toClassId?: string;
  targetAcademicYearId?: string;
  studentIds: string[];
};

/** Mirrors the backend's `AcademicsDtos.PromotionResultResponse` -- one outcome per requested student id. */
export type PromotionResult = {
  studentId: string;
  studentName: string | null;
  promoted: boolean;
  reason: string | null;
};

export type PromoteStudentsResult = {
  results: PromotionResult[];
  promotedCount: number;
  requestedCount: number;
};

/** Bulk-moves students from one section to another (e.g. promoting a class to the next grade). */
export async function promoteStudents(input: PromoteStudentsInput): Promise<PromoteStudentsResult> {
  const { data } = await api.post<PromoteStudentsResult>('/v1/students/promote', input);
  return data;
}

/** Mirrors the backend's `AcademicsDtos.PromotionHistoryEntry`. */
export type PromotionHistoryEntry = {
  studentId: string;
  studentName: string | null;
  previousAcademicYearId: string | null;
  previousClassId: string | null;
  previousSectionId: string | null;
  newAcademicYearId: string | null;
  newClassId: string | null;
  newSectionId: string | null;
  promotionDate: string; // ISO timestamp
  performedByUserId: string | null;
};

type PagedModel<T> = {
  content: T[];
  page: { size: number; number: number; totalElements: number; totalPages: number };
};

/** Promotion History screen: every promotion school-wide, newest first. */
export async function fetchPromotionHistory(page = 0, size = 20): Promise<PagedModel<PromotionHistoryEntry>> {
  const { data } = await api.get<PagedModel<PromotionHistoryEntry>>('/v1/academic-years/promotion-history', {
    params: { page, size },
  });
  return data;
}
