import { useMemo, useState, type ReactNode } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Avatar, Badge, Button, Input, Layout, Menu, Space, Typography, theme } from 'antd';
import type { MenuProps } from 'antd';
import {
  ApartmentOutlined,
  BarChartOutlined,
  BellOutlined,
  BookOutlined,
  CalendarOutlined,
  CarOutlined,
  CheckSquareOutlined,
  ContactsOutlined,
  DashboardOutlined,
  FileDoneOutlined,
  HomeOutlined,
  IdcardOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  NotificationOutlined,
  ProfileOutlined,
  ReadOutlined,
  SearchOutlined,
  SettingOutlined,
  SolutionOutlined,
  SwapOutlined,
  TeamOutlined,
  TrophyOutlined,
  UserOutlined,
  WalletOutlined,
} from '@ant-design/icons';
import { logout as logoutRequest } from '../api/auth';
import { useAuthStore } from '../store/authStore';
import { hasAnyRole, hasPermission, hasRole, ROLE } from '../lib/roles';
import { ChangePasswordModal } from '../features/settings';

const { Sider, Header, Content } = Layout;
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
  const [collapsed, setCollapsed] = useState(false);

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
        key: '/app/front-office',
        label: 'Front Office',
        icon: <ContactsOutlined />,
        visible: hasPermission(user?.permissions, 'ENQUIRY_VIEW'),
      },
      {
        key: '/app/enquiries',
        label: 'Enquiries',
        icon: <ContactsOutlined />,
        visible: hasPermission(user?.permissions, 'ENQUIRY_VIEW'),
      },
      {
        key: '/app/admissions',
        label: 'Online Admissions',
        icon: <SolutionOutlined />,
        visible: hasPermission(user?.permissions, 'ADMISSION_APPLICATION_VIEW'),
      },
      {
        key: '/app/admission-cycles',
        label: 'Admission Cycles',
        icon: <CalendarOutlined />,
        visible: hasPermission(user?.permissions, 'ADMISSION_CYCLE_VIEW'),
      },
      {
        key: '/app/students',
        label: 'Students',
        icon: <TeamOutlined />,
        visible: hasAnyRole(user?.roles, [ROLE.SCHOOL_ADMIN, ROLE.TEACHER]),
      },
      {
        key: '/app/attendance',
        label: 'Attendance',
        icon: <CheckSquareOutlined />,
        visible: hasAnyRole(user?.roles, [ROLE.SCHOOL_ADMIN, ROLE.TEACHER]),
      },
      {
        key: '/app/exams',
        label: 'Exams',
        icon: <ProfileOutlined />,
        visible: hasAnyRole(user?.roles, [ROLE.SCHOOL_ADMIN, ROLE.TEACHER]),
      },
      {
        key: '/app/classes',
        label: 'Classes',
        icon: <ApartmentOutlined />,
        visible: hasRole(user?.roles, ROLE.SCHOOL_ADMIN),
      },
      {
        key: '/app/fees',
        label: 'Fees',
        icon: <WalletOutlined />,
        visible: hasRole(user?.roles, ROLE.SCHOOL_ADMIN),
      },
      {
        key: '/app/fee-collection',
        label: 'Fee Collection',
        icon: <WalletOutlined />,
        visible: hasPermission(user?.permissions, 'FEE_COLLECT'),
      },
      {
        key: '/app/library',
        label: 'Library',
        icon: <BookOutlined />,
        visible: hasAnyRole(user?.roles, [ROLE.SCHOOL_ADMIN, ROLE.TEACHER]),
      },
      {
        key: '/app/transport',
        label: 'Transport',
        icon: <CarOutlined />,
        visible: hasAnyRole(user?.roles, [ROLE.SCHOOL_ADMIN, ROLE.TEACHER]),
      },
      {
        key: '/app/hostel',
        label: 'Hostel',
        icon: <HomeOutlined />,
        visible: hasAnyRole(user?.roles, [ROLE.SCHOOL_ADMIN, ROLE.TEACHER]),
      },
      {
        key: '/app/staff',
        label: 'Staff',
        icon: <IdcardOutlined />,
        visible: hasRole(user?.roles, ROLE.SCHOOL_ADMIN),
      },
      {
        key: '/app/leave-requests',
        label: 'Leave Requests',
        icon: <FileDoneOutlined />,
        visible: hasRole(user?.roles, ROLE.SCHOOL_ADMIN),
      },
      {
        key: '/app/reports',
        label: 'Reports',
        icon: <BarChartOutlined />,
        visible: hasRole(user?.roles, ROLE.SCHOOL_ADMIN),
      },
      {
        key: '/app/announcements',
        label: 'Announcements',
        icon: <NotificationOutlined />,
        visible: hasRole(user?.roles, ROLE.SCHOOL_ADMIN),
      },
      {
        key: '/app/promotion',
        label: 'Promotion',
        icon: <SwapOutlined />,
        visible: hasPermission(user?.permissions, 'STUDENT_PROMOTE'),
      },
      {
        key: '/app/settings',
        label: 'Settings',
        icon: <SettingOutlined />,
        visible: hasAnyRole(user?.roles, [ROLE.SCHOOL_ADMIN, ROLE.SUPER_ADMIN]),
      },
      {
        key: '/app/my-attendance',
        label: 'My Attendance',
        icon: <CalendarOutlined />,
        visible: hasRole(user?.roles, ROLE.STUDENT),
      },
      {
        key: '/app/my-results',
        label: 'My Results',
        icon: <TrophyOutlined />,
        visible: hasRole(user?.roles, ROLE.STUDENT),
      },
      {
        key: '/app/my-library',
        label: 'My Library',
        icon: <ReadOutlined />,
        visible: hasRole(user?.roles, ROLE.STUDENT),
      },
      {
        key: '/app/my-transport',
        label: 'My Transport',
        icon: <CarOutlined />,
        visible: hasRole(user?.roles, ROLE.STUDENT),
      },
      {
        key: '/app/my-hostel',
        label: 'My Hostel',
        icon: <HomeOutlined />,
        visible: hasRole(user?.roles, ROLE.STUDENT),
      },
      {
        key: '/app/my-profile',
        label: 'My Profile',
        icon: <UserOutlined />,
        visible: hasRole(user?.roles, ROLE.TEACHER),
      },
    ],
    [user?.roles, user?.permissions],
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

  const initials = (user?.name ?? '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  return (
    <div style={{ minHeight: '100vh', padding: token.marginLG, background: token.colorBgLayout }}>
      <Layout
        style={{
          minHeight: `calc(100vh - ${token.marginLG * 2}px)`,
          borderRadius: token.borderRadiusLG * 1.3,
          overflow: 'hidden',
          boxShadow: token.boxShadowTertiary,
        }}
      >
        <Sider
          width={240}
          theme="light"
          breakpoint="lg"
          collapsedWidth={0}
          collapsed={collapsed}
          onBreakpoint={(broken) => setCollapsed(broken)}
          trigger={null}
          style={{ borderInlineEnd: `1px solid ${token.colorBorderSecondary}` }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: token.marginSM,
              padding: `${token.paddingLG}px ${token.paddingMD}px`,
            }}
          >
            <span
              aria-hidden
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 36,
                height: 36,
                borderRadius: token.borderRadius,
                background: token.colorPrimary,
                color: '#fff',
                fontWeight: 700,
              }}
            >
              SM
            </span>
            <Text strong style={{ fontSize: token.fontSizeLG, letterSpacing: 0.2 }}>
              School Manager
            </Text>
          </div>
          <Menu
            data-testid="main-nav"
            mode="inline"
            selectedKeys={[selectedKey]}
            items={menuItems}
            onClick={({ key }) => navigate(key)}
            style={{ border: 'none', paddingInline: token.paddingXS }}
          />
        </Sider>
        <Layout>
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
            <Button
              type="text"
              aria-label={collapsed ? 'Open navigation' : 'Close navigation'}
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
            />
            <Input
              prefix={<SearchOutlined style={{ color: token.colorTextTertiary }} />}
              placeholder="Search"
              style={{ maxWidth: 320, background: token.colorFillTertiary }}
              variant="filled"
            />
            <div style={{ flex: 1 }} />
            <Space size="large" align="center">
              <Badge dot color={token.colorPrimary}>
                <BellOutlined style={{ fontSize: 18, color: token.colorTextSecondary }} />
              </Badge>
              <Space size="small" align="center">
                <Avatar style={{ background: token.colorPrimary }}>{initials || <UserOutlined />}</Avatar>
                {user?.name && (
                  <div style={{ lineHeight: 1.2 }}>
                    <div style={{ fontWeight: 600 }}>{user.name}</div>
                    {primaryRole && (
                      <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                        {primaryRole}
                      </Text>
                    )}
                  </div>
                )}
              </Space>
              <Button icon={<LogoutOutlined />} onClick={handleLogout} loading={loggingOut}>
                Log out
              </Button>
            </Space>
          </Header>
          <Content style={{ padding: token.paddingLG }}>
            <Outlet />
          </Content>
        </Layout>
      </Layout>
      <ChangePasswordModal />
    </div>
  );
}

export default AppLayout;
