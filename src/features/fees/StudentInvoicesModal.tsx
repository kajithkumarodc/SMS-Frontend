import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, Empty, Modal, Skeleton, Space, Table, Tag, Typography, theme } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { fetchStudentFeeStatement, type InvoiceStatementLine, type Payment } from '../../api/fees';
import type { Student } from '../../api/students';
import { INVOICE_STATUS_TAG_COLOR, invoiceStatusLabel } from './feeStatus';
import { formatAmount, formatDate } from './format';
import ReceiptView from './ReceiptView';

const { Text } = Typography;

type Props = {
  /** The student whose fee statement to show, or null when the modal is closed. */
  student: Student | null;
  onClose: () => void;
};

/** Student Profile / Students-list "Invoices" view: the full fee statement (plan Phase 5 part I). */
function StudentInvoicesModal({ student, onClose }: Props) {
  const { token } = theme.useToken();
  const open = student !== null;
  const [viewingReceipt, setViewingReceipt] = useState<string | null>(null);

  const statementQuery = useQuery({
    queryKey: ['student-fee-statement', student?.id],
    queryFn: () => fetchStudentFeeStatement(student!.id),
    enabled: open,
  });

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
  ];

  const paymentColumns: ColumnsType<Payment> = [
    { title: 'Receipt #', dataIndex: 'receiptNumber', key: 'receiptNumber' },
    { title: 'Amount', dataIndex: 'amount', key: 'amount', align: 'right', render: (v: number) => formatAmount(v) },
    { title: 'Method', dataIndex: 'method', key: 'method' },
    { title: 'Date', dataIndex: 'paidAt', key: 'paidAt', render: (v: string) => formatDate(v) },
    {
      title: '',
      key: 'receipt',
      render: (_v, payment) => (
        <a onClick={() => setViewingReceipt(payment.id)}>View receipt</a>
      ),
    },
  ];

  return (
    <Modal
      title={student ? `Fee statement — ${student.fullName}` : 'Fee statement'}
      open={open}
      onCancel={onClose}
      footer={null}
      width={820}
      destroyOnClose
    >
      {statementQuery.isError ? (
        <Alert type="warning" showIcon message="Couldn't load this student's fee statement" />
      ) : statementQuery.isPending ? (
        <Skeleton active paragraph={{ rows: 4 }} />
      ) : statement ? (
        <Space direction="vertical" size={token.marginLG} style={{ width: '100%' }}>
          <Space size="large" wrap>
            <Stat label="Total assigned" value={statement.totalAssigned} />
            <Stat label="Discount" value={statement.totalDiscount} />
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
            locale={{
              emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No fees assigned yet" />,
            }}
          />
          <Text type="secondary">Expand a row to see its payment history and view receipts.</Text>
        </Space>
      ) : null}

      <ReceiptView paymentId={viewingReceipt} onClose={() => setViewingReceipt(null)} />
    </Modal>
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

export default StudentInvoicesModal;
