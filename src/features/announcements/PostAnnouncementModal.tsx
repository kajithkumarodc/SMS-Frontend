import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { App, Form, Input, Modal } from 'antd';
import { createAnnouncement } from '../../api/announcements';
import { ANNOUNCEMENTS_QUERY_KEY } from './queryKeys';

const schema = z.object({
  title: z.string().trim().min(1, 'A title is required').max(200, 'Keep the title under 200 characters'),
  body: z.string().trim().min(1, 'A message is required').max(20_000, 'That message is too long'),
});

type FormValues = z.infer<typeof schema>;

const EMPTY: FormValues = { title: '', body: '' };

type Props = {
  open: boolean;
  onClose: () => void;
};

function PostAnnouncementModal({ open, onClose }: Props) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();

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
    mutationFn: (values: FormValues) =>
      createAnnouncement({ title: values.title.trim(), body: values.body.trim() }),
    onSuccess: (created) => {
      message.success(`Announcement "${created.title}" posted`);
      void queryClient.invalidateQueries({ queryKey: ANNOUNCEMENTS_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: ['dashboard', 'summary'] });
      onClose();
    },
    onError: () => {
      message.error('Could not post the announcement. Please try again.');
    },
  });

  const submit = handleSubmit((values) => mutation.mutate(values));

  return (
    <Modal
      title="Post announcement"
      open={open}
      onCancel={onClose}
      onOk={submit}
      okText="Post"
      confirmLoading={mutation.isPending}
      destroyOnClose
      maskClosable={!mutation.isPending}
    >
      <Form layout="vertical" requiredMark="optional" onFinish={submit}>
        <Controller
          control={control}
          name="title"
          render={({ field }) => (
            <Form.Item
              label="Title"
              required
              validateStatus={errors.title ? 'error' : undefined}
              help={errors.title?.message}
            >
              <Input
                {...field}
                data-testid="announcement-title-input"
                placeholder="e.g. Sports day moved to Friday"
                autoComplete="off"
                maxLength={200}
              />
            </Form.Item>
          )}
        />

        <Controller
          control={control}
          name="body"
          render={({ field }) => (
            <Form.Item
              label="Message"
              required
              validateStatus={errors.body ? 'error' : undefined}
              help={errors.body?.message}
            >
              <Input.TextArea
                {...field}
                data-testid="announcement-body-input"
                placeholder="Write the announcement everyone in the school will see…"
                autoSize={{ minRows: 4, maxRows: 12 }}
                showCount
                maxLength={20_000}
              />
            </Form.Item>
          )}
        />
      </Form>
    </Modal>
  );
}

export default PostAnnouncementModal;
