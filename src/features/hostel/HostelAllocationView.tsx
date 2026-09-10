import { Card, Empty, List, Space, Tag, Typography, theme } from 'antd';
import { HomeOutlined } from '@ant-design/icons';
import type { HostelAllocation } from '../../api/hostel';

const { Title, Text } = Typography;

type Props = {
  allocation: HostelAllocation | null;
  /** Empty-state copy — differs between the student's own page and a parent's child page. */
  emptyText?: string;
};

/**
 * The block + room + roommates for one student, shared by the student's own
 * "My hostel" page and a parent's per-child page.
 */
function HostelAllocationView({
  allocation,
  emptyText = 'Not allocated a hostel room yet',
}: Props) {
  const { token } = theme.useToken();

  if (!allocation) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyText} />;
  }

  return (
    <Space direction="vertical" size={token.margin} style={{ width: '100%' }}>
      <Space size={token.marginSM} align="start">
        <span
          aria-hidden
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: token.controlHeightLG,
            height: token.controlHeightLG,
            borderRadius: token.borderRadiusLG,
            background: token.colorPrimaryBg,
            color: token.colorPrimary,
            fontSize: token.fontSizeLG,
          }}
        >
          <HomeOutlined />
        </span>
        <Space direction="vertical" size={0}>
          <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
            {allocation.blockName}
          </Text>
          <Title level={4} style={{ margin: 0 }}>
            Room {allocation.roomNumber}
          </Title>
          <Tag style={{ marginInlineEnd: 0, marginTop: token.marginXXS }}>
            {allocation.capacity} bed{allocation.capacity === 1 ? '' : 's'}
          </Tag>
        </Space>
      </Space>

      <div>
        <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
          ROOMMATES
        </Text>
        {allocation.roommates.length === 0 ? (
          <div>
            <Text type="secondary">No roommates yet — the only one in this room.</Text>
          </div>
        ) : (
          <List
            size="small"
            dataSource={allocation.roommates}
            rowKey={(name) => name}
            renderItem={(name) => <List.Item>{name}</List.Item>}
          />
        )}
      </div>
    </Space>
  );
}

export default HostelAllocationView;
