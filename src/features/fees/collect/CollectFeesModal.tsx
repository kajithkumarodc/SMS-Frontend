import { useEffect, useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Alert, App, Button, DatePicker, Form, Input, InputNumber, Modal, Radio, Table, Typography, theme } from 'antd';
import { WalletOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { collectFees, COLLECT_METHODS, type CollectFeesResult, type FeeLine, type PaymentMethod } from '../../../api/fees';
import { API_DATE_FORMAT, DISPLAY_DATE_FORMAT } from '../../../lib/dates';
import { serverMessage } from '../../../lib/apiErrors';
import { formatAmount } from '../format';
import { termLabel } from './feeLabels';

const { Text } = Typography;

type Props = {
  studentId: string;
  /** The fees chosen on the Student Fees page; `null` keeps the modal closed. */
  lines: FeeLine[] | null;
  onClose: () => void;
  onCollected: (result: CollectFeesResult) => void;
};

type Entry = { amount: number | null; fine: number | null };

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Smart School's "Collect Fees" pop-up: date, payment mode, note, and for each chosen fee its fine and the amount
 * being paid now (defaults to the full balance; less makes it a part payment). The server re-checks every amount
 * against the balance under a lock, so this form can never over-collect.
 */
function CollectFeesModal({ studentId, lines, onClose, onCollected }: Props) {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const payable = useMemo(() => (lines ?? []).filter((l) => l.balance > 0), [lines]);

  const [date, setDate] = useState(dayjs().format(API_DATE_FORMAT));
  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!lines) return;
    setDate(dayjs().format(API_DATE_FORMAT));
    setMethod('CASH');
    setReference('');
    setNote('');
    setError(null);
    setEntries(Object.fromEntries(lines.filter((l) => l.balance > 0).map((l) => [l.lineId, { amount: l.balance, fine: 0 }])));
  }, [lines]);

  const totalFees = round2(payable.reduce((s, l) => s + (entries[l.lineId]?.amount ?? 0), 0));
  const totalFine = round2(payable.reduce((s, l) => s + (entries[l.lineId]?.fine ?? 0), 0));
  const total = round2(totalFees + totalFine);

  const mutation = useMutation({
    mutationFn: () =>
      collectFees(studentId, {
        paymentDate: date,
        method,
        referenceNumber: method === 'CASH' ? undefined : reference.trim() || undefined,
        notes: note.trim() || undefined,
        lines: payable
          .map((l) => ({ invoiceLineId: l.lineId, amount: round2(entries[l.lineId]?.amount ?? 0), fine: round2(entries[l.lineId]?.fine ?? 0) }))
          .filter((l) => l.amount + l.fine > 0),
      }),
    onSuccess: (result) => {
      message.success(`${formatAmount(result.total)} collected · Receipt ${result.receiptNumbers.join(', ')}`);
      onCollected(result);
    },
    onError: (e) => setError(serverMessage(e) ?? 'Could not collect the fees. Nothing was saved -- please try again.'),
  });

  const pay = () => {
    setError(null);
    if (!date) return setError('Pick the payment date.');
    if (dayjs(date).isAfter(dayjs(), 'day')) return setError("The payment date can't be in the future.");
    for (const l of payable) {
      const e = entries[l.lineId];
      if ((e?.amount ?? 0) > l.balance) return setError(`Only ${formatAmount(l.balance)} is due for ${l.label}.`);
    }
    if (total <= 0) return setError('Enter the amount being paid.');
    mutation.mutate();
  };

  const setEntry = (id: string, patch: Partial<Entry>) => setEntries((all) => ({ ...all, [id]: { ...all[id], ...patch } }));

  return (
    <Modal
      title="Collect Fees"
      open={lines !== null}
      onCancel={() => !mutation.isPending && onClose()}
      width={760}
      destroyOnHidden
      maskClosable={!mutation.isPending}
      footer={
        payable.length > 0 && (
          <Button type="primary" icon={<WalletOutlined />} loading={mutation.isPending} onClick={pay} disabled={total <= 0}>
            Pay {formatAmount(total)}
          </Button>
        )
      }
    >
      <Form layout="horizontal" labelCol={{ span: 5 }} wrapperCol={{ span: 19 }} colon={false}>
        <Form.Item label="Date" htmlFor="collect-date" required>
          <DatePicker
            id="collect-date"
            style={{ width: '100%' }}
            format={DISPLAY_DATE_FORMAT}
            allowClear={false}
            value={date ? dayjs(date) : null}
            disabledDate={(d) => d.isAfter(dayjs(), 'day')}
            onChange={(d) => setDate(d ? d.format(API_DATE_FORMAT) : '')}
          />
        </Form.Item>
        <Form.Item label="Payment Mode" required>
          <Radio.Group value={method} onChange={(e) => setMethod(e.target.value)} options={COLLECT_METHODS} />
        </Form.Item>
        {method !== 'CASH' && (
          <Form.Item label="Reference No." htmlFor="collect-reference">
            <Input
              id="collect-reference"
              maxLength={255}
              placeholder={method === 'CHEQUE' ? 'Cheque number' : method === 'DD' ? 'DD number' : 'Transaction / reference ID'}
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </Form.Item>
        )}
        <Form.Item label="Note" htmlFor="collect-note">
          <Input.TextArea id="collect-note" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
        </Form.Item>
      </Form>

      {payable.length === 0 ? (
        <Alert type="info" message="No Fees Found" description="The selected fees are already paid." />
      ) : (
        <Table<FeeLine>
          rowKey="lineId"
          size="small"
          pagination={false}
          dataSource={payable}
          scroll={{ x: 'max-content' }}
          columns={[
            {
              key: 'fees',
              title: 'Fees',
              render: (_v, l) => (
                <div>
                  <Text style={{ color: token.colorPrimary }}>{l.label}</Text>
                  <div>
                    <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                      {l.feeGroup} · {termLabel(l.term)} · Due {formatAmount(l.balance)}
                    </Text>
                  </div>
                </div>
              ),
            },
            {
              key: 'fine',
              title: 'Fine Amount',
              align: 'right',
              width: 140,
              render: (_v, l) => (
                <InputNumber
                  aria-label={`Fine for ${l.label}`}
                  min={0}
                  precision={2}
                  controls={false}
                  style={{ width: 120, color: token.colorError }}
                  value={entries[l.lineId]?.fine}
                  onChange={(v) => setEntry(l.lineId, { fine: v })}
                />
              ),
            },
            {
              key: 'amount',
              title: 'Fees Amount',
              align: 'right',
              width: 150,
              render: (_v, l) => (
                <InputNumber
                  aria-label={`Amount for ${l.label}`}
                  min={0}
                  max={l.balance}
                  precision={2}
                  controls={false}
                  style={{ width: 130 }}
                  status={(entries[l.lineId]?.amount ?? 0) > l.balance ? 'error' : undefined}
                  value={entries[l.lineId]?.amount}
                  onChange={(v) => setEntry(l.lineId, { amount: v })}
                />
              ),
            },
          ]}
          summary={() => (
            <>
              <Table.Summary.Row>
                <Table.Summary.Cell index={0}>
                  <Text strong>Total</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={1} align="right">
                  <Text strong type="danger">
                    {formatAmount(totalFine)}
                  </Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={2} align="right">
                  <Text strong>{formatAmount(totalFees)}</Text>
                </Table.Summary.Cell>
              </Table.Summary.Row>
              <Table.Summary.Row>
                <Table.Summary.Cell index={0} colSpan={2}>
                  <Text strong>Paying Amount</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={2} align="right">
                  <Text strong style={{ fontSize: token.fontSizeLG, color: token.colorPrimary }}>
                    {formatAmount(total)}
                  </Text>
                </Table.Summary.Cell>
              </Table.Summary.Row>
            </>
          )}
        />
      )}
      {error && <Alert type="error" showIcon style={{ marginTop: token.marginSM }} message={error} />}
    </Modal>
  );
}

export default CollectFeesModal;
