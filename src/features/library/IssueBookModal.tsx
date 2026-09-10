import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Form, Modal, Select, Typography } from 'antd';
import { fetchStudents } from '../../api/students';
import { issueBook, NoCopiesAvailableError, type LibraryBook } from '../../api/library';
import { STUDENTS_QUERY_KEY } from '../students/queryKeys';
import { LIBRARY_ACTIVE_LOANS_KEY, LIBRARY_BOOKS_KEY, STUDENT_LOANS_KEY } from './queryKeys';
import { formatDate } from './format';

const { Text } = Typography;

// The students endpoint is paginated; a single generous page is plenty for a
// picker at this scale (mirrors the fees invoice form).
const STUDENT_PICKER_PAGE_SIZE = 500;

const schema = z.object({ studentId: z.string().min(1, 'Select a student') });
type FormValues = z.infer<typeof schema>;

type Props = {
  /** The book to issue, or null when the modal is closed. */
  book: LibraryBook | null;
  onClose: () => void;
};

function IssueBookModal({ book, onClose }: Props) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const open = book !== null;

  const [issued, setIssued] = useState<{ studentName: string; dueDate: string } | null>(null);

  const studentsQuery = useQuery({
    queryKey: [...STUDENTS_QUERY_KEY, { picker: true }],
    queryFn: () => fetchStudents({ page: 0, size: STUDENT_PICKER_PAGE_SIZE }),
    staleTime: 60 * 1000,
    enabled: open,
  });

  const studentOptions = useMemo(
    () =>
      (studentsQuery.data?.content ?? []).map((s) => ({
        value: s.id,
        label: `${s.fullName} (${s.admissionNumber})`,
      })),
    [studentsQuery.data],
  );

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { studentId: '' },
    mode: 'onTouched',
  });

  useEffect(() => {
    if (open) {
      reset({ studentId: '' });
      setIssued(null);
    }
  }, [open, reset]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => issueBook({ bookId: book!.id, studentId: values.studentId }),
    onSuccess: (loan, values) => {
      const studentName =
        studentOptions.find((o) => o.value === values.studentId)?.label ?? 'the student';
      setIssued({ studentName, dueDate: loan.dueDate });
      void queryClient.invalidateQueries({ queryKey: LIBRARY_BOOKS_KEY });
      void queryClient.invalidateQueries({ queryKey: LIBRARY_ACTIVE_LOANS_KEY });
      void queryClient.invalidateQueries({ queryKey: [...STUDENT_LOANS_KEY, values.studentId] });
    },
    onError: (error) => {
      message.error(
        error instanceof NoCopiesAvailableError
          ? 'No copies of this book are available right now.'
          : 'Could not issue the book. Please try again.',
      );
    },
  });

  const submit = handleSubmit((values) => mutation.mutate(values));
  const noCopies = book ? book.availableCopies <= 0 : false;

  return (
    <Modal
      title={book ? `Issue "${book.title}"` : 'Issue book'}
      open={open}
      onCancel={onClose}
      onOk={issued ? onClose : submit}
      okText={issued ? 'Done' : 'Issue book'}
      okButtonProps={{ disabled: !issued && noCopies }}
      cancelButtonProps={{ style: issued ? { display: 'none' } : undefined }}
      confirmLoading={mutation.isPending}
      destroyOnClose
      maskClosable={!mutation.isPending}
    >
      {issued ? (
        <Alert
          type="success"
          showIcon
          message="Book issued"
          description={
            <>
              Issued to <Text strong>{issued.studentName}</Text>. Due back on{' '}
              <Text strong>{formatDate(issued.dueDate)}</Text>.
            </>
          }
        />
      ) : (
        <>
          {noCopies && (
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
              message="No copies available"
              description="Every copy of this book is currently on loan."
            />
          )}
          <Form layout="vertical" requiredMark="optional" onFinish={submit}>
            <Controller
              control={control}
              name="studentId"
              render={({ field }) => (
                <Form.Item
                  label="Student"
                  required
                  validateStatus={errors.studentId ? 'error' : undefined}
                  help={errors.studentId?.message}
                >
                  <Select
                    {...field}
                    data-testid="issue-student-select"
                    placeholder="Search by name or admission number"
                    loading={studentsQuery.isLoading}
                    options={studentOptions}
                    showSearch
                    optionFilterProp="label"
                    disabled={noCopies}
                  />
                </Form.Item>
              )}
            />
          </Form>
        </>
      )}
    </Modal>
  );
}

export default IssueBookModal;
