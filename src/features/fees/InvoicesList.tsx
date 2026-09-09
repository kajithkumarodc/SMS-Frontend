import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Empty, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { fetchFeeStructures, type Invoice } from '../../api/fees';
import { FEE_STRUCTURES_QUERY_KEY } from './queryKeys';
import { INVOICE_STATUS_TAG_COLOR, invoiceStatusLabel } from './feeStatus';
import { formatAmount, formatDate } from './format';
import PayNowButton from './PayNowButton';

const { Text } = Typography;

type Props = {
  invoices: Invoice[];
  /** Called after a "Pay now" completes so the caller can refetch the list. */
  onInvoicePaid: () => void;
};

/**
 * Invoice table shared by the admin's per-student modal and the parent's
 * per-child portal view: fee structure, amount, status tag, due date, and a
 * "Pay now" action on anything still PENDING.
 */
function InvoicesList({ invoices, onInvoicePaid }: Props) {
  // The invoice carries only the fee-structure id; resolve its name + due date.
  const feeStructuresQuery = useQuery({
    queryKey: FEE_STRUCTURES_QUERY_KEY,
    queryFn: fetchFeeStructures,
    staleTime: 60 * 1000,
  });

  const feeStructure = useMemo(() => {
    const map = new Map((feeStructuresQuery.data ?? []).map((fs) => [fs.id, fs]));
    return (id: string) => map.get(id);
  }, [feeStructuresQuery.data]);

  const columns: ColumnsType<Invoice> = [
    {
      title: 'Fee structure',
      dataIndex: 'feeStructureId',
      key: 'feeStructure',
      render: (id: string) => feeStructure(id)?.name ?? <Text type="secondary">—</Text>,
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
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (status: Invoice['status']) => (
        <Tag color={INVOICE_STATUS_TAG_COLOR[status]} style={{ marginInlineEnd: 0 }}>
          {invoiceStatusLabel(status)}
        </Tag>
      ),
    },
    {
      title: 'Due date',
      dataIndex: 'feeStructureId',
      key: 'dueDate',
      width: 150,
      render: (id: string) => formatDate(feeStructure(id)?.dueDate ?? null),
    },
    {
      title: '',
      key: 'pay',
      width: 110,
      align: 'right',
      render: (_value, invoice) => (
        <PayNowButton
          invoice={invoice}
          description={feeStructure(invoice.feeStructureId)?.name ?? 'School fees'}
          onPaid={onInvoicePaid}
        />
      ),
    },
  ];

  return (
    <Table<Invoice>
      rowKey="id"
      size="small"
      columns={columns}
      dataSource={invoices}
      pagination={false}
      scroll={{ x: 'max-content' }}
      locale={{
        emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No invoices yet" />,
      }}
    />
  );
}

export default InvoicesList;
