import { useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Descriptions, Modal, Spin, Table, Typography, theme } from 'antd';
import { CloseOutlined, PrinterOutlined } from '@ant-design/icons';
import { fetchPayroll, type PayrollDetail } from '../../api/payrollManagement';
import { formatDisplayDate } from '../../lib/dates';
import { formatAmount } from '../fees/format';
import { monthYearLabel } from './format';
import { PAYROLL_DETAIL_KEY } from './queryKeys';

const { Title, Text } = Typography;

type Props = {
  /** The payroll to show, or null when closed. */
  payrollId: string | null;
  onClose: () => void;
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);
}

/** The date the salary was paid, or that it has not been yet. */
function salaryDate(p: PayrollDetail): string {
  return p.payment ? formatDisplayDate(p.payment.date) : 'Not paid yet';
}

/** The attendance lines of the payslip as [label, value] pairs: how the month's days add up to the salary. */
function attendanceLines(p: PayrollDetail): [string, string][] {
  const a = p.attendancePay;
  return [
    ['Total days in month', String(a.daysInMonth)],
    ['Present days', String(a.presentDays)],
    ['Leave days (unpaid)', `${a.leaveDays} (${a.absentDays} absent, ${a.unmarkedDays} unmarked, ${a.halfDays} half day${a.halfDays === 1 ? '' : 's'} as half)`],
    ['Approved leave (paid)', String(a.paidLeaveDays)],
    ['Holidays and Sundays (paid)', String(a.holidayDays)],
    ['Upcoming days (not earned yet)', String(a.upcomingDays)],
    ['Payable days', String(a.payableDays)],
    ['Per day rate', formatAmount(a.perDayRate)],
    ['Salary for payable days (net)', formatAmount(a.earnedSalary)],
  ];
}

function attendanceRows(p: PayrollDetail): string {
  return attendanceLines(p).map(([label, value]) => `<tr><th>${label}</th><td>${escapeHtml(value)}</td></tr>`).join('');
}

/** Opens the browser print dialog with a plain payslip, so the page's own layout does not get in the way. */
function printPayslip(p: PayrollDetail) {
  const lines = (items: { type: string; amount: number }[]) =>
    items.length === 0
      ? '<tr><td colspan="2" class="muted">None</td></tr>'
      : items.map((l) => `<tr><td>${escapeHtml(l.type)}</td><td class="num">${formatAmount(l.amount)}</td></tr>`).join('');
  const row = (label: string, value: string) => `<tr><th>${label}</th><td>${escapeHtml(value)}</td></tr>`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Payslip ${escapeHtml(p.staff.fullName)} ${monthYearLabel(p.month, p.year)}</title>
<style>
  body { font-family: Arial, sans-serif; margin: 24px; color: #222; }
  h1 { font-size: 20px; margin: 0; text-align: center; } h2 { font-size: 15px; margin: 4px 0 18px; text-align: center; font-weight: normal; }
  h3 { font-size: 14px; margin: 18px 0 6px; }
  table { width: 100%; border-collapse: collapse; } th, td { border: 1px solid #bbb; padding: 6px 8px; font-size: 13px; text-align: left; }
  th { background: #f3f3f3; width: 22%; } td.num { text-align: right; } .muted { color: #888; }
  .cols { display: flex; gap: 16px; } .cols > div { flex: 1; } .total th, .total td { font-weight: bold; }
</style></head><body>
<h1>${escapeHtml(p.schoolName ?? 'Payslip')}</h1>
<h2>Payslip for ${monthYearLabel(p.month, p.year)}</h2>
<table>
  ${row('Staff ID', p.staff.staffId)}${row('Name', p.staff.fullName)}${row('Role', p.staff.roleName ?? '')}
  ${row('Department', p.staff.departmentName ?? '')}${row('Designation', p.staff.designationName ?? '')}${row('EPF No.', p.staff.epfNo ?? '')}
  ${row('Salary Date', salaryDate(p))}
</table>
<div class="cols">
  <div><h3>Earning</h3><table><tr><th>Type</th><th>Amount</th></tr>${lines(p.earnings)}</table></div>
  <div><h3>Deduction</h3><table><tr><th>Type</th><th>Amount</th></tr>${lines(p.deductions)}</table></div>
</div>
<h3>Attendance</h3>
<table>
  ${attendanceRows(p)}
</table>
<h3>Payroll Summary</h3>
<table>
  <tr><th>Basic Salary</th><td class="num">${formatAmount(p.basicSalary)}</td></tr>
  <tr><th>Earning</th><td class="num">${formatAmount(p.earningTotal)}</td></tr>
  <tr><th>Deduction</th><td class="num">${formatAmount(p.deductionTotal)}</td></tr>
  <tr><th>Gross Salary</th><td class="num">${formatAmount(p.grossSalary)}</td></tr>
  <tr><th>Tax</th><td class="num">${formatAmount(p.tax)}</td></tr>
  <tr class="total"><th>Total Salary (Net)</th><td class="num">${formatAmount(p.netSalary)}</td></tr>
</table>
${p.payment ? `<h3>Payment</h3><table>${row('Payment Mode', p.payment.modeLabel)}${row('Payment Date', formatDisplayDate(p.payment.date))}${row('Note', p.payment.note ?? '')}</table>` : ''}
</body></html>`;
  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) return;
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
  win.print();
}

/** A staff member's payslip for one month, with a Print button. */
function PayslipModal({ payrollId, onClose }: Props) {
  const { token } = theme.useToken();
  const open = payrollId !== null;
  const query = useQuery({
    queryKey: [...PAYROLL_DETAIL_KEY, payrollId],
    queryFn: () => fetchPayroll(payrollId as string),
    enabled: open,
  });
  // Keep the last payslip while the modal animates closed -- unmounting mid-close leaves its overlay behind.
  const last = useRef<PayrollDetail | null>(null);
  if (open && query.data) last.current = query.data;
  const payroll = open ? query.data ?? null : last.current;

  const lineColumns = [
    { key: 'type', title: 'Type', dataIndex: 'type' },
    { key: 'amount', title: 'Amount', dataIndex: 'amount', align: 'right' as const, render: (v: number) => formatAmount(v) },
  ];

  return (
    <Modal
      title={<span style={{ color: token.colorWhite, fontSize: token.fontSizeLG, fontWeight: 500 }}>Payslip</span>}
      open={open}
      onCancel={onClose}
      footer={
        payroll && (
          <Button type="primary" icon={<PrinterOutlined />} onClick={() => printPayslip(payroll)}>
            Print
          </Button>
        )
      }
      width={820}
      destroyOnHidden
      closeIcon={<CloseOutlined style={{ color: token.colorWhite, fontSize: 16 }} />}
      styles={{
        content: { padding: 0, overflow: 'hidden' },
        header: { background: token.colorPrimary, padding: `${token.paddingSM}px ${token.paddingLG}px`, margin: 0 },
        body: { padding: token.paddingLG, maxHeight: '70vh', overflowY: 'auto' },
      }}
    >
      {query.isError ? (
        <Alert type="warning" showIcon message="Couldn't load the payslip" />
      ) : !payroll ? (
        <div style={{ textAlign: 'center', padding: token.paddingXL }}>
          <Spin />
        </div>
      ) : (
        <div data-testid="payslip">
          <Title level={4} style={{ textAlign: 'center', margin: 0 }}>
            {payroll.schoolName ?? 'Payslip'}
          </Title>
          <Text style={{ display: 'block', textAlign: 'center', marginBottom: token.marginMD }} type="secondary">
            Payslip for {monthYearLabel(payroll.month, payroll.year)}
          </Text>
          <Descriptions size="small" bordered column={{ xs: 1, md: 2 }}>
            <Descriptions.Item label="Staff ID">{payroll.staff.staffId}</Descriptions.Item>
            <Descriptions.Item label="Name">{payroll.staff.fullName}</Descriptions.Item>
            <Descriptions.Item label="Role">{payroll.staff.roleName ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="Department">{payroll.staff.departmentName ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="Designation">{payroll.staff.designationName ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="EPF No.">{payroll.staff.epfNo ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="Salary Date">
              <Text strong>{salaryDate(payroll)}</Text>
            </Descriptions.Item>
          </Descriptions>
          <Title level={5} style={{ marginTop: token.marginMD }}>
            Attendance
          </Title>
          <Descriptions size="small" bordered column={{ xs: 1, md: 2 }}>
            {attendanceLines(payroll).map(([label, value]) => (
              <Descriptions.Item key={label} label={label}>
                {value}
              </Descriptions.Item>
            ))}
          </Descriptions>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: token.marginMD, marginTop: token.marginMD }}>
            <div>
              <Title level={5}>Earning</Title>
              <Table size="small" pagination={false} rowKey={(_r, i) => String(i)} columns={lineColumns} dataSource={payroll.earnings} locale={{ emptyText: 'None' }} />
            </div>
            <div>
              <Title level={5}>Deduction</Title>
              <Table size="small" pagination={false} rowKey={(_r, i) => String(i)} columns={lineColumns} dataSource={payroll.deductions} locale={{ emptyText: 'None' }} />
            </div>
          </div>
          <Title level={5} style={{ marginTop: token.marginMD }}>
            Payroll Summary
          </Title>
          <Descriptions size="small" bordered column={1}>
            <Descriptions.Item label="Basic Salary">{formatAmount(payroll.basicSalary)}</Descriptions.Item>
            <Descriptions.Item label="Earning">{formatAmount(payroll.earningTotal)}</Descriptions.Item>
            <Descriptions.Item label="Deduction">{formatAmount(payroll.deductionTotal)}</Descriptions.Item>
            <Descriptions.Item label="Gross Salary">{formatAmount(payroll.grossSalary)}</Descriptions.Item>
            <Descriptions.Item label="Tax">{formatAmount(payroll.tax)}</Descriptions.Item>
            <Descriptions.Item label="Total Salary (Net)">
              <Text strong style={{ fontSize: token.fontSizeLG }}>{formatAmount(payroll.netSalary)}</Text>
            </Descriptions.Item>
          </Descriptions>
          {payroll.payment && (
            <>
              <Title level={5} style={{ marginTop: token.marginMD }}>
                Payment
              </Title>
              <Descriptions size="small" bordered column={1}>
                <Descriptions.Item label="Payment Mode">{payroll.payment.modeLabel}</Descriptions.Item>
                <Descriptions.Item label="Payment Date">{formatDisplayDate(payroll.payment.date)}</Descriptions.Item>
                <Descriptions.Item label="Note">{payroll.payment.note ?? '—'}</Descriptions.Item>
              </Descriptions>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}

export default PayslipModal;
