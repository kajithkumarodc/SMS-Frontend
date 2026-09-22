import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App, DatePicker, Form, Input, Modal, Select, Space } from 'antd';
import dayjs from 'dayjs';
import { createEnquiry, fetchAssignableStaff, fetchEnquirySources } from '../../api/enquiries';
import { fetchClasses } from '../../api/classes';
import { ASSIGNABLE_STAFF_KEY, ENQUIRIES_KEY, ENQUIRY_SOURCES_KEY, ENQUIRY_SUMMARY_KEY } from './queryKeys';
import { CLASSES_QUERY_KEY } from '../classes/queryKeys';

const schema = z.object({
  applicantName: z.string().trim().min(1, 'Applicant name is required').max(200, 'Keep this under 200 characters'),
  guardianName: z.string().trim().max(200).optional(),
  phone: z.string().trim().max(30).optional(),
  email: z.string().trim().email('Enter a valid email').max(200).optional().or(z.literal('')),
  classId: z.string().optional(),
  enquiryDate: z.string().optional(),
  sourceId: z.string().optional(),
  assignedStaffUserId: z.string().optional(),
  remarks: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const EMPTY: FormValues = {
  applicantName: '',
  guardianName: '',
  phone: '',
  email: '',
  classId: '',
  enquiryDate: '',
  sourceId: '',
  assignedStaffUserId: '',
  remarks: '',
};

type Props = {
  open: boolean;
  onClose: () => void;
};

function AddEnquiryModal({ open, onClose }: Props) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();

  const sourcesQuery = useQuery({ queryKey: ENQUIRY_SOURCES_KEY, queryFn: fetchEnquirySources, enabled: open });
  const staffQuery = useQuery({ queryKey: ASSIGNABLE_STAFF_KEY, queryFn: fetchAssignableStaff, enabled: open });
  const classesQuery = useQuery({ queryKey: CLASSES_QUERY_KEY, queryFn: fetchClasses, enabled: open });

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: EMPTY, mode: 'onTouched' });

  useEffect(() => {
    if (open) reset(EMPTY);
  }, [open, reset]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      createEnquiry({
        applicantName: values.applicantName.trim(),
        guardianName: values.guardianName?.trim() || null,
        phone: values.phone?.trim() || null,
        email: values.email?.trim() || null,
        classId: values.classId || null,
        enquiryDate: values.enquiryDate || null,
        sourceId: values.sourceId || null,
        assignedStaffUserId: values.assignedStaffUserId || null,
        remarks: values.remarks?.trim() || null,
      }),
    onSuccess: (enquiry) => {
      message.success(`Enquiry ${enquiry.enquiryNumber} created`);
      void queryClient.invalidateQueries({ queryKey: ENQUIRIES_KEY });
      void queryClient.invalidateQueries({ queryKey: ENQUIRY_SUMMARY_KEY });
      onClose();
    },
    onError: () => {
      message.error('Could not create the enquiry. Please try again.');
    },
  });

  const submit = handleSubmit((values) => mutation.mutate(values));

  return (
    <Modal
      title="New admission enquiry"
      open={open}
      onCancel={onClose}
      onOk={submit}
      okText="Create enquiry"
      confirmLoading={mutation.isPending}
      destroyOnClose
      maskClosable={!mutation.isPending}
    >
      <Form layout="vertical" requiredMark="optional" onFinish={submit}>
        <Controller
          control={control}
          name="applicantName"
          render={({ field }) => (
            <Form.Item
              label="Applicant / student name"
              required
              validateStatus={errors.applicantName ? 'error' : undefined}
              help={errors.applicantName?.message}
            >
              <Input {...field} autoComplete="off" />
            </Form.Item>
          )}
        />
        <Controller
          control={control}
          name="guardianName"
          render={({ field }) => (
            <Form.Item label="Parent / guardian name" help="Optional">
              <Input {...field} autoComplete="off" />
            </Form.Item>
          )}
        />
        <Space.Compact block>
          <Controller
            control={control}
            name="phone"
            render={({ field }) => (
              <Form.Item label="Phone" style={{ width: '50%' }} help="Optional">
                <Input {...field} autoComplete="off" />
              </Form.Item>
            )}
          />
          <Controller
            control={control}
            name="email"
            render={({ field }) => (
              <Form.Item
                label="Email"
                style={{ width: '50%' }}
                validateStatus={errors.email ? 'error' : undefined}
                help={errors.email?.message ?? 'Optional'}
              >
                <Input {...field} autoComplete="off" />
              </Form.Item>
            )}
          />
        </Space.Compact>
        <Controller
          control={control}
          name="classId"
          render={({ field }) => (
            <Form.Item label="Class interested in" help="Optional">
              <Select
                {...field}
                allowClear
                placeholder="Select a class"
                loading={classesQuery.isLoading}
                options={(classesQuery.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
              />
            </Form.Item>
          )}
        />
        <Controller
          control={control}
          name="enquiryDate"
          render={({ field }) => (
            <Form.Item label="Enquiry date" help="Defaults to today">
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
          name="sourceId"
          render={({ field }) => (
            <Form.Item label="Source" help="Optional">
              <Select
                {...field}
                allowClear
                placeholder="Select a source"
                loading={sourcesQuery.isLoading}
                options={(sourcesQuery.data ?? []).map((s) => ({ value: s.id, label: s.name }))}
              />
            </Form.Item>
          )}
        />
        <Controller
          control={control}
          name="assignedStaffUserId"
          render={({ field }) => (
            <Form.Item label="Assigned to" help="Optional">
              <Select
                {...field}
                allowClear
                showSearch
                placeholder="Select a staff member"
                loading={staffQuery.isLoading}
                optionFilterProp="label"
                options={(staffQuery.data ?? []).map((s) => ({ value: s.id, label: `${s.fullName} (${s.email})` }))}
              />
            </Form.Item>
          )}
        />
        <Controller
          control={control}
          name="remarks"
          render={({ field }) => (
            <Form.Item label="Remarks" help="Optional">
              <Input.TextArea {...field} rows={2} />
            </Form.Item>
          )}
        />
      </Form>
    </Modal>
  );
}

export default AddEnquiryModal;
