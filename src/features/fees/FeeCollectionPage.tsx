import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  App,
  Button,
  Card,
  Empty,
  Popconfirm,
  Result,
  Select,
  Skeleton,
  Space,
  Table,
  Tag,
  Typography,
  theme,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ReloadOutlined, SwapOutlined } from '@ant-design/icons';
import { fetchStudents } from '../../api/students';
import {
  applyDiscountToInvoice,
  applyLateFee,
  fetchFeeDiscounts,
  fetchStudentFeeStatement,
  reversePayment,
  type Invoice,
  type InvoiceStatementLine,
  type Payment,
} from '../../api/fees';
import { useAuthStore } from '../../store/authStore';
import { hasPermission } from '../../lib/roles';
import { INVOICE_STATUS_TAG_COLOR, invoiceStatusLabel } from './feeStatus';
import { formatAmount, formatDate } from './format';
import CollectPaymentModal from './CollectPaymentModal';
import ReceiptView from './ReceiptView';

const STUDENT_PICKER_PAGE_SIZE = 500;

function FeeCollectionPage() {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const permissions = useAuthStore((state) => state.user?.permissions);
  const canCollect = hasPermission(permissions, 'FEE_COLLECT');
  const canDiscount = hasPermission(permissions, 'FEE_DISCOUNT');
  const canRefund = hasPermission(permissions, 'FEE_REFUND');

  const [studentId, setStudentId] = useState<string | undefined>();
  const [collectingInvoice, setCollectingInvoice] = useState<Invoice | null>(null);
  const [viewingReceipt, setViewingReceipt] = useState<string | null>(null);

  const studentsQuery = useQuery({
    queryKey: ['students', { picker: true }],
    queryFn: () => fetchStudents({ page: 0, size: STUDENT_PICKER_PAGE_SIZE }),
    staleTime: 60 * 1000,
  });
  const studentOptions = useMemo(
    () => (studentsQuery.data?.content ?? []).map((s) => ({ value: s.id, label: `${s.fullName} (${s.admissionNumber})` })),
    [studentsQuery.data],
  );

  const statementQuery = useQuery({
    queryKey: ['student-fee-statement', studentId],
    queryFn: () => fetchStudentFeeStatement(studentId as string),
    enabled: Boolean(studentId),
  });

  const discountsQuery = useQuery({ queryKey: ['fee-discounts'], queryFn: fetchFeeDiscounts, enabled: canDiscount });

  const applyDiscountMutation = useMutation({
    mutationFn: ({ invoiceId, discountId }: { invoiceId: string; discountId: string }) =>
      applyDiscountToInvoice(invoiceId, discountId),
    onSuccess: () => {
      message.success('Discount applied');
      void queryClient.invalidateQueries({ queryKey: ['student-fee-statement', studentId] });
    },
    onError: (error: unknown) => {
      const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      message.error(detail ?? 'Could not apply the discount.');
    },
  });

  const lateFeeMutation = useMutation({
    mutationFn: (invoiceId: string) => applyLateFee(invoiceId),
    onSuccess: () => {
      message.success('Late fee applied');
      void queryClient.invalidateQueries({ queryKey: ['student-fee-statement', studentId] });
    },
    onError: (error: unknown) => {
      const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      message.error(detail ?? 'Could not apply the late fee.');
    },
  });

  const reverseMutation = useMutation({
    mutationFn: ({ paymentId, reason }: { paymentId: string; reason: string }) => reversePayment(paymentId, reason),
    onSuccess: () => {
      message.success('Payment reversed');
      void queryClient.invalidateQueries({ queryKey: ['student-fee-statement', studentId] });
    },
    onError: (error: unknown) => {
      const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      message.error(detail ?? 'Could not reverse this payment.');
    },
  });

  if (!canCollect) {
    return <Result status="403" title="Not available" subTitle="You don't have permission to collect fees." />;
  }

  const statement = statementQuery.data;

  return (
    <div style={{ maxWidth: 1040, width: '100%', margin: '0 auto' }}>
      <Typography.Title level={2} style={{ marginTop: 0 }}>
        Fee Collection
      </Typography.Title>
      <Typography.Text type="secondary">Search a student to view their fee statement and collect payments.</Typography.Text>

      <Card style={{ margin: `${token.marginLG}px 0`, boxShadow: token.boxShadowTertiary }}>
        <Select
          style={{ width: '100%', maxWidth: 480 }}
          placeholder="Search by name or admission number"
          loading={studentsQuery.isLoading}
          options={studentOptions}
          showSearch
          optionFilterProp="label"
          value={studentId}
          onChange={setStudentId}
        />
      </Card>

      {studentId && (
        <Space direction="vertical" size={token.marginLG} style={{ width: '100%' }}>
          {statementQuery.isError ? (
            <Alert type="warning" showIcon message="Couldn't load this student's fee statement" />
          ) : statementQuery.isPending ? (
            <Skeleton active paragraph={{ rows: 4 }} />
          ) : statement ? (
            <>
              <Card style={{ boxShadow: token.boxShadowTertiary }}>
                <Space size="large" wrap>
                  <Stat label="Total assigned" value={statement.totalAssigned} />
                  <Stat label="Discount" value={statement.totalDiscount} />
                  <Stat label="Total payable" value={statement.totalPayable} />
                  <Stat label="Paid" value={statement.totalPaid} color={token.colorSuccess} />
                  <Stat label="Balance" value={statement.totalBalance} color={statement.totalBalance > 0 ? token.colorError : token.colorTextTertiary} />
                </Space>
              </Card>

              {statement.invoices.length === 0 ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No fees assigned to this student yet" />
              ) : (
                statement.invoices.map((line) => (
                  <InvoiceCard
                    key={line.invoiceId}
                    line={line}
                    canDiscount={canDiscount}
                    canRefund={canRefund}
                    discounts={discountsQuery.data ?? []}
                    onCollect={() =>
                      setCollectingInvoice({
                        id: line.invoiceId,
                        studentId: studentId!,
                        feeStructureId: '',
                        amount: line.amount,
                        discountAmount: line.discountAmount,
                        netAmount: line.netAmount,
                        lateFeeAmount: 0,
                        lateFeeApplied: false,
                        paidAmount: line.paidAmount,
                        balance: line.balance,
                        status: line.status,
                        razorpayOrderId: null,
                        razorpayPaymentId: null,
                        createdAt: '',
                        paidAt: null,
                      })
                    }
                    onApplyDiscount={(discountId) => applyDiscountMutation.mutate({ invoiceId: line.invoiceId, discountId })}
                    onApplyLateFee={() => lateFeeMutation.mutate(line.invoiceId)}
                    onReverse={(paymentId, reason) => reverseMutation.mutate({ paymentId, reason })}
                    onViewReceipt={setViewingReceipt}
                  />
                ))
              )}

              <Button icon={<ReloadOutlined />} onClick={() => void statementQuery.refetch()}>
                Refresh
              </Button>
            </>
          ) : null}
        </Space>
      )}

      <CollectPaymentModal
        invoice={collectingInvoice}
        onClose={() => setCollectingInvoice(null)}
        onCollected={(payment) => {
          setCollectingInvoice(null);
          setViewingReceipt(payment.id);
        }}
      />
      <ReceiptView paymentId={viewingReceipt} onClose={() => setViewingReceipt(null)} />
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color?: string }) {
  const { token } = theme.useToken();
  return (
    <div>
      <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
        {label}
      </Typography.Text>
      <div style={{ fontSize: token.fontSizeHeading3, fontWeight: token.fontWeightStrong, color }}>{formatAmount(value)}</div>
    </div>
  );
}

function InvoiceCard({
  line,
  canDiscount,
  canRefund,
  discounts,
  onCollect,
  onApplyDiscount,
  onApplyLateFee,
  onReverse,
  onViewReceipt,
}: {
  line: InvoiceStatementLine;
  canDiscount: boolean;
  canRefund: boolean;
  discounts: { id: string; name: string }[];
  onCollect: () => void;
  onApplyDiscount: (discountId: string) => void;
  onApplyLateFee: () => void;
  onReverse: (paymentId: string, reason: string) => void;
  onViewReceipt: (paymentId: string) => void;
}) {
  const { token } = theme.useToken();
  const [discountId, setDiscountId] = useState<string | undefined>();

  const paymentColumns: ColumnsType<Payment> = [
    { title: 'Receipt #', dataIndex: 'receiptNumber', key: 'receiptNumber' },
    { title: 'Type', dataIndex: 'type', key: 'type', width: 100, render: (t: string) => <Tag color={t === 'REVERSAL' ? 'error' : 'success'}>{t}</Tag> },
    { title: 'Amount', dataIndex: 'amount', key: 'amount', align: 'right', render: (v: number) => formatAmount(v) },
    { title: 'Method', dataIndex: 'method', key: 'method' },
    { title: 'Date', dataIndex: 'paidAt', key: 'paidAt', render: (v: string) => formatDate(v) },
    {
      title: '',
      key: 'actions',
      render: (_v, payment) => (
        <Space size="small">
          <Button size="small" type="link" onClick={() => onViewReceipt(payment.id)}>
            Receipt
          </Button>
          {canRefund && payment.type === 'PAYMENT' && (
            <Popconfirm
              title="Reverse this payment?"
              description="This creates an offsetting ledger entry — nothing is deleted."
              onConfirm={() => onReverse(payment.id, 'Reversed by staff')}
            >
              <Button size="small" type="link" danger>
                Reverse
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <Card
      style={{ boxShadow: token.boxShadowTertiary }}
      title={
        <Space>
          <span>{line.feeStructureName ?? 'Fee'}</span>
          <Tag color={INVOICE_STATUS_TAG_COLOR[line.status]}>{invoiceStatusLabel(line.status)}</Tag>
          {line.overdue && <Tag color="error">Overdue</Tag>}
        </Space>
      }
      extra={
        <Space>
          {canDiscount && line.paidAmount === 0 && (
            <Select
              size="small"
              style={{ width: 160 }}
              placeholder="Apply discount"
              options={discounts.map((d) => ({ value: d.id, label: d.name }))}
              value={discountId}
              onChange={(v) => {
                setDiscountId(v);
                onApplyDiscount(v);
              }}
            />
          )}
          {line.overdue && (
            <Button size="small" onClick={onApplyLateFee}>
              Apply late fee
            </Button>
          )}
          {line.balance > 0 && (
            <Button size="small" type="primary" icon={<SwapOutlined />} onClick={onCollect}>
              Collect payment
            </Button>
          )}
        </Space>
      }
    >
      <Space size="large" wrap style={{ marginBottom: token.marginMD }}>
        <span>Due {formatDate(line.dueDate)}</span>
        <span>Amount {formatAmount(line.amount)}</span>
        {line.discountAmount > 0 && <span>Discount {formatAmount(line.discountAmount)}</span>}
        <span>Net {formatAmount(line.netAmount)}</span>
        <span>Paid {formatAmount(line.paidAmount)}</span>
        <span style={{ fontWeight: 600 }}>Balance {formatAmount(line.balance)}</span>
      </Space>

      <Table<Payment>
        rowKey="id"
        size="small"
        columns={paymentColumns}
        dataSource={line.payments}
        pagination={false}
        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No payments yet" /> }}
      />
    </Card>
  );
}

export default FeeCollectionPage;
