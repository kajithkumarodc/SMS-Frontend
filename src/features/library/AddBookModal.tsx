import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { App, Form, Input, InputNumber, Modal } from 'antd';
import { addBook, type AddBookInput } from '../../api/library';
import { LIBRARY_BOOKS_KEY } from './queryKeys';

const schema = z.object({
  title: z.string().trim().min(1, 'A title is required').max(300, 'Keep this under 300 characters'),
  author: z.string().trim().min(1, 'An author is required').max(200, 'Keep this under 200 characters'),
  isbn: z.string().trim().max(20, 'Keep this under 20 characters').optional(),
  totalCopies: z
    .number({ invalid_type_error: 'Enter how many copies' })
    .int('Whole copies only')
    .min(1, 'At least one copy'),
});

type FormValues = z.infer<typeof schema>;

const EMPTY: FormValues = { title: '', author: '', isbn: '', totalCopies: 1 };

type Props = {
  open: boolean;
  onClose: () => void;
};

function AddBookModal({ open, onClose }: Props) {
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
    mutationFn: (values: FormValues) => {
      const payload: AddBookInput = {
        title: values.title.trim(),
        author: values.author.trim(),
        isbn: values.isbn?.trim() ? values.isbn.trim() : null,
        totalCopies: values.totalCopies,
      };
      return addBook(payload);
    },
    onSuccess: (created) => {
      message.success(`"${created.title}" added to the catalogue`);
      void queryClient.invalidateQueries({ queryKey: LIBRARY_BOOKS_KEY });
      onClose();
    },
    onError: () => {
      message.error('Could not add the book. Please try again.');
    },
  });

  const submit = handleSubmit((values) => mutation.mutate(values));

  return (
    <Modal
      title="Add book"
      open={open}
      onCancel={onClose}
      onOk={submit}
      okText="Add book"
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
              <Input {...field} data-testid="book-title-input" placeholder="e.g. Clean Code" autoComplete="off" />
            </Form.Item>
          )}
        />

        <Controller
          control={control}
          name="author"
          render={({ field }) => (
            <Form.Item
              label="Author"
              required
              validateStatus={errors.author ? 'error' : undefined}
              help={errors.author?.message}
            >
              <Input {...field} data-testid="book-author-input" placeholder="e.g. Robert C. Martin" autoComplete="off" />
            </Form.Item>
          )}
        />

        <Controller
          control={control}
          name="isbn"
          render={({ field }) => (
            <Form.Item
              label="ISBN"
              validateStatus={errors.isbn ? 'error' : undefined}
              help={errors.isbn?.message ?? 'Optional'}
            >
              <Input {...field} data-testid="book-isbn-input" placeholder="e.g. 978-0132350884" autoComplete="off" />
            </Form.Item>
          )}
        />

        <Controller
          control={control}
          name="totalCopies"
          render={({ field }) => (
            <Form.Item
              label="Total copies"
              required
              validateStatus={errors.totalCopies ? 'error' : undefined}
              help={errors.totalCopies?.message}
            >
              <InputNumber
                data-testid="book-copies-input"
                style={{ width: '100%' }}
                min={1}
                step={1}
                precision={0}
                value={field.value || undefined}
                onChange={(v) => field.onChange(v ?? undefined)}
              />
            </Form.Item>
          )}
        />
      </Form>
    </Modal>
  );
}

export default AddBookModal;
