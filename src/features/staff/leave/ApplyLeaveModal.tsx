import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, Col, DatePicker, Form, Input, Modal, Radio, Row, Select, Typography, theme } from 'antd';
import { CloseOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { createLeaveRequest, uploadLeaveAttachment, type HalfDay, type MyLeaveInfo } from '../../../api/leaveManagement';
import { API_DATE_FORMAT, DISPLAY_DATE_FORMAT, todayApiDate } from '../../../lib/dates';
import { serverMessage } from '../../../lib/apiErrors';
import { ALLOWED_UPLOAD_TYPES, uploadProblem } from '../../../lib/files';
import FilePicker from '../../students/admission/FilePicker';
import { LEAVE_REQUESTS_KEY, MY_LEAVE_INFO_KEY, MY_LEAVE_REQUESTS_KEY } from './queryKeys';

const { Text } = Typography;

const schema = z
  .object({
    applyDate: z.string().min(1, 'Apply date is required'),
    leaveTypeId: z.string().min(1, 'Available leave is required'),
    fromDate: z.string().min(1, 'Leave from date is required'),
    toDate: z.string().min(1, 'Leave to date is required'),
    halfDay: z.string(),
    reason: z.string().max(1000, 'Keep this under 1000 characters'),
  })
  .refine((v) => !v.fromDate || !v.toDate || !dayjs(v.toDate).isBefore(dayjs(v.fromDate), 'day'), {
    message: 'Leave to date cannot be before the from date',
    path: ['toDate'],
  });

type FormValues = z.infer<typeof schema>;

const emptyForm = (): FormValues => ({ applyDate: todayApiDate(), leaveTypeId: '', fromDate: '', toDate: '', halfDay: '', reason: '' });

type Props = {
  open: boolean;
  /** The signed-in user as an applicant; null while it loads (or when they have no staff profile). */
  info: MyLeaveInfo | null;
  onClose: () => void;
};

const availableText = (available: number | null) =>
  available === null ? 'no limit set' : `${Number.isInteger(available) ? available : available.toFixed(1)} day(s) available`;

/** "Add Details" on the Apply Leave page: the signed-in user asks for leave for themselves. */
function ApplyLeaveModal({ open, info, onClose }: Props) {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: emptyForm(), mode: 'onTouched' });

  const halfDay = watch('halfDay');
  const fromDate = watch('fromDate');
  const toDate = watch('toDate');
  const leaveTypeId = watch('leaveTypeId');
  const balance = info?.balances.find((b) => b.leaveTypeId === leaveTypeId);

  useEffect(() => {
    if (open) {
      reset(emptyForm());
      setPendingFile(null);
    }
  }, [open, reset]);

  const saveMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const saved = await createLeaveRequest({
        staffProfileId: info!.staffProfileId,
        leaveTypeId: values.leaveTypeId,
        applyDate: values.applyDate,
        fromDate: values.fromDate,
        toDate: values.halfDay ? values.fromDate : values.toDate,
        halfDay: (values.halfDay || null) as HalfDay | null,
        reason: values.reason.trim() || null,
        note: null,
        status: 'PENDING',
      });
      if (!pendingFile) return { problem: undefined };
      try {
        await uploadLeaveAttachment(saved.id, pendingFile);
        return { problem: undefined };
      } catch (error) {
        return { problem: serverMessage(error) ?? 'the document could not be saved' };
      }
    },
    onSuccess: ({ problem }) => {
      if (problem) message.warning(`Leave request sent, but ${problem}`);
      else message.success(`Leave request sent to the ${info?.approverLabel ?? 'approver'}`);
      void queryClient.invalidateQueries({ queryKey: MY_LEAVE_REQUESTS_KEY });
      void queryClient.invalidateQueries({ queryKey: MY_LEAVE_INFO_KEY });
      void queryClient.invalidateQueries({ queryKey: LEAVE_REQUESTS_KEY });
      onClose();
    },
    onError: (error) => message.error(serverMessage(error) ?? 'Could not send the leave request. Please try again.'),
  });

  const fieldError = (name: keyof FormValues) =>
    errors[name] ? { validateStatus: 'error' as const, help: errors[name]?.message as string } : {};
  const fid = (name: string) => `apply-leave-${name}`;

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
            disabled={disabled}
            value={field.value ? dayjs(field.value) : null}
            onChange={(d) => {
              const value = d ? d.format(API_DATE_FORMAT) : '';
              field.onChange(value);
              if (name === 'fromDate' && (halfDay || !toDate || dayjs(toDate).isBefore(dayjs(value), 'day'))) {
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
      title={<span style={{ color: token.colorWhite, fontSize: token.fontSizeLG, fontWeight: 500 }}>Add Details</span>}
      open={open}
      onCancel={onClose}
      footer={null}
      width={760}
      destroyOnHidden
      closeIcon={<CloseOutlined style={{ color: token.colorWhite, fontSize: 16 }} />}
      styles={{
        content: { padding: 0, overflow: 'hidden' },
        header: { background: token.colorPrimary, padding: `${token.paddingSM}px ${token.paddingLG}px`, margin: 0 },
        body: { padding: token.paddingLG, maxHeight: '75vh', overflowY: 'auto' },
      }}
    >
      <Form layout="vertical" onFinish={handleSubmit((values) => saveMutation.mutate(values))} data-testid="apply-leave-form">
        {info && (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: token.marginMD }}
            message={`Your request will be sent to the ${info.approverLabel} for approval, and you will be notified of the decision.`}
          />
        )}
        <Row gutter={token.marginMD}>
          <Col xs={24} md={12}>
            {dateField('applyDate', 'Apply Date')}
          </Col>
          <Col xs={24} md={12}>
            <Controller
              control={control}
              name="leaveTypeId"
              render={({ field }) => (
                <Form.Item label="Available Leave" htmlFor={fid('leaveTypeId')} required {...fieldError('leaveTypeId')}>
                  <Select
                    id={fid('leaveTypeId')}
                    placeholder="Select"
                    loading={!info}
                    options={(info?.balances ?? []).map((b) => ({
                      value: b.leaveTypeId,
                      label: `${b.name} (${availableText(b.available)})`,
                      disabled: b.available !== null && b.available <= 0,
                    }))}
                    value={field.value || undefined}
                    onChange={(v: string) => field.onChange(v)}
                    onBlur={field.onBlur}
                  />
                </Form.Item>
              )}
            />
            {balance && balance.allotted !== null && (
              <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                {balance.used} of {balance.allotted} day(s) of {balance.name} used in {info?.year}.
              </Text>
            )}
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
                <Form.Item>
                  <Radio.Group
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
          <Col xs={24}>
            <Controller
              control={control}
              name="reason"
              render={({ field }) => (
                <Form.Item label="Reason" htmlFor={fid('reason')} {...fieldError('reason')}>
                  <Input.TextArea {...field} id={fid('reason')} rows={4} />
                </Form.Item>
              )}
            />
          </Col>
          <Col xs={24}>
            <Form.Item label="Attach Document">
              <FilePicker
                ariaLabel="Document"
                accept={ALLOWED_UPLOAD_TYPES.join(',')}
                value={pendingFile}
                validate={uploadProblem}
                onRejected={(reason) => message.error(reason)}
                onChange={setPendingFile}
              />
            </Form.Item>
          </Col>
        </Row>
        <Text type="secondary" style={{ display: 'block', marginBottom: token.marginSM }}>
          {halfDay
            ? 'A half day leave is one day, counted as 0.5.'
            : fromDate && toDate
              ? `Full day leave: ${Math.max(0, dayjs(toDate).diff(dayjs(fromDate), 'day') + 1)} day(s), counting every calendar day from the From date to the To date.`
              : 'Full day leave counts every calendar day from the From date to the To date.'}
        </Text>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button type="primary" htmlType="submit" loading={saveMutation.isPending} disabled={!info}>
            Save
          </Button>
        </div>
      </Form>
    </Modal>
  );
}

export default ApplyLeaveModal;
