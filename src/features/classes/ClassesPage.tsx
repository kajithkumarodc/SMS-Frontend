import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Card,
  Collapse,
  Empty,
  Result,
  Skeleton,
  Space,
  Tag,
  Typography,
  theme,
} from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { fetchClasses, type SchoolClass } from '../../api/classes';
import { useAuthStore } from '../../store/authStore';
import { hasRole, ROLE } from '../../lib/roles';
import { CLASSES_QUERY_KEY } from './queryKeys';
import AddClassModal from './AddClassModal';
import AddSectionModal from './AddSectionModal';

const { Title, Text } = Typography;

function ClassesPage() {
  const { token } = theme.useToken();
  const roles = useAuthStore((state) => state.user?.roles);
  const canManage = hasRole(roles, ROLE.SCHOOL_ADMIN);

  const [addClassOpen, setAddClassOpen] = useState(false);
  const [sectionTarget, setSectionTarget] = useState<{ id: string; name: string } | null>(null);

  const { data, isPending, isError, isFetching, refetch } = useQuery({
    queryKey: CLASSES_QUERY_KEY,
    queryFn: fetchClasses,
    enabled: canManage,
  });

  if (!canManage) {
    return (
      <Result
        status="403"
        title="Not available"
        subTitle="Only a school administrator can manage classes and sections."
      />
    );
  }

  const classes = data ?? [];

  const renderClass = (cls: SchoolClass) => ({
    key: cls.id,
    label: (
      <Space>
        <Text strong>{cls.name}</Text>
        <Text type="secondary">
          {cls.sections.length} section{cls.sections.length === 1 ? '' : 's'}
        </Text>
      </Space>
    ),
    extra: (
      <Button
        size="small"
        icon={<PlusOutlined />}
        onClick={(event) => {
          event.stopPropagation();
          setSectionTarget({ id: cls.id, name: cls.name });
        }}
      >
        Add section
      </Button>
    ),
    children:
      cls.sections.length === 0 ? (
        <Text type="secondary">No sections yet — add the first one.</Text>
      ) : (
        <Space size={[token.marginXS, token.marginXS]} wrap>
          {cls.sections.map((section) => (
            <Tag key={section.id} style={{ marginInlineEnd: 0 }}>
              {section.name}
            </Tag>
          ))}
        </Space>
      ),
  });

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
            Classes &amp; sections
          </Title>
          <Text type="secondary">Grade / class groups and their sections.</Text>
        </div>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              void refetch();
            }}
            loading={isFetching && !isPending}
          >
            Refresh
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddClassOpen(true)}>
            Add class
          </Button>
        </Space>
      </header>

      <Card
        styles={{ body: { padding: token.paddingLG } }}
        style={{ boxShadow: token.boxShadowTertiary }}
      >
        {isError ? (
          <Alert
            type="warning"
            showIcon
            message="Couldn't load classes"
            description="There was a problem reaching the server."
            action={
              <Button size="small" onClick={() => void refetch()}>
                Try again
              </Button>
            }
          />
        ) : isPending ? (
          <Skeleton active paragraph={{ rows: 5 }} />
        ) : classes.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="No classes yet — add your first class"
          />
        ) : (
          <Collapse
            accordion
            items={classes.map(renderClass)}
            defaultActiveKey={classes[0]?.id}
          />
        )}
      </Card>

      <AddClassModal open={addClassOpen} onClose={() => setAddClassOpen(false)} />
      <AddSectionModal target={sectionTarget} onClose={() => setSectionTarget(null)} />
    </div>
  );
}

export default ClassesPage;
