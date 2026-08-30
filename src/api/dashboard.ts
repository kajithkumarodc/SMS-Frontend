import api from '../lib/api';

export type DashboardCounts = {
  schools: number;
  users: number;
};

export type DashboardSummary = {
  userId: string;
  tenantId: string;
  roles: string[];
  /** false = real role-specific data below; true = nothing to show for this role yet. */
  placeholder: boolean;
  /** Present only when placeholder is true — explains what is still to come. */
  note: string | null;
  /** Present only when placeholder is false. */
  counts: DashboardCounts | null;
};

export async function fetchDashboardSummary(): Promise<DashboardSummary> {
  const { data } = await api.get<DashboardSummary>('/v1/dashboard/summary');
  return data;
}
