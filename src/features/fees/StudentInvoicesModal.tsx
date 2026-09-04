import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, Empty, Modal, Skeleton, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { fetchFeeStructures, fetchStudentInvoices, type Invoice } from '../../api/fees';
import type { Student } from '../../api/students';
import { FEE_STRUCTURES_QUERY_KEY, STUDENT_INVOICES_QUERY_KEY } from './queryKeys';
import { INVOICE_STATUS_TAG_COLOR, invoiceStatusLabel } from './feeStatus';
import { formatAmount, formatDate } from './format';

const { Text } = Typography;

type Props = {
  /** The student whose invoices to show, or null when the modal is closed. */
  student: Student | null;
  onClose: () => void;
};

function StudentInvoicesModal({ student, onClose }: Props) {
  const open = student !== null;

  const invoicesQuery = useQuery({
    queryKey: [...STUDENT_INVOICES_QUERY_KEY, student?.id],
    queryFn: () => fetchStudentInvoices(student!.id),
    enabled: open,
  });

  // The invoice carries only the fee-structure id; resolve its name + due date.
  const feeStructuresQuery = useQuery({
    queryKey: FEE_STRUCTURES_QUERY_KEY,
    queryFn: fetchFeeStructures,
    enabled: open,
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
      width: 120,
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
      width: 160,
      render: (id: string) => formatDate(feeStructure(id)?.dueDate ?? null),
    },
  ];

  return (
    <Modal
      title={student ? `Invoices — ${student.fullName}` : 'Invoices'}
      open={open}
      onCancel={onClose}
      footer={null}
      width={720}
      destroyOnClose
    >
      {invoicesQuery.isError ? (
        <Alert type="warning" showIcon message="Couldn't load this student's invoices" />
      ) : invoicesQuery.isPending ? (
        <Skeleton active paragraph={{ rows: 3 }} />
      ) : (
        <Table<Invoice>
          rowKey="id"
          size="small"
          columns={columns}
          dataSource={invoicesQuery.data ?? []}
          pagination={false}
          scroll={{ x: 'max-content' }}
          locale={{
            emptyText: (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No invoices for this student yet" />
            ),
          }}
        />
      )}
    </Modal>
  );
}

export default StudentInvoicesModal;
