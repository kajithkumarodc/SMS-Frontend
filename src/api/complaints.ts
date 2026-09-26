import api from '../lib/api';

export type ComplaintAttachment = {
  fileName: string;
  contentType: string;
  sizeBytes: number;
};

/** Mirrors the backend's `ComplaintDtos.ComplaintResponse`. */
export type Complaint = {
  id: string;
  /** "Complain #": assigned by the database, never editable. */
  complaintNo: number;
  complaintTypeId: string | null;
  complaintTypeName: string | null;
  sourceId: string | null;
  sourceName: string | null;
  complainBy: string;
  phone: string | null;
  complaintDate: string;
  description: string | null;
  actionTaken: string | null;
  assigned: string | null;
  note: string | null;
  attachment: ComplaintAttachment | null;
  createdAt: string;
  updatedAt: string;
};

export type ComplaintType = {
  id: string;
  name: string;
  active: boolean;
};

/** The Add Complain form -- mirrors `ComplaintDtos.ComplaintRequest`. */
export type ComplaintInput = {
  complaintTypeId: string | null;
  sourceId: string | null;
  complainBy: string;
  phone: string | null;
  complaintDate: string;
  description: string | null;
  actionTaken: string | null;
  assigned: string | null;
  note: string | null;
};

/** List columns the backend can sort by (`ComplaintController.SORTABLE`). */
export type ComplaintSortKey = 'complaintNo' | 'complaintTypeName' | 'complainBy' | 'phone' | 'complaintDate';

export type ComplaintFilter = {
  /** Text, or a complaint number ("417" / "#417"). */
  q?: string;
  /** `<key>,asc|desc`. Omit for the newest complaint first. */
  sort?: string;
  page: number;
  size: number;
};

type PagedModel<T> = {
  content: T[];
  page: { size: number; number: number; totalElements: number; totalPages: number };
};

export async function fetchComplaints(filter: ComplaintFilter): Promise<PagedModel<Complaint>> {
  const { data } = await api.get<PagedModel<Complaint>>('/v1/complaints', { params: filter });
  return data;
}

const EXPORT_PAGE_SIZE = 500;

/** Every complaint matching `filter` (all pages, same order) -- for Copy/Excel/CSV/PDF/Print. */
export async function fetchAllComplaints(filter: Omit<ComplaintFilter, 'page' | 'size'>): Promise<Complaint[]> {
  const rows: Complaint[] = [];
  for (let page = 0; ; page += 1) {
    const result = await fetchComplaints({ ...filter, page, size: EXPORT_PAGE_SIZE });
    rows.push(...result.content);
    if (page + 1 >= result.page.totalPages) return rows;
  }
}

export async function fetchComplaint(id: string): Promise<Complaint> {
  const { data } = await api.get<Complaint>(`/v1/complaints/${id}`);
  return data;
}

export async function createComplaint(input: ComplaintInput): Promise<Complaint> {
  const { data } = await api.post<Complaint>('/v1/complaints', input);
  return data;
}

export async function updateComplaint(id: string, input: ComplaintInput): Promise<Complaint> {
  const { data } = await api.put<Complaint>(`/v1/complaints/${id}`, input);
  return data;
}

export async function deleteComplaint(id: string): Promise<void> {
  await api.delete(`/v1/complaints/${id}`);
}

export async function uploadComplaintAttachment(id: string, file: File): Promise<Complaint> {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.put<Complaint>(`/v1/complaints/${id}/attachment`, form);
  return data;
}

export async function removeComplaintAttachment(id: string): Promise<Complaint> {
  const { data } = await api.delete<Complaint>(`/v1/complaints/${id}/attachment`);
  return data;
}

/** Same-origin link; the auth cookie goes with it. */
export function complaintAttachmentUrl(id: string): string {
  const base = (api.defaults.baseURL ?? '/api').replace(/\/$/, '');
  return `${base}/v1/complaints/${id}/attachment`;
}

export async function fetchComplaintTypes(): Promise<ComplaintType[]> {
  const { data } = await api.get<ComplaintType[]>('/v1/complaint-types');
  return data;
}
