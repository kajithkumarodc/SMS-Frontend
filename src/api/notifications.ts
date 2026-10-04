import api from '../lib/api';

/** One in-app notification (`NotificationController.NotificationResponse`). */
export type AppNotification = {
  id: string;
  /** LEAVE_REQUESTED, LEAVE_DECIDED, ... -- picks the icon. */
  type: string;
  title: string;
  message: string;
  /** App route to open when it is clicked. */
  link: string | null;
  read: boolean;
  createdAt: string;
};

export type Inbox = { unread: number; items: AppNotification[] };

export async function fetchInbox(): Promise<Inbox> {
  const { data } = await api.get<Inbox>('/v1/notifications');
  return data;
}

export async function markNotificationRead(id: string): Promise<void> {
  await api.post(`/v1/notifications/${id}/read`);
}

export async function markAllNotificationsRead(): Promise<void> {
  await api.post('/v1/notifications/read-all');
}
