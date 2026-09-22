import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Descriptions, Divider, Modal, Skeleton, Space, Tag, Typography, theme } from 'antd';
import { PrinterOutlined } from '@ant-design/icons';
import { fetchReceipt, type Receipt } from '../../api/fees';
import { formatAmount, formatDate } from './format';

const { Title, Text } = Typography;

type Props = {
  /** The payment id to show a receipt for, or null when the modal is closed. */
  paymentId: string | null;
  onClose: () => void;
  /** Portal callers pass their own ownership-scoped fetcher; staff use the default staff endpoint. */
  fetcher?: (paymentId: string) => Promise<Receipt>;
};

function ReceiptView({ paymentId, onClose, fetcher = fetchReceipt }: Props) {
  const { token } = theme.useToken();
  const open = paymentId !== null;

  const query = useQuery({
    queryKey: ['receipt', paymentId],
    queryFn: () => fetcher(paymentId as string),
    enabled: open,
  });

  const receipt = query.data;

  return (
    <Modal
      title="Payment receipt"
      open={open}
      onCancel={onClose}
      footer={
        receipt && (
          <Button type="primary" icon={<PrinterOutlined />} onClick={() => window.print()}>
            Print
          </Button>
        )
      }
      width={560}
      destroyOnClose
    >
      {query.isError ? (
        <Alert type="warning" showIcon message="Couldn't load this receipt" />
      ) : query.isPending ? (
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : receipt ? (
        <div id="receipt-print-area">
          <Space direction="vertical" size={token.marginXS} style={{ width: '100%' }}>
            <Title level={4} style={{ margin: 0 }}>
              {receipt.schoolName ?? 'School'}
            </Title>
            <Text type="secondary">Receipt {receipt.payment.receiptNumber}</Text>
            <Text type="secondary">{formatDate(receipt.payment.paidAt)}</Text>
          </Space>

          <Divider style={{ margin: `${token.marginMD}px 0` }} />

          <Descriptions column={1} size="small" colon={false}>
            <Descriptions.Item label="Student">
              {receipt.studentName} ({receipt.admissionNumber})
            </Descriptions.Item>
            <Descriptions.Item label="Class / Section">
              {receipt.className ? `${receipt.className} · ${receipt.sectionName ?? ''}` : 'Not assigned'}
            </Descriptions.Item>
            <Descriptions.Item label="Academic session">{receipt.academicYear ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="Fee">{receipt.feeStructureName ?? '—'}</Descriptions.Item>
          </Descriptions>

          <Divider style={{ margin: `${token.marginMD}px 0` }} />

          <Descriptions column={1} size="small" colon={false}>
            <Descriptions.Item label="Original amount">{formatAmount(receipt.originalAmount)}</Descriptions.Item>
            {receipt.discountAmount > 0 && (
              <Descriptions.Item label="Discount">- {formatAmount(receipt.discountAmount)}</Descriptions.Item>
            )}
            {receipt.lateFeeAmount > 0 && (
              <Descriptions.Item label="Late fee">+ {formatAmount(receipt.lateFeeAmount)}</Descriptions.Item>
            )}
            <Descriptions.Item label={receipt.payment.type === 'REVERSAL' ? 'Reversed amount' : 'Amount paid'}>
              <Text strong style={{ fontSize: token.fontSizeLG }}>
                {formatAmount(receipt.payment.amount)}
              </Text>
            </Descriptions.Item>
            <Descriptions.Item label="Payment method">
              <Tag>{receipt.payment.method}</Tag>
              {receipt.payment.referenceNumber && <Text type="secondary"> {receipt.payment.referenceNumber}</Text>}
            </Descriptions.Item>
            <Descriptions.Item label="Balance remaining">{formatAmount(receipt.balanceAfter)}</Descriptions.Item>
            <Descriptions.Item label="Collected by">{receipt.collectedByName ?? 'Online payment'}</Descriptions.Item>
          </Descriptions>

          {receipt.payment.type === 'REVERSAL' && (
            <Alert
              style={{ marginTop: token.marginMD }}
              type="warning"
              showIcon
              message="This is a reversal / refund record"
              description={receipt.payment.reason ?? undefined}
            />
          )}
        </div>
      ) : null}
    </Modal>
  );
}

export default ReceiptView;
