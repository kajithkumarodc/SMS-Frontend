import api from '../lib/api';

export type AuditLogEntry = {
  id: string;
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  details: Record<string, unknown>;
  createdAt: string;
};

export type AuditLogPage = {
  content: AuditLogEntry[];
};

/** Most recent audit entries, newest first. SCHOOL_ADMIN only. */
export async function fetchRecentAuditLog(size = 6): Promise<AuditLogEntry[]> {
  const { data } = await api.get<AuditLogPage>('/v1/audit-log', { params: { size } });
  return data.content;
}
