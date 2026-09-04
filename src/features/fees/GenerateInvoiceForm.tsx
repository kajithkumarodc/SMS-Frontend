import { useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App, Button, Empty, Form, Select, Space } from 'antd';
import { fetchStudents } from '../../api/students';
import { createInvoice, type FeeStructure } from '../../api/fees';
import { STUDENTS_QUERY_KEY } from '../students/queryKeys';
import { STUDENT_INVOICES_QUERY_KEY } from './queryKeys';
import { formatAmount } from './format';

// The students endpoint is paginated; a single generous page is plenty for a
// picker at this scale (a dedicated search endpoint can replace this later).
const STUDENT_PICKER_PAGE_SIZE = 500;

const schema = z.object({
  studentId: z.string().min(1, 'Select a student'),
  feeStructureId: z.string().min(1, 'Select a fee structure'),
});

type FormValues = z.infer<typeof schema>;

type Props = {
  feeStructures: FeeStructure[];
  feeStructuresLoading: boolean;
};

function GenerateInvoiceForm({ feeStructures, feeStructuresLoading }: Props) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();

  const studentsQuery = useQuery({
    queryKey: [...STUDENTS_QUERY_KEY, { picker: true }],
    queryFn: () => fetchStudents({ page: 0, size: STUDENT_PICKER_PAGE_SIZE }),
    staleTime: 60 * 1000,
  });

  const studentOptions = useMemo(
    () =>
      (studentsQuery.data?.content ?? []).map((s) => ({
        value: s.id,
        label: `${s.fullName} (${s.admissionNumber})`,
      })),
    [studentsQuery.data],
  );

  const feeStructureOptions = useMemo(
    () =>
      feeStructures.map((fs) => ({
        value: fs.id,
        label: `${fs.name} — ${formatAmount(fs.amount)}`,
      })),
    [feeStructures],
  );

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { studentId: '', feeStructureId: '' },
    mode: 'onTouched',
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) => createInvoice(values),
    onSuccess: (invoice) => {
      message.success('Invoice generated — it starts as PENDING');
      void queryClient.invalidateQueries({
        queryKey: [...STUDENT_INVOICES_QUERY_KEY, invoice.studentId],
      });
      reset({ studentId: '', feeStructureId: '' });
    },
    onError: () => {
      message.error('Could not generate the invoice. Please try again.');
    },
  });

  const submit = handleSubmit((values) => mutation.mutate(values));

  if (!feeStructuresLoading && feeStructures.length === 0) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description="Add a fee structure first, then you can generate invoices against it."
      />
    );
  }

  return (
    <Form layout="vertical" requiredMark="optional" onFinish={submit} style={{ maxWidth: 460 }}>
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
              placeholder="Search by name or admission number"
              loading={studentsQuery.isLoading}
              options={studentOptions}
              showSearch
              optionFilterProp="label"
            />
          </Form.Item>
        )}
      />

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
              placeholder="Select a fee structure"
              loading={feeStructuresLoading}
              options={feeStructureOptions}
              showSearch
              optionFilterProp="label"
            />
          </Form.Item>
        )}
      />

      <Space>
        <Button type="primary" htmlType="submit" loading={mutation.isPending}>
          Generate invoice
        </Button>
      </Space>
    </Form>
  );
}

export default GenerateInvoiceForm;
