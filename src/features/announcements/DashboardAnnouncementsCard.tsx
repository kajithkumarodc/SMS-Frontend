import { Link } from 'react-router-dom';
import { Card, Empty, Space, theme } from 'antd';
import { RightOutlined } from '@ant-design/icons';
import type { DashboardAnnouncement } from '../../api/dashboard';
import AnnouncementItem from './AnnouncementItem';

type Props = {
  announcements: DashboardAnnouncement[];
  /** Show a "Manage" link to the full announcements page (SCHOOL_ADMIN only). */
  canManage: boolean;
};

/** The recent-announcements card on every role's dashboard. Read-only. */
function DashboardAnnouncementsCard({ announcements, canManage }: Props) {
  const { token } = theme.useToken();

  return (
    <Card
      title="Announcements"
      style={{ boxShadow: token.boxShadowTertiary }}
      styles={{ body: { padding: token.paddingLG } }}
      extra={
        canManage ? (
          <Link to="/app/announcements">
            Manage <RightOutlined />
          </Link>
        ) : null
      }
    >
      {announcements.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No announcements yet" />
      ) : (
        <Space
          direction="vertical"
          size={token.margin}
          split={<div style={{ height: 1, background: token.colorSplit, width: '100%' }} />}
          style={{ width: '100%' }}
        >
          {announcements.map((announcement) => (
            <AnnouncementItem
              key={announcement.id}
              title={announcement.title}
              body={announcement.body}
              createdAt={announcement.createdAt}
            />
          ))}
        </Space>
      )}
    </Card>
  );
}

export default DashboardAnnouncementsCard;
