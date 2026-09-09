import { useQuery } from '@tanstack/react-query';
import { Alert, Modal, Skeleton } from 'antd';
import { fetchStudentInvoices } from '../../api/fees';
import type { Student } from '../../api/students';
import { STUDENT_INVOICES_QUERY_KEY } from './queryKeys';
import InvoicesList from './InvoicesList';

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

  return (
    <Modal
      title={student ? `Invoices — ${student.fullName}` : 'Invoices'}
      open={open}
      onCancel={onClose}
      footer={null}
      width={760}
      destroyOnClose
    >
      {invoicesQuery.isError ? (
        <Alert type="warning" showIcon message="Couldn't load this student's invoices" />
      ) : invoicesQuery.isPending ? (
        <Skeleton active paragraph={{ rows: 3 }} />
      ) : (
        <InvoicesList
          invoices={invoicesQuery.data ?? []}
          onInvoicePaid={() => void invoicesQuery.refetch()}
        />
      )}
    </Modal>
  );
}

export default StudentInvoicesModal;
