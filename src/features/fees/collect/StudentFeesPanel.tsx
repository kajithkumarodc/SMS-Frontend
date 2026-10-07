import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, Empty, Input, Modal, Skeleton, Space, Table, Tag, Tooltip, Typography, theme } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { EnterOutlined, PlusOutlined, PrinterOutlined, UndoOutlined, WalletOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  fetchCollectionReceipt,
  fetchStudentFees,
  METHOD_LABEL,
  reversePayment,
  type CollectFeesResult,
  type FeeLine,
  type FeeLinePayment,
} from '../../../api/fees';
import { useAuthStore } from '../../../store/authStore';
import { hasPermission } from '../../../lib/roles';
import { formatDisplayDate } from '../../../lib/dates';
import { serverMessage } from '../../../lib/apiErrors';
import { downloadCsv, downloadExcel, downloadPdf, printRows, type ExportColumn, type ExportKind } from '../../../lib/tableExport';
import DataTableToolbar from '../../../components/DataTableToolbar';
import { formatAmount } from '../format';
import ReceiptView from '../ReceiptView';
import CollectFeesModal from './CollectFeesModal';
import { termLabel } from './feeLabels';
import { printCollectionReceipt, printFeeStatement } from './printFees';

const { Text } = Typography;

export const STUDENT_FEES_KEY = ['student-fees'] as const;

type Row =
  | { kind: 'line'; key: string; line: FeeLine }
  | { kind: 'payment'; key: string; line: FeeLine; payment: FeeLinePayment };

const STATUS_TAG: Record<string, { color: string; label: string }> = {
  PAID: { color: 'success', label: 'Paid' },
  PARTIAL: { color: 'warning', label: 'Partial' },
  UNPAID: { color: 'error', label: 'Unpaid' },
};

type Props = {
  studentId: string;
  /** Used on printed statements. */
  header: { schoolName?: string | null; studentName: string; admissionNumber: string; classText: string };
};

/**
 * Smart School's Student Fees table: one row per fee line (fee type in a term) with its status, amount, discount,
 * fine, paid and balance, and under it a row for every payment made on it. Select lines to collect or print them;
 * revert a payment or print its receipt from its row.
 */
function StudentFeesPanel({ studentId, header }: Props) {
  const { token } = theme.useToken();
  const { message, modal } = App.useApp();
  const queryClient = useQueryClient();
  const permissions = useAuthStore((state) => state.user?.permissions);
  const canCollect = hasPermission(permissions, 'FEE_COLLECT');
  const canRevert = hasPermission(permissions, 'FEE_REFUND');

  const [selected, setSelected] = useState<string[]>([]);
  const [collecting, setCollecting] = useState<FeeLine[] | null>(null);
  const [reverting, setReverting] = useState<{ payment: FeeLinePayment; lines: FeeLine[] } | null>(null);
  const [reason, setReason] = useState('');
  const [legacyReceipt, setLegacyReceipt] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = useState(100);
  const [exporting, setExporting] = useState<ExportKind | null>(null);

  const feesQuery = useQuery({ queryKey: [...STUDENT_FEES_KEY, studentId], queryFn: () => fetchStudentFees(studentId) });
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: [...STUDENT_FEES_KEY, studentId] });
    void queryClient.invalidateQueries({ queryKey: ['student-invoices'] });
  };

  const lines = useMemo(() => {
    const all = feesQuery.data?.lines ?? [];
    const q = search.trim().toLowerCase();
    return q ? all.filter((l) => `${l.label} ${l.feeGroup} ${termLabel(l.term)}`.toLowerCase().includes(q)) : all;
  }, [feesQuery.data, search]);
  const rows: Row[] = useMemo(
    () =>
      lines.flatMap((line) => [
        { kind: 'line' as const, key: line.lineId, line },
        ...line.payments.map((payment) => ({
          kind: 'payment' as const,
          key: `${line.lineId}:${payment.paymentId}:${payment.paymentNumber}`,
          line,
          payment,
        })),
      ]),
    [lines],
  );

  const revertMutation = useMutation({
    mutationFn: () => reversePayment(reverting!.payment.paymentId, reason.trim()),
    onSuccess: () => {
      message.success(`Payment ${reverting!.payment.receiptNumber} reverted`);
      setReverting(null);
      setReason('');
      refresh();
    },
    onError: (e) => message.error(serverMessage(e) ?? 'Could not revert the payment. Please try again.'),
  });

  const printReceipt = async (payment: FeeLinePayment) => {
    if (!payment.collectionId) {
      setLegacyReceipt(payment.paymentId);
      return;
    }
    try {
      const receipt = await fetchCollectionReceipt(payment.collectionId);
      if (!printCollectionReceipt(receipt)) message.warning('Allow pop-ups for this site to print the receipt.');
    } catch (e) {
      message.error(serverMessage(e) ?? 'Could not load the receipt.');
    }
  };

  const onCollected = (result: CollectFeesResult) => {
    setCollecting(null);
    setSelected([]);
    refresh();
    modal.confirm({
      title: 'Fees collected',
      content: `${formatAmount(result.total)} received. Receipt ${result.receiptNumbers.join(', ')}.`,
      okText: 'Print Receipt',
      cancelText: 'Close',
      onOk: async () => {
        const receipt = await fetchCollectionReceipt(result.collectionId);
        if (!printCollectionReceipt(receipt)) message.warning('Allow pop-ups for this site to print the receipt.');
      },
    });
  };

  if (feesQuery.isPending) return <Skeleton active paragraph={{ rows: 6 }} />;
  if (feesQuery.isError) {
    return <Alert type="error" showIcon message={serverMessage(feesQuery.error) ?? "Couldn't load the fees."} action={<Button onClick={() => void feesQuery.refetch()}>Retry</Button>} />;
  }
  const data = feesQuery.data;
  const session = [...new Set(data.groups.map((g) => g.academicYear).filter(Boolean))].join(', ');
  const selectedLines = (data.lines ?? []).filter((l) => selected.includes(l.lineId));

  const money = (n: number) => (n ? formatAmount(n) : '0.00');
  const columns: ColumnsType<Row> = [
    {
      key: 'fees',
      title: 'Fees',
      render: (_v, r) =>
        r.kind === 'line' ? (
          <div>
            <Text>{r.line.label}</Text>
            <div>
              <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                {r.line.feeGroup} · {termLabel(r.line.term)}
              </Text>
            </div>
          </div>
        ) : null,
    },
    { key: 'due', title: 'Due Date', render: (_v, r) => (r.kind === 'line' ? formatDisplayDate(r.line.dueDate) : null) },
    {
      key: 'status',
      title: 'Status',
      render: (_v, r) =>
        r.kind === 'line' ? (
          <Tag color={STATUS_TAG[r.line.status].color} style={{ marginInlineEnd: 0 }}>
            {STATUS_TAG[r.line.status].label}
          </Tag>
        ) : r.payment.reversed ? (
          <Tag>Reverted</Tag>
        ) : null,
    },
    {
      key: 'amount',
      title: 'Amount',
      align: 'right',
      render: (_v, r) =>
        r.kind === 'line' ? (
          <div>
            {money(r.line.amount)}
            {r.line.fine > 0 && <div style={{ color: token.colorError }}>+ {money(r.line.fine)}</div>}
          </div>
        ) : null,
    },
    {
      key: 'pid',
      title: 'Payment ID',
      render: (_v, r) =>
        r.kind === 'payment' ? (
          <Space size={token.marginXXS} style={{ textDecoration: r.payment.reversed ? 'line-through' : undefined }}>
            <EnterOutlined style={{ transform: 'scaleX(-1)', color: token.colorTextTertiary }} />
            {r.payment.paymentNumber}
          </Space>
        ) : null,
    },
    {
      key: 'mode',
      title: 'Mode',
      render: (_v, r) =>
        r.kind === 'payment' ? (
          <Tooltip title={r.payment.referenceNumber ? `Ref: ${r.payment.referenceNumber}` : undefined}>
            {METHOD_LABEL[r.payment.method] ?? r.payment.method}
          </Tooltip>
        ) : null,
    },
    { key: 'date', title: 'Date', render: (_v, r) => (r.kind === 'payment' ? formatDisplayDate(r.payment.paymentDate) : null) },
    { key: 'discount', title: 'Discount', align: 'right', render: (_v, r) => (r.kind === 'line' ? money(r.line.discount) : money(0)) },
    { key: 'fine', title: 'Fine', align: 'right', render: (_v, r) => money(r.kind === 'line' ? r.line.fine : r.payment.fine) },
    {
      key: 'paid',
      title: 'Paid',
      align: 'right',
      render: (_v, r) =>
        r.kind === 'line' ? money(r.line.paid) : <span style={{ textDecoration: r.payment.reversed ? 'line-through' : undefined }}>{money(r.payment.amount)}</span>,
    },
    { key: 'balance', title: 'Balance', align: 'right', render: (_v, r) => (r.kind === 'line' && r.line.balance > 0 ? money(r.line.balance) : null) },
    {
      key: 'action',
      title: 'Action',
      align: 'right',
      render: (_v, r) =>
        r.kind === 'line' ? (
          <Space size={token.marginXXS}>
            {canCollect && r.line.balance > 0 && (
              <Tooltip title="Collect Fees">
                <Button size="small" icon={<PlusOutlined />} aria-label={`Collect ${r.line.label}`} onClick={() => setCollecting([r.line])} />
              </Tooltip>
            )}
            <Tooltip title="Print">
              <Button
                size="small"
                icon={<PrinterOutlined />}
                aria-label={`Print ${r.line.label}`}
                onClick={() => printFeeStatement({ ...header, session }, [r.line]) || message.warning('Allow pop-ups to print.')}
              />
            </Tooltip>
          </Space>
        ) : (
          <Space size={token.marginXXS}>
            {canRevert && !r.payment.reversed && (
              <Tooltip title="Revert this payment">
                <Button
                  size="small"
                  type="text"
                  icon={<UndoOutlined />}
                  aria-label={`Revert payment ${r.payment.paymentNumber}`}
                  onClick={() => {
                    setReason('');
                    setReverting({
                      payment: r.payment,
                      lines: data.lines.filter((l) => l.payments.some((p) => p.paymentId === r.payment.paymentId)),
                    });
                  }}
                />
              </Tooltip>
            )}
            <Tooltip title="Print receipt">
              <Button size="small" type="text" icon={<PrinterOutlined />} aria-label={`Print receipt ${r.payment.receiptNumber}`} onClick={() => void printReceipt(r.payment)} />
            </Tooltip>
          </Space>
        ),
    },
  ];

  const exportColumns: ExportColumn<FeeLine>[] = [
    { title: 'Fees', value: (l) => `${l.label} (${l.feeGroup} · ${termLabel(l.term)})` },
    { title: 'Due Date', value: (l) => formatDisplayDate(l.dueDate) },
    { title: 'Status', value: (l) => STATUS_TAG[l.status].label },
    { title: 'Amount', value: (l) => l.amount },
    { title: 'Discount', value: (l) => l.discount },
    { title: 'Fine', value: (l) => l.fine },
    { title: 'Paid', value: (l) => l.paid },
    { title: 'Balance', value: (l) => l.balance },
  ];
  const handleExport = async (kind: ExportKind) => {
    setExporting(kind);
    try {
      const base = `fees-${header.admissionNumber}-${dayjs().format('YYYY-MM-DD')}`;
      const title = `Student Fees - ${header.studentName}`;
      if (kind === 'csv') downloadCsv(lines, exportColumns, base);
      else if (kind === 'excel') await downloadExcel(lines, exportColumns, base, title);
      else if (kind === 'pdf') await downloadPdf(lines, exportColumns, base, title);
      else printRows(lines, exportColumns, title);
    } catch {
      message.error("Couldn't export the fees.");
    } finally {
      setExporting(null);
    }
  };

  const t = data.totals;
  return (
    <div>
      <style>{`.fee-line-overdue > td { background: ${token.colorErrorBg} !important; }
        .fee-payment-row > td { background: ${token.colorFillQuaternary}; }`}</style>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: token.marginSM, marginBottom: token.marginSM }}>
        <Space wrap>
          <Button
            type="primary"
            icon={<PrinterOutlined />}
            disabled={selectedLines.length === 0}
            onClick={() => printFeeStatement({ ...header, session }, selectedLines) || message.warning('Allow pop-ups to print.')}
          >
            Print Selected
          </Button>
          {canCollect && (
            <Button
              icon={<WalletOutlined />}
              style={{ background: token.colorWarning, borderColor: token.colorWarning, color: '#fff' }}
              disabled={selectedLines.filter((l) => l.balance > 0).length === 0}
              onClick={() => setCollecting(selectedLines)}
            >
              Collect Selected
            </Button>
          )}
        </Space>
        <Text>Date: {formatDisplayDate(dayjs().format('YYYY-MM-DD'))}</Text>
      </div>
      {session && (
        <div style={{ textAlign: 'center', marginBottom: token.marginSM }}>
          <Text strong>Session : {session}</Text>
        </div>
      )}

      {data.lines.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No fees assigned to this student yet. Assign fees from Fees Master or at admission." />
      ) : (
        <>
          <DataTableToolbar
            search={search}
            onSearchChange={setSearch}
            searchLabel="Search fees"
            pageSize={pageSize}
            onPageSizeChange={setPageSize}
            columns={[]}
            hiddenColumns={[]}
            onHiddenColumnsChange={() => undefined}
            onExport={(k) => void handleExport(k)}
            exporting={exporting}
            canExport
            canPrint
            showColumnToggle={false}
          />
          <Table<Row>
            rowKey="key"
            size="small"
            columns={columns}
            dataSource={rows}
            scroll={{ x: 'max-content' }}
            pagination={rows.length > pageSize ? { pageSize, showSizeChanger: false } : false}
            rowClassName={(r) => (r.kind === 'payment' ? 'fee-payment-row' : r.line.overdue ? 'fee-line-overdue' : '')}
            rowSelection={{
              selectedRowKeys: selected,
              onChange: (keys) => setSelected((keys as string[]).filter((k) => !k.includes(':'))),
              getCheckboxProps: (r) => ({ disabled: r.kind === 'payment', 'aria-label': r.kind === 'line' ? `Select ${r.line.label}` : undefined }),
              renderCell: (_c, r, _i, node) => (r.kind === 'line' ? node : null),
            }}
            summary={() => (
              <Table.Summary.Row>
                <Table.Summary.Cell index={0} colSpan={4} align="right">
                  <Text strong>Grand Total</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={4} align="right">
                  <Text strong>{formatAmount(t.amount)}</Text>
                  {t.fine > 0 && <div style={{ color: token.colorError, fontWeight: 600 }}>+ {formatAmount(t.fine)}</div>}
                </Table.Summary.Cell>
                <Table.Summary.Cell index={5} colSpan={3} />
                <Table.Summary.Cell index={8} align="right">
                  <Text strong>{formatAmount(t.discount)}</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={9} align="right">
                  <Text strong>{formatAmount(t.fine)}</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={10} align="right">
                  <Text strong>{formatAmount(t.paid)}</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={11} align="right">
                  <Text strong style={{ color: t.balance > 0 ? token.colorError : undefined }}>{formatAmount(t.balance)}</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={12} />
              </Table.Summary.Row>
            )}
          />
        </>
      )}

      <CollectFeesModal studentId={studentId} lines={collecting} onClose={() => setCollecting(null)} onCollected={onCollected} />

      <Modal
        title="Revert payment"
        open={reverting !== null}
        onCancel={() => !revertMutation.isPending && setReverting(null)}
        okText="Revert"
        okButtonProps={{ danger: true, disabled: !reason.trim() }}
        confirmLoading={revertMutation.isPending}
        onOk={() => revertMutation.mutate()}
        destroyOnHidden
      >
        {reverting && (
          <>
            <p>
              Payment <b>{reverting.payment.receiptNumber}</b> of {formatDisplayDate(reverting.payment.paymentDate)} will be reverted. The whole
              payment is reverted, for these fees:
            </p>
            <ul style={{ paddingLeft: token.paddingLG }}>
              {reverting.lines.map((l) => (
                <li key={l.lineId}>
                  {l.label} ({l.feeGroup} · {termLabel(l.term)})
                </li>
              ))}
            </ul>
            <p style={{ color: token.colorTextSecondary }}>The original payment stays on record with a reversal entry; the amount becomes due again.</p>
            <Input.TextArea
              aria-label="Reason for reverting"
              placeholder="Reason (required), e.g. cheque bounced"
              rows={2}
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </>
        )}
      </Modal>

      <ReceiptView paymentId={legacyReceipt} onClose={() => setLegacyReceipt(null)} />
    </div>
  );
}

export default StudentFeesPanel;
