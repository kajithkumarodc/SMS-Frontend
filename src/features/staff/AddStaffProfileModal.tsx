import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, DatePicker, Form, Input, InputNumber, Modal, Select } from 'antd';
import dayjs from 'dayjs';
import {
  createStaffProfile,
  DuplicateStaffProfileError,
  fetchEligibleUsers,
} from '../../api/staff';
import { ELIGIBLE_USERS_KEY, STAFF_PROFILES_KEY } from './queryKeys';

const schema = z.object({
  userId: z.string().min(1, 'Select a user'),
  employeeCode: z.string().trim().min(1, 'An employee code is required').max(50, 'Keep this under 50 characters'),
  department: z.string().trim().max(200, 'Keep this under 200 characters').optional(),
  designation: z.string().trim().max(200, 'Keep this under 200 characters').optional(),
  dateOfJoining: z.string().min(1, 'Pick a date of joining'),
  salaryAmount: z
    .number({ invalid_type_error: 'Enter a salary amount' })
    .min(0, 'Salary cannot be negative'),
});

type FormValues = z.infer<typeof schema>;

const EMPTY: FormValues = {
  userId: '',
  employeeCode: '',
  department: '',
  designation: '',
  dateOfJoining: '',
  salaryAmount: 0,
};

type Props = {
  open: boolean;
  onClose: () => void;
};

function AddStaffProfileModal({ open, onClose }: Props) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();

  const eligibleUsersQuery = useQuery({
    queryKey: ELIGIBLE_USERS_KEY,
    queryFn: fetchEligibleUsers,
    enabled: open,
    staleTime: 30 * 1000,
  });
  const eligibleUsers = eligibleUsersQuery.data ?? [];
  const noEligibleUsers = eligibleUsersQuery.isSuccess && eligibleUsers.length === 0;

  const {
    control,
    handleSubmit,
    reset,
    setError,
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
    mutationFn: (values: FormValues) =>
      createStaffProfile({
        userId: values.userId,
        employeeCode: values.employeeCode.trim(),
        department: values.department?.trim() ? values.department.trim() : null,
        designation: values.designation?.trim() ? values.designation.trim() : null,
        dateOfJoining: values.dateOfJoining,
        salaryAmount: values.salaryAmount,
      }),
    onSuccess: (profile) => {
      message.success(`Staff profile "${profile.employeeCode}" added for ${profile.fullName}`);
      void queryClient.invalidateQueries({ queryKey: STAFF_PROFILES_KEY });
      void queryClient.invalidateQueries({ queryKey: ELIGIBLE_USERS_KEY });
      onClose();
    },
    onError: (error) => {
      if (error instanceof DuplicateStaffProfileError) {
        setError('employeeCode', { type: 'server', message: error.message });
        return;
      }
      message.error('Could not add the staff profile. Please try again.');
    },
  });

  const submit = handleSubmit((values) => mutation.mutate(values));

  return (
    <Modal
      title="Add staff profile"
      open={open}
      onCancel={onClose}
      onOk={submit}
      okText="Add staff profile"
      confirmLoading={mutation.isPending}
      okButtonProps={{ disabled: eligibleUsersQuery.isLoading || noEligibleUsers }}
      destroyOnClose
      maskClosable={!mutation.isPending}
    >
      {noEligibleUsers && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="Everyone already has a staff profile"
          description="Every user in the tenant already has a staff profile, or there are no other user accounts yet."
        />
      )}

      <Form layout="vertical" requiredMark="optional" onFinish={submit}>
        <Controller
          control={control}
          name="userId"
          render={({ field }) => (
            <Form.Item
              label="User"
              required
              validateStatus={errors.userId ? 'error' : undefined}
              help={errors.userId?.message}
            >
              <Select
                {...field}
                data-testid="staff-user-select"
                placeholder="Select a user"
                loading={eligibleUsersQuery.isLoading}
                options={eligibleUsers.map((u) => ({
                  value: u.id,
                  label: `${u.fullName} (${u.email})${u.roles.length ? ` — ${u.roles.join(', ')}` : ''}`,
                }))}
                showSearch
                optionFilterProp="label"
              />
            </Form.Item>
          )}
        />

        <Controller
          control={control}
          name="employeeCode"
          render={({ field }) => (
            <Form.Item
              label="Employee code"
              required
              validateStatus={errors.employeeCode ? 'error' : undefined}
              help={errors.employeeCode?.message}
            >
              <Input
                {...field}
                data-testid="staff-employee-code-input"
                placeholder="e.g. EMP-001"
                autoComplete="off"
              />
            </Form.Item>
          )}
        />

        <Controller
          control={control}
          name="department"
          render={({ field }) => (
            <Form.Item label="Department" help="Optional">
              <Input {...field} placeholder="e.g. Science" autoComplete="off" />
            </Form.Item>
          )}
        />

        <Controller
          control={control}
          name="designation"
          render={({ field }) => (
            <Form.Item label="Designation" help="Optional">
              <Input {...field} placeholder="e.g. Senior Teacher" autoComplete="off" />
            </Form.Item>
          )}
        />

        <Controller
          control={control}
          name="dateOfJoining"
          render={({ field }) => (
            <Form.Item
              label="Date of joining"
              required
              validateStatus={errors.dateOfJoining ? 'error' : undefined}
              help={errors.dateOfJoining?.message}
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
          name="salaryAmount"
          render={({ field }) => (
            <Form.Item
              label="Salary"
              required
              validateStatus={errors.salaryAmount ? 'error' : undefined}
              help={errors.salaryAmount?.message}
            >
              <InputNumber
                data-testid="staff-salary-input"
                style={{ width: '100%' }}
                min={0}
                step={1000}
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

export default AddStaffProfileModal;
