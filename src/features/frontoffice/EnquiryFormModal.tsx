import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App, Button, Col, DatePicker, Form, Input, InputNumber, Modal, Row, Select, theme } from 'antd';
import { CloseOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { isAxiosError } from 'axios';
import {
  createEnquiry,
  fetchAssignableStaff,
  fetchEnquiryReferences,
  fetchEnquirySources,
  updateEnquiry,
  type Enquiry,
  type EnquiryInput,
} from '../../api/enquiries';
import { fetchClasses } from '../../api/classes';
import { API_DATE_FORMAT, DISPLAY_DATE_FORMAT, todayApiDate } from '../../lib/dates';
import {
  ASSIGNABLE_STAFF_KEY,
  ENQUIRIES_KEY,
  ENQUIRY_KEY,
  ENQUIRY_REFERENCES_KEY,
  ENQUIRY_SOURCES_KEY,
  ENQUIRY_SUMMARY_KEY,
} from './queryKeys';
import { CLASSES_QUERY_KEY } from '../classes/queryKeys';

/** Same rule as the backend's `EnquiryDtos.PHONE_PATTERN`. */
const PHONE_PATTERN = /^\+?[0-9][0-9 ()-]{4,28}[0-9]$/;

const schema = z
  .object({
    applicantName: z.string().trim().min(1, 'Name is required').max(200, 'Keep this under 200 characters'),
    phone: z.string().trim().min(1, 'Phone is required').regex(PHONE_PATTERN, 'Enter a valid phone number'),
    email: z.string().trim().max(200).email('Enter a valid email').or(z.literal('')),
    address: z.string().max(1000, 'Keep this under 1000 characters'),
    description: z.string().max(2000, 'Keep this under 2000 characters'),
    remarks: z.string().max(2000, 'Keep this under 2000 characters'),
    enquiryDate: z.string().min(1, 'Date is required'),
    nextFollowUpDate: z.string().min(1, 'Next follow up date is required'),
    assignedStaffUserId: z.string(),
    referenceId: z.string(),
    sourceId: z.string().min(1, 'Source is required'),
    classId: z.string(),
    numberOfChildren: z.number().int('Whole numbers only').min(0).max(99, 'At most 99').nullable(),
  })
  .refine((v) => !v.enquiryDate || !v.nextFollowUpDate || v.nextFollowUpDate >= v.enquiryDate, {
    path: ['nextFollowUpDate'],
    message: "Can't be before the enquiry date",
  });

type FormValues = z.infer<typeof schema>;

function emptyForm(): FormValues {
  const today = todayApiDate();
  return {
    applicantName: '',
    phone: '',
    email: '',
    address: '',
    description: '',
    remarks: '',
    enquiryDate: today,
    nextFollowUpDate: today,
    assignedStaffUserId: '',
    referenceId: '',
    sourceId: '',
    classId: '',
    numberOfChildren: null,
  };
}

function fromEnquiry(e: Enquiry): FormValues {
  return {
    applicantName: e.applicantName,
    phone: e.phone ?? '',
    email: e.email ?? '',
    address: e.address ?? '',
    description: e.description ?? '',
    remarks: e.remarks ?? '',
    enquiryDate: e.enquiryDate,
    nextFollowUpDate: e.followUpDate ?? '',
    assignedStaffUserId: e.assignedStaffUserId ?? '',
    referenceId: e.referenceId ?? '',
    sourceId: e.sourceId ?? '',
    classId: e.classId ?? '',
    numberOfChildren: e.numberOfChildren,
  };
}

function toInput(v: FormValues): EnquiryInput {
  const orNull = (s: string) => s.trim() || null;
  return {
    applicantName: v.applicantName.trim(),
    phone: v.phone.trim(),
    email: orNull(v.email),
    address: orNull(v.address),
    description: orNull(v.description),
    remarks: orNull(v.remarks),
    enquiryDate: v.enquiryDate,
    nextFollowUpDate: v.nextFollowUpDate,
    assignedStaffUserId: v.assignedStaffUserId || null,
    referenceId: v.referenceId || null,
    sourceId: v.sourceId,
    classId: v.classId || null,
    numberOfChildren: v.numberOfChildren,
  };
}

/** The backend's problem+json `detail`, when it sent one (400/404 validation messages). */
function serverMessage(error: unknown): string | undefined {
  if (isAxiosError(error)) {
    const detail = (error.response?.data as { detail?: unknown } | undefined)?.detail;
    if (typeof detail === 'string' && detail) return detail;
  }
  return undefined;
}

type Props = {
  open: boolean;
  /** The enquiry being edited; null/undefined = adding a new one. */
  enquiry?: Enquiry | null;
  onClose: () => void;
};

/** The Admission Enquiry form, used for both Add and Edit. */
function EnquiryFormModal({ open, enquiry, onClose }: Props) {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const editing = Boolean(enquiry);

  const sourcesQuery = useQuery({ queryKey: ENQUIRY_SOURCES_KEY, queryFn: fetchEnquirySources, enabled: open });
  const referencesQuery = useQuery({ queryKey: ENQUIRY_REFERENCES_KEY, queryFn: fetchEnquiryReferences, enabled: open });
  const staffQuery = useQuery({ queryKey: ASSIGNABLE_STAFF_KEY, queryFn: fetchAssignableStaff, enabled: open });
  const classesQuery = useQuery({ queryKey: CLASSES_QUERY_KEY, queryFn: fetchClasses, enabled: open });

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: emptyForm(), mode: 'onTouched' });

  useEffect(() => {
    if (open) reset(enquiry ? fromEnquiry(enquiry) : emptyForm());
  }, [open, enquiry, reset]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      enquiry ? updateEnquiry(enquiry.id, toInput(values)) : createEnquiry(toInput(values)),
    onSuccess: (saved) => {
      message.success(editing ? 'Enquiry updated' : `Enquiry ${saved.enquiryNumber} added`);
      void queryClient.invalidateQueries({ queryKey: ENQUIRIES_KEY });
      void queryClient.invalidateQueries({ queryKey: ENQUIRY_SUMMARY_KEY });
      void queryClient.invalidateQueries({ queryKey: [...ENQUIRY_KEY, saved.id] });
      onClose();
    },
    onError: (error) => {
      message.error(serverMessage(error) ?? `Could not ${editing ? 'update' : 'save'} the enquiry. Please try again.`);
    },
  });

  const submit = handleSubmit((values) => mutation.mutate(values));

  const fieldError = (name: keyof FormValues) =>
    errors[name] ? { validateStatus: 'error' as const, help: errors[name]?.message } : {};

  // Links each label to its input (clicking the label focuses it; screen readers announce it).
  const fid = (name: keyof FormValues) => `enquiry-form-${name}`;

  const dateField = (name: 'enquiryDate' | 'nextFollowUpDate', label: string) => (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <Form.Item label={label} htmlFor={fid(name)} required {...fieldError(name)}>
          <DatePicker
            id={fid(name)}
            style={{ width: '100%' }}
            format={DISPLAY_DATE_FORMAT}
            allowClear={false}
            value={field.value ? dayjs(field.value) : null}
            onChange={(d) => field.onChange(d ? d.format(API_DATE_FORMAT) : '')}
            onBlur={field.onBlur}
          />
        </Form.Item>
      )}
    />
  );

  const textArea = (name: 'address' | 'description' | 'remarks', label: string) => (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <Form.Item label={label} htmlFor={fid(name)} {...fieldError(name)}>
          <Input.TextArea {...field} id={fid(name)} rows={2} />
        </Form.Item>
      )}
    />
  );

  const lookupSelect = (
    name: 'assignedStaffUserId' | 'referenceId' | 'sourceId' | 'classId',
    label: string,
    options: { value: string; label: string }[],
    loading: boolean,
    required = false,
  ) => (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <Form.Item label={label} htmlFor={fid(name)} required={required} {...fieldError(name)}>
          <Select
            id={fid(name)}
            placeholder="Select"
            allowClear={!required}
            showSearch
            optionFilterProp="label"
            loading={loading}
            options={options}
            value={field.value || undefined}
            onChange={(v) => field.onChange(v ?? '')}
            onBlur={field.onBlur}
          />
        </Form.Item>
      )}
    />
  );

  return (
    <Modal
      title={
        <span style={{ color: token.colorWhite, fontSize: token.fontSizeLG, fontWeight: 500 }}>
          {editing ? 'Edit Admission Enquiry' : 'Admission Enquiry'}
        </span>
      }
      open={open}
      onCancel={onClose}
      width={960}
      destroyOnHidden
      maskClosable={!mutation.isPending}
      styles={{
        content: { padding: 0, overflow: 'hidden' },
        header: { background: token.colorPrimary, padding: `${token.paddingSM}px ${token.paddingLG}px`, margin: 0 },
        body: { padding: `${token.paddingMD}px ${token.paddingLG}px 0` },
        footer: {
          borderTop: `1px solid ${token.colorBorderSecondary}`,
          padding: `${token.paddingSM}px ${token.paddingLG}px`,
          margin: 0,
        },
      }}
      closeIcon={<CloseOutlined style={{ color: token.colorWhite, fontSize: 16 }} />}
      footer={
        <Button type="primary" onClick={submit} loading={mutation.isPending}>
          Save
        </Button>
      }
    >
      <Form layout="vertical" onFinish={submit} data-testid="enquiry-form">
        <Row gutter={token.marginMD}>
          <Col xs={24} md={8}>
            <Controller
              control={control}
              name="applicantName"
              render={({ field }) => (
                <Form.Item label="Name" htmlFor={fid('applicantName')} required {...fieldError('applicantName')}>
                  <Input {...field} id={fid('applicantName')} autoComplete="off" autoFocus />
                </Form.Item>
              )}
            />
          </Col>
          <Col xs={24} md={8}>
            <Controller
              control={control}
              name="phone"
              render={({ field }) => (
                <Form.Item label="Phone" htmlFor={fid('phone')} required {...fieldError('phone')}>
                  <Input {...field} id={fid('phone')} autoComplete="off" inputMode="tel" />
                </Form.Item>
              )}
            />
          </Col>
          <Col xs={24} md={8}>
            <Controller
              control={control}
              name="email"
              render={({ field }) => (
                <Form.Item label="Email" htmlFor={fid('email')} {...fieldError('email')}>
                  <Input {...field} id={fid('email')} autoComplete="off" inputMode="email" />
                </Form.Item>
              )}
            />
          </Col>

          <Col xs={24} md={8}>{textArea('address', 'Address')}</Col>
          <Col xs={24} md={8}>{textArea('description', 'Description')}</Col>
          <Col xs={24} md={8}>{textArea('remarks', 'Note')}</Col>

          <Col xs={24} md={8}>{dateField('enquiryDate', 'Date')}</Col>
          <Col xs={24} md={8}>{dateField('nextFollowUpDate', 'Next Follow Up Date')}</Col>
          <Col xs={24} md={8}>
            {lookupSelect(
              'assignedStaffUserId',
              'Assigned',
              (staffQuery.data ?? []).map((s) => ({ value: s.id, label: s.fullName })),
              staffQuery.isLoading,
            )}
          </Col>

          <Col xs={24} sm={12} md={6}>
            {lookupSelect(
              'referenceId',
              'Reference',
              (referencesQuery.data ?? []).map((r) => ({ value: r.id, label: r.name })),
              referencesQuery.isLoading,
            )}
          </Col>
          <Col xs={24} sm={12} md={6}>
            {lookupSelect(
              'sourceId',
              'Source',
              (sourcesQuery.data ?? []).map((s) => ({ value: s.id, label: s.name })),
              sourcesQuery.isLoading,
              true,
            )}
          </Col>
          <Col xs={24} sm={12} md={6}>
            {lookupSelect(
              'classId',
              'Class',
              (classesQuery.data ?? []).map((c) => ({ value: c.id, label: c.name })),
              classesQuery.isLoading,
            )}
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Controller
              control={control}
              name="numberOfChildren"
              render={({ field }) => (
                <Form.Item label="Number Of Child" htmlFor={fid('numberOfChildren')} {...fieldError('numberOfChildren')}>
                  <InputNumber
                    id={fid('numberOfChildren')}
                    style={{ width: '100%' }}
                    min={0}
                    max={99}
                    precision={0}
                    value={field.value}
                    onChange={(v) => field.onChange(typeof v === 'number' ? v : null)}
                    onBlur={field.onBlur}
                  />
                </Form.Item>
              )}
            />
          </Col>
        </Row>
        {/* Lets Enter submit from any single-line field. */}
        <button type="submit" hidden aria-hidden />
      </Form>
    </Modal>
  );
}

export default EnquiryFormModal;
