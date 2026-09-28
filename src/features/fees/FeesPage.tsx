import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Card,
  Empty,
  Result,
  Skeleton,
  Space,
  Table,
  Tag,
  Typography,
  theme,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { fetchFeeStructures, type FeeStructure } from '../../api/fees';
import { useAuthStore } from '../../store/authStore';
import { hasRole, ROLE } from '../../lib/roles';
import { FEE_STRUCTURES_QUERY_KEY } from './queryKeys';
import { formatAmount, formatDate } from './format';
import AddFeeStructureModal from './AddFeeStructureModal';
import GenerateInvoiceForm from './GenerateInvoiceForm';
import FeeTypesTab from './FeeTypesTab';
import FeeDiscountsTab from './FeeDiscountsTab';

const { Title, Text } = Typography;

const FREQUENCY_LABEL: Record<string, string> = {
  ONE_TIME: 'One-time',
  MONTHLY: 'Monthly',
  QUARTERLY: 'Quarterly',
  HALF_YEARLY: 'Half-yearly',
  ANNUAL: 'Annual',
};

export type FeesSection = 'master' | 'types' | 'discounts';

const SECTION_HEADER: Record<FeesSection, { title: string; description: string }> = {
  master: { title: 'Fees Master', description: 'Define what your school charges and assign it to students.' },
  types: { title: 'Fees Type', description: 'The kinds of fees your school charges (tuition, transport, and so on).' },
  discounts: { title: 'Fees Discount', description: 'Discounts that can be applied to student fees.' },
};

type Props = {
  /** Which Fees Collection menu page this is. */
  section: FeesSection;
};

function FeesPage({ section }: Props) {
  const { token } = theme.useToken();
  const roles = useAuthStore((state) => state.user?.roles);
  const canManage = hasRole(roles, ROLE.SCHOOL_ADMIN);

  const [addOpen, setAddOpen] = useState(false);

  const feeStructuresQuery = useQuery({
    queryKey: FEE_STRUCTURES_QUERY_KEY,
    queryFn: () => fetchFeeStructures(),
    enabled: canManage && section === 'master',
  });

  if (!canManage) {
    return (
      <Result
        status="403"
        title="Not available"
        subTitle="Only a school administrator can manage fees."
      />
    );
  }

  const feeStructures = feeStructuresQuery.data ?? [];

  const columns: ColumnsType<FeeStructure> = [
    { title: 'Name', dataIndex: 'name', key: 'name', render: (value: string) => <Text strong>{value}</Text> },
    { title: 'Session', dataIndex: 'academicYear', key: 'academicYear', width: 120 },
    { title: 'Amount', dataIndex: 'amount', key: 'amount', align: 'right', width: 140, render: (value: number) => formatAmount(value) },
    {
      title: 'Frequency',
      dataIndex: 'frequency',
      key: 'frequency',
      width: 120,
      render: (v: string) => FREQUENCY_LABEL[v] ?? v,
    },
    { title: 'Due date', dataIndex: 'dueDate', key: 'dueDate', width: 150, render: (value: string) => formatDate(value) },
    {
      title: 'Late fee',
      dataIndex: 'lateFeeAmount',
      key: 'lateFeeAmount',
      width: 110,
      render: (v: number | null) => (v ? formatAmount(v) : '—'),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => <Tag color={status === 'ACTIVE' ? 'success' : 'default'}>{status}</Tag>,
    },
  ];

  const structuresTab = (
    <div>
      <Card
        title="Fee structures"
        style={{ marginBottom: token.marginLG, boxShadow: token.boxShadowTertiary }}
        styles={{ body: { padding: token.paddingLG } }}
        extra={
          <Space>
            <Button
              size="small"
              icon={<ReloadOutlined />}
              onClick={() => void feeStructuresQuery.refetch()}
              loading={feeStructuresQuery.isFetching && !feeStructuresQuery.isPending}
            >
              Refresh
            </Button>
            <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => setAddOpen(true)}>
              Add fee structure
            </Button>
          </Space>
        }
      >
        {feeStructuresQuery.isError ? (
          <Alert
            type="warning"
            showIcon
            message="Couldn't load fee structures"
            action={
              <Button size="small" onClick={() => void feeStructuresQuery.refetch()}>
                Try again
              </Button>
            }
          />
        ) : feeStructuresQuery.isPending ? (
          <Skeleton active paragraph={{ rows: 4 }} />
        ) : (
          <Table<FeeStructure>
            rowKey="id"
            columns={columns}
            dataSource={feeStructures}
            pagination={false}
            scroll={{ x: 'max-content' }}
            locale={{
              emptyText: (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No fee structures yet" />
              ),
            }}
          />
        )}
      </Card>

      <Card
        title="Assign fee to students"
        style={{ boxShadow: token.boxShadowTertiary }}
        styles={{ body: { padding: token.paddingLG } }}
      >
        <GenerateInvoiceForm
          feeStructures={feeStructures}
          feeStructuresLoading={feeStructuresQuery.isPending}
        />
      </Card>

      <AddFeeStructureModal open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );

  return (
    <div style={{ maxWidth: 1040, width: '100%', margin: '0 auto' }}>
      <header style={{ marginBottom: token.marginLG }}>
        <Text type="secondary">Fees Collection</Text>
        <Title level={2} style={{ margin: 0 }}>
          {SECTION_HEADER[section].title}
        </Title>
        <Text type="secondary">{SECTION_HEADER[section].description}</Text>
      </header>

      {section === 'master' ? structuresTab : section === 'types' ? <FeeTypesTab /> : <FeeDiscountsTab />}
    </div>
  );
}

export default FeesPage;
