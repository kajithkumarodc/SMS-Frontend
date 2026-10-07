import api from '../lib/api';

/** The four Setup Front Office lists, by their API path. */
export type SetupListKey = 'purposes' | 'complaint-types' | 'sources' | 'references';

export type SetupItem = {
  id: string;
  name: string;
  description: string | null;
};

export type SetupItemInput = {
  name: string;
  description: string | null;
};

/** What a delete did: removed outright, or hidden because `usageCount` records use it. */
export type SetupDeleteResult = {
  outcome: 'DELETED' | 'DEACTIVATED';
  usageCount: number;
};

export async function fetchSetupItems(list: SetupListKey): Promise<SetupItem[]> {
  const { data } = await api.get<SetupItem[]>(`/v1/front-office-setup/${list}`);
  return data;
}

export async function createSetupItem(list: SetupListKey, input: SetupItemInput): Promise<SetupItem> {
  const { data } = await api.post<SetupItem>(`/v1/front-office-setup/${list}`, input);
  return data;
}

export async function updateSetupItem(list: SetupListKey, id: string, input: SetupItemInput): Promise<SetupItem> {
  const { data } = await api.put<SetupItem>(`/v1/front-office-setup/${list}/${id}`, input);
  return data;
}

export async function deleteSetupItem(list: SetupListKey, id: string): Promise<SetupDeleteResult> {
  const { data } = await api.delete<SetupDeleteResult>(`/v1/front-office-setup/${list}/${id}`);
  return data;
}
