import { Card, Result, Tag, Typography, theme } from 'antd';
import { ToolOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

type Props = {
  /** Menu group the page belongs to, shown above the title (e.g. "Student Information"). */
  section: string;
  title: string;
  description: string;
  /** When false, shows a 403 instead. */
  canView?: boolean;
};

/** Temporary page for a menu item whose screen isn't built yet. */
function ComingSoonPage({ section, title, description, canView = true }: Props) {
  const { token } = theme.useToken();

  if (!canView) {
    return <Result status="403" title="Not available" subTitle={`You don't have permission to view ${title}.`} />;
  }

  return (
    <div style={{ maxWidth: 1200, width: '100%', margin: '0 auto' }}>
      <header style={{ marginBottom: token.marginLG }}>
        <Text type="secondary">{section}</Text>
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

export default ComingSoonPage;
