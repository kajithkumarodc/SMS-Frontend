import api from '../lib/api';

export type ReceiveDocument = {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  uploadedAt: string;
};

/** Mirrors the backend's `PostalReceiveDtos.ReceiveResponse`. */
export type PostalReceive = {
  id: string;
  /** PRC-YYYY-NNNNN, issued by the server on create and never editable. */
  referenceNo: string;
  fromTitle: string;
  toTitle: string | null;
  address: string | null;
  note: string | null;
  receiveDate: string;
  documents: ReceiveDocument[];
  createdAt: string;
  updatedAt: string;
};

/** The Add Postal Receive form. No reference number: the server assigns it. */
export type PostalReceiveInput = {
  fromTitle: string;
  toTitle: string | null;
  address: string | null;
  note: string | null;
  receiveDate: string;
};

/** List columns the backend can sort by (`PostalReceiveController.SORTABLE`). */
export type ReceiveSortKey = 'fromTitle' | 'referenceNo' | 'toTitle' | 'receiveDate';

export type ReceiveFilter = {
  q?: string;
  /** `<key>,asc|desc`. Omit for the latest receive first. */
  sort?: string;
  page: number;
  size: number;
};

type PagedModel<T> = {
  content: T[];
  page: { size: number; number: number; totalElements: number; totalPages: number };
};

/** Mirrors `PostalReceiveService.MAX_DOCUMENTS`. */
export const MAX_RECEIVE_DOCUMENTS = 10;

export async function fetchReceives(filter: ReceiveFilter): Promise<PagedModel<PostalReceive>> {
  const { data } = await api.get<PagedModel<PostalReceive>>('/v1/postal-receives', { params: filter });
  return data;
}

const EXPORT_PAGE_SIZE = 500;

/** Every receive matching `filter` (all pages, same order) -- for Copy/Excel/CSV/PDF/Print. */
export async function fetchAllReceives(filter: Omit<ReceiveFilter, 'page' | 'size'>): Promise<PostalReceive[]> {
  const rows: PostalReceive[] = [];
  for (let page = 0; ; page += 1) {
    const result = await fetchReceives({ ...filter, page, size: EXPORT_PAGE_SIZE });
    rows.push(...result.content);
    if (page + 1 >= result.page.totalPages) return rows;
  }
}

export async function fetchReceive(id: string): Promise<PostalReceive> {
  const { data } = await api.get<PostalReceive>(`/v1/postal-receives/${id}`);
  return data;
}

export async function createReceive(input: PostalReceiveInput): Promise<PostalReceive> {
  const { data } = await api.post<PostalReceive>('/v1/postal-receives', input);
  return data;
}

export async function updateReceive(id: string, input: PostalReceiveInput): Promise<PostalReceive> {
  const { data } = await api.put<PostalReceive>(`/v1/postal-receives/${id}`, input);
  return data;
}

export async function deleteReceive(id: string): Promise<void> {
  await api.delete(`/v1/postal-receives/${id}`);
}

export async function uploadReceiveDocument(id: string, file: File): Promise<ReceiveDocument> {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.post<ReceiveDocument>(`/v1/postal-receives/${id}/documents`, form);
  return data;
}

export async function deleteReceiveDocument(id: string, documentId: string): Promise<void> {
  await api.delete(`/v1/postal-receives/${id}/documents/${documentId}`);
}

/** Same-origin link; the auth cookie goes with it. */
export function receiveDocumentUrl(id: string, documentId: string): string {
  const base = (api.defaults.baseURL ?? '/api').replace(/\/$/, '');
  return `${base}/v1/postal-receives/${id}/documents/${documentId}`;
}
