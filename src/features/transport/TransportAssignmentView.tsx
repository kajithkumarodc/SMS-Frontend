import { Card, Empty, List, Space, Tag, Typography, theme } from 'antd';
import { CarOutlined } from '@ant-design/icons';
import type { TransportAssignment } from '../../api/transport';

const { Title, Text } = Typography;

type Props = {
  assignment: TransportAssignment | null;
  /** Empty-state copy — differs between the student's own page and a parent's child page. */
  emptyText?: string;
};

/**
 * The route + vehicle(s) + driver info for one student, shared by the student's
 * own "My transport" page and a parent's per-child page.
 */
function TransportAssignmentView({
  assignment,
  emptyText = 'Not assigned to a transport route yet',
}: Props) {
  const { token } = theme.useToken();

  if (!assignment) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyText} />;
  }

  return (
    <Space direction="vertical" size={token.margin} style={{ width: '100%' }}>
      <div>
        <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
          ROUTE
        </Text>
        <Title level={4} style={{ margin: 0 }}>
          {assignment.routeName}
        </Title>
      </div>

      {assignment.vehicles.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="No vehicle is assigned to this route yet"
        />
      ) : (
        <List
          dataSource={assignment.vehicles}
          rowKey={(vehicle) => vehicle.registrationNumber}
          renderItem={(vehicle) => (
            <List.Item style={{ display: 'block' }}>
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
                  <CarOutlined />
                </span>
                <Space direction="vertical" size={0}>
                  <Text strong>{vehicle.registrationNumber}</Text>
                  <Text type="secondary">
                    Driver: {vehicle.driverName}
                    {vehicle.driverContact ? ` · ${vehicle.driverContact}` : ''}
                  </Text>
                  <Tag style={{ marginInlineEnd: 0, marginTop: token.marginXXS }}>
                    {vehicle.capacity} seats
                  </Tag>
                </Space>
              </Space>
            </List.Item>
          )}
        />
      )}
    </Space>
  );
}

export default TransportAssignmentView;

/** A `Card`-wrapped variant for the portal pages, matching the other portal cards. */
export function TransportAssignmentCard(props: Props) {
  const { token } = theme.useToken();
  return (
    <Card styles={{ body: { padding: token.paddingLG } }} style={{ boxShadow: token.boxShadowTertiary }}>
      <TransportAssignmentView {...props} />
    </Card>
  );
}
