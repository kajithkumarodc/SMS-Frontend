import api from '../lib/api';

/** A school-wide announcement. Mirrors the backend's `AnnouncementDtos.AnnouncementResponse`. */
export type Announcement = {
  id: string;
  title: string;
  body: string;
  createdBy: string;
  createdAt: string; // ISO timestamp
};

/** Shape of Spring's `PagedModel` response. */
export type AnnouncementsPage = {
  content: Announcement[];
  page: {
    size: number;
    number: number;
    totalElements: number;
    totalPages: number;
  };
};

export type FetchAnnouncementsParams = {
  /** Zero-based page index, as the backend expects. */
  page: number;
  size: number;
};

/** Announcements for the caller's tenant, newest first. Any authenticated role may read. */
export async function fetchAnnouncements(params: FetchAnnouncementsParams): Promise<AnnouncementsPage> {
  const { data } = await api.get<AnnouncementsPage>('/v1/announcements', { params });
  return data;
}

export type CreateAnnouncementInput = {
  title: string;
  body: string;
};

/** Post an announcement. SCHOOL_ADMIN only server-side. */
export async function createAnnouncement(input: CreateAnnouncementInput): Promise<Announcement> {
  const { data } = await api.post<Announcement>('/v1/announcements', input);
  return data;
}

/** Remove an announcement. SCHOOL_ADMIN only server-side; 404 for a cross-tenant id. */
export async function deleteAnnouncement(id: string): Promise<void> {
  await api.delete(`/v1/announcements/${id}`);
}
