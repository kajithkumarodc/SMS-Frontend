import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { App, Form, Input, Modal, Select, Typography } from 'antd';
import { updateStudent, type Student, type UpdateStudentInput } from '../../api/students';
import { STUDENTS_QUERY_KEY } from './queryKeys';

const { Text } = Typography;

const schema = z.object({
  fullName: z.string().trim().min(1, 'Full name is required').max(200, 'Keep this under 200 characters'),
  guardianName: z.string().trim().max(200, 'Keep this under 200 characters').optional(),
  guardianContact: z.string().trim().max(50, 'Keep this under 50 characters').optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']),
});

type FormValues = z.infer<typeof schema>;

type Props = {
  /** The student to edit; `null` keeps the modal closed. */
  student: Student | null;
  onClose: () => void;
};

function EditStudentModal({ student, onClose }: Props) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { fullName: '', guardianName: undefined, guardianContact: undefined, status: 'ACTIVE' },
    mode: 'onTouched',
  });

  useEffect(() => {
    if (student) {
      reset({
        fullName: student.fullName,
        guardianName: student.guardianName ?? undefined,
        guardianContact: student.guardianContact ?? undefined,
        status: student.status,
      });
    }
  }, [student, reset]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      if (!student) {
        return Promise.reject(new Error('No student selected'));
      }
      const payload: UpdateStudentInput = {
        fullName: values.fullName.trim(),
        guardianName: values.guardianName?.trim() || undefined,
        guardianContact: values.guardianContact?.trim() || undefined,
        status: values.status,
      };
      return updateStudent(student.id, payload);
    },
    onSuccess: (updated) => {
      message.success(`${updated.fullName} updated`);
      void queryClient.invalidateQueries({ queryKey: STUDENTS_QUERY_KEY });
      onClose();
    },
    onError: () => {
      message.error('Could not save the changes. Please try again.');
    },
  });

  const submit = handleSubmit((values) => mutation.mutate(values));

  return (
    <Modal
      title="Edit student"
      open={student !== null}
      onCancel={onClose}
      onOk={submit}
      okText="Save changes"
      confirmLoading={mutation.isPending}
      destroyOnClose
      maskClosable={!mutation.isPending}
    >
      <Form layout="vertical" requiredMark="optional" onFinish={submit}>
        <Form.Item label="Admission number">
          <Input value={student?.admissionNumber ?? ''} disabled />
          <Text type="secondary" style={{ fontSize: 12 }}>
            Admission number cannot be changed — it is the student&rsquo;s permanent record key.
          </Text>
        </Form.Item>

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
              <Input {...field} placeholder="e.g. Priya Sharma" autoComplete="off" />
            </Form.Item>
          )}
        />

        <Controller
          control={control}
          name="guardianName"
          render={({ field }) => (
            <Form.Item
              label="Guardian name"
              validateStatus={errors.guardianName ? 'error' : undefined}
              help={errors.guardianName?.message}
            >
              <Input {...field} value={field.value ?? ''} placeholder="e.g. Anil Sharma" autoComplete="off" />
            </Form.Item>
          )}
        />

        <Controller
          control={control}
          name="guardianContact"
          render={({ field }) => (
            <Form.Item
              label="Guardian contact"
              validateStatus={errors.guardianContact ? 'error' : undefined}
              help={errors.guardianContact?.message}
            >
              <Input {...field} value={field.value ?? ''} placeholder="Phone or email" autoComplete="off" />
            </Form.Item>
          )}
        />

        <Controller
          control={control}
          name="status"
          render={({ field }) => (
            <Form.Item
              label="Status"
              required
              validateStatus={errors.status ? 'error' : undefined}
              help={errors.status?.message}
            >
              <Select
                {...field}
                options={[
                  { value: 'ACTIVE', label: 'Active' },
                  { value: 'INACTIVE', label: 'Inactive' },
                ]}
              />
            </Form.Item>
          )}
        />
      </Form>
    </Modal>
  );
}

export default EditStudentModal;
