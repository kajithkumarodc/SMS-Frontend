import { useMemo, useState, type ReactNode } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Button, Layout, Menu, Space, Typography, theme } from 'antd';
import type { MenuProps } from 'antd';
import { DashboardOutlined, LogoutOutlined, TeamOutlined } from '@ant-design/icons';
import { logout as logoutRequest } from '../api/auth';
import { useAuthStore } from '../store/authStore';
import { hasAnyRole, ROLE } from '../lib/roles';

const { Header, Content } = Layout;
const { Text } = Typography;

const LOGIN_ROUTE = '/login';

type NavItem = {
  key: string;
  label: string;
  icon: ReactNode;
  visible: boolean;
};

function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const { token } = theme.useToken();
  const [loggingOut, setLoggingOut] = useState(false);

  const primaryRole = user?.roles?.[0];

  const navItems: NavItem[] = useMemo(
    () => [
      {
        key: '/app/dashboard',
        label: 'Dashboard',
        icon: <DashboardOutlined />,
        visible: true,
      },
      {
        key: '/app/students',
        label: 'Students',
        icon: <TeamOutlined />,
        visible: hasAnyRole(user?.roles, [ROLE.SCHOOL_ADMIN, ROLE.TEACHER]),
      },
    ],
    [user?.roles],
  );

  const menuItems: MenuProps['items'] = navItems
    .filter((item) => item.visible)
    .map((item) => ({ key: item.key, label: item.label, icon: item.icon }));

  const selectedKey =
    navItems.find((item) => location.pathname.startsWith(item.key))?.key ?? '/app/dashboard';

  const handleLogout = async () => {
    setLoggingOut(true);
    await logoutRequest();
    logout();
    navigate(LOGIN_ROUTE, { replace: true });
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: token.marginLG,
          background: token.colorBgContainer,
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          paddingInline: token.paddingLG,
        }}
      >
        <Text strong style={{ color: token.colorPrimary, letterSpacing: 1, whiteSpace: 'nowrap' }}>
          SCHOOL MANAGEMENT
        </Text>
        <Menu
          mode="horizontal"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ flex: 1, minWidth: 0, background: 'transparent', borderBottom: 'none' }}
        />
        <Space size="middle">
          {user?.name && (
            <Text type="secondary" style={{ whiteSpace: 'nowrap' }}>
              {user.name}
              {primaryRole ? ` · ${primaryRole}` : ''}
            </Text>
          )}
          <Button icon={<LogoutOutlined />} onClick={handleLogout} loading={loggingOut}>
            Log out
          </Button>
        </Space>
      </Header>
      <Content style={{ padding: token.paddingLG }}>
        <Outlet />
      </Content>
    </Layout>
  );
}

export default AppLayout;
