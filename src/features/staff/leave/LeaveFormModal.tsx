import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, Col, DatePicker, Form, Input, Modal, Radio, Row, Select, Space, Typography, theme } from 'antd';
import { CloseOutlined, DeleteOutlined, DownloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  approverFor,
  createLeaveRequest,
  fetchLeaveOptions,
  fetchLeaveStaff,
  HALF_DAY_LABEL,
  LEAVE_STATUS_LABEL,
  leaveAttachmentUrl,
  removeLeaveAttachment,
  updateLeaveRequest,
  uploadLeaveAttachment,
  type HalfDay,
  type LeaveInput,
  type LeaveRequestRow,
  type LeaveStatus,
} from '../../../api/leaveManagement';
import { API_DATE_FORMAT, DISPLAY_DATE_FORMAT, todayApiDate } from '../../../lib/dates';
import { serverMessage } from '../../../lib/apiErrors';
import { ALLOWED_UPLOAD_TYPES, uploadProblem } from '../../../lib/files';
import FilePicker from '../../students/admission/FilePicker';
import { LEAVE_OPTIONS_KEY, LEAVE_REQUESTS_KEY, LEAVE_STAFF_KEY } from './queryKeys';

const { Text } = Typography;

const schema = z
  .object({
    roleId: z.string().min(1, 'Role is required'),
    staffProfileId: z.string().min(1, 'Name is required'),
    applyDate: z.string().min(1, 'Apply date is required'),
    leaveTypeId: z.string().min(1, 'Leave type is required'),
    fromDate: z.string().min(1, 'Leave from date is required'),
    toDate: z.string().min(1, 'Leave to date is required'),
    halfDay: z.string(),
    reason: z.string().max(1000, 'Keep this under 1000 characters'),
    note: z.string().max(2000, 'Keep this under 2000 characters'),
    status: z.enum(['PENDING', 'APPROVED', 'REJECTED']),
  })
  .refine((v) => !v.fromDate || !v.toDate || !dayjs(v.toDate).isBefore(dayjs(v.fromDate), 'day'), {
    message: 'Leave to date cannot be before the from date',
    path: ['toDate'],
  });

type FormValues = z.infer<typeof schema>;

const emptyForm = (): FormValues => ({
  roleId: '',
  staffProfileId: '',
  applyDate: todayApiDate(),
  leaveTypeId: '',
  fromDate: '',
  toDate: '',
  halfDay: '',
  reason: '',
  note: '',
  status: 'PENDING',
});

const fromRow = (r: LeaveRequestRow): FormValues => ({
  roleId: r.roleId ?? '',
  staffProfileId: r.staffProfileId ?? '',
  applyDate: r.applyDate,
  leaveTypeId: r.leaveTypeId ?? '',
  fromDate: r.fromDate,
  toDate: r.toDate,
  halfDay: r.halfDay ?? '',
  reason: r.reason ?? '',
  note: r.note ?? '',
  status: r.status,
});

type Props = {
  open: boolean;
  /** The request being edited, or null to add one. */
  editing: LeaveRequestRow | null;
  onClose: () => void;
};

/** "Add Details" / "Edit Details" for a leave request. */
function LeaveFormModal({ open, editing, onClose }: Props) {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [removeExisting, setRemoveExisting] = useState(false);
  // Whoever can decide a request (by the approval flow) sets its status and edits it; everyone else only views it.
  const readOnly = editing !== null && !editing.canDecide;

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: emptyForm(), mode: 'onTouched' });

  const roleId = watch('roleId');
  const halfDay = watch('halfDay');
  const fromDate = watch('fromDate');
  const toDate = watch('toDate');

  useEffect(() => {
    if (open) {
      reset(editing ? fromRow(editing) : emptyForm());
      setPendingFile(null);
      setRemoveExisting(false);
    }
  }, [open, editing, reset]);

  const optionsQuery = useQuery({ queryKey: LEAVE_OPTIONS_KEY, queryFn: fetchLeaveOptions, enabled: open });
  const staffQuery = useQuery({
    queryKey: [...LEAVE_STAFF_KEY, roleId],
    queryFn: () => fetchLeaveStaff(roleId),
    enabled: open && Boolean(roleId),
  });

  const staffOptions = (staffQuery.data ?? []).map((s) => ({ value: s.id, label: `${s.name} (${s.staffId})` }));
  // While the list loads in edit mode, still show the current staff member.
  if (editing?.staffProfileId && editing.roleId === roleId && !staffOptions.some((o) => o.value === editing.staffProfileId)) {
    staffOptions.push({ value: editing.staffProfileId, label: `${editing.staffName ?? ''} (${editing.staffId ?? ''})` });
  }

  const selectedStaff = staffQuery.data?.find((o) => o.id === watch('staffProfileId'));
  const selectedRoleName = optionsQuery.data?.roles.find((r) => r.id === roleId)?.name ?? editing?.roleName;
  // A request is only decided by someone else: for staff the signed-in user can decide for, the status is theirs to set.
  const canSetStatus = editing ? editing.canDecide : Boolean(selectedStaff && !selectedStaff.own);
  const approver = editing ? editing.approverLabel : approverFor(selectedRoleName);

  const saveMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const input: LeaveInput = {
        staffProfileId: values.staffProfileId,
        leaveTypeId: values.leaveTypeId,
        applyDate: values.applyDate,
        fromDate: values.fromDate,
        toDate: values.halfDay ? values.fromDate : values.toDate,
        halfDay: (values.halfDay || null) as HalfDay | null,
        reason: values.reason.trim() || null,
        note: values.note.trim() || null,
        status: values.status as LeaveStatus,
      };
      const saved = editing ? await updateLeaveRequest(editing.id, input) : await createLeaveRequest(input);
      try {
        if (pendingFile) return { saved: await uploadLeaveAttachment(saved.id, pendingFile), problem: undefined };
        if (removeExisting && saved.attachment) return { saved: await removeLeaveAttachment(saved.id), problem: undefined };
      } catch (error) {
        return { saved, problem: serverMessage(error) ?? 'the document could not be saved' };
      }
      return { saved, problem: undefined };
    },
    onSuccess: ({ saved, problem }) => {
      if (problem) message.warning(`Leave request saved, but ${problem}`);
      else message.success(editing ? 'Leave request updated' : 'Leave request saved');
      void queryClient.invalidateQueries({ queryKey: LEAVE_REQUESTS_KEY });
      void saved;
      onClose();
    },
    onError: (error) => message.error(serverMessage(error) ?? 'Could not save the leave request. Please try again.'),
  });

  const fieldError = (name: keyof FormValues) =>
    errors[name] ? { validateStatus: 'error' as const, help: errors[name]?.message as string } : {};
  const fid = (name: string) => `leave-${name}`;
  const existingFile = !removeExisting ? editing?.attachment : null;

  const dateField = (name: 'applyDate' | 'fromDate' | 'toDate', label: string, disabled = false) => (
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
            disabled={disabled || readOnly}
            value={field.value ? dayjs(field.value) : null}
            onChange={(d) => {
              const value = d ? d.format(API_DATE_FORMAT) : '';
              field.onChange(value);
              if (name === 'fromDate' && (halfDay || !watch('toDate') || dayjs(watch('toDate')).isBefore(dayjs(value), 'day'))) {
                setValue('toDate', value, { shouldValidate: true });
              }
            }}
            onBlur={field.onBlur}
          />
        </Form.Item>
      )}
    />
  );

  return (
    <Modal
      title={<span style={{ color: token.colorWhite, fontSize: token.fontSizeLG, fontWeight: 500 }}>{editing ? 'Edit Details' : 'Add Details'}</span>}
      open={open}
      onCancel={onClose}
      footer={null}
      width={820}
      destroyOnHidden
      closeIcon={<CloseOutlined style={{ color: token.colorWhite, fontSize: 16 }} />}
      styles={{
        content: { padding: 0, overflow: 'hidden' },
        header: { background: token.colorPrimary, padding: `${token.paddingSM}px ${token.paddingLG}px`, margin: 0 },
        body: { padding: token.paddingLG, maxHeight: '75vh', overflowY: 'auto' },
      }}
    >
      <Form layout="vertical" onFinish={handleSubmit((values) => saveMutation.mutate(values))} data-testid="leave-form">
        {(editing || roleId) && (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: token.marginMD }}
            message={
              selectedStaff?.own
                ? `Your request will be sent to the ${approver} for approval.`
                : `This request is sent to the ${approver} for approval.`
            }
          />
        )}
        <Row gutter={token.marginMD}>
          <Col xs={24} md={12}>
            <Controller
              control={control}
              name="roleId"
              render={({ field }) => (
                <Form.Item label="Role" htmlFor={fid('roleId')} required {...fieldError('roleId')}>
                  <Select
                    id={fid('roleId')}
                    placeholder="Select"
                    showSearch
                    optionFilterProp="label"
                    disabled={editing !== null}
                    loading={optionsQuery.isLoading}
                    options={(optionsQuery.data?.roles ?? []).map((r) => ({ value: r.id, label: r.name }))}
                    value={field.value || undefined}
                    onChange={(v: string) => {
                      field.onChange(v);
                      setValue('staffProfileId', '');
                    }}
                    onBlur={field.onBlur}
                  />
                </Form.Item>
              )}
            />
          </Col>
          <Col xs={24} md={12}>
            <Controller
              control={control}
              name="staffProfileId"
              render={({ field }) => (
                <Form.Item label="Name" htmlFor={fid('staffProfileId')} required {...fieldError('staffProfileId')}>
                  <Select
                    id={fid('staffProfileId')}
                    placeholder={roleId ? 'Select' : 'Select a role first'}
                    showSearch
                    optionFilterProp="label"
                    disabled={!roleId || editing !== null}
                    loading={staffQuery.isLoading}
                    options={staffOptions}
                    value={field.value || undefined}
                    onChange={(v: string) => field.onChange(v)}
                    onBlur={field.onBlur}
                  />
                </Form.Item>
              )}
            />
          </Col>
          <Col xs={24} md={12}>
            {dateField('applyDate', 'Apply Date')}
          </Col>
          <Col xs={24} md={12}>
            <Controller
              control={control}
              name="leaveTypeId"
              render={({ field }) => (
                <Form.Item label="Leave Type" htmlFor={fid('leaveTypeId')} required {...fieldError('leaveTypeId')}>
                  <Select
                    id={fid('leaveTypeId')}
                    placeholder="Select"
                    disabled={readOnly}
                    loading={optionsQuery.isLoading}
                    options={(optionsQuery.data?.leaveTypes ?? []).map((t) => ({ value: t.id, label: t.name }))}
                    value={field.value || undefined}
                    onChange={(v: string) => field.onChange(v)}
                    onBlur={field.onBlur}
                  />
                </Form.Item>
              )}
            />
          </Col>
          <Col xs={24} md={12}>
            {dateField('fromDate', 'Leave From Date')}
          </Col>
          <Col xs={24} md={12}>
            {dateField('toDate', 'Leave To Date', Boolean(halfDay))}
          </Col>
          <Col xs={24}>
            <Controller
              control={control}
              name="halfDay"
              render={({ field }) => (
                <Form.Item {...fieldError('halfDay')}>
                  <Radio.Group
                    disabled={readOnly}
                    value={field.value || 'FULL'}
                    onChange={(e) => {
                      const next = e.target.value === 'FULL' ? '' : (e.target.value as string);
                      field.onChange(next);
                      // A half day is one day: the To date follows the From date.
                      if (next && fromDate) setValue('toDate', fromDate, { shouldValidate: true });
                    }}
                    aria-label="Day type"
                  >
                    <Radio value="FULL">Full Day</Radio>
                    <Radio value="FIRST_HALF">Half Day (First Half)</Radio>
                    <Radio value="SECOND_HALF">Half Day (Second Half)</Radio>
                  </Radio.Group>
                </Form.Item>
              )}
            />
          </Col>
          <Col xs={24} md={12}>
            <Controller
              control={control}
              name="reason"
              render={({ field }) => (
                <Form.Item label="Reason" htmlFor={fid('reason')} {...fieldError('reason')}>
                  <Input.TextArea {...field} id={fid('reason')} rows={4} disabled={readOnly} />
                </Form.Item>
              )}
            />
          </Col>
          <Col xs={24} md={12}>
            <Controller
              control={control}
              name="note"
              render={({ field }) => (
                <Form.Item label="Note" htmlFor={fid('note')} {...fieldError('note')}>
                  <Input.TextArea {...field} id={fid('note')} rows={4} disabled={readOnly} />
                </Form.Item>
              )}
            />
          </Col>
          <Col xs={24} md={12}>
            <Form.Item label="Attach Document">
              {existingFile && !pendingFile ? (
                <Space style={{ width: '100%', justifyContent: 'space-between', border: `1px solid ${token.colorBorder}`, borderRadius: token.borderRadius, padding: `${token.paddingXXS}px ${token.paddingXS}px` }}>
                  <Button type="link" size="small" icon={<DownloadOutlined />} href={leaveAttachmentUrl(editing!.id)} style={{ padding: 0 }}>
                    {existingFile.fileName}
                  </Button>
                  {editing?.canDecide && (
                    <Button type="text" size="small" danger icon={<DeleteOutlined />} aria-label="Remove document" onClick={() => setRemoveExisting(true)} />
                  )}
                </Space>
              ) : readOnly ? (
                <Text type="secondary">No document attached</Text>
              ) : (
                <FilePicker
                  ariaLabel="Document"
                  accept={ALLOWED_UPLOAD_TYPES.join(',')}
                  value={pendingFile}
                  validate={uploadProblem}
                  onRejected={(reason) => message.error(reason)}
                  onChange={setPendingFile}
                />
              )}
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <Form.Item label="Status" {...fieldError('status')}>
                  <Radio.Group
                    disabled={!canSetStatus}
                    value={field.value}
                    onChange={(e) => field.onChange(e.target.value)}
                    aria-label="Status"
                  >
                    {(Object.keys(LEAVE_STATUS_LABEL) as LeaveStatus[]).map((s) => (
                      <Radio key={s} value={s}>
                        {LEAVE_STATUS_LABEL[s]}
                      </Radio>
                    ))}
                  </Radio.Group>
                  {!canSetStatus && (
                    <div>
                      <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                        {editing ? `Approved or disapproved by the ${approver}.` : `A request stays Pending until the ${approver} approves it.`}
                      </Text>
                    </div>
                  )}
                </Form.Item>
              )}
            />
          </Col>
        </Row>
        <Text type="secondary" style={{ display: 'block', marginBottom: token.marginSM }}>
          {halfDay
            ? `A half day leave is one day, counted as 0.5 (${HALF_DAY_LABEL[halfDay as HalfDay]}).`
            : fromDate && toDate
              ? `Full day leave: ${Math.max(0, dayjs(toDate).diff(dayjs(fromDate), 'day') + 1)} day(s), counting every calendar day from the From date to the To date.`
              : 'Full day leave counts every calendar day from the From date to the To date.'}
        </Text>
        {!readOnly && (
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button type="primary" htmlType="submit" loading={saveMutation.isPending}>
              Save
            </Button>
          </div>
        )}
      </Form>
    </Modal>
  );
}

export default LeaveFormModal;
