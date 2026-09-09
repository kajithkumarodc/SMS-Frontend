import { useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  App,
  Button,
  Card,
  Empty,
  Pagination,
  Result,
  Skeleton,
  Space,
  Typography,
  theme,
} from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { deleteAnnouncement, fetchAnnouncements } from '../../api/announcements';
import { useAuthStore } from '../../store/authStore';
import { hasRole, ROLE } from '../../lib/roles';
import { ANNOUNCEMENTS_QUERY_KEY } from './queryKeys';
import AnnouncementItem from './AnnouncementItem';
import PostAnnouncementModal from './PostAnnouncementModal';

const { Title, Text } = Typography;

const PAGE_SIZE = 10;

function AnnouncementsPage() {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const roles = useAuthStore((state) => state.user?.roles);
  const canManage = hasRole(roles, ROLE.SCHOOL_ADMIN);

  const [page, setPage] = useState(1); // 1-based for the UI; the API is 0-based
  const [postOpen, setPostOpen] = useState(false);

  const query = useQuery({
    queryKey: [...ANNOUNCEMENTS_QUERY_KEY, { page }],
    queryFn: () => fetchAnnouncements({ page: page - 1, size: PAGE_SIZE }),
    enabled: canManage,
    placeholderData: keepPreviousData,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteAnnouncement(id),
    onSuccess: () => {
      message.success('Announcement deleted');
      void queryClient.invalidateQueries({ queryKey: ANNOUNCEMENTS_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: ['dashboard', 'summary'] });
    },
    onError: () => {
      message.error('Could not delete the announcement. Please try again.');
    },
  });

  if (!canManage) {
    return (
      <Result
        status="403"
        title="Not available"
        subTitle="Only a school administrator can manage announcements."
      />
    );
  }

  const announcements = query.data?.content ?? [];
  const total = query.data?.page.totalElements ?? 0;

  return (
    <div style={{ maxWidth: 780, width: '100%', margin: '0 auto' }}>
      <header
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: token.marginSM,
          marginBottom: token.marginLG,
        }}
      >
        <div>
          <Title level={2} style={{ margin: 0 }}>
            Announcements
          </Title>
          <Text type="secondary">School-wide messages — everyone signed in can see these.</Text>
        </div>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => void query.refetch()}
            loading={query.isFetching && !query.isPending}
          >
            Refresh
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setPostOpen(true)}>
            Post announcement
          </Button>
        </Space>
      </header>

      <Card styles={{ body: { padding: token.paddingLG } }} style={{ boxShadow: token.boxShadowTertiary }}>
        {query.isError ? (
          <Alert
            type="warning"
            showIcon
            message="Couldn't load announcements"
            description="There was a problem reaching the server."
            action={
              <Button size="small" onClick={() => void query.refetch()}>
                Try again
              </Button>
            }
          />
        ) : query.isPending ? (
          <Skeleton active paragraph={{ rows: 6 }} />
        ) : announcements.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No announcements yet" />
        ) : (
          <Space direction="vertical" size={token.margin} split={<Divider />} style={{ width: '100%' }}>
            {announcements.map((announcement) => (
              <AnnouncementItem
                key={announcement.id}
                title={announcement.title}
                body={announcement.body}
                createdAt={announcement.createdAt}
                onDelete={() => deleteMutation.mutate(announcement.id)}
                deleting={deleteMutation.isPending && deleteMutation.variables === announcement.id}
              />
            ))}
          </Space>
        )}

        {total > PAGE_SIZE && (
          <div style={{ marginTop: token.marginLG, textAlign: 'right' }}>
            <Pagination
              current={page}
              pageSize={PAGE_SIZE}
              total={total}
              showSizeChanger={false}
              onChange={setPage}
            />
          </div>
        )}
      </Card>

      <PostAnnouncementModal open={postOpen} onClose={() => setPostOpen(false)} />
    </div>
  );
}

/** A hairline divider between list items, resolved from the theme. */
function Divider() {
  const { token } = theme.useToken();
  return <div style={{ height: 1, background: token.colorSplit, width: '100%' }} />;
}

export default AnnouncementsPage;
