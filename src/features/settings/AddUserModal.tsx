import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App, Form, Input, Modal, Select, Typography } from 'antd';
import { createUser, DuplicateEmailError } from '../../api/users';
import { fetchRoles } from '../../api/roles';
import { USERS_KEY, ROLES_KEY } from './queryKeys';

const { Text, Paragraph } = Typography;

const schema = z.object({
  email: z.string().trim().min(1, 'Email is required').email('Enter a valid email'),
  fullName: z.string().trim().min(1, 'Full name is required').max(200, 'Keep this under 200 characters'),
  initialPassword: z
    .string()
    .refine((v) => v.length === 0 || v.length >= 8, 'Password must be at least 8 characters')
    .optional(),
  roleIds: z.array(z.string()).min(1, 'Select at least one role'),
});

type FormValues = z.infer<typeof schema>;

const EMPTY: FormValues = { email: '', fullName: '', initialPassword: '', roleIds: [] };

type Props = {
  open: boolean;
  onClose: () => void;
};

function AddUserModal({ open, onClose }: Props) {
  const { message, modal } = App.useApp();
  const queryClient = useQueryClient();

  const rolesQuery = useQuery({ queryKey: ROLES_KEY, queryFn: fetchRoles, enabled: open, staleTime: 30 * 1000 });
  const roles = rolesQuery.data ?? [];

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
      createUser({
        email: values.email.trim(),
        fullName: values.fullName.trim(),
        initialPassword: values.initialPassword?.trim() ? values.initialPassword.trim() : undefined,
        roleIds: values.roleIds,
      }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: USERS_KEY });
      onClose();
      if (result.generatedPassword) {
        modal.info({
          title: `User "${result.user.fullName}" created`,
          content: (
            <div>
              <Paragraph>
                No password was set, so a temporary one was generated. Share it with them now — it will not be
                shown again.
              </Paragraph>
              <Paragraph copyable={{ text: result.generatedPassword }}>
                <Text code style={{ fontSize: 16 }}>
                  {result.generatedPassword}
                </Text>
              </Paragraph>
              <Text type="secondary">They must change this password on first login.</Text>
            </div>
          ),
          okText: 'Done',
        });
      } else {
        message.success(`User "${result.user.fullName}" created`);
      }
    },
    onError: (error) => {
      if (error instanceof DuplicateEmailError) {
        setError('email', { type: 'server', message: error.message });
        return;
      }
      message.error('Could not create the user. Please try again.');
    },
  });

  const submit = handleSubmit((values) => mutation.mutate(values));

  return (
    <Modal
      title="Add user"
      open={open}
      onCancel={onClose}
      onOk={submit}
      okText="Create user"
      confirmLoading={mutation.isPending}
      destroyOnClose
      maskClosable={!mutation.isPending}
    >
      <Form layout="vertical" requiredMark="optional" onFinish={submit}>
        <Controller
          control={control}
          name="email"
          render={({ field }) => (
            <Form.Item label="Email" required validateStatus={errors.email ? 'error' : undefined} help={errors.email?.message}>
              <Input {...field} placeholder="name@school.example" autoComplete="off" />
            </Form.Item>
          )}
        />
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
              <Input {...field} placeholder="Full name" autoComplete="off" />
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
                placeholder="Select one or more roles"
                loading={rolesQuery.isLoading}
                options={roles.map((r) => ({ value: r.id, label: r.name }))}
              />
            </Form.Item>
          )}
        />
        <Controller
          control={control}
          name="initialPassword"
          render={({ field }) => (
            <Form.Item
              label="Initial password"
              help={errors.initialPassword?.message ?? 'Optional — leave blank to auto-generate a temporary one'}
              validateStatus={errors.initialPassword ? 'error' : undefined}
            >
              <Input.Password {...field} placeholder="Leave blank to auto-generate" autoComplete="new-password" />
            </Form.Item>
          )}
        />
      </Form>
    </Modal>
  );
}

export default AddUserModal;
