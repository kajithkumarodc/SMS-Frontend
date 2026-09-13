import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { App, DatePicker, Form, InputNumber, Modal } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { DuplicatePayrollRecordError, generatePayroll } from '../../api/payroll';
import type { StaffProfile } from '../../api/staff';
import { OWN_PAYROLL_KEY } from './queryKeys';

const schema = z.object({
  monthYear: z.string().min(1, 'Pick a month'), // "YYYY-MM"
  deductions: z
    .number({ invalid_type_error: 'Enter a deductions amount' })
    .min(0, 'Deductions cannot be negative'),
});

type FormValues = z.infer<typeof schema>;

const EMPTY: FormValues = { monthYear: '', deductions: 0 };

type Props = {
  /** The staff member to generate payroll for, or null when the modal is closed. */
  staff: StaffProfile | null;
  onClose: () => void;
};

function GeneratePayrollModal({ staff, onClose }: Props) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const open = staff !== null;

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
      if (!staff) return Promise.reject(new Error('No staff member'));
      const [year, month] = values.monthYear.split('-').map(Number);
      return generatePayroll({
        staffUserId: staff.userId,
        month,
        year,
        deductions: values.deductions,
      });
    },
    onSuccess: (record) => {
      message.success(
        `Payroll generated for ${staff?.fullName ?? 'this staff member'} — net pay ${record.netPay.toFixed(2)}`,
      );
      // Only visible to the staff member's own "My payroll" — nothing on this admin view depends on it,
      // but keep their cache fresh in case the same browser session is also logged in as them (dev/demo).
      void queryClient.invalidateQueries({ queryKey: OWN_PAYROLL_KEY });
      onClose();
    },
    onError: (error) => {
      message.error(
        error instanceof DuplicatePayrollRecordError
          ? error.message
          : 'Could not generate payroll. Please try again.',
      );
    },
  });

  const submit = handleSubmit((values) => mutation.mutate(values));

  return (
    <Modal
      title={staff ? `Generate payroll — ${staff.fullName}` : 'Generate payroll'}
      open={open}
      onCancel={onClose}
      onOk={submit}
      okText="Generate payroll"
      confirmLoading={mutation.isPending}
      destroyOnClose
      maskClosable={!mutation.isPending}
    >
      <Form layout="vertical" requiredMark="optional" onFinish={submit}>
        <Controller
          control={control}
          name="monthYear"
          render={({ field }) => (
            <Form.Item
              label="Month"
              required
              validateStatus={errors.monthYear ? 'error' : undefined}
              help={errors.monthYear?.message}
            >
              <DatePicker
                picker="month"
                style={{ width: '100%' }}
                value={field.value ? dayjs(`${field.value}-01`) : null}
                onChange={(d: Dayjs | null) => field.onChange(d ? d.format('YYYY-MM') : '')}
              />
            </Form.Item>
          )}
        />

        <Controller
          control={control}
          name="deductions"
          render={({ field }) => (
            <Form.Item
              label="Deductions"
              required
              validateStatus={errors.deductions ? 'error' : undefined}
              help={errors.deductions?.message ?? 'Statutory/other deductions for this month'}
            >
              <InputNumber
                style={{ width: '100%' }}
                min={0}
                step={100}
                precision={2}
                value={field.value}
                onChange={(v) => field.onChange(v ?? 0)}
              />
            </Form.Item>
          )}
        />
      </Form>
    </Modal>
  );
}

export default GeneratePayrollModal;
