import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Result,
  Row,
  Skeleton,
  Space,
  Typography,
  theme,
} from 'antd';
import { PlusOutlined, ReloadOutlined, RightOutlined } from '@ant-design/icons';
import { fetchBlocks, type HostelBlock } from '../../api/hostel';
import { useAuthStore } from '../../store/authStore';
import { hasAnyRole, hasRole, ROLE } from '../../lib/roles';
import { HOSTEL_BLOCKS_KEY } from './queryKeys';
import AddBlockModal from './AddBlockModal';
import BlockRoomsModal from './BlockRoomsModal';

const { Title, Text } = Typography;

function HostelPage() {
  const { token } = theme.useToken();
  const roles = useAuthStore((state) => state.user?.roles);
  const canView = hasAnyRole(roles, [ROLE.SCHOOL_ADMIN, ROLE.TEACHER]);
  const canManage = hasRole(roles, ROLE.SCHOOL_ADMIN);

  const [addBlockOpen, setAddBlockOpen] = useState(false);
  const [viewingBlock, setViewingBlock] = useState<HostelBlock | null>(null);

  const blocksQuery = useQuery({
    queryKey: HOSTEL_BLOCKS_KEY,
    queryFn: fetchBlocks,
    enabled: canView,
  });

  if (!canView) {
    return <Result status="403" title="Not available" subTitle="Only school staff can view the hostel." />;
  }

  const blocks = blocksQuery.data ?? [];

  return (
    <div style={{ maxWidth: 1040, width: '100%', margin: '0 auto' }}>
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
        <div>
          <Title level={2} style={{ margin: 0 }}>
            Hostel
          </Title>
          <Text type="secondary">Blocks, rooms and who lives in them.</Text>
        </div>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => void blocksQuery.refetch()}
            loading={blocksQuery.isFetching && !blocksQuery.isPending}
          >
            Refresh
          </Button>
          {canManage && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddBlockOpen(true)}>
              Add block
            </Button>
          )}
        </Space>
      </header>

      <Card
        title="Blocks"
        style={{ boxShadow: token.boxShadowTertiary }}
        styles={{ body: { padding: token.paddingLG } }}
      >
        {blocksQuery.isError ? (
          <Alert
            type="warning"
            showIcon
            message="Couldn't load blocks"
            description="There was a problem reaching the server."
            action={
              <Button size="small" onClick={() => void blocksQuery.refetch()}>
                Try again
              </Button>
            }
          />
        ) : blocksQuery.isPending ? (
          <Skeleton active paragraph={{ rows: 3 }} />
        ) : blocks.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No blocks yet" />
        ) : (
          <Row gutter={[token.margin, token.margin]}>
            {blocks.map((block) => (
              <Col key={block.id} xs={24} sm={12} lg={8}>
                <Card
                  size="small"
                  hoverable
                  onClick={() => setViewingBlock(block)}
                  style={{ height: '100%', boxShadow: token.boxShadowTertiary }}
                >
                  <Space direction="vertical" size={token.marginXXS} style={{ width: '100%' }}>
                    <Text strong>{block.name}</Text>
                    <Text style={{ color: token.colorPrimary, fontSize: token.fontSizeSM }}>
                      View rooms <RightOutlined />
                    </Text>
                  </Space>
                </Card>
              </Col>
            ))}
          </Row>
        )}
      </Card>

      {canManage && <AddBlockModal open={addBlockOpen} onClose={() => setAddBlockOpen(false)} />}
      <BlockRoomsModal block={viewingBlock} canManage={canManage} onClose={() => setViewingBlock(null)} />
    </div>
  );
}

export default HostelPage;
