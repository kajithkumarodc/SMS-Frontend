import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { App, DatePicker, Form, Input, InputNumber, Modal, Select } from 'antd';
import dayjs from 'dayjs';
import { updateStaffProfile, type StaffProfile } from '../../api/staff';
import { STAFF_PROFILES_KEY } from './queryKeys';

const schema = z.object({
  department: z.string().trim().max(200, 'Keep this under 200 characters').optional(),
  designation: z.string().trim().max(200, 'Keep this under 200 characters').optional(),
  dateOfJoining: z.string().min(1, 'Pick a date of joining'),
  salaryAmount: z
    .number({ invalid_type_error: 'Enter a salary amount' })
    .min(0, 'Salary cannot be negative'),
  status: z.string().min(1),
});

type FormValues = z.infer<typeof schema>;

type Props = {
  /** The profile to edit, or null when the modal is closed. */
  profile: StaffProfile | null;
  onClose: () => void;
};

function EditStaffProfileModal({ profile, onClose }: Props) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const open = profile !== null;

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      department: '',
      designation: '',
      dateOfJoining: '',
      salaryAmount: 0,
      status: 'ACTIVE',
    },
    mode: 'onTouched',
  });

  useEffect(() => {
    if (profile) {
      reset({
        department: profile.department ?? '',
        designation: profile.designation ?? '',
        dateOfJoining: profile.dateOfJoining,
        salaryAmount: profile.salaryAmount,
        status: profile.status,
      });
    }
  }, [profile, reset]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      if (!profile) return Promise.reject(new Error('No profile'));
      return updateStaffProfile(profile.id, {
        department: values.department?.trim() ? values.department.trim() : null,
        designation: values.designation?.trim() ? values.designation.trim() : null,
        dateOfJoining: values.dateOfJoining,
        salaryAmount: values.salaryAmount,
        status: values.status as 'ACTIVE' | 'INACTIVE',
      });
    },
    onSuccess: (saved) => {
      message.success(`${saved.fullName}'s staff profile updated`);
      void queryClient.invalidateQueries({ queryKey: STAFF_PROFILES_KEY });
      onClose();
    },
    onError: () => {
      message.error('Could not update the staff profile. Please try again.');
    },
  });

  const submit = handleSubmit((values) => mutation.mutate(values));

  return (
    <Modal
      title={profile ? `Edit staff profile — ${profile.fullName}` : 'Edit staff profile'}
      open={open}
      onCancel={onClose}
      onOk={submit}
      okText="Save changes"
      confirmLoading={mutation.isPending}
      destroyOnClose
      maskClosable={!mutation.isPending}
    >
      <Form layout="vertical" requiredMark="optional" onFinish={submit}>
        <Form.Item label="Employee code">
          <Input value={profile?.employeeCode} disabled />
        </Form.Item>

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

        <Controller
          control={control}
          name="status"
          render={({ field }) => (
            <Form.Item label="Status">
              <Select
                {...field}
                options={[
                  { value: 'ACTIVE', label: 'Active' },
                  { value: 'INACTIVE', label: 'Inactive' },
                ]}
              />
            </Form.Item>
          )}
        />
      </Form>
    </Modal>
  );
}

export default EditStaffProfileModal;
