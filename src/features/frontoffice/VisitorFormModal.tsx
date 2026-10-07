import { useEffect, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  App,
  Button,
  Col,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  TimePicker,
  Typography,
  Upload,
  theme,
} from 'antd';
import { CloseOutlined, CloudUploadOutlined, DeleteOutlined, PaperClipOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  createVisitor,
  fetchFrontOfficePurposes,
  fetchMeetingOptions,
  removeVisitorAttachment,
  updateVisitor,
  uploadVisitorAttachment,
  type MeetingWithType,
  type Visitor,
  type VisitorInput,
} from '../../api/visitors';
import {
  API_DATE_FORMAT,
  API_TIME_FORMAT,
  DISPLAY_DATE_FORMAT,
  DISPLAY_TIME_FORMAT,
  parseApiTime,
  todayApiDate,
} from '../../lib/dates';
import { serverMessage } from '../../lib/apiErrors';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { FRONT_OFFICE_PURPOSES_KEY, MEETING_OPTIONS_KEY, VISITORS_KEY, VISITOR_KEY } from './queryKeys';

const { Text } = Typography;

/** Same rule as the backend's `EnquiryDtos.PHONE_PATTERN`. */
const PHONE_PATTERN = /^\+?[0-9][0-9 ()-]{4,28}[0-9]$/;
/** Mirrors the backend's upload allow-list and cap (`StudentDocumentService`). */
const ALLOWED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
const MAX_FILE_BYTES = 10 * 1024 * 1024;

const MEETING_WITH_OPTIONS: { value: MeetingWithType; label: string }[] = [
  { value: 'STAFF', label: 'Staff' },
  { value: 'STUDENT', label: 'Student' },
];

const schema = z
  .object({
    purposeId: z.string().min(1, 'Purpose is required'),
    meetingWithType: z.string().min(1, 'Meeting with is required'),
    personId: z.string(),
    visitorName: z.string().trim().min(1, 'Visitor name is required').max(200, 'Keep this under 200 characters'),
    phone: z
      .string()
      .trim()
      .refine((v) => v === '' || PHONE_PATTERN.test(v), 'Enter a valid phone number'),
    idCard: z.string().trim().max(100, 'Keep this under 100 characters'),
    numberOfPersons: z.number().int('Whole numbers only').min(1, 'At least 1').max(999, 'At most 999').nullable(),
    visitDate: z.string().min(1, 'Date is required'),
    inTime: z.string(),
    outTime: z.string(),
    note: z.string().max(2000, 'Keep this under 2000 characters'),
  })
  .refine((v) => !v.meetingWithType || v.personId, {
    path: ['personId'],
    message: 'Choose whom the visitor is meeting',
  })
  .refine((v) => !v.inTime || !v.outTime || v.outTime >= v.inTime, {
    path: ['outTime'],
    message: "Can't be before in time",
  });

type FormValues = z.infer<typeof schema>;

function emptyForm(): FormValues {
  return {
    purposeId: '',
    meetingWithType: '',
    personId: '',
    visitorName: '',
    phone: '',
    idCard: '',
    numberOfPersons: null,
    visitDate: todayApiDate(),
    // A visitor is usually logged on arrival: in time now, out time filled in when they leave.
    inTime: dayjs().format(API_TIME_FORMAT),
    outTime: '',
    note: '',
  };
}

function fromVisitor(v: Visitor): FormValues {
  return {
    purposeId: v.purposeId,
    meetingWithType: v.meetingWithType,
    personId: (v.meetingWithType === 'STAFF' ? v.staffProfileId : v.studentId) ?? '',
    visitorName: v.visitorName,
    phone: v.phone ?? '',
    idCard: v.idCard ?? '',
    numberOfPersons: v.numberOfPersons,
    visitDate: v.visitDate,
    inTime: parseApiTime(v.inTime)?.format(API_TIME_FORMAT) ?? '',
    outTime: parseApiTime(v.outTime)?.format(API_TIME_FORMAT) ?? '',
    note: v.note ?? '',
  };
}

function toInput(v: FormValues): VisitorInput {
  const type = v.meetingWithType as MeetingWithType;
  return {
    purposeId: v.purposeId,
    meetingWithType: type,
    staffProfileId: type === 'STAFF' ? v.personId : null,
    studentId: type === 'STUDENT' ? v.personId : null,
    visitorName: v.visitorName.trim(),
    phone: v.phone.trim() || null,
    idCard: v.idCard.trim() || null,
    numberOfPersons: v.numberOfPersons,
    visitDate: v.visitDate,
    inTime: v.inTime || null,
    outTime: v.outTime || null,
    note: v.note.trim() || null,
  };
}

type Props = {
  open: boolean;
  /** The visitor being edited; null/undefined = adding a new one. */
  visitor?: Visitor | null;
  onClose: () => void;
};

/** The Add/Edit Visitor form. The document is uploaded right after the visitor is saved. */
function VisitorFormModal({ open, visitor, onClose }: Props) {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const editing = Boolean(visitor);

  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [removeExisting, setRemoveExisting] = useState(false);
  const [fileError, setFileError] = useState<string>();
  const [personSearch, setPersonSearch] = useState('');
  const debouncedPersonSearch = useDebouncedValue(personSearch.trim(), 250);

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: emptyForm(), mode: 'onTouched' });
  const meetingWithType = useWatch({ control, name: 'meetingWithType' }) as MeetingWithType | '';

  useEffect(() => {
    if (!open) return;
    reset(visitor ? fromVisitor(visitor) : emptyForm());
    setPendingFile(null);
    setRemoveExisting(false);
    setFileError(undefined);
    setPersonSearch('');
  }, [open, visitor, reset]);

  const purposesQuery = useQuery({ queryKey: FRONT_OFFICE_PURPOSES_KEY, queryFn: fetchFrontOfficePurposes, enabled: open });
  const peopleQuery = useQuery({
    queryKey: [...MEETING_OPTIONS_KEY, meetingWithType, debouncedPersonSearch],
    queryFn: () => fetchMeetingOptions(meetingWithType as MeetingWithType, debouncedPersonSearch || undefined),
    enabled: open && Boolean(meetingWithType),
  });

  // Keep the saved person selectable while editing even if they're outside the first 20 search results.
  const personOptions = (peopleQuery.data ?? []).map((p) => ({ value: p.id, label: `${p.name} - ${p.code}` }));
  const savedPersonId = visitor && visitor.meetingWithType === meetingWithType
    ? (visitor.meetingWithType === 'STAFF' ? visitor.staffProfileId : visitor.studentId)
    : null;
  if (savedPersonId && !personOptions.some((o) => o.value === savedPersonId)) {
    personOptions.unshift({ value: savedPersonId, label: `${visitor!.meetingWithName ?? ''} - ${visitor!.meetingWithCode ?? ''}` });
  }

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const saved = visitor ? await updateVisitor(visitor.id, toInput(values)) : await createVisitor(toInput(values));
      try {
        if (pendingFile) return { saved: await uploadVisitorAttachment(saved.id, pendingFile), attachmentError: undefined };
        if (removeExisting && saved.attachment) return { saved: await removeVisitorAttachment(saved.id), attachmentError: undefined };
      } catch (error) {
        return { saved, attachmentError: serverMessage(error) ?? 'Please try attaching it again.' };
      }
      return { saved, attachmentError: undefined };
    },
    onSuccess: ({ saved, attachmentError }) => {
      if (attachmentError) {
        message.warning(`Visitor saved, but the document couldn't be attached. ${attachmentError}`);
      } else {
        message.success(editing ? 'Visitor updated' : `Visitor ${saved.visitorName} added`);
      }
      void queryClient.invalidateQueries({ queryKey: VISITORS_KEY });
      void queryClient.invalidateQueries({ queryKey: [...VISITOR_KEY, saved.id] });
      onClose();
    },
    onError: (error) => {
      message.error(serverMessage(error) ?? `Could not ${editing ? 'update' : 'save'} the visitor. Please try again.`);
    },
  });

  const submit = handleSubmit((values) => mutation.mutate(values));
  const fieldError = (name: keyof FormValues) =>
    errors[name] ? { validateStatus: 'error' as const, help: errors[name]?.message } : {};
  const fid = (name: keyof FormValues) => `visitor-form-${name}`;

  const pickFile = (file: File) => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      setFileError('Allowed files: PDF, JPG, PNG, WEBP, DOC, DOCX');
    } else if (file.size > MAX_FILE_BYTES) {
      setFileError('The file is larger than 10 MB');
    } else {
      setFileError(undefined);
      setPendingFile(file);
    }
    return false; // keep it local; it's uploaded after the visitor is saved
  };

  const shownFileName = pendingFile?.name ?? (!removeExisting ? visitor?.attachment?.fileName : undefined);

  const timeField = (name: 'inTime' | 'outTime', label: string) => (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <Form.Item label={label} htmlFor={fid(name)} {...fieldError(name)}>
          <TimePicker
            id={fid(name)}
            style={{ width: '100%' }}
            format={DISPLAY_TIME_FORMAT}
            use12Hours
            needConfirm={false}
            value={parseApiTime(field.value)}
            onChange={(t) => field.onChange(t ? t.format(API_TIME_FORMAT) : '')}
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
          {editing ? 'Edit Visitor' : 'Add Visitor'}
        </span>
      }
      open={open}
      onCancel={onClose}
      width={960}
      destroyOnHidden
      maskClosable={!mutation.isPending}
      closeIcon={<CloseOutlined style={{ color: token.colorWhite, fontSize: 16 }} />}
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
      footer={
        <Button type="primary" onClick={submit} loading={mutation.isPending}>
          Save
        </Button>
      }
    >
      <Form layout="vertical" onFinish={submit} data-testid="visitor-form">
        <Row gutter={token.marginMD}>
          <Col xs={24} md={8}>
            <Controller
              control={control}
              name="purposeId"
              render={({ field }) => (
                <Form.Item label="Purpose" htmlFor={fid('purposeId')} required {...fieldError('purposeId')}>
                  <Select
                    id={fid('purposeId')}
                    placeholder="Select"
                    showSearch
                    optionFilterProp="label"
                    loading={purposesQuery.isLoading}
                    options={(purposesQuery.data ?? []).map((p) => ({ value: p.id, label: p.name }))}
                    value={field.value || undefined}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                  />
                </Form.Item>
              )}
            />
          </Col>
          <Col xs={24} md={8}>
            <Controller
              control={control}
              name="meetingWithType"
              render={({ field }) => (
                <Form.Item label="Meeting With" htmlFor={fid('meetingWithType')} required {...fieldError('meetingWithType')}>
                  <Select
                    id={fid('meetingWithType')}
                    placeholder="Select"
                    options={MEETING_WITH_OPTIONS}
                    value={field.value || undefined}
                    onChange={(v) => {
                      field.onChange(v);
                      setValue('personId', '');
                      setPersonSearch('');
                    }}
                    onBlur={field.onBlur}
                  />
                </Form.Item>
              )}
            />
          </Col>
          <Col xs={24} md={8}>
            <Controller
              control={control}
              name="visitorName"
              render={({ field }) => (
                <Form.Item label="Visitor Name" htmlFor={fid('visitorName')} required {...fieldError('visitorName')}>
                  <Input {...field} id={fid('visitorName')} autoComplete="off" />
                </Form.Item>
              )}
            />
          </Col>

          <Col xs={24} md={8}>
            <Controller
              control={control}
              name="phone"
              render={({ field }) => (
                <Form.Item label="Phone" htmlFor={fid('phone')} {...fieldError('phone')}>
                  <Input {...field} id={fid('phone')} autoComplete="off" inputMode="tel" />
                </Form.Item>
              )}
            />
          </Col>
          <Col xs={24} md={16}>
            {meetingWithType && (
              <Controller
                control={control}
                name="personId"
                render={({ field }) => (
                  <Form.Item
                    label={meetingWithType === 'STAFF' ? 'Staff' : 'Student'}
                    htmlFor={fid('personId')}
                    required
                    {...fieldError('personId')}
                  >
                    <Select
                      id={fid('personId')}
                      placeholder={meetingWithType === 'STAFF' ? 'Search by name or staff ID' : 'Search by name or admission number'}
                      showSearch
                      filterOption={false}
                      onSearch={setPersonSearch}
                      loading={peopleQuery.isFetching}
                      notFoundContent={peopleQuery.isFetching ? 'Searching…' : 'No matches'}
                      options={personOptions}
                      value={field.value || undefined}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      style={{ maxWidth: 480 }}
                    />
                  </Form.Item>
                )}
              />
            )}
          </Col>

          <Col xs={24} md={8}>
            <Controller
              control={control}
              name="idCard"
              render={({ field }) => (
                <Form.Item label="ID Card" htmlFor={fid('idCard')} {...fieldError('idCard')}>
                  <Input {...field} id={fid('idCard')} autoComplete="off" />
                </Form.Item>
              )}
            />
          </Col>
          <Col xs={24} md={8}>
            <Controller
              control={control}
              name="numberOfPersons"
              render={({ field }) => (
                <Form.Item label="Number Of Person" htmlFor={fid('numberOfPersons')} {...fieldError('numberOfPersons')}>
                  <InputNumber
                    id={fid('numberOfPersons')}
                    style={{ width: '100%' }}
                    min={1}
                    max={999}
                    precision={0}
                    value={field.value}
                    onChange={(v) => field.onChange(typeof v === 'number' ? v : null)}
                    onBlur={field.onBlur}
                  />
                </Form.Item>
              )}
            />
          </Col>
          <Col xs={24} md={8}>
            <Controller
              control={control}
              name="visitDate"
              render={({ field }) => (
                <Form.Item label="Date" htmlFor={fid('visitDate')} required {...fieldError('visitDate')}>
                  <DatePicker
                    id={fid('visitDate')}
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
          </Col>

          <Col xs={24} md={8}>{timeField('inTime', 'In Time')}</Col>
          <Col xs={24} md={8}>{timeField('outTime', 'Out Time')}</Col>
          <Col xs={24} md={8}>
            <Form.Item
              label="Attach Document"
              validateStatus={fileError ? 'error' : undefined}
              help={fileError}
            >
              {shownFileName ? (
                <Space
                  style={{
                    width: '100%',
                    justifyContent: 'space-between',
                    border: `1px solid ${token.colorBorder}`,
                    borderRadius: token.borderRadius,
                    padding: `${token.paddingXXS}px ${token.paddingXS}px`,
                  }}
                >
                  <Text ellipsis style={{ maxWidth: 220 }}>
                    <PaperClipOutlined /> {shownFileName}
                  </Text>
                  <Button
                    type="text"
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    aria-label="Remove document"
                    onClick={() => {
                      if (pendingFile) setPendingFile(null);
                      else setRemoveExisting(true);
                    }}
                  />
                </Space>
              ) : (
                <Upload.Dragger
                  accept={ALLOWED_TYPES.join(',')}
                  multiple={false}
                  showUploadList={false}
                  beforeUpload={pickFile}
                  style={{ padding: 0 }}
                >
                  <Space size="small" style={{ paddingBlock: 2 }}>
                    <CloudUploadOutlined style={{ fontSize: 18, color: token.colorPrimary }} />
                    <span>Drag and drop a file here or click</span>
                  </Space>
                </Upload.Dragger>
              )}
            </Form.Item>
          </Col>

          <Col span={24}>
            <Controller
              control={control}
              name="note"
              render={({ field }) => (
                <Form.Item label="Note" htmlFor={fid('note')} {...fieldError('note')}>
                  <Input.TextArea {...field} id={fid('note')} rows={3} />
                </Form.Item>
              )}
            />
          </Col>
        </Row>
        <button type="submit" hidden aria-hidden />
      </Form>
    </Modal>
  );
}

export default VisitorFormModal;
