import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { App, Alert, Form, Input, InputNumber, Modal, Select, Typography } from 'antd';
import { MANUAL_PAYMENT_METHODS, collectPayment, type Invoice, type Payment } from '../../api/fees';
import { formatAmount } from './format';

const { Text } = Typography;

const METHOD_LABEL: Record<string, string> = {
  CASH: 'Cash',
  BANK_TRANSFER: 'Bank transfer',
  CHEQUE: 'Cheque',
  OTHER: 'Other',
};

const schema = z.object({
  amount: z.number({ invalid_type_error: 'Enter an amount' }).positive('Must be greater than 0'),
  method: z.enum(['CASH', 'BANK_TRANSFER', 'CHEQUE', 'OTHER']),
  referenceNumber: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

type Props = {
  invoice: Invoice | null;
  onClose: () => void;
  onCollected: (payment: Payment) => void;
};

function CollectPaymentModal({ invoice, onClose, onCollected }: Props) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const open = invoice !== null;

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { amount: undefined, method: 'CASH', referenceNumber: '', notes: '' },
    mode: 'onTouched',
  });

  useEffect(() => {
    if (open && invoice) {
      reset({ amount: invoice.balance, method: 'CASH', referenceNumber: '', notes: '' });
    }
  }, [open, invoice, reset]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      if (!invoice) return Promise.reject(new Error('No invoice selected'));
      return collectPayment(invoice.id, values);
    },
    onSuccess: (payment) => {
      message.success(`Collected ${formatAmount(payment.amount)} — receipt ${payment.receiptNumber}`);
      void queryClient.invalidateQueries({ queryKey: ['student-fee-statement'] });
      void queryClient.invalidateQueries({ queryKey: ['student-invoices'] });
      void queryClient.invalidateQueries({ queryKey: ['invoice-payments'] });
      onCollected(payment);
    },
    onError: (error: unknown) => {
      const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      message.error(detail ?? 'Could not collect the payment. Please try again.');
    },
  });

  const submit = handleSubmit((values) => mutation.mutate(values));

  return (
    <Modal
      title={invoice ? `Collect payment — balance ${formatAmount(invoice.balance)}` : 'Collect payment'}
      open={open}
      onCancel={onClose}
      onOk={submit}
      okText="Collect payment"
      confirmLoading={mutation.isPending}
      destroyOnClose
      maskClosable={!mutation.isPending}
    >
      {invoice && invoice.balance <= 0 ? (
        <Alert type="info" showIcon message="This invoice has no outstanding balance." />
      ) : (
        <Form layout="vertical" requiredMark="optional" onFinish={submit}>
          <Controller
            control={control}
            name="amount"
            render={({ field }) => (
              <Form.Item
                label="Amount"
                required
                validateStatus={errors.amount ? 'error' : undefined}
                help={errors.amount?.message ?? (invoice ? `Outstanding balance: ${formatAmount(invoice.balance)}` : undefined)}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={0.01}
                  max={invoice?.balance}
                  precision={2}
                  value={field.value ?? undefined}
                  onChange={(v) => field.onChange(v ?? undefined)}
                />
              </Form.Item>
            )}
          />

          <Controller
            control={control}
            name="method"
            render={({ field }) => (
              <Form.Item label="Payment method" required>
                <Select {...field} options={MANUAL_PAYMENT_METHODS.map((m) => ({ value: m, label: METHOD_LABEL[m] }))} />
              </Form.Item>
            )}
          />

          <Controller
            control={control}
            name="referenceNumber"
            render={({ field }) => (
              <Form.Item label="Reference (cheque # / bank ref, optional)">
                <Input {...field} placeholder="Optional" autoComplete="off" />
              </Form.Item>
            )}
          />

          <Controller
            control={control}
            name="notes"
            render={({ field }) => (
              <Form.Item label="Notes (optional)">
                <Input.TextArea {...field} rows={2} placeholder="Optional" />
              </Form.Item>
            )}
          />

          <Text type="secondary">Full or partial payment — the server rejects any amount over the outstanding balance.</Text>
        </Form>
      )}
    </Modal>
  );
}

export default CollectPaymentModal;
