import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, DatePicker, Form, Input, InputNumber, Modal, Select } from 'antd';
import dayjs from 'dayjs';
import { fetchSchools } from '../../api/students';
import { createFeeStructure, type CreateFeeStructureInput } from '../../api/fees';
import { FEE_STRUCTURES_QUERY_KEY } from './queryKeys';

const schema = z.object({
  schoolId: z.string().min(1, 'Select a school'),
  name: z.string().trim().min(1, 'A name is required').max(150, 'Keep this under 150 characters'),
  amount: z
    .number({ invalid_type_error: 'Enter an amount' })
    .positive('Amount must be greater than 0'),
  dueDate: z.string().min(1, 'Pick a due date'),
});

type FormValues = z.infer<typeof schema>;

const EMPTY: FormValues = { schoolId: '', name: '', amount: 0, dueDate: '' };

type Props = {
  open: boolean;
  onClose: () => void;
};

function AddFeeStructureModal({ open, onClose }: Props) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();

  const schoolsQuery = useQuery({
    queryKey: ['schools'],
    queryFn: fetchSchools,
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });
  const schoolOptions = (schoolsQuery.data ?? []).map((school) => ({
    value: school.id,
    label: school.name,
  }));
  const noSchools = schoolsQuery.isSuccess && schoolOptions.length === 0;

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: EMPTY,
    mode: 'onTouched',
  });

  useEffect(() => {
    if (open) reset(EMPTY);
  }, [open, reset]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const payload: CreateFeeStructureInput = {
        schoolId: values.schoolId,
        name: values.name.trim(),
        amount: values.amount,
        dueDate: values.dueDate,
      };
      return createFeeStructure(payload);
    },
    onSuccess: (created) => {
      message.success(`Fee structure "${created.name}" added`);
      void queryClient.invalidateQueries({ queryKey: FEE_STRUCTURES_QUERY_KEY });
      onClose();
    },
    onError: () => {
      message.error('Could not add the fee structure. Please try again.');
    },
  });

  const submit = handleSubmit((values) => mutation.mutate(values));

  return (
    <Modal
      title="Add fee structure"
      open={open}
      onCancel={onClose}
      onOk={submit}
      okText="Add fee structure"
      confirmLoading={mutation.isPending}
      okButtonProps={{ disabled: schoolsQuery.isLoading || noSchools }}
      destroyOnClose
      maskClosable={!mutation.isPending}
    >
      {noSchools && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="No schools found for your account"
          description="A fee structure belongs to a school. Ask an administrator to set one up first."
        />
      )}

      <Form layout="vertical" requiredMark="optional" onFinish={submit}>
        <Controller
          control={control}
          name="schoolId"
          render={({ field }) => (
            <Form.Item
              label="School"
              required
              validateStatus={errors.schoolId ? 'error' : undefined}
              help={errors.schoolId?.message}
            >
              <Select
                {...field}
                placeholder="Select a school"
                loading={schoolsQuery.isLoading}
                options={schoolOptions}
                showSearch
                optionFilterProp="label"
              />
            </Form.Item>
          )}
        />

        <Controller
          control={control}
          name="name"
          render={({ field }) => (
            <Form.Item
              label="Name"
              required
              validateStatus={errors.name ? 'error' : undefined}
              help={errors.name?.message}
            >
              <Input {...field} placeholder="e.g. Term 1 Tuition" autoComplete="off" />
            </Form.Item>
          )}
        />

        <Controller
          control={control}
          name="amount"
          render={({ field }) => (
            <Form.Item
              label="Amount"
              required
              validateStatus={errors.amount ? 'error' : undefined}
              help={errors.amount?.message}
            >
              <InputNumber
                style={{ width: '100%' }}
                min={0}
                step={100}
                precision={2}
                value={field.value || undefined}
                onChange={(v) => field.onChange(v ?? undefined)}
              />
            </Form.Item>
          )}
        />

        <Controller
          control={control}
          name="dueDate"
          render={({ field }) => (
            <Form.Item
              label="Due date"
              required
              validateStatus={errors.dueDate ? 'error' : undefined}
              help={errors.dueDate?.message}
            >
              <DatePicker
                style={{ width: '100%' }}
                value={field.value ? dayjs(field.value) : null}
                onChange={(d) => field.onChange(d ? d.format('YYYY-MM-DD') : '')}
              />
            </Form.Item>
          )}
        />
      </Form>
    </Modal>
  );
}

export default AddFeeStructureModal;
