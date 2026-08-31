import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, DatePicker, Form, Input, InputNumber, Modal, Select } from 'antd';
import dayjs from 'dayjs';
import { createExam } from '../../api/exams';
import { fetchClassSubjects } from '../../api/classes';
import { EXAMS_QUERY_KEY } from './queryKeys';

const schema = z.object({
  subjectId: z.string().min(1, 'Select a subject'),
  name: z.string().trim().min(1, 'Exam name is required').max(150, 'Keep this under 150 characters'),
  examDate: z.string().min(1, 'Pick an exam date'),
  maxMarks: z.number({ invalid_type_error: 'Enter the maximum marks' }).positive('Max marks must be greater than 0'),
});

type FormValues = z.infer<typeof schema>;

const EMPTY: FormValues = { subjectId: '', name: '', examDate: '', maxMarks: 100 };

type Props = {
  open: boolean;
  onClose: () => void;
  classId: string;
  className: string;
};

function AddExamModal({ open, onClose, classId, className }: Props) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();

  const subjectsQuery = useQuery({
    queryKey: ['class-subjects', classId],
    queryFn: () => fetchClassSubjects(classId),
    enabled: open && classId !== '',
    staleTime: 5 * 60 * 1000,
  });
  const subjects = subjectsQuery.data ?? [];
  const noSubjects = subjectsQuery.isSuccess && subjects.length === 0;

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
      createExam({
        classId,
        subjectId: values.subjectId,
        name: values.name.trim(),
        examDate: values.examDate,
        maxMarks: values.maxMarks,
      }),
    onSuccess: (created) => {
      message.success(`Exam "${created.name}" added`);
      void queryClient.invalidateQueries({ queryKey: [...EXAMS_QUERY_KEY, classId] });
      onClose();
    },
    onError: () => {
      message.error('Could not add the exam. Please try again.');
    },
  });

  const submit = handleSubmit((values) => mutation.mutate(values));

  return (
    <Modal
      title={`Add exam for ${className}`}
      open={open}
      onCancel={onClose}
      onOk={submit}
      okText="Add exam"
      confirmLoading={mutation.isPending}
      okButtonProps={{ disabled: subjectsQuery.isLoading || noSubjects }}
      destroyOnClose
      maskClosable={!mutation.isPending}
    >
      {noSubjects && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="No subjects on this class yet"
          description="Assign a subject to this class on the Classes page first."
        />
      )}

      <Form layout="vertical" requiredMark="optional" onFinish={submit}>
        <Controller
          control={control}
          name="name"
          render={({ field }) => (
            <Form.Item
              label="Exam name"
              required
              validateStatus={errors.name ? 'error' : undefined}
              help={errors.name?.message}
            >
              <Input {...field} placeholder="e.g. Mid-term 2026" autoComplete="off" />
            </Form.Item>
          )}
        />

        <Controller
          control={control}
          name="subjectId"
          render={({ field }) => (
            <Form.Item
              label="Subject"
              required
              validateStatus={errors.subjectId ? 'error' : undefined}
              help={errors.subjectId?.message}
            >
              <Select
                {...field}
                placeholder="Select a subject"
                loading={subjectsQuery.isLoading}
                options={subjects.map((s) => ({ value: s.id, label: s.name }))}
                showSearch
                optionFilterProp="label"
              />
            </Form.Item>
          )}
        />

        <Controller
          control={control}
          name="examDate"
          render={({ field }) => (
            <Form.Item
              label="Exam date"
              required
              validateStatus={errors.examDate ? 'error' : undefined}
              help={errors.examDate?.message}
            >
              <DatePicker
                style={{ width: '100%' }}
                value={field.value ? dayjs(field.value) : null}
                onChange={(d) => field.onChange(d ? d.format('YYYY-MM-DD') : '')}
              />
            </Form.Item>
          )}
        />

        <Controller
          control={control}
          name="maxMarks"
          render={({ field }) => (
            <Form.Item
              label="Maximum marks"
              required
              validateStatus={errors.maxMarks ? 'error' : undefined}
              help={errors.maxMarks?.message}
            >
              <InputNumber
                style={{ width: '100%' }}
                min={0}
                step={5}
                value={field.value}
                onChange={(v) => field.onChange(v ?? undefined)}
              />
            </Form.Item>
          )}
        />
      </Form>
    </Modal>
  );
}

export default AddExamModal;
