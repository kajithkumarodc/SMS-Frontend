import api from '../lib/api';

export type DispatchDocument = {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  uploadedAt: string;
};

/** Mirrors the backend's `PostalDispatchDtos.DispatchResponse`. */
export type PostalDispatch = {
  id: string;
  /** DSP-YYYY-NNNNN, issued by the server on create and never editable. */
  referenceNo: string;
  toTitle: string;
  fromTitle: string | null;
  address: string | null;
  note: string | null;
  dispatchDate: string;
  documents: DispatchDocument[];
  createdAt: string;
  updatedAt: string;
};

/** The Add Postal Dispatch form. No reference number: the server assigns it. */
export type PostalDispatchInput = {
  toTitle: string;
  fromTitle: string | null;
  address: string | null;
  note: string | null;
  dispatchDate: string;
};

/** List columns the backend can sort by (`PostalDispatchController.SORTABLE`). */
export type DispatchSortKey = 'toTitle' | 'referenceNo' | 'fromTitle' | 'dispatchDate';

export type DispatchFilter = {
  q?: string;
  /** `<key>,asc|desc`. Omit for the latest dispatch first. */
  sort?: string;
  page: number;
  size: number;
};

type PagedModel<T> = {
  content: T[];
  page: { size: number; number: number; totalElements: number; totalPages: number };
};

/** Mirrors `PostalDispatchService.MAX_DOCUMENTS`. */
export const MAX_DISPATCH_DOCUMENTS = 10;

export async function fetchDispatches(filter: DispatchFilter): Promise<PagedModel<PostalDispatch>> {
  const { data } = await api.get<PagedModel<PostalDispatch>>('/v1/postal-dispatches', { params: filter });
  return data;
}

const EXPORT_PAGE_SIZE = 500;

/** Every dispatch matching `filter` (all pages, same order) -- for Copy/Excel/CSV/PDF/Print. */
export async function fetchAllDispatches(filter: Omit<DispatchFilter, 'page' | 'size'>): Promise<PostalDispatch[]> {
  const rows: PostalDispatch[] = [];
  for (let page = 0; ; page += 1) {
    const result = await fetchDispatches({ ...filter, page, size: EXPORT_PAGE_SIZE });
    rows.push(...result.content);
    if (page + 1 >= result.page.totalPages) return rows;
  }
}

export async function fetchDispatch(id: string): Promise<PostalDispatch> {
  const { data } = await api.get<PostalDispatch>(`/v1/postal-dispatches/${id}`);
  return data;
}

export async function createDispatch(input: PostalDispatchInput): Promise<PostalDispatch> {
  const { data } = await api.post<PostalDispatch>('/v1/postal-dispatches', input);
  return data;
}

export async function updateDispatch(id: string, input: PostalDispatchInput): Promise<PostalDispatch> {
  const { data } = await api.put<PostalDispatch>(`/v1/postal-dispatches/${id}`, input);
  return data;
}

export async function deleteDispatch(id: string): Promise<void> {
  await api.delete(`/v1/postal-dispatches/${id}`);
}

export async function uploadDispatchDocument(id: string, file: File): Promise<DispatchDocument> {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.post<DispatchDocument>(`/v1/postal-dispatches/${id}/documents`, form);
  return data;
}

export async function deleteDispatchDocument(id: string, documentId: string): Promise<void> {
  await api.delete(`/v1/postal-dispatches/${id}/documents/${documentId}`);
}

/** Same-origin link; the auth cookie goes with it. */
export function dispatchDocumentUrl(id: string, documentId: string): string {
  const base = (api.defaults.baseURL ?? '/api').replace(/\/$/, '');
  return `${base}/v1/postal-dispatches/${id}/documents/${documentId}`;
}
