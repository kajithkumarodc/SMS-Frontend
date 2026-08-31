import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App, Form, Input, Modal, Select } from 'antd';
import { createSubject, DuplicateNameError } from '../../api/classes';
import { fetchSchools } from '../../api/students';
import { SUBJECTS_QUERY_KEY } from './queryKeys';

const schema = z.object({
  schoolId: z.string().min(1, 'Select a school'),
  name: z.string().trim().min(1, 'Subject name is required').max(100, 'Keep this under 100 characters'),
});

type FormValues = z.infer<typeof schema>;

type Props = {
  open: boolean;
  onClose: () => void;
};

function AddSubjectModal({ open, onClose }: Props) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();

  const schoolsQuery = useQuery({
    queryKey: ['schools'],
    queryFn: fetchSchools,
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });
  const schools = schoolsQuery.data ?? [];
  const singleSchoolId = schools.length === 1 ? schools[0].id : '';

  const {
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { schoolId: '', name: '' },
    mode: 'onTouched',
  });

  useEffect(() => {
    if (open) {
      reset({ schoolId: singleSchoolId, name: '' });
    }
  }, [open, singleSchoolId, reset]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => createSubject({ schoolId: values.schoolId, name: values.name.trim() }),
    onSuccess: (created) => {
      message.success(`Subject "${created.name}" added`);
      void queryClient.invalidateQueries({ queryKey: SUBJECTS_QUERY_KEY });
      onClose();
    },
    onError: (error) => {
      if (error instanceof DuplicateNameError) {
        setError('name', { type: 'server', message: error.message });
        return;
      }
      message.error('Could not add the subject. Please try again.');
    },
  });

  const submit = handleSubmit((values) => mutation.mutate(values));

  return (
    <Modal
      title="Add subject"
      open={open}
      onCancel={onClose}
      onOk={submit}
      okText="Add subject"
      confirmLoading={mutation.isPending}
      okButtonProps={{ disabled: schoolsQuery.isLoading || schools.length === 0 }}
      destroyOnClose
      maskClosable={!mutation.isPending}
    >
      <Form layout="vertical" requiredMark="optional" onFinish={submit}>
        {schools.length !== 1 && (
          <Controller
            control={control}
            name="schoolId"
            render={({ field }) => (
              <Form.Item
                label="School"
                required
                validateStatus={errors.schoolId ? 'error' : undefined}
                help={errors.schoolId?.message}
              >
                <Select
                  {...field}
                  placeholder="Select a school"
                  loading={schoolsQuery.isLoading}
                  options={schools.map((s) => ({ value: s.id, label: s.name }))}
                />
              </Form.Item>
            )}
          />
        )}

        <Controller
          control={control}
          name="name"
          render={({ field }) => (
            <Form.Item
              label="Subject name"
              required
              validateStatus={errors.name ? 'error' : undefined}
              help={errors.name?.message}
            >
              <Input {...field} placeholder="e.g. Mathematics" autoComplete="off" />
            </Form.Item>
          )}
        />
      </Form>
    </Modal>
  );
}

export default AddSubjectModal;
