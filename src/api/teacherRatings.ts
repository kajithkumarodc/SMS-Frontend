import api from '../lib/api';

export type RatingStatus = 'PENDING' | 'APPROVED';

/** One rating on the Teachers Rating page (`TeacherRatingDtos.RatingRow`). */
export type RatingRow = {
  id: string;
  staffProfileId: string;
  staffId: string | null;
  staffName: string | null;
  rating: number;
  comment: string | null;
  status: RatingStatus;
  studentId: string;
  studentName: string | null;
  studentAdmissionNumber: string | null;
  createdAt: string;
};

/** A teacher's average over approved ratings; `average` is null when none is approved yet. */
export type RatingSummary = { staffProfileId: string; average: number | null; count: number };

/** A teacher a student can rate, with their own rating of them if they gave one. */
export type RatableTeacher = {
  staffProfileId: string;
  staffId: string;
  name: string;
  designation: string | null;
  department: string | null;
  hasPhoto: boolean;
  myRating: number | null;
  myComment: string | null;
  myStatus: RatingStatus | null;
};

export async function fetchTeacherRatings(): Promise<RatingRow[]> {
  const { data } = await api.get<RatingRow[]>('/v1/teacher-ratings');
  return data;
}

export async function approveTeacherRating(id: string): Promise<void> {
  await api.post(`/v1/teacher-ratings/${id}/approve`);
}

export async function deleteTeacherRating(id: string): Promise<void> {
  await api.delete(`/v1/teacher-ratings/${id}`);
}

export async function fetchRatingSummary(staffProfileId: string): Promise<RatingSummary> {
  const { data } = await api.get<RatingSummary>(`/v1/teacher-ratings/summary/${staffProfileId}`);
  return data;
}

export async function fetchRatableTeachers(): Promise<RatableTeacher[]> {
  const { data } = await api.get<RatableTeacher[]>('/v1/me/teacher-ratings');
  return data;
}

export async function submitTeacherRating(staffProfileId: string, rating: number, comment: string | null): Promise<void> {
  await api.post('/v1/me/teacher-ratings', { staffProfileId, rating, comment });
}
