import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { App, Button, Col, DatePicker, Form, Input, Modal, Row, Select, theme } from 'antd';
import { CloseOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { payPayroll, PAYMENT_MODES, type PaymentMode, type PayrollRow } from '../../api/payrollManagement';
import { API_DATE_FORMAT, DISPLAY_DATE_FORMAT, todayApiDate } from '../../lib/dates';
import { serverMessage } from '../../lib/apiErrors';
import { formatAmount } from '../fees/format';
import { monthYearLabel } from './format';
import { PAYROLL_ROWS_KEY } from './queryKeys';

const schema = z.object({
  paymentMode: z.string().min(1, 'Payment mode is required'),
  paymentDate: z
    .string()
    .min(1, 'Payment date is required')
    .refine((v) => !dayjs(v).isAfter(dayjs(), 'day'), 'The payment date cannot be in the future'),
  note: z.string().max(500, 'Keep this under 500 characters'),
});

type FormValues = z.infer<typeof schema>;

const emptyForm = (): FormValues => ({ paymentMode: '', paymentDate: todayApiDate(), note: '' });

type Props = {
  /** The staff member to pay, or null when closed. */
  row: PayrollRow | null;
  month: number;
  year: number;
  onClose: () => void;
};

/** "Proceed To Pay": marks a generated payroll paid with a payment mode, date and note. */
function ProceedToPayModal({ row, month, year, onClose }: Props) {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const open = row !== null;

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: emptyForm(), mode: 'onTouched' });

  useEffect(() => {
    if (row) reset(emptyForm());
  }, [row, reset]);

  const payMutation = useMutation({
    mutationFn: (values: FormValues) =>
      payPayroll(row?.payrollId as string, {
        paymentMode: values.paymentMode as PaymentMode,
        paymentDate: values.paymentDate,
        note: values.note.trim() || null,
      }),
    onSuccess: () => {
      message.success(`${row?.fullName} has been paid`);
      void queryClient.invalidateQueries({ queryKey: PAYROLL_ROWS_KEY });
      onClose();
    },
    onError: (error) => message.error(serverMessage(error) ?? 'Could not record the payment. Please try again.'),
  });

  const fieldError = (name: keyof FormValues) =>
    errors[name] ? { validateStatus: 'error' as const, help: errors[name]?.message } : {};

  return (
    <Modal
      title={<span style={{ color: token.colorWhite, fontSize: token.fontSizeLG, fontWeight: 500 }}>Proceed To Pay</span>}
      open={open}
      onCancel={onClose}
      footer={null}
      width={760}
      destroyOnHidden
      closeIcon={<CloseOutlined style={{ color: token.colorWhite, fontSize: 16 }} />}
      styles={{
        content: { padding: 0, overflow: 'hidden' },
        header: { background: token.colorPrimary, padding: `${token.paddingSM}px ${token.paddingLG}px`, margin: 0 },
        body: { padding: token.paddingLG },
      }}
    >
      <Form layout="vertical" onFinish={handleSubmit((values) => payMutation.mutate(values))} data-testid="pay-form">
        <Row gutter={token.marginMD}>
          <Col xs={24} md={12}>
            <Form.Item label="Staff Name" htmlFor="pay-staff">
              <Input id="pay-staff" readOnly value={row ? `${row.fullName} (${row.staffId})` : ''} />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item label="Payment Amount" htmlFor="pay-amount">
              <Input id="pay-amount" readOnly value={row?.netSalary == null ? '' : formatAmount(row.netSalary)} />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item label="Month - Year" htmlFor="pay-month">
              <Input id="pay-month" readOnly value={monthYearLabel(month, year)} />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Controller
              control={control}
              name="paymentMode"
              render={({ field }) => (
                <Form.Item label="Payment Mode" htmlFor="pay-mode" required {...fieldError('paymentMode')}>
                  <Select
                    id="pay-mode"
                    placeholder="Select"
                    options={PAYMENT_MODES}
                    value={field.value || undefined}
                    onChange={(v: string) => field.onChange(v)}
                    onBlur={field.onBlur}
                  />
                </Form.Item>
              )}
            />
          </Col>
          <Col xs={24} md={12}>
            <Controller
              control={control}
              name="paymentDate"
              render={({ field }) => (
                <Form.Item label="Payment Date" htmlFor="pay-date" required {...fieldError('paymentDate')}>
                  <DatePicker
                    id="pay-date"
                    style={{ width: '100%' }}
                    format={DISPLAY_DATE_FORMAT}
                    allowClear={false}
                    disabledDate={(d) => d.isAfter(dayjs(), 'day')}
                    value={field.value ? dayjs(field.value) : null}
                    onChange={(d) => field.onChange(d ? d.format(API_DATE_FORMAT) : '')}
                    onBlur={field.onBlur}
                  />
                </Form.Item>
              )}
            />
          </Col>
          <Col xs={24} md={12}>
            <Controller
              control={control}
              name="note"
              render={({ field }) => (
                <Form.Item label="Note" htmlFor="pay-note" {...fieldError('note')}>
                  <Input.TextArea {...field} id="pay-note" rows={2} />
                </Form.Item>
              )}
            />
          </Col>
        </Row>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button type="primary" htmlType="submit" loading={payMutation.isPending}>
            Save
          </Button>
        </div>
      </Form>
    </Modal>
  );
}

export default ProceedToPayModal;
