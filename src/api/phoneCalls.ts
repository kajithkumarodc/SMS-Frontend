import api from '../lib/api';

export type CallType = 'INCOMING' | 'OUTGOING';

/** Mirrors the backend's `PhoneCallLogDtos.PhoneCallResponse`. */
export type PhoneCall = {
  id: string;
  name: string | null;
  phone: string;
  callDate: string;
  description: string | null;
  nextFollowUpDate: string | null;
  callDuration: string | null;
  note: string | null;
  callType: CallType;
  createdAt: string;
  updatedAt: string;
};

/** The Add Phone Call Log form -- mirrors `PhoneCallLogDtos.PhoneCallRequest`. */
export type PhoneCallInput = {
  name: string | null;
  phone: string;
  callDate: string;
  description: string | null;
  nextFollowUpDate: string | null;
  callDuration: string | null;
  note: string | null;
  callType: CallType;
};

/** List columns the backend can sort by (`PhoneCallLogController.SORTABLE`). */
export type PhoneCallSortKey = 'name' | 'phone' | 'callDate' | 'nextFollowUpDate' | 'callType';

export type PhoneCallFilter = {
  q?: string;
  /** `<key>,asc|desc`. Omit for the latest call first. */
  sort?: string;
  page: number;
  size: number;
};

type PagedModel<T> = {
  content: T[];
  page: { size: number; number: number; totalElements: number; totalPages: number };
};

export const CALL_TYPE_LABEL: Record<CallType, string> = { INCOMING: 'Incoming', OUTGOING: 'Outgoing' };

export async function fetchPhoneCalls(filter: PhoneCallFilter): Promise<PagedModel<PhoneCall>> {
  const { data } = await api.get<PagedModel<PhoneCall>>('/v1/phone-calls', { params: filter });
  return data;
}

const EXPORT_PAGE_SIZE = 500;

/** Every call matching `filter` (all pages, same order) -- for Excel/CSV/PDF/Print. */
export async function fetchAllPhoneCalls(filter: Omit<PhoneCallFilter, 'page' | 'size'>): Promise<PhoneCall[]> {
  const rows: PhoneCall[] = [];
  for (let page = 0; ; page += 1) {
    const result = await fetchPhoneCalls({ ...filter, page, size: EXPORT_PAGE_SIZE });
    rows.push(...result.content);
    if (page + 1 >= result.page.totalPages) return rows;
  }
}

export async function createPhoneCall(input: PhoneCallInput): Promise<PhoneCall> {
  const { data } = await api.post<PhoneCall>('/v1/phone-calls', input);
  return data;
}

export async function updatePhoneCall(id: string, input: PhoneCallInput): Promise<PhoneCall> {
  const { data } = await api.put<PhoneCall>(`/v1/phone-calls/${id}`, input);
  return data;
}

export async function deletePhoneCall(id: string): Promise<void> {
  await api.delete(`/v1/phone-calls/${id}`);
}
