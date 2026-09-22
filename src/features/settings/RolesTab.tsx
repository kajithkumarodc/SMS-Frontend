import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Card, Empty, Skeleton, Space, Tag, Typography, theme } from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { fetchRoles, type AppRole } from '../../api/roles';
import { ROLES_KEY } from './queryKeys';
import AddRoleModal from './AddRoleModal';
import EditRolePermissionsModal from './EditRolePermissionsModal';

const { Text } = Typography;

function RolesTab() {
  const { token } = theme.useToken();
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<AppRole | null>(null);

  const rolesQuery = useQuery({ queryKey: ROLES_KEY, queryFn: fetchRoles });
  const roles = rolesQuery.data ?? [];

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
        <Text type="secondary">Roles and the permissions granted to each. Click a role to edit its permissions.</Text>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => void rolesQuery.refetch()}
            loading={rolesQuery.isFetching && !rolesQuery.isPending}
          >
            Refresh
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddOpen(true)}>
            Add role
          </Button>
        </Space>
      </header>

      {rolesQuery.isError ? (
        <Alert
          type="warning"
          showIcon
          message="Couldn't load roles"
          description="There was a problem reaching the server."
          action={
            <Button size="small" onClick={() => void rolesQuery.refetch()}>
              Try again
            </Button>
          }
        />
      ) : rolesQuery.isPending ? (
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : roles.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No roles yet" />
      ) : (
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          {roles.map((role) => (
            <Card
              key={role.id}
              size="small"
              hoverable
              onClick={() => setEditing(role)}
              title={role.name}
              style={{ boxShadow: token.boxShadowTertiary }}
            >
              {role.permissionNames.length === 0 ? (
                <Text type="secondary">No permissions granted</Text>
              ) : (
                <Space size={[4, 4]} wrap>
                  {role.permissionNames.map((name) => (
                    <Tag key={name}>{name}</Tag>
                  ))}
                </Space>
              )}
            </Card>
          ))}
        </Space>
      )}

      <AddRoleModal open={addOpen} onClose={() => setAddOpen(false)} />
      <EditRolePermissionsModal role={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

export default RolesTab;
