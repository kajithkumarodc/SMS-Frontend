import { Card, Result, Tag, Typography, theme } from 'antd';
import { ToolOutlined } from '@ant-design/icons';
import { useAuthStore } from '../../store/authStore';
import { hasPermission } from '../../lib/roles';

const { Title, Text } = Typography;

type Props = {
  title: string;
  description: string;
};

/**
 * Temporary page for a Front Office sub-module that is in the menu but not built yet
 * (Visitor Book, Phone Call Log, Postal Dispatch/Receive, Complaints, Setup).
 * Gated on ENQUIRY_VIEW like the rest of Front Office until each module gets its own permissions.
 */
function FrontOfficePlaceholderPage({ title, description }: Props) {
  const { token } = theme.useToken();
  const permissions = useAuthStore((state) => state.user?.permissions);

  if (!hasPermission(permissions, 'ENQUIRY_VIEW')) {
    return <Result status="403" title="Not available" subTitle={`You don't have permission to view ${title}.`} />;
  }

  return (
    <div style={{ maxWidth: 1200, width: '100%', margin: '0 auto' }}>
      <header style={{ marginBottom: token.marginLG }}>
        <Text type="secondary">Front Office</Text>
        <Title level={3} style={{ margin: 0 }}>
          {title}
        </Title>
      </header>
      <Card>
        <Result
          icon={<ToolOutlined style={{ color: token.colorTextTertiary }} />}
          title={
            <>
              {title} <Tag color="processing">Coming soon</Tag>
            </>
          }
          subTitle={description}
        />
      </Card>
    </div>
  );
}

export default FrontOfficePlaceholderPage;
