import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, Card, DatePicker, Empty, Select, Skeleton, Space, Table, Tabs, Tag, Typography, theme } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs, { type Dayjs } from 'dayjs';
import {
  fetchFeeBalances,
  fetchFeeCollectionTransactions,
  fetchFeeDailyCollection,
  type BalanceFeeEntry,
  type DailyCollectionPoint,
  type FeeTransaction,
} from '../../api/reports';
import { fetchClasses } from '../../api/classes';
import { formatAmount, formatDate } from './format';

const { Text } = Typography;
const { RangePicker } = DatePicker;

const METHOD_OPTIONS = [
  { value: 'CASH', label: 'Cash' },
  { value: 'BANK_TRANSFER', label: 'Bank transfer' },
  { value: 'CHEQUE', label: 'Cheque' },
  { value: 'ONLINE', label: 'Online' },
  { value: 'OTHER', label: 'Other' },
];

function useDateRange(daysBack: number): [string, string, [Dayjs, Dayjs], (r: [Dayjs, Dayjs]) => void] {
  const [range, setRange] = useState<[Dayjs, Dayjs]>([dayjs().subtract(daysBack, 'day'), dayjs()]);
  return [range[0].format('YYYY-MM-DD'), range[1].format('YYYY-MM-DD'), range, setRange];
}

function FeeReportsCard() {
  const { token } = theme.useToken();

  return (
    <Card title="Fee reports" style={{ marginTop: token.marginLG, boxShadow: token.boxShadowTertiary }}>
      <Tabs
        defaultActiveKey="balances"
        items={[
          { key: 'balances', label: 'Balance Fees', children: <BalanceFeesTab /> },
          { key: 'daily', label: 'Daily Collection', children: <DailyCollectionTab /> },
          { key: 'transactions', label: 'Collection Report', children: <TransactionsTab /> },
        ]}
      />
    </Card>
  );
}

function BalanceFeesTab() {
  const [classId, setClassId] = useState<string | undefined>();
  const classesQuery = useQuery({ queryKey: ['classes'], queryFn: fetchClasses });
  const query = useQuery({ queryKey: ['reports', 'fee-balances', classId], queryFn: () => fetchFeeBalances(classId) });

  const columns: ColumnsType<BalanceFeeEntry> = [
    { title: 'Student', dataIndex: 'fullName', key: 'fullName' },
    { title: 'Admission #', dataIndex: 'admissionNumber', key: 'admissionNumber' },
    { title: 'Payable', dataIndex: 'totalPayable', key: 'totalPayable', align: 'right', render: (v: number) => formatAmount(v) },
    { title: 'Paid', dataIndex: 'totalPaid', key: 'totalPaid', align: 'right', render: (v: number) => formatAmount(v) },
    {
      title: 'Balance',
      dataIndex: 'totalBalance',
      key: 'totalBalance',
      align: 'right',
      render: (v: number) => <Text type={v > 0 ? 'danger' : 'secondary'}>{formatAmount(v)}</Text>,
    },
  ];

  return (
    <Space direction="vertical" style={{ width: '100%' }}>
      <Select
        style={{ width: 220 }}
        placeholder="All classes"
        allowClear
        options={(classesQuery.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
        value={classId}
        onChange={setClassId}
      />
      {query.isError ? (
        <Alert type="warning" showIcon message="Couldn't load balances" />
      ) : query.isPending ? (
        <Skeleton active paragraph={{ rows: 4 }} />
      ) : (
        <Table<BalanceFeeEntry>
          rowKey="studentId"
          size="small"
          columns={columns}
          dataSource={query.data ?? []}
          pagination={{ pageSize: 10 }}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No fee assignments yet" /> }}
        />
      )}
    </Space>
  );
}

function DailyCollectionTab() {
  const [from, to, range, setRange] = useDateRange(13);
  const query = useQuery({ queryKey: ['reports', 'fee-daily-collection', from, to], queryFn: () => fetchFeeDailyCollection(from, to) });

  const columns: ColumnsType<DailyCollectionPoint> = [
    { title: 'Date', dataIndex: 'date', key: 'date', render: (v: string) => formatDate(v) },
    {
      title: 'By method',
      key: 'byMethod',
      render: (_v, point) => (
        <Space size="small" wrap>
          {Object.entries(point.byMethod).map(([method, amount]) => (
            <Tag key={method}>
              {method}: {formatAmount(amount)}
            </Tag>
          ))}
        </Space>
      ),
    },
    { title: 'Total', dataIndex: 'total', key: 'total', align: 'right', render: (v: number) => <Text strong>{formatAmount(v)}</Text> },
  ];

  return (
    <Space direction="vertical" style={{ width: '100%' }}>
      <RangePicker
        value={range}
        onChange={(v) => v && v[0] && v[1] && setRange([v[0], v[1]])}
        allowClear={false}
      />
      {query.isError ? (
        <Alert type="warning" showIcon message="Couldn't load daily collection" />
      ) : query.isPending ? (
        <Skeleton active paragraph={{ rows: 4 }} />
      ) : (
        <Table<DailyCollectionPoint>
          rowKey="date"
          size="small"
          columns={columns}
          dataSource={query.data ?? []}
          pagination={false}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No collection in this range" /> }}
        />
      )}
    </Space>
  );
}

function TransactionsTab() {
  const [from, to, range, setRange] = useDateRange(13);
  const [method, setMethod] = useState<string | undefined>();
  const query = useQuery({
    queryKey: ['reports', 'fee-collection-transactions', from, to, method],
    queryFn: () => fetchFeeCollectionTransactions({ from, to, method }),
  });

  const columns: ColumnsType<FeeTransaction> = useMemo(
    () => [
      { title: 'Receipt #', dataIndex: 'receiptNumber', key: 'receiptNumber' },
      { title: 'Student', dataIndex: 'studentName', key: 'studentName' },
      { title: 'Fee', dataIndex: 'feeStructureName', key: 'feeStructureName', render: (v) => v ?? '—' },
      {
        title: 'Type',
        dataIndex: 'type',
        key: 'type',
        render: (t: string) => <Tag color={t === 'REVERSAL' ? 'error' : 'success'}>{t}</Tag>,
      },
      { title: 'Amount', dataIndex: 'amount', key: 'amount', align: 'right', render: (v: number) => formatAmount(v) },
      { title: 'Method', dataIndex: 'method', key: 'method' },
      { title: 'Date', dataIndex: 'paidAt', key: 'paidAt', render: (v: string) => formatDate(v) },
    ],
    [],
  );

  return (
    <Space direction="vertical" style={{ width: '100%' }}>
      <Space wrap>
        <RangePicker value={range} onChange={(v) => v && v[0] && v[1] && setRange([v[0], v[1]])} allowClear={false} />
        <Select style={{ width: 180 }} placeholder="All methods" allowClear options={METHOD_OPTIONS} value={method} onChange={setMethod} />
      </Space>
      {query.isError ? (
        <Alert type="warning" showIcon message="Couldn't load the collection report" />
      ) : query.isPending ? (
        <Skeleton active paragraph={{ rows: 4 }} />
      ) : (
        <>
          <Text type="secondary">
            {query.data?.transactionCount ?? 0} transaction(s) — net collected {formatAmount(query.data?.totalCollected ?? 0)}
          </Text>
          <Table<FeeTransaction>
            rowKey="paymentId"
            size="small"
            columns={columns}
            dataSource={query.data?.transactions ?? []}
            pagination={{ pageSize: 10 }}
            locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No transactions in this range" /> }}
          />
        </>
      )}
    </Space>
  );
}

export default FeeReportsCard;
