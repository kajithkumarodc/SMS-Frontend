import { Card, Typography, theme } from 'antd';
import { useAuthStore } from '../../store/authStore';

const { Title, Text } = Typography;

function DashboardPage() {
  const user = useAuthStore((state) => state.user);
  const { token } = theme.useToken();

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      <Title level={3} style={{ marginBottom: token.marginXS }}>
        Welcome back{user?.name ? `, ${user.name}` : ''}
      </Title>
      <Text type="secondary">
        {user?.roles?.length ? user.roles.join(', ') : 'No roles assigned'}
      </Text>

      <Card style={{ marginTop: token.marginLG }}>
        <Text type="secondary">
          Dashboard widgets for your role will appear here.
        </Text>
      </Card>
    </div>
  );
}

export default DashboardPage;
