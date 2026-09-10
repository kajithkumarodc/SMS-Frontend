import { useQuery } from '@tanstack/react-query';
import { Alert, Modal, Skeleton } from 'antd';
import { fetchStudentLoans } from '../../api/library';
import type { Student } from '../../api/students';
import { STUDENT_LOANS_KEY } from './queryKeys';
import LoanHistoryList from './LoanHistoryList';

type Props = {
  /** The student whose loan history to show, or null when the modal is closed. */
  student: Student | null;
  onClose: () => void;
};

function StudentLibraryModal({ student, onClose }: Props) {
  const open = student !== null;

  const loansQuery = useQuery({
    queryKey: [...STUDENT_LOANS_KEY, student?.id],
    queryFn: () => fetchStudentLoans(student!.id),
    enabled: open,
  });

  return (
    <Modal
      title={student ? `Library — ${student.fullName}` : 'Library'}
      open={open}
      onCancel={onClose}
      footer={null}
      width={640}
      destroyOnClose
    >
      {loansQuery.isError ? (
        <Alert type="warning" showIcon message="Couldn't load this student's borrowing history" />
      ) : loansQuery.isPending ? (
        <Skeleton active paragraph={{ rows: 3 }} />
      ) : (
        <LoanHistoryList loans={loansQuery.data ?? []} emptyText="This student hasn't borrowed anything yet" />
      )}
    </Modal>
  );
}

export default StudentLibraryModal;
