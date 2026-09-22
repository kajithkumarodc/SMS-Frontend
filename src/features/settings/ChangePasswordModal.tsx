import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { App, Form, Input, Modal, Typography } from 'antd';
import { changeOwnPassword, WrongCurrentPasswordError } from '../../api/users';
import { useAuthStore } from '../../store/authStore';

const { Paragraph } = Typography;

const schema = z.object({
  currentPassword: z.string().min(1, 'Enter your current password'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

type FormValues = z.infer<typeof schema>;

/**
 * A blocking modal shown whenever the signed-in user's account has
 * `mustChangePassword=true` (set on account creation and on every admin
 * password reset -- see `UserService`). No email/SMS provider is involved:
 * the user simply sets their own password here.
 */
function ChangePasswordModal() {
  const { message } = App.useApp();
  const user = useAuthStore((state) => state.user);
  const login = useAuthStore((state) => state.login);
  const open = Boolean(user?.mustChangePassword);

  const {
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: '', newPassword: '' },
    mode: 'onTouched',
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) => changeOwnPassword(values.currentPassword, values.newPassword),
    onSuccess: () => {
      message.success('Password changed');
      reset();
      if (user) login({ ...user, mustChangePassword: false });
    },
    onError: (error) => {
      if (error instanceof WrongCurrentPasswordError) {
        setError('currentPassword', { type: 'server', message: error.message });
        return;
      }
      message.error('Could not change the password. Please try again.');
    },
  });

  const submit = handleSubmit((values) => mutation.mutate(values));

  return (
    <Modal
      title="Set a new password"
      open={open}
      onOk={submit}
      okText="Change password"
      confirmLoading={mutation.isPending}
      closable={false}
      maskClosable={false}
      keyboard={false}
      cancelButtonProps={{ style: { display: 'none' } }}
    >
      <Paragraph type="secondary">Your account was created with a temporary password. Set your own before continuing.</Paragraph>
      <Form layout="vertical" requiredMark="optional" onFinish={submit}>
        <Controller
          control={control}
          name="currentPassword"
          render={({ field }) => (
            <Form.Item
              label="Current (temporary) password"
              required
              validateStatus={errors.currentPassword ? 'error' : undefined}
              help={errors.currentPassword?.message}
            >
              <Input.Password {...field} autoComplete="current-password" />
            </Form.Item>
          )}
        />
        <Controller
          control={control}
          name="newPassword"
          render={({ field }) => (
            <Form.Item
              label="New password"
              required
              validateStatus={errors.newPassword ? 'error' : undefined}
              help={errors.newPassword?.message}
            >
              <Input.Password {...field} autoComplete="new-password" />
            </Form.Item>
          )}
        />
      </Form>
    </Modal>
  );
}

export default ChangePasswordModal;
