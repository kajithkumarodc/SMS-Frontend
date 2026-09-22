import { Result, Tabs, Typography } from 'antd';
import { useAuthStore } from '../../store/authStore';
import { hasAnyRole, ROLE } from '../../lib/roles';
import UsersTab from './UsersTab';
import RolesTab from './RolesTab';
import AcademicYearsTab from './AcademicYearsTab';

const { Title } = Typography;

function SettingsPage() {
  const roles = useAuthStore((state) => state.user?.roles);
  const canView = hasAnyRole(roles, [ROLE.SCHOOL_ADMIN, ROLE.SUPER_ADMIN]);

  if (!canView) {
    return <Result status="403" title="Not available" subTitle="Only administrators can manage settings." />;
  }

  return (
    <div style={{ maxWidth: 1040, width: '100%', margin: '0 auto' }}>
      <Title level={2} style={{ marginTop: 0 }}>
        Settings
      </Title>
      <Tabs
        defaultActiveKey="users"
        items={[
          { key: 'users', label: 'Users', children: <UsersTab /> },
          { key: 'roles', label: 'Roles & Permissions', children: <RolesTab /> },
          { key: 'academic-years', label: 'Academic Years', children: <AcademicYearsTab /> },
        ]}
      />
    </div>
  );
}

export default SettingsPage;
