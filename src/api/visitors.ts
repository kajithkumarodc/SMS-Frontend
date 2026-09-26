import api from '../lib/api';

export type MeetingWithType = 'STAFF' | 'STUDENT';

export type VisitorAttachment = {
  fileName: string;
  contentType: string;
  sizeBytes: number;
};

/** Mirrors the backend's `VisitorDtos.VisitorResponse`. Times are `HH:mm:ss`. */
export type Visitor = {
  id: string;
  purposeId: string;
  purposeName: string | null;
  meetingWithType: MeetingWithType;
  staffProfileId: string | null;
  studentId: string | null;
  meetingWithName: string | null;
  /** Employee code (staff) or admission number (student). */
  meetingWithCode: string | null;
  visitorName: string;
  phone: string | null;
  idCard: string | null;
  numberOfPersons: number | null;
  visitDate: string;
  inTime: string | null;
  outTime: string | null;
  note: string | null;
  attachment: VisitorAttachment | null;
  createdAt: string;
  updatedAt: string;
};

export type FrontOfficePurpose = {
  id: string;
  name: string;
  active: boolean;
};

/** A staff member or student a visitor can meet. */
export type MeetingPerson = {
  id: string;
  type: MeetingWithType;
  name: string;
  code: string;
};

type PagedModel<T> = {
  content: T[];
  page: { size: number; number: number; totalElements: number; totalPages: number };
};

/** List columns the backend can sort by (`VisitorController.SORTABLE`). */
export type VisitorSortKey =
  | 'purposeName'
  | 'visitorName'
  | 'phone'
  | 'idCard'
  | 'numberOfPersons'
  | 'visitDate'
  | 'inTime'
  | 'outTime';

export type VisitorFilter = {
  q?: string;
  from?: string;
  to?: string;
  /** `<key>,asc|desc`. Omit for the latest visit first. */
  sort?: string;
  page: number;
  size: number;
};

/** The Add Visitor form -- mirrors `VisitorDtos.VisitorRequest`. Times are `HH:mm`. */
export type VisitorInput = {
  purposeId: string;
  meetingWithType: MeetingWithType;
  staffProfileId: string | null;
  studentId: string | null;
  visitorName: string;
  phone: string | null;
  idCard: string | null;
  numberOfPersons: number | null;
  visitDate: string;
  inTime: string | null;
  outTime: string | null;
  note: string | null;
};

export async function fetchVisitors(filter: VisitorFilter): Promise<PagedModel<Visitor>> {
  const { data } = await api.get<PagedModel<Visitor>>('/v1/visitors', { params: filter });
  return data;
}

const EXPORT_PAGE_SIZE = 500;

/** Every visitor matching `filter` (all pages, same order) -- for Copy/Excel/CSV/PDF/Print. */
export async function fetchAllVisitors(filter: Omit<VisitorFilter, 'page' | 'size'>): Promise<Visitor[]> {
  const rows: Visitor[] = [];
  for (let page = 0; ; page += 1) {
    const result = await fetchVisitors({ ...filter, page, size: EXPORT_PAGE_SIZE });
    rows.push(...result.content);
    if (page + 1 >= result.page.totalPages) return rows;
  }
}

export async function fetchVisitor(id: string): Promise<Visitor> {
  const { data } = await api.get<Visitor>(`/v1/visitors/${id}`);
  return data;
}

export async function createVisitor(input: VisitorInput): Promise<Visitor> {
  const { data } = await api.post<Visitor>('/v1/visitors', input);
  return data;
}

export async function updateVisitor(id: string, input: VisitorInput): Promise<Visitor> {
  const { data } = await api.put<Visitor>(`/v1/visitors/${id}`, input);
  return data;
}

export async function deleteVisitor(id: string): Promise<void> {
  await api.delete(`/v1/visitors/${id}`);
}

export async function uploadVisitorAttachment(id: string, file: File): Promise<Visitor> {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.put<Visitor>(`/v1/visitors/${id}/attachment`, form);
  return data;
}

export async function removeVisitorAttachment(id: string): Promise<Visitor> {
  const { data } = await api.delete<Visitor>(`/v1/visitors/${id}/attachment`);
  return data;
}

/** Same-origin link; the auth cookie goes with it, like student document downloads. */
export function visitorAttachmentUrl(id: string): string {
  const base = (api.defaults.baseURL ?? '/api').replace(/\/$/, '');
  return `${base}/v1/visitors/${id}/attachment`;
}

export async function fetchMeetingOptions(type: MeetingWithType, q?: string): Promise<MeetingPerson[]> {
  const { data } = await api.get<MeetingPerson[]>('/v1/visitors/meeting-options', { params: { type, q } });
  return data;
}

export async function fetchFrontOfficePurposes(): Promise<FrontOfficePurpose[]> {
  const { data } = await api.get<FrontOfficePurpose[]>('/v1/front-office-purposes');
  return data;
}

/** "Staff (Joe Black - 9000)" / "Student (Edward Thomas - 18001)", as the Visitor List shows it. */
export function meetingWithLabel(v: Pick<Visitor, 'meetingWithType' | 'meetingWithName' | 'meetingWithCode'>): string {
  const kind = v.meetingWithType === 'STAFF' ? 'Staff' : 'Student';
  if (!v.meetingWithName) return kind;
  return v.meetingWithCode ? `${kind} (${v.meetingWithName} - ${v.meetingWithCode})` : `${kind} (${v.meetingWithName})`;
}
