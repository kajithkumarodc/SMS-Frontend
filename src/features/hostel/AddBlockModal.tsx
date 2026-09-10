import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { App, Form, Input, Modal } from 'antd';
import { createBlock } from '../../api/hostel';
import { HOSTEL_BLOCKS_KEY } from './queryKeys';

const schema = z.object({
  name: z.string().trim().min(1, 'A name is required').max(200, 'Keep this under 200 characters'),
});

type FormValues = z.infer<typeof schema>;

type Props = {
  open: boolean;
  onClose: () => void;
};

function AddBlockModal({ open, onClose }: Props) {
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
    mutationFn: (values: FormValues) => createBlock({ name: values.name.trim() }),
    onSuccess: (block) => {
      message.success(`Block "${block.name}" added`);
      void queryClient.invalidateQueries({ queryKey: HOSTEL_BLOCKS_KEY });
      onClose();
    },
    onError: () => {
      message.error('Could not add the block. Please try again.');
    },
  });

  const submit = handleSubmit((values) => mutation.mutate(values));

  return (
    <Modal
      title="Add block"
      open={open}
      onCancel={onClose}
      onOk={submit}
      okText="Add block"
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
              <Input {...field} data-testid="block-name-input" placeholder="e.g. Block A" autoComplete="off" />
            </Form.Item>
          )}
        />
      </Form>
    </Modal>
  );
}

export default AddBlockModal;
