import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App, Button, Form, Input, Modal, Select, Space, Typography } from 'antd';
import { resetUserPassword, updateUser, type AppUser } from '../../api/users';
import { fetchRoles } from '../../api/roles';
import { ROLES_KEY, USERS_KEY } from './queryKeys';

const { Text, Paragraph } = Typography;

const schema = z.object({
  fullName: z.string().trim().min(1, 'Full name is required').max(200, 'Keep this under 200 characters'),
  status: z.string().min(1),
  roleIds: z.array(z.string()).min(1, 'Select at least one role'),
});

type FormValues = z.infer<typeof schema>;

type Props = {
  /** The user to edit, or null when the modal is closed. */
  user: AppUser | null;
  onClose: () => void;
};

function EditUserModal({ user, onClose }: Props) {
  const { message, modal } = App.useApp();
  const queryClient = useQueryClient();
  const open = user !== null;

  const rolesQuery = useQuery({ queryKey: ROLES_KEY, queryFn: fetchRoles, enabled: open, staleTime: 30 * 1000 });
  const roles = rolesQuery.data ?? [];

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { fullName: '', status: 'ACTIVE', roleIds: [] },
    mode: 'onTouched',
  });

  useEffect(() => {
    if (user && roles.length > 0) {
      reset({
        fullName: user.fullName,
        status: user.status,
        roleIds: roles.filter((r) => user.roles.includes(r.name)).map((r) => r.id),
      });
    }
  }, [user, roles, reset]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      if (!user) return Promise.reject(new Error('No user'));
      return updateUser(user.id, {
        fullName: values.fullName.trim(),
        status: values.status as 'ACTIVE' | 'INACTIVE',
        roleIds: values.roleIds,
      });
    },
    onSuccess: (saved) => {
      message.success(`${saved.fullName} updated`);
      void queryClient.invalidateQueries({ queryKey: USERS_KEY });
      onClose();
    },
    onError: () => {
      message.error('Could not update the user. Please try again.');
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: () => {
      if (!user) return Promise.reject(new Error('No user'));
      return resetUserPassword(user.id);
    },
    onSuccess: (temporaryPassword) => {
      modal.info({
        title: `Password reset for ${user?.fullName}`,
        content: (
          <div>
            <Paragraph>Share this temporary password with them now — it will not be shown again.</Paragraph>
            <Paragraph copyable={{ text: temporaryPassword }}>
              <Text code style={{ fontSize: 16 }}>
                {temporaryPassword}
              </Text>
            </Paragraph>
            <Text type="secondary">They must change this password on first login.</Text>
          </div>
        ),
        okText: 'Done',
      });
    },
    onError: () => {
      message.error('Could not reset the password. Please try again.');
    },
  });

  const submit = handleSubmit((values) => mutation.mutate(values));

  return (
    <Modal
      title={user ? `Edit user — ${user.fullName}` : 'Edit user'}
      open={open}
      onCancel={onClose}
      onOk={submit}
      okText="Save changes"
      confirmLoading={mutation.isPending}
      destroyOnClose
      maskClosable={!mutation.isPending}
    >
      <Form layout="vertical" requiredMark="optional" onFinish={submit}>
        <Form.Item label="Email">
          <Input value={user?.email} disabled />
        </Form.Item>

        <Controller
          control={control}
          name="fullName"
          render={({ field }) => (
            <Form.Item
              label="Full name"
              required
              validateStatus={errors.fullName ? 'error' : undefined}
              help={errors.fullName?.message}
            >
              <Input {...field} autoComplete="off" />
            </Form.Item>
          )}
        />

        <Controller
          control={control}
          name="roleIds"
          render={({ field }) => (
            <Form.Item
              label="Roles"
              required
              validateStatus={errors.roleIds ? 'error' : undefined}
              help={errors.roleIds?.message}
            >
              <Select
                {...field}
                mode="multiple"
                loading={rolesQuery.isLoading}
                options={roles.map((r) => ({ value: r.id, label: r.name }))}
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

        <Form.Item label="Password">
          <Space direction="vertical">
            <Button loading={resetPasswordMutation.isPending} onClick={() => resetPasswordMutation.mutate()}>
              Reset password
            </Button>
            <Text type="secondary">Generates a new temporary password — no email/SMS provider required.</Text>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  );
}

export default EditUserModal;
