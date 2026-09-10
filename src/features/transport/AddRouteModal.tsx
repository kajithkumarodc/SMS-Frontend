import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { App, Form, Input, Modal } from 'antd';
import { createRoute } from '../../api/transport';
import { TRANSPORT_ROUTES_KEY } from './queryKeys';

const schema = z.object({
  name: z.string().trim().min(1, 'A name is required').max(200, 'Keep this under 200 characters'),
});

type FormValues = z.infer<typeof schema>;

type Props = {
  open: boolean;
  onClose: () => void;
};

function AddRouteModal({ open, onClose }: Props) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '' },
    mode: 'onTouched',
  });

  useEffect(() => {
    if (open) reset({ name: '' });
  }, [open, reset]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => createRoute({ name: values.name.trim() }),
    onSuccess: (route) => {
      message.success(`Route "${route.name}" added`);
      void queryClient.invalidateQueries({ queryKey: TRANSPORT_ROUTES_KEY });
      onClose();
    },
    onError: () => {
      message.error('Could not add the route. Please try again.');
    },
  });

  const submit = handleSubmit((values) => mutation.mutate(values));

  return (
    <Modal
      title="Add route"
      open={open}
      onCancel={onClose}
      onOk={submit}
      okText="Add route"
      confirmLoading={mutation.isPending}
      destroyOnClose
      maskClosable={!mutation.isPending}
    >
      <Form layout="vertical" requiredMark="optional" onFinish={submit}>
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
              <Input
                {...field}
                data-testid="route-name-input"
                placeholder="e.g. Route 1 - North Zone"
                autoComplete="off"
              />
            </Form.Item>
          )}
        />
      </Form>
    </Modal>
  );
}

export default AddRouteModal;
