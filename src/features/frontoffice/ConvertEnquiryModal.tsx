import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, DatePicker, Descriptions, Form, Input, Modal, Select, Typography } from 'antd';
import dayjs from 'dayjs';
import { convertEnquiryToStudent, type Enquiry } from '../../api/enquiries';
import { DuplicateAdmissionNumberError, fetchSchools } from '../../api/students';
import { fetchClasses } from '../../api/classes';
import { buildSectionSelectOptions } from '../classes/sectionLookup';
import { CLASSES_QUERY_KEY } from '../classes/queryKeys';
import { ENQUIRIES_KEY, ENQUIRY_KEY, ENQUIRY_SUMMARY_KEY } from './queryKeys';
import { STUDENTS_QUERY_KEY } from '../students/queryKeys';

const { Text, Paragraph } = Typography;

/** The enquiry only ever has one combined name; the admission form needs first/last separately. */
function splitApplicantName(applicantName: string): { firstName: string; lastName: string } {
  const parts = applicantName.trim().split(/\s+/);
  const firstName = parts[0] ?? applicantName.trim();
  const lastName = parts.length > 1 ? parts.slice(1).join(' ') : firstName;
  return { firstName, lastName };
}

const schema = z.object({
  schoolId: z.string().min(1, 'Select a school'),
  admissionNumber: z.string().trim().min(1, 'An admission number is required').max(60),
  dateOfBirth: z.string().min(1, 'Pick a date of birth'),
  gender: z.string().optional(),
  admissionDate: z.string().optional(),
  sectionId: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const EMPTY: FormValues = {
  schoolId: '',
  admissionNumber: '',
  dateOfBirth: '',
  gender: '',
  admissionDate: '',
  sectionId: '',
};

type Props = {
  /** The enquiry to convert, or null when the modal is closed. */
  enquiry: Enquiry | null;
  onClose: () => void;
  onConverted?: (studentId: string) => void;
};

/**
 * "Convert to Student" -- the enquiry only ever has the lead fields it already
 * collected (name, guardian, phone, email, class); this asks only for what
 * a real admission additionally needs (school, admission number, DOB, ...)
 * and submits through the same student-creation path the Students module
 * itself uses (`StudentService#create` on the backend, unchanged).
 */
function ConvertEnquiryModal({ enquiry, onClose, onConverted }: Props) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const open = enquiry !== null;

  const schoolsQuery = useQuery({ queryKey: ['schools'], queryFn: fetchSchools, enabled: open });
  const classesQuery = useQuery({ queryKey: CLASSES_QUERY_KEY, queryFn: fetchClasses, enabled: open });
  const sectionOptions = buildSectionSelectOptions(classesQuery.data);

  const {
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: EMPTY, mode: 'onTouched' });

  useEffect(() => {
    if (open) reset(EMPTY);
  }, [open, reset]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      if (!enquiry) return Promise.reject(new Error('No enquiry'));
      const { firstName, lastName } = splitApplicantName(enquiry.applicantName);
      return convertEnquiryToStudent(enquiry.id, {
        schoolId: values.schoolId,
        firstName,
        lastName,
        dateOfBirth: values.dateOfBirth,
        admissionNumber: values.admissionNumber.trim(),
        gender: (values.gender || undefined) as 'MALE' | 'FEMALE' | 'OTHER' | undefined,
        admissionDate: values.admissionDate || undefined,
        sectionId: values.sectionId || undefined,
        guardianName: enquiry.guardianName ?? undefined,
        guardianPhone: enquiry.phone ?? undefined,
        guardianEmail: enquiry.email ?? undefined,
      });
    },
    onSuccess: (result) => {
      message.success(`${result.student.fullName} admitted as a student (${result.student.admissionNumber})`);
      void queryClient.invalidateQueries({ queryKey: ENQUIRIES_KEY });
      void queryClient.invalidateQueries({ queryKey: ENQUIRY_SUMMARY_KEY });
      void queryClient.invalidateQueries({ queryKey: STUDENTS_QUERY_KEY });
      if (enquiry) void queryClient.invalidateQueries({ queryKey: [...ENQUIRY_KEY, enquiry.id] });
      onConverted?.(result.student.id);
      onClose();
    },
    onError: (error) => {
      if (error instanceof DuplicateAdmissionNumberError) {
        setError('admissionNumber', { type: 'server', message: error.message });
        return;
      }
      message.error('Could not convert this enquiry. Please try again.');
    },
  });

  const submit = handleSubmit((values) => mutation.mutate(values));
  const alreadyConverted = Boolean(enquiry?.convertedStudentId);

  return (
    <Modal
      title={enquiry ? `Convert to student — ${enquiry.applicantName}` : 'Convert to student'}
      open={open}
      onCancel={onClose}
      onOk={submit}
      okText="Convert to student"
      confirmLoading={mutation.isPending}
      okButtonProps={{ disabled: alreadyConverted }}
      destroyOnClose
      maskClosable={!mutation.isPending}
    >
      {alreadyConverted ? (
        <Alert type="info" showIcon message="This enquiry has already been converted to a student." />
      ) : (
        <>
          <Paragraph type="secondary">
            Carried over from the enquiry -- edit these later from the student's own record if needed.
          </Paragraph>
          <Descriptions size="small" column={1} bordered style={{ marginBottom: 16 }}>
            <Descriptions.Item label="Name">{enquiry?.applicantName}</Descriptions.Item>
            <Descriptions.Item label="Guardian">{enquiry?.guardianName || <Text type="secondary">—</Text>}</Descriptions.Item>
            <Descriptions.Item label="Phone">{enquiry?.phone || <Text type="secondary">—</Text>}</Descriptions.Item>
            <Descriptions.Item label="Email">{enquiry?.email || <Text type="secondary">—</Text>}</Descriptions.Item>
          </Descriptions>

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
                    loading={schoolsQuery.isLoading}
                    options={(schoolsQuery.data ?? []).map((s) => ({ value: s.id, label: s.name }))}
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
                  <Input {...field} autoComplete="off" />
                </Form.Item>
              )}
            />
            <Controller
              control={control}
              name="dateOfBirth"
              render={({ field }) => (
                <Form.Item
                  label="Date of birth"
                  required
                  validateStatus={errors.dateOfBirth ? 'error' : undefined}
                  help={errors.dateOfBirth?.message}
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
              name="gender"
              render={({ field }) => (
                <Form.Item label="Gender" help="Optional">
                  <Select
                    {...field}
                    allowClear
                    options={[
                      { value: 'MALE', label: 'Male' },
                      { value: 'FEMALE', label: 'Female' },
                      { value: 'OTHER', label: 'Other' },
                    ]}
                  />
                </Form.Item>
              )}
            />
            <Controller
              control={control}
              name="admissionDate"
              render={({ field }) => (
                <Form.Item label="Admission date" help="Defaults to today">
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
              name="sectionId"
              render={({ field }) => (
                <Form.Item label="Section" help="Optional">
                  <Select {...field} allowClear placeholder="Select a section" options={sectionOptions} />
                </Form.Item>
              )}
            />
          </Form>
        </>
      )}
    </Modal>
  );
}

export default ConvertEnquiryModal;
