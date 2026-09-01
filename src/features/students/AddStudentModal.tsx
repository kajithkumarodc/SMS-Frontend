import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, DatePicker, Form, Input, Modal, Select, Typography } from 'antd';
import dayjs from 'dayjs';
import {
  createStudent,
  DuplicateAdmissionNumberError,
  fetchSchools,
  type CreateStudentInput,
} from '../../api/students';
import { STUDENTS_QUERY_KEY } from './queryKeys';

const { Text } = Typography;

const schema = z.object({
  schoolId: z.string().min(1, 'Select a school'),
  fullName: z.string().trim().min(1, 'Full name is required').max(200, 'Keep this under 200 characters'),
  admissionNumber: z
    .string()
    .trim()
    .min(1, 'Admission number is required')
    .max(60, 'Keep this under 60 characters'),
  dateOfBirth: z.string().optional(),
  guardianName: z.string().trim().max(200, 'Keep this under 200 characters').optional(),
  guardianContact: z.string().trim().max(50, 'Keep this under 50 characters').optional(),
});

type FormValues = z.infer<typeof schema>;

const EMPTY_FORM: FormValues = {
  schoolId: '',
  fullName: '',
  admissionNumber: '',
  dateOfBirth: undefined,
  guardianName: undefined,
  guardianContact: undefined,
};

type Props = {
  open: boolean;
  onClose: () => void;
};

function AddStudentModal({ open, onClose }: Props) {
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
    defaultValues: EMPTY_FORM,
    mode: 'onTouched',
  });

  const schoolsQuery = useQuery({
    queryKey: ['schools'],
    queryFn: fetchSchools,
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (open) {
      reset(EMPTY_FORM);
    }
  }, [open, reset]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const payload: CreateStudentInput = {
        schoolId: values.schoolId,
        fullName: values.fullName.trim(),
        admissionNumber: values.admissionNumber.trim(),
        dateOfBirth: values.dateOfBirth || undefined,
        guardianName: values.guardianName?.trim() || undefined,
        guardianContact: values.guardianContact?.trim() || undefined,
      };
      return createStudent(payload);
    },
    onSuccess: (student) => {
      message.success(`${student.fullName} added`);
      void queryClient.invalidateQueries({ queryKey: STUDENTS_QUERY_KEY });
      onClose();
    },
    onError: (error) => {
      if (error instanceof DuplicateAdmissionNumberError) {
        setError('admissionNumber', { type: 'server', message: error.message });
        return;
      }
      message.error('Could not add the student. Please try again.');
    },
  });

  const submit = handleSubmit((values) => mutation.mutate(values));

  const schoolOptions = (schoolsQuery.data ?? []).map((school) => ({
    value: school.id,
    label: school.name,
  }));
  const noSchools = schoolsQuery.isSuccess && schoolOptions.length === 0;

  return (
    <Modal
      title="Add student"
      open={open}
      onCancel={onClose}
      onOk={submit}
      okText="Add student"
      confirmLoading={mutation.isPending}
      okButtonProps={{ disabled: schoolsQuery.isLoading || noSchools }}
      destroyOnClose
      maskClosable={!mutation.isPending}
    >
      {schoolsQuery.isError && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="Couldn't load the school list"
          description="Try reopening this dialog. If it keeps failing, the schools endpoint may be unavailable."
        />
      )}
      {noSchools && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="No schools found for your account"
          description="A student must belong to a school. Ask an administrator to set one up first."
        />
      )}

      <Form layout="vertical" requiredMark="optional" onFinish={submit}>
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
                data-testid="student-school-select"
                placeholder="Select a school"
                loading={schoolsQuery.isLoading}
                options={schoolOptions}
                showSearch
                optionFilterProp="label"
              />
            </Form.Item>
          )}
        />

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
              <Input
                {...field}
                data-testid="student-fullname-input"
                placeholder="e.g. Priya Sharma"
                autoComplete="off"
              />
            </Form.Item>
          )}
        />

        <Controller
          control={control}
          name="admissionNumber"
          render={({ field }) => (
            <Form.Item
              label="Admission number"
              required
              validateStatus={errors.admissionNumber ? 'error' : undefined}
              help={errors.admissionNumber?.message}
            >
              <Input
                {...field}
                data-testid="student-admission-input"
                placeholder="e.g. ADM-2026-001"
                autoComplete="off"
              />
            </Form.Item>
          )}
        />

        <Controller
          control={control}
          name="dateOfBirth"
          render={({ field }) => (
            <Form.Item
              label="Date of birth"
              validateStatus={errors.dateOfBirth ? 'error' : undefined}
              help={errors.dateOfBirth?.message}
            >
              <DatePicker
                style={{ width: '100%' }}
                value={field.value ? dayjs(field.value) : null}
                onChange={(date) => field.onChange(date ? date.format('YYYY-MM-DD') : undefined)}
                disabledDate={(date) => date.isAfter(dayjs(), 'day')}
              />
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
              <Input
                {...field}
                value={field.value ?? ''}
                placeholder="e.g. Anil Sharma"
                autoComplete="off"
              />
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
              <Input
                {...field}
                value={field.value ?? ''}
                placeholder="Phone or email"
                autoComplete="off"
              />
            </Form.Item>
          )}
        />

        <Text type="secondary" style={{ fontSize: 12 }}>
          The student is created with status <Text code>ACTIVE</Text>.
        </Text>
      </Form>
    </Modal>
  );
}

export default AddStudentModal;
