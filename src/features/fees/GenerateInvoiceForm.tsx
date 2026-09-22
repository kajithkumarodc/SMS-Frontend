import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App, Alert, Button, Empty, Form, Select, Space, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { fetchStudents } from '../../api/students';
import { bulkAssignFee, type BulkAssignResponse, type FeeStructure } from '../../api/fees';
import { STUDENTS_QUERY_KEY } from '../students/queryKeys';
import { formatAmount } from './format';

// The students endpoint is paginated; a single generous page is plenty for a
// picker at this scale (a dedicated search endpoint can replace this later).
const STUDENT_PICKER_PAGE_SIZE = 500;

const schema = z.object({
  studentIds: z.array(z.string()).min(1, 'Select at least one student'),
  feeStructureId: z.string().min(1, 'Select a fee structure'),
});

type FormValues = z.infer<typeof schema>;

type Props = {
  feeStructures: FeeStructure[];
  feeStructuresLoading: boolean;
};

/**
 * Assigns a fee structure to one or many students at once (plan Phase 5 part C:
 * "support bulk assignment"). A single student is simply a one-element bulk
 * request -- same endpoint, same per-student result reporting either way.
 */
function GenerateInvoiceForm({ feeStructures, feeStructuresLoading }: Props) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [result, setResult] = useState<BulkAssignResponse | null>(null);

  const studentsQuery = useQuery({
    queryKey: [...STUDENTS_QUERY_KEY, { picker: true }],
    queryFn: () => fetchStudents({ page: 0, size: STUDENT_PICKER_PAGE_SIZE }),
    staleTime: 60 * 1000,
  });

  const studentName = useMemo(() => {
    const map = new Map((studentsQuery.data?.content ?? []).map((s) => [s.id, `${s.fullName} (${s.admissionNumber})`]));
    return (id: string) => map.get(id) ?? id;
  }, [studentsQuery.data]);

  const studentOptions = useMemo(
    () => (studentsQuery.data?.content ?? []).map((s) => ({ value: s.id, label: `${s.fullName} (${s.admissionNumber})` })),
    [studentsQuery.data],
  );

  const feeStructureOptions = useMemo(
    () => feeStructures.map((fs) => ({ value: fs.id, label: `${fs.name} — ${formatAmount(fs.amount)}` })),
    [feeStructures],
  );

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { studentIds: [], feeStructureId: '' },
    mode: 'onTouched',
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) => bulkAssignFee(values.feeStructureId, values.studentIds),
    onSuccess: (outcome) => {
      setResult(outcome);
      if (outcome.assignedCount > 0) {
        message.success(`Assigned the fee to ${outcome.assignedCount} of ${outcome.requestedCount} student(s)`);
      } else {
        message.warning('No students were assigned — see the results below.');
      }
      void queryClient.invalidateQueries({ queryKey: ['student-invoices'] });
      void queryClient.invalidateQueries({ queryKey: ['student-fee-statement'] });
    },
    onError: () => {
      message.error('Could not assign the fee. Please try again.');
    },
    onSettled: (_data, _error, variables) => {
      reset({ studentIds: [], feeStructureId: variables.feeStructureId });
    },
  });

  const submit = handleSubmit((values) => mutation.mutate(values));

  const resultColumns: ColumnsType<BulkAssignResponse['results'][number]> = [
    { title: 'Student', dataIndex: 'studentId', key: 'studentId', render: (id: string) => studentName(id) },
    {
      title: 'Outcome',
      dataIndex: 'assigned',
      key: 'assigned',
      width: 120,
      render: (assigned: boolean) => <Tag color={assigned ? 'success' : 'default'}>{assigned ? 'Assigned' : 'Skipped'}</Tag>,
    },
    { title: 'Reason', dataIndex: 'reason', key: 'reason', render: (v) => v ?? '—' },
  ];

  if (!feeStructuresLoading && feeStructures.length === 0) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description="Add a fee structure first, then you can assign it to students."
      />
    );
  }

  return (
    <Space direction="vertical" style={{ width: '100%' }}>
      <Form layout="vertical" requiredMark="optional" onFinish={submit} style={{ maxWidth: 520 }}>
        <Controller
          control={control}
          name="feeStructureId"
          render={({ field }) => (
            <Form.Item
              label="Fee structure"
              required
              validateStatus={errors.feeStructureId ? 'error' : undefined}
              help={errors.feeStructureId?.message}
            >
              <Select
                {...field}
                data-testid="invoice-fee-structure-select"
                placeholder="Select a fee structure"
                loading={feeStructuresLoading}
                options={feeStructureOptions}
                showSearch
                optionFilterProp="label"
              />
            </Form.Item>
          )}
        />

        <Controller
          control={control}
          name="studentIds"
          render={({ field }) => (
            <Form.Item
              label="Students"
              required
              validateStatus={errors.studentIds ? 'error' : undefined}
              help={errors.studentIds?.message}
            >
              <Select
                {...field}
                mode="multiple"
                data-testid="invoice-student-select"
                placeholder="Search by name or admission number — select one or many"
                loading={studentsQuery.isLoading}
                options={studentOptions}
                showSearch
                optionFilterProp="label"
                maxTagCount="responsive"
              />
            </Form.Item>
          )}
        />

        <Space>
          <Button type="primary" htmlType="submit" loading={mutation.isPending}>
            Assign fee
          </Button>
        </Space>
      </Form>

      {result && (
        <>
          <Alert
            type={result.assignedCount > 0 ? 'success' : 'warning'}
            showIcon
            message={`${result.assignedCount} of ${result.requestedCount} student(s) assigned`}
          />
          <Table
            rowKey="studentId"
            size="small"
            dataSource={result.results}
            columns={resultColumns}
            pagination={false}
          />
        </>
      )}
    </Space>
  );
}

export default GenerateInvoiceForm;
