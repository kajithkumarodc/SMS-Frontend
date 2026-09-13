import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Card,
  Empty,
  Result,
  Skeleton,
  Space,
  Table,
  Tag,
  Typography,
  theme,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { fetchStaffProfiles, type StaffProfile } from '../../api/staff';
import { useAuthStore } from '../../store/authStore';
import { hasRole, ROLE } from '../../lib/roles';
import { STAFF_PROFILES_KEY } from './queryKeys';
import { STAFF_STATUS_TAG_COLOR, statusLabel } from './status';
import AddStaffProfileModal from './AddStaffProfileModal';
import EditStaffProfileModal from './EditStaffProfileModal';
import StaffDetailModal from './StaffDetailModal';

const { Title, Text } = Typography;

function StaffPage() {
  const { token } = theme.useToken();
  const roles = useAuthStore((state) => state.user?.roles);
  const canView = hasRole(roles, ROLE.SCHOOL_ADMIN);

  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<StaffProfile | null>(null);
  const [viewing, setViewing] = useState<StaffProfile | null>(null);

  const profilesQuery = useQuery({
    queryKey: STAFF_PROFILES_KEY,
    queryFn: fetchStaffProfiles,
    enabled: canView,
  });

  if (!canView) {
    return <Result status="403" title="Not available" subTitle="Only school admins can view staff records." />;
  }

  const profiles = profilesQuery.data ?? [];

  const columns: ColumnsType<StaffProfile> = [
    {
      title: 'Employee code',
      dataIndex: 'employeeCode',
      key: 'employeeCode',
      render: (value: string) => <Text strong>{value}</Text>,
    },
    {
      title: 'Name',
      key: 'name',
      render: (_value, record) => (
        <Space direction="vertical" size={0}>
          <Text>{record.fullName}</Text>
          <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
            {record.email}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Department',
      dataIndex: 'department',
      key: 'department',
      render: (value: string | null) => value || <Text type="secondary">—</Text>,
    },
    {
      title: 'Designation',
      dataIndex: 'designation',
      key: 'designation',
      render: (value: string | null) => value || <Text type="secondary">—</Text>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: StaffProfile['status']) => (
        <Tag color={STAFF_STATUS_TAG_COLOR[status]} style={{ marginInlineEnd: 0 }}>
          {statusLabel(status)}
        </Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 160,
      render: (_value, record) => (
        <Space size="small" wrap>
          <Button type="link" size="small" style={{ paddingInline: 0 }} onClick={() => setViewing(record)}>
            View
          </Button>
          <Button type="link" size="small" style={{ paddingInline: 0 }} onClick={() => setEditing(record)}>
            Edit
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ maxWidth: 1040, width: '100%', margin: '0 auto' }}>
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
            Staff
          </Title>
          <Text type="secondary">Staff profiles, department/designation and leave &amp; payroll.</Text>
        </div>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => void profilesQuery.refetch()}
            loading={profilesQuery.isFetching && !profilesQuery.isPending}
          >
            Refresh
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddOpen(true)}>
            Add staff profile
          </Button>
        </Space>
      </header>

      <Card
        styles={{ body: { padding: token.paddingLG } }}
        style={{ boxShadow: token.boxShadowTertiary }}
      >
        {profilesQuery.isError ? (
          <Alert
            type="warning"
            showIcon
            message="Couldn't load staff profiles"
            description="There was a problem reaching the server."
            action={
              <Button size="small" onClick={() => void profilesQuery.refetch()}>
                Try again
              </Button>
            }
          />
        ) : profilesQuery.isPending ? (
          <Skeleton active paragraph={{ rows: 6 }} />
        ) : (
          <Table<StaffProfile>
            rowKey="id"
            columns={columns}
            dataSource={profiles}
            pagination={false}
            scroll={{ x: 'max-content' }}
            locale={{
              emptyText: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="No staff profiles yet — add your first one"
                />
              ),
            }}
          />
        )}
      </Card>

      <AddStaffProfileModal open={addOpen} onClose={() => setAddOpen(false)} />
      <EditStaffProfileModal profile={editing} onClose={() => setEditing(null)} />
      <StaffDetailModal staff={viewing} onClose={() => setViewing(null)} />
    </div>
  );
}

export default StaffPage;
