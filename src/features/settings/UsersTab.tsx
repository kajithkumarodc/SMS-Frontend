import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Empty, Skeleton, Space, Table, Tag, Typography, theme } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { fetchUsers, type AppUser } from '../../api/users';
import { USERS_KEY } from './queryKeys';
import AddUserModal from './AddUserModal';
import EditUserModal from './EditUserModal';

const { Text } = Typography;

function UsersTab() {
  const { token } = theme.useToken();
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<AppUser | null>(null);

  const usersQuery = useQuery({ queryKey: USERS_KEY, queryFn: fetchUsers });
  const users = usersQuery.data ?? [];

  const columns: ColumnsType<AppUser> = [
    {
      title: 'Name',
      key: 'name',
      render: (_value, record) => (
        <Space direction="vertical" size={0}>
          <Text strong>{record.fullName}</Text>
          <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
            {record.email}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Roles',
      key: 'roles',
      render: (_value, record) => (
        <Space size={[4, 4]} wrap>
          {record.roles.map((role) => (
            <Tag key={role}>{role}</Tag>
          ))}
        </Space>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (status: AppUser['status']) => (
        <Tag color={status === 'ACTIVE' ? 'success' : 'default'}>{status === 'ACTIVE' ? 'Active' : 'Inactive'}</Tag>
      ),
    },
    {
      title: 'Password',
      key: 'mustChangePassword',
      width: 160,
      render: (_value, record) =>
        record.mustChangePassword ? <Tag color="warning">Must change on login</Tag> : <Text type="secondary">—</Text>,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      render: (_value, record) => (
        <Button type="link" size="small" style={{ paddingInline: 0 }} onClick={() => setEditing(record)}>
          Edit
        </Button>
      ),
    },
  ];

  return (
    <div>
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
        <Text type="secondary">Local accounts and their role assignments.</Text>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => void usersQuery.refetch()}
            loading={usersQuery.isFetching && !usersQuery.isPending}
          >
            Refresh
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddOpen(true)}>
            Add user
          </Button>
        </Space>
      </header>

      {usersQuery.isError ? (
        <Alert
          type="warning"
          showIcon
          message="Couldn't load users"
          description="There was a problem reaching the server."
          action={
            <Button size="small" onClick={() => void usersQuery.refetch()}>
              Try again
            </Button>
          }
        />
      ) : usersQuery.isPending ? (
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : (
        <Table<AppUser>
          rowKey="id"
          columns={columns}
          dataSource={users}
          pagination={false}
          scroll={{ x: 'max-content' }}
          locale={{
            emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No users yet — add your first one" />,
          }}
        />
      )}

      <AddUserModal open={addOpen} onClose={() => setAddOpen(false)} />
      <EditUserModal user={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

export default UsersTab;
