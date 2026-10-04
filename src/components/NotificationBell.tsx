import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge, Button, Empty, List, Popover, Typography, theme } from 'antd';
import { BellOutlined, CheckCircleOutlined, CloseCircleOutlined, FileDoneOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { fetchInbox, markAllNotificationsRead, markNotificationRead, type AppNotification } from '../api/notifications';

dayjs.extend(relativeTime);

const { Text } = Typography;

export const NOTIFICATIONS_KEY = ['notifications'] as const;
/** How often the bell checks for new notifications. */
const POLL_MS = 30_000;

function icon(n: AppNotification) {
  if (n.type === 'LEAVE_DECIDED') {
    return n.title.toLowerCase().includes('disapproved') ? (
      <CloseCircleOutlined style={{ color: '#cf1322', fontSize: 18 }} />
    ) : (
      <CheckCircleOutlined style={{ color: '#389e0d', fontSize: 18 }} />
    );
  }
  return <FileDoneOutlined style={{ color: '#d46b08', fontSize: 18 }} />;
}

/** The bell in the header: unread count, the latest notifications, and a click opens the page they are about. */
function NotificationBell() {
  const { token } = theme.useToken();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const inboxQuery = useQuery({
    queryKey: NOTIFICATIONS_KEY,
    queryFn: fetchInbox,
    refetchInterval: POLL_MS,
    refetchOnWindowFocus: true,
  });
  const inbox = inboxQuery.data;

  const refresh = () => void queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
  const readOne = useMutation({ mutationFn: markNotificationRead, onSuccess: refresh });
  const readAll = useMutation({ mutationFn: markAllNotificationsRead, onSuccess: refresh });

  const openNotification = (n: AppNotification) => {
    if (!n.read) readOne.mutate(n.id);
    setOpen(false);
    if (n.link) navigate(n.link);
  };

  const content = (
    <div style={{ width: 360 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: token.marginXS }}>
        <Text strong>Notifications</Text>
        <Button type="link" size="small" disabled={!inbox?.unread} loading={readAll.isPending} onClick={() => readAll.mutate()}>
          Mark all as read
        </Button>
      </div>
      {inbox && inbox.items.length > 0 ? (
        <List
          size="small"
          dataSource={inbox.items}
          style={{ maxHeight: 420, overflowY: 'auto' }}
          renderItem={(n) => (
            <List.Item
              onClick={() => openNotification(n)}
              style={{ cursor: 'pointer', background: n.read ? undefined : token.colorPrimaryBg, paddingInline: token.paddingSM }}
              role="button"
              aria-label={n.title}
            >
              <List.Item.Meta
                avatar={icon(n)}
                title={<Text strong={!n.read}>{n.title}</Text>}
                description={
                  <>
                    <div style={{ whiteSpace: 'normal' }}>{n.message}</div>
                    <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                      {dayjs(n.createdAt).fromNow()}
                    </Text>
                  </>
                }
              />
            </List.Item>
          )}
        />
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No notifications yet" />
      )}
    </div>
  );

  return (
    <Popover content={content} trigger="click" placement="bottomRight" open={open} onOpenChange={setOpen}>
      <Badge count={inbox?.unread ?? 0} size="small" overflowCount={99}>
        <Button type="text" shape="circle" aria-label={`Notifications${inbox?.unread ? `, ${inbox.unread} unread` : ''}`} icon={<BellOutlined style={{ fontSize: 18, color: token.colorTextSecondary }} />} />
      </Badge>
    </Popover>
  );
}

export default NotificationBell;
