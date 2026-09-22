import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { App, DatePicker, Form, Input, Modal } from 'antd';
import dayjs from 'dayjs';
import { createAcademicYear, DuplicateNameError } from '../../api/academicYears';
import { ACADEMIC_YEARS_KEY } from './queryKeys';

const schema = z
  .object({
    name: z.string().trim().min(1, 'A name is required').max(20, 'Keep this under 20 characters'),
    startDate: z.string().min(1, 'Pick a start date'),
    endDate: z.string().min(1, 'Pick an end date'),
  })
  .refine((v) => !v.startDate || !v.endDate || v.endDate > v.startDate, {
    message: 'End date must be after the start date',
    path: ['endDate'],
  });

type FormValues = z.infer<typeof schema>;

const EMPTY: FormValues = { name: '', startDate: '', endDate: '' };

type Props = {
  open: boolean;
  onClose: () => void;
};

function AddAcademicYearModal({ open, onClose }: Props) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();

  const {
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: EMPTY, mode: 'onTouched' });

  useEffect(() => {
    if (open) reset(EMPTY);
  }, [open, reset]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      createAcademicYear({ name: values.name.trim(), startDate: values.startDate, endDate: values.endDate }),
    onSuccess: (year) => {
      message.success(`Academic year "${year.name}" created`);
      void queryClient.invalidateQueries({ queryKey: ACADEMIC_YEARS_KEY });
      onClose();
    },
    onError: (error) => {
      if (error instanceof DuplicateNameError) {
        setError('name', { type: 'server', message: error.message });
        return;
      }
      message.error('Could not create the academic year. Please try again.');
    },
  });

  const submit = handleSubmit((values) => mutation.mutate(values));

  return (
    <Modal
      title="Add academic year"
      open={open}
      onCancel={onClose}
      onOk={submit}
      okText="Create"
      confirmLoading={mutation.isPending}
      destroyOnClose
      maskClosable={!mutation.isPending}
    >
      <Form layout="vertical" requiredMark="optional" onFinish={submit}>
        <Controller
          control={control}
          name="name"
          render={({ field }) => (
            <Form.Item label="Name" required validateStatus={errors.name ? 'error' : undefined} help={errors.name?.message}>
              <Input {...field} placeholder="e.g. 2025-2026" autoComplete="off" />
            </Form.Item>
          )}
        />
        <Controller
          control={control}
          name="startDate"
          render={({ field }) => (
            <Form.Item
              label="Start date"
              required
              validateStatus={errors.startDate ? 'error' : undefined}
              help={errors.startDate?.message}
            >
              <DatePicker
                style={{ width: '100%' }}
                value={field.value ? dayjs(field.value) : null}
                onChange={(d) => field.onChange(d ? d.format('YYYY-MM-DD') : '')}
              />
            </Form.Item>
          )}
        />
        <Controller
          control={control}
          name="endDate"
          render={({ field }) => (
            <Form.Item
              label="End date"
              required
              validateStatus={errors.endDate ? 'error' : undefined}
              help={errors.endDate?.message}
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

export default AddAcademicYearModal;
