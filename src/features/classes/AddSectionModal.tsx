import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { App, Form, Input, Modal } from 'antd';
import { createSection, DuplicateNameError, renameSection } from '../../api/classes';
import { CLASSES_QUERY_KEY } from './queryKeys';

const schema = z.object({
  name: z.string().trim().min(1, 'Section name is required').max(100, 'Keep this under 100 characters'),
});

type FormValues = z.infer<typeof schema>;

type Props = {
  /** The class to add a section to (or whose `section` to rename); `null` keeps the modal closed. */
  target: { id: string; name: string; section?: { id: string; name: string } } | null;
  onClose: () => void;
};

function AddSectionModal({ target, onClose }: Props) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();

  const {
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '' },
    mode: 'onTouched',
  });

  useEffect(() => {
    if (target) {
      reset({ name: target.section?.name ?? '' });
    }
  }, [target, reset]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      if (!target) {
        return Promise.reject(new Error('No class selected'));
      }
      return target.section
        ? renameSection(target.id, target.section.id, values.name.trim())
        : createSection(target.id, values.name.trim());
    },
    onSuccess: (created) => {
      message.success(target?.section ? `Section renamed to "${created.name}"` : `Section "${created.name}" added`);
      void queryClient.invalidateQueries({ queryKey: CLASSES_QUERY_KEY });
      onClose();
    },
    onError: (error) => {
      if (error instanceof DuplicateNameError) {
        setError('name', { type: 'server', message: error.message });
        return;
      }
      message.error(`Could not ${target?.section ? 'rename' : 'add'} the section. Please try again.`);
    },
  });

  const submit = handleSubmit((values) => mutation.mutate(values));

  return (
    <Modal
      title={target?.section ? `Rename section ${target.section.name} (${target.name})` : target ? `Add section to ${target.name}` : 'Add section'}
      open={target !== null}
      onCancel={onClose}
      onOk={submit}
      okText={target?.section ? 'Save' : 'Add section'}
      confirmLoading={mutation.isPending}
      destroyOnHidden
      maskClosable={!mutation.isPending}
    >
      <Form layout="vertical" requiredMark="optional" onFinish={submit}>
        <Controller
          control={control}
          name="name"
          render={({ field }) => (
            <Form.Item
              label="Section name"
              htmlFor="section-name"
              required
              validateStatus={errors.name ? 'error' : undefined}
              help={errors.name?.message}
            >
              <Input {...field} id="section-name" placeholder="e.g. A" autoComplete="off" autoFocus />
            </Form.Item>
          )}
        />
      </Form>
    </Modal>
  );
}

export default AddSectionModal;
