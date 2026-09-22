import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Card, Empty, Result, Skeleton, Space, Table, Tag, Typography, theme } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ArrowLeftOutlined, ReloadOutlined } from '@ant-design/icons';
import { ChildNotFoundError, fetchChildFeeStatement, fetchChildReceipt, fetchMyChildren } from '../../api/portal';
import type { InvoiceStatementLine, Payment } from '../../api/fees';
import { useAuthStore } from '../../store/authStore';
import { hasRole, ROLE } from '../../lib/roles';
import { MY_CHILDREN_KEY } from './queryKeys';
import { INVOICE_STATUS_TAG_COLOR, invoiceStatusLabel } from '../fees/feeStatus';
import { formatAmount, formatDate } from '../fees/format';
import ReceiptView from '../fees/ReceiptView';
import PayNowButton from '../fees/PayNowButton';

const { Title, Text } = Typography;

function ChildInvoicesPage() {
  const { token } = theme.useToken();
  const { studentId = '' } = useParams();
  const roles = useAuthStore((state) => state.user?.roles);
  const isParent = hasRole(roles, ROLE.PARENT);
  const [viewingReceipt, setViewingReceipt] = useState<string | null>(null);

  const childrenQuery = useQuery({
    queryKey: MY_CHILDREN_KEY,
    queryFn: fetchMyChildren,
    enabled: isParent,
  });
  const child = childrenQuery.data?.find((c) => c.id === studentId);

  // The endpoint itself enforces ownership (404 -> ChildNotFoundError); the children
  // list is only used for the child's name and a friendly "not yours" screen.
  const statementQuery = useQuery({
    queryKey: ['child-fee-statement', studentId],
    queryFn: () => fetchChildFeeStatement(studentId),
    enabled: isParent && studentId !== '',
    retry: (failureCount, err) => !(err instanceof ChildNotFoundError) && failureCount < 1,
  });

  if (!isParent) {
    return <Result status="403" title="Not available" subTitle="Only a parent account can view this page." />;
  }

  const notYours =
    (statementQuery.isError && statementQuery.error instanceof ChildNotFoundError) ||
    (childrenQuery.isSuccess && !child);

  const statement = statementQuery.data;

  const columns: ColumnsType<InvoiceStatementLine> = [
    { title: 'Fee', dataIndex: 'feeStructureName', key: 'feeStructureName', render: (v) => v ?? '—' },
    { title: 'Net payable', dataIndex: 'netAmount', key: 'netAmount', align: 'right', render: (v: number) => formatAmount(v) },
    { title: 'Paid', dataIndex: 'paidAmount', key: 'paidAmount', align: 'right', render: (v: number) => formatAmount(v) },
    { title: 'Balance', dataIndex: 'balance', key: 'balance', align: 'right', render: (v: number) => formatAmount(v) },
    { title: 'Due date', dataIndex: 'dueDate', key: 'dueDate', render: (v: string | null) => formatDate(v) },
    {
      title: 'Status',
      key: 'status',
      render: (_v, line) => (
        <Space size="small">
          <Tag color={INVOICE_STATUS_TAG_COLOR[line.status]} style={{ marginInlineEnd: 0 }}>
            {invoiceStatusLabel(line.status)}
          </Tag>
          {line.overdue && <Tag color="error">Overdue</Tag>}
        </Space>
      ),
    },
    {
      title: '',
      key: 'pay',
      align: 'right',
      render: (_v, line) => (
        <PayNowButton
          invoice={{ id: line.invoiceId, status: line.status, balance: line.balance }}
          description={line.feeStructureName ?? 'School fees'}
          onPaid={() => void statementQuery.refetch()}
        />
      ),
    },
  ];

  const paymentColumns: ColumnsType<Payment> = [
    { title: 'Receipt #', dataIndex: 'receiptNumber', key: 'receiptNumber' },
    { title: 'Amount', dataIndex: 'amount', key: 'amount', align: 'right', render: (v: number) => formatAmount(v) },
    { title: 'Method', dataIndex: 'method', key: 'method' },
    { title: 'Date', dataIndex: 'paidAt', key: 'paidAt', render: (v: string) => formatDate(v) },
    { title: '', key: 'receipt', render: (_v, payment) => <a onClick={() => setViewingReceipt(payment.id)}>View receipt</a> },
  ];

  return (
    <div style={{ maxWidth: 900, width: '100%', margin: '0 auto' }}>
      <Link to="/app/dashboard" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <ArrowLeftOutlined /> Back to dashboard
      </Link>

      <header
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: token.marginSM,
          margin: `${token.marginSM}px 0 ${token.marginLG}px`,
        }}
      >
        <div>
          <Title level={2} style={{ margin: 0 }}>
            {child ? `${child.fullName} — fees` : 'Fees'}
          </Title>
          <Text type="secondary">
            {child?.admissionNumber ? `Admission ${child.admissionNumber}` : 'Fee dues and payments'}
          </Text>
        </div>
        {!notYours && (
          <Button
            icon={<ReloadOutlined />}
            onClick={() => void statementQuery.refetch()}
            loading={statementQuery.isFetching && !statementQuery.isPending}
          >
            Refresh
          </Button>
        )}
      </header>

      {notYours ? (
        <Result
          status="404"
          title="Student not found"
          subTitle="This student isn't linked to your account."
          extra={
            <Link to="/app/dashboard">
              <Button type="primary">Back to dashboard</Button>
            </Link>
          }
        />
      ) : (
        <Card styles={{ body: { padding: token.paddingLG } }} style={{ boxShadow: token.boxShadowTertiary }}>
          {statementQuery.isError || childrenQuery.isError ? (
            <Alert
              type="warning"
              showIcon
              message="Couldn't load fees"
              description="There was a problem reaching the server."
              action={
                <Button size="small" onClick={() => void statementQuery.refetch()}>
                  Try again
                </Button>
              }
            />
          ) : childrenQuery.isPending || statementQuery.isPending ? (
            <Skeleton active paragraph={{ rows: 5 }} />
          ) : statement ? (
            <Space direction="vertical" size={token.marginLG} style={{ width: '100%' }}>
              <Space size="large" wrap>
                <Stat label="Total payable" value={statement.totalPayable} />
                <Stat label="Paid" value={statement.totalPaid} color={token.colorSuccess} />
                <Stat
                  label="Balance"
                  value={statement.totalBalance}
                  color={statement.totalBalance > 0 ? token.colorError : token.colorTextTertiary}
                />
              </Space>

              <Table<InvoiceStatementLine>
                rowKey="invoiceId"
                size="small"
                columns={columns}
                dataSource={statement.invoices}
                pagination={false}
                expandable={{
                  expandedRowRender: (line) => (
                    <Table<Payment>
                      rowKey="id"
                      size="small"
                      columns={paymentColumns}
                      dataSource={line.payments}
                      pagination={false}
                      locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No payments yet" /> }}
                    />
                  ),
                  rowExpandable: (line) => line.payments.length > 0,
                }}
                locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No fees assigned yet" /> }}
              />
            </Space>
          ) : null}
        </Card>
      )}

      <ReceiptView paymentId={viewingReceipt} onClose={() => setViewingReceipt(null)} fetcher={fetchChildReceipt} />
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color?: string }) {
  const { token } = theme.useToken();
  return (
    <div>
      <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
        {label}
      </Text>
      <div style={{ fontSize: token.fontSizeHeading3, fontWeight: token.fontWeightStrong, color }}>{formatAmount(value)}</div>
    </div>
  );
}

export default ChildInvoicesPage;
