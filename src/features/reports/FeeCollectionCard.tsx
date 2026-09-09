import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Row,
  Skeleton,
  Statistic,
  Table,
  Typography,
  theme,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { fetchFeeCollection, type OverdueInvoice } from '../../api/reports';
import { fetchStudents } from '../../api/students';
import { STUDENTS_QUERY_KEY } from '../students/queryKeys';
import { FEE_COLLECTION_QUERY_KEY } from './queryKeys';
import { formatAmount, formatDate } from './format';

const { Text } = Typography;

// One generous page is plenty to resolve student names at this scale.
const STUDENT_PAGE_SIZE = 500;

function FeeCollectionCard() {
  const { token } = theme.useToken();

  const query = useQuery({
    queryKey: FEE_COLLECTION_QUERY_KEY,
    queryFn: fetchFeeCollection,
  });

  const studentsQuery = useQuery({
    queryKey: [...STUDENTS_QUERY_KEY, { picker: true }],
    queryFn: () => fetchStudents({ page: 0, size: STUDENT_PAGE_SIZE }),
    staleTime: 60 * 1000,
  });

  const studentName = useMemo(() => {
    const map = new Map((studentsQuery.data?.content ?? []).map((s) => [s.id, s.fullName]));
    return (id: string) => map.get(id) ?? '—';
  }, [studentsQuery.data]);

  const columns: ColumnsType<OverdueInvoice> = [
    {
      title: 'Student',
      dataIndex: 'studentId',
      key: 'student',
      render: (id: string) => studentName(id),
    },
    {
      title: 'Fee structure',
      dataIndex: 'feeStructureName',
      key: 'feeStructureName',
      render: (value: string) => <Text type="secondary">{value}</Text>,
    },
    {
      title: 'Amount',
      dataIndex: 'amount',
      key: 'amount',
      align: 'right',
      width: 140,
      render: (value: number) => formatAmount(value),
    },
    {
      title: 'Due date',
      dataIndex: 'dueDate',
      key: 'dueDate',
      width: 150,
      render: (value: string) => <Text type="danger">{formatDate(value)}</Text>,
    },
  ];

  const report = query.data;
  const collectionRate =
    report && report.totalInvoiced > 0
      ? Math.round((report.totalCollected / report.totalInvoiced) * 100)
      : 0;

  return (
    <Card
      title="Fee collection"
      style={{ boxShadow: token.boxShadowTertiary }}
      styles={{ body: { padding: token.paddingLG } }}
      extra={
        report && report.totalInvoiced > 0 ? (
          <Text type="secondary">{collectionRate}% collected</Text>
        ) : null
      }
    >
      {query.isError ? (
        <Alert
          type="warning"
          showIcon
          message="Couldn't load the fee collection report"
          action={
            <Button size="small" onClick={() => void query.refetch()}>
              Try again
            </Button>
          }
        />
      ) : query.isPending ? (
        <Skeleton active paragraph={{ rows: 5 }} />
      ) : (
        <>
          <Row gutter={[token.margin, token.margin]}>
            <Col xs={24} sm={8}>
              <StatTile label="Total invoiced" amount={report!.totalInvoiced} color={token.colorText} />
            </Col>
            <Col xs={24} sm={8}>
              <StatTile
                label="Total collected"
                amount={report!.totalCollected}
                color={token.colorSuccess}
              />
            </Col>
            <Col xs={24} sm={8}>
              <StatTile
                label="Outstanding"
                amount={report!.outstanding}
                color={report!.outstanding > 0 ? token.colorError : token.colorTextTertiary}
              />
            </Col>
          </Row>

          <Text strong style={{ display: 'block', margin: `${token.marginLG}px 0 ${token.marginSM}px` }}>
            Overdue invoices
          </Text>
          <Table<OverdueInvoice>
            rowKey="invoiceId"
            size="small"
            columns={columns}
            dataSource={report!.overdueInvoices}
            loading={studentsQuery.isLoading}
            pagination={false}
            scroll={{ x: 'max-content' }}
            locale={{
              emptyText: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="No overdue invoices — everything on track"
                />
              ),
            }}
          />
        </>
      )}
    </Card>
  );
}

function StatTile({ label, amount, color }: { label: string; amount: number; color: string }) {
  const { token } = theme.useToken();
  return (
    <Card size="small" style={{ height: '100%', background: token.colorFillQuaternary, border: 'none' }}>
      <Statistic
        title={label}
        value={formatAmount(amount)}
        valueStyle={{
          fontSize: token.fontSizeHeading2,
          fontWeight: token.fontWeightStrong,
          lineHeight: 1.2,
          color,
        }}
      />
    </Card>
  );
}

export default FeeCollectionCard;
