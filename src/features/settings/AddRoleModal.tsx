import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { App, Form, Input, Modal } from 'antd';
import { createRole, DuplicateNameError } from '../../api/roles';
import { ROLES_KEY } from './queryKeys';

const schema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'A role name is required')
    .max(50, 'Keep this under 50 characters')
    .regex(/^[A-Z][A-Z0-9_]*$/, 'Use uppercase letters, digits and underscores, e.g. EXAM_COORDINATOR'),
});

type FormValues = z.infer<typeof schema>;

type Props = {
  open: boolean;
  onClose: () => void;
};

function AddRoleModal({ open, onClose }: Props) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();

  const {
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { name: '' }, mode: 'onTouched' });

  useEffect(() => {
    if (open) reset({ name: '' });
  }, [open, reset]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => createRole(values.name.trim()),
    onSuccess: (role) => {
      message.success(`Role "${role.name}" created — assign permissions to it next`);
      void queryClient.invalidateQueries({ queryKey: ROLES_KEY });
      onClose();
    },
    onError: (error) => {
      if (error instanceof DuplicateNameError) {
        setError('name', { type: 'server', message: error.message });
        return;
      }
      message.error('Could not create the role. Please try again.');
    },
  });

  const submit = handleSubmit((values) => mutation.mutate(values));

  return (
    <Modal
      title="Add role"
      open={open}
      onCancel={onClose}
      onOk={submit}
      okText="Create role"
      confirmLoading={mutation.isPending}
      destroyOnClose
      maskClosable={!mutation.isPending}
    >
      <Form layout="vertical" requiredMark="optional" onFinish={submit}>
        <Controller
          control={control}
          name="name"
          render={({ field }) => (
            <Form.Item label="Role name" required validateStatus={errors.name ? 'error' : undefined} help={errors.name?.message}>
              <Input {...field} placeholder="e.g. EXAM_COORDINATOR" autoComplete="off" />
            </Form.Item>
          )}
        />
      </Form>
    </Modal>
  );
}

export default AddRoleModal;
