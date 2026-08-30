import { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Button, Layout, Space, Typography, theme } from 'antd';
import { LogoutOutlined } from '@ant-design/icons';
import { logout as logoutRequest } from '../api/auth';
import { useAuthStore } from '../store/authStore';

const { Header, Content } = Layout;
const { Text } = Typography;

const LOGIN_ROUTE = '/login';

function AppLayout() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const { token } = theme.useToken();
  const [loggingOut, setLoggingOut] = useState(false);

  const primaryRole = user?.roles?.[0];

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
          justifyContent: 'space-between',
          gap: token.marginMD,
          background: token.colorBgContainer,
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          paddingInline: token.paddingLG,
        }}
      >
        <Text strong style={{ color: token.colorPrimary, letterSpacing: 1 }}>
          SCHOOL MANAGEMENT
        </Text>
        <Space size="middle">
          {user?.name && (
            <Text type="secondary">
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
