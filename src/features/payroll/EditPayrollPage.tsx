import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Avatar, Button, Card, Col, Descriptions, Input, InputNumber, Result, Row, Space, Spin, Table, Typography, theme } from 'antd';
import { CalculatorOutlined, CloseOutlined, PlusOutlined, UserOutlined } from '@ant-design/icons';
import { fetchPayroll, updatePayroll, type PayrollDetail, type PayrollLine } from '../../api/payrollManagement';
import { staffPhotoUrl } from '../../api/staffMembers';
import { useAuthStore } from '../../store/authStore';
import { hasPermission } from '../../lib/roles';
import { serverMessage } from '../../lib/apiErrors';
import { formatAmount } from '../fees/format';
import { monthName, roundMoney } from './format';
import { PAYROLL_DETAIL_KEY, PAYROLL_ROWS_KEY } from './queryKeys';

const { Title, Text } = Typography;

const PAYROLL_PAGE = '/app/human-resource/payroll';

/** The deduction line Calculate keeps in step with the attendance (the server names it `Loss of pay (n days)`). */
const LOSS_OF_PAY = 'Loss of pay';

/** One line being edited; blank lines are dropped on save. */
type Draft = { key: number; type: string; amount: number | null };

let nextKey = 1;
const blankLine = (): Draft => ({ key: nextKey++, type: '', amount: null });
const toDrafts = (lines: PayrollLine[]): Draft[] =>
  lines.length === 0 ? [blankLine()] : lines.map((l) => ({ key: nextKey++, type: l.type, amount: l.amount }));
const sum = (drafts: Draft[]) => roundMoney(drafts.reduce((total, d) => total + (d.amount ?? 0), 0));

/** Why the lines cannot be saved, or undefined. A line with neither a type nor an amount is just empty. */
function lineProblem(kind: string, drafts: Draft[]): string | undefined {
  for (const d of drafts) {
    const hasAmount = (d.amount ?? 0) > 0;
    if (hasAmount && !d.type.trim()) return `Enter a type for every ${kind} amount`;
    if (d.type.trim() && !hasAmount) return `Enter an amount for "${d.type.trim()}" or remove it`;
    if (d.type.trim().length > 100) return 'Keep each type under 100 characters';
  }
  return undefined;
}

const keepFilled = (drafts: Draft[]): PayrollLine[] =>
  drafts.filter((d) => d.type.trim() && (d.amount ?? 0) > 0).map((d) => ({ type: d.type.trim(), amount: roundMoney(d.amount as number) }));

type LinesProps = {
  title: string;
  kind: string;
  drafts: Draft[];
  disabled: boolean;
  onChange: (drafts: Draft[]) => void;
};

/** One of the Earning / Deduction columns: a list of Type + amount rows with add and remove. */
function LinesColumn({ title, kind, drafts, disabled, onChange }: LinesProps) {
  const { token } = theme.useToken();
  const update = (key: number, patch: Partial<Draft>) => onChange(drafts.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: token.marginSM }}>
        <Title level={4} style={{ margin: 0, fontWeight: 500 }}>
          {title}
        </Title>
        {!disabled && (
          <Button type="primary" size="small" icon={<PlusOutlined />} aria-label={`Add ${kind}`} onClick={() => onChange([...drafts, blankLine()])} />
        )}
      </div>
      <Card size="small" styles={{ body: { minHeight: 220 } }}>
        {drafts.map((d) => (
          <Space.Compact key={d.key} style={{ width: '100%', marginBottom: token.marginXS }}>
            <Input
              variant="underlined"
              placeholder="Type"
              maxLength={100}
              disabled={disabled}
              aria-label={`${title} type`}
              value={d.type}
              onChange={(e) => update(d.key, { type: e.target.value })}
            />
            <InputNumber
              variant="underlined"
              min={0}
              precision={2}
              placeholder="0.00"
              disabled={disabled}
              style={{ width: 130 }}
              aria-label={`${title} amount`}
              value={d.amount}
              onChange={(v) => update(d.key, { amount: typeof v === 'number' ? v : null })}
            />
            {!disabled && (
              <Button
                type="text"
                danger
                icon={<CloseOutlined />}
                aria-label={`Remove ${kind} line`}
                onClick={() => {
                  const rest = drafts.filter((x) => x.key !== d.key);
                  onChange(rest.length === 0 ? [blankLine()] : rest);
                }}
              />
            )}
          </Space.Compact>
        ))}
      </Card>
    </>
  );
}

/** Human Resource -> Payroll -> Edit Payroll (/app/human-resource/payroll/:payrollId/edit). */
function EditPayrollPage() {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { payrollId } = useParams<{ payrollId: string }>();
  const canEdit = hasPermission(useAuthStore((state) => state.user?.permissions), 'PAYROLL_CREATE');

  const query = useQuery({
    queryKey: [...PAYROLL_DETAIL_KEY, payrollId],
    queryFn: () => fetchPayroll(payrollId as string),
    enabled: canEdit,
  });
  const payroll = query.data;

  const [earnings, setEarnings] = useState<Draft[]>([blankLine()]);
  const [deductions, setDeductions] = useState<Draft[]>([blankLine()]);
  const [tax, setTax] = useState<number | null>(null);

  useEffect(() => {
    if (payroll) {
      setEarnings(toDrafts(payroll.earnings));
      setDeductions(toDrafts(payroll.deductions));
      setTax(payroll.tax > 0 ? payroll.tax : null);
    }
  }, [payroll]);

  const summary = useMemo(() => {
    const basic = payroll?.basicSalary ?? 0;
    const earning = sum(earnings);
    const deduction = sum(deductions);
    const taxAmount = roundMoney(tax ?? 0);
    const gross = roundMoney(basic + earning);
    return { basic, earning, deduction, gross, tax: taxAmount, net: roundMoney(gross - deduction - taxAmount) };
  }, [payroll, earnings, deductions, tax]);

  const problem = lineProblem('earning', earnings) ?? lineProblem('deduction', deductions) ?? (summary.net < 0 ? 'The deductions and tax are more than the gross salary' : undefined);

  const saveMutation = useMutation({
    mutationFn: () => updatePayroll(payrollId as string, { earnings: keepFilled(earnings), deductions: keepFilled(deductions), tax: roundMoney(tax ?? 0) }),
    onSuccess: (saved: PayrollDetail) => {
      message.success(`Payroll of ${saved.staff.fullName} saved`);
      void queryClient.invalidateQueries({ queryKey: PAYROLL_ROWS_KEY });
      queryClient.setQueryData([...PAYROLL_DETAIL_KEY, payrollId], saved);
      navigate(PAYROLL_PAGE);
    },
    onError: (error) => message.error(serverMessage(error) ?? 'Could not save the payroll. Please try again.'),
  });

  if (!canEdit) {
    return <Result status="403" title="Not available" subTitle="You don't have permission to edit payroll." />;
  }
  if (query.isError) {
    return <Result status="404" title="Payroll not found" extra={<Button onClick={() => navigate(PAYROLL_PAGE)}>Back to Payroll</Button>} />;
  }
  if (!payroll) {
    return (
      <div style={{ textAlign: 'center', padding: token.paddingXL }}>
        <Spin />
      </div>
    );
  }

  const locked = payroll.status === 'PAID';
  const pay = payroll.attendancePay;
  const staff = payroll.staff;

  /**
   * Works the salary out from the month's attendance: re-reads it, then replaces the loss-of-pay deduction line
   * with what the unpaid days (absent, half days) come to. The other lines are kept as typed.
   */
  const calculate = async () => {
    const fresh = (await query.refetch()).data;
    const latest = fresh?.attendancePay ?? payroll.attendancePay;
    const others = deductions.filter((d) => !d.type.trim().toLowerCase().startsWith(LOSS_OF_PAY.toLowerCase()));
    const next = latest.lossOfPay > 0 ? [...keepFilled(others), { type: latest.deductionType, amount: latest.lossOfPay }] : keepFilled(others);
    // Also tidy the amounts to cents and drop empty rows, so what is shown is exactly what will be saved.
    setEarnings(toDrafts(keepFilled(earnings)));
    setDeductions(toDrafts(next));
    setTax(summary.tax > 0 ? summary.tax : null);
    message.success(latest.lossOfPay > 0 ? `${latest.deductionType} of ${formatAmount(latest.lossOfPay)} applied` : 'No loss of pay: no leave days this month');
  };

  const save = () => {
    if (problem) {
      message.error(problem);
      return;
    }
    saveMutation.mutate();
  };

  const summaryRow = (label: string, value: number, opts: { danger?: boolean; bold?: boolean } = {}) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: `${token.paddingSM}px 0`, borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
      <Text>{label}</Text>
      <Text strong={opts.bold ?? true} type={opts.danger && value > 0 ? 'danger' : undefined} style={{ fontSize: token.fontSizeXL }}>
        {formatAmount(value)}
      </Text>
    </div>
  );

  return (
    <Card
      title={
        <Title level={4} style={{ margin: 0, fontWeight: 500 }}>
          Edit Payroll For : {monthName(payroll.month)} {payroll.year}
        </Title>
      }
      extra={<Button type="primary" icon={<span aria-hidden>&larr;</span>} aria-label="Back to Payroll" onClick={() => navigate(PAYROLL_PAGE)} />}
    >
      {locked && (
        <Alert type="info" showIcon style={{ marginBottom: token.marginMD }} message="This payroll is already paid. Revert it from the Payroll list to change it." />
      )}
      <Row gutter={token.marginLG} style={{ marginBottom: token.marginLG }}>
        <Col xs={24} xl={15}>
          <div style={{ display: 'flex', gap: token.marginMD, border: `1px solid ${token.colorBorderSecondary}`, borderRadius: token.borderRadius, padding: token.paddingSM }}>
            {staff.hasPhoto ? (
              <img src={staffPhotoUrl(staff.staffProfileId, staff.photoVersion)} alt={staff.fullName} style={{ width: 130, height: 130, objectFit: 'cover', flex: 'none' }} />
            ) : (
              <Avatar shape="square" size={130} icon={<UserOutlined />} style={{ flex: 'none' }} />
            )}
            <Descriptions size="small" column={2} colon={false} style={{ flex: 1 }} labelStyle={{ fontWeight: 600 }}>
              <Descriptions.Item label="Name">{staff.fullName}</Descriptions.Item>
              <Descriptions.Item label="Staff ID">{staff.staffId}</Descriptions.Item>
              <Descriptions.Item label="Phone">{staff.phone ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="Email">{staff.email}</Descriptions.Item>
              <Descriptions.Item label="EPF No.">{staff.epfNo ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="Role">{staff.roleName ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="Department">{staff.departmentName ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="Designation">{staff.designationName ?? '—'}</Descriptions.Item>
            </Descriptions>
          </div>
        </Col>
        <Col xs={24} xl={9}>
          <Table
            size="small"
            bordered
            pagination={false}
            rowKey={(r) => `${r.year}-${r.month}`}
            dataSource={payroll.attendance}
            title={() => <Text strong>Attendance</Text>}
            columns={[
              { key: 'month', title: 'Month', render: (_v, r) => monthName(r.month) },
              { key: 'p', title: <Tooltipped label="P" hint="Present" />, align: 'center', dataIndex: 'present' },
              { key: 'l', title: <Tooltipped label="L" hint="Late" />, align: 'center', dataIndex: 'late' },
              { key: 'a', title: <Tooltipped label="A" hint="Absent" />, align: 'center', dataIndex: 'absent' },
              { key: 'f', title: <Tooltipped label="F" hint="Half Day" />, align: 'center', dataIndex: 'halfDay' },
              { key: 'h', title: <Tooltipped label="H" hint="Holiday" />, align: 'center', dataIndex: 'holiday' },
              { key: 'sh', title: <Tooltipped label="SH" hint="Half Day (Second Half)" />, align: 'center', dataIndex: 'halfDaySecondHalf' },
              { key: 'v', title: <Tooltipped label="V" hint="Approved leave days" />, align: 'center', dataIndex: 'leave' },
              { key: 'u', title: <Tooltipped label="U" hint="Unmarked days (taken as leave)" />, align: 'center', dataIndex: 'unmarked' },
            ]}
          />
        </Col>
      </Row>

      <Row gutter={token.marginLG}>
        <Col xs={24} md={12} xl={8}>
          <LinesColumn title="Earning" kind="earning" drafts={earnings} disabled={locked} onChange={setEarnings} />
        </Col>
        <Col xs={24} md={12} xl={8}>
          <LinesColumn title="Deduction" kind="deduction" drafts={deductions} disabled={locked} onChange={setDeductions} />
        </Col>
        <Col xs={24} xl={8}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: token.marginSM }}>
            <Title level={4} style={{ margin: 0, fontWeight: 500 }}>
              Payroll Summary
            </Title>
            {!locked && (
              <Button type="primary" size="small" icon={<CalculatorOutlined />} loading={query.isRefetching} onClick={() => void calculate()}>
                Calculate
              </Button>
            )}
          </div>
          <Card size="small">
            {summaryRow('Basic Salary', summary.basic)}
            {summaryRow('Earning', summary.earning)}
            {summaryRow('Deduction', summary.deduction, { danger: true })}
            {summaryRow('Gross Salary', summary.gross)}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: `${token.paddingSM}px 0`, borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
              <label htmlFor="payroll-tax">Tax</label>
              <InputNumber
                id="payroll-tax"
                variant="underlined"
                min={0}
                precision={2}
                placeholder="0.00"
                disabled={locked}
                style={{ width: 140 }}
                value={tax}
                onChange={(v) => setTax(typeof v === 'number' ? v : null)}
              />
            </div>
            {summaryRow('Net Salary', summary.net)}
          </Card>
          <Card size="small" title="Salary for attendance" style={{ marginTop: token.marginSM }} data-testid="attendance-pay">
            <Descriptions size="small" column={1} colon={false}>
              <Descriptions.Item label="Total days in month">{pay.daysInMonth}</Descriptions.Item>
              <Descriptions.Item label="Present days">{pay.presentDays}</Descriptions.Item>
              <Descriptions.Item label="Leave days (unpaid)">
                <Text type={pay.leaveDays > 0 ? 'danger' : undefined}>{pay.leaveDays}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Upcoming days (not earned yet)">{pay.upcomingDays}</Descriptions.Item>
              <Descriptions.Item label="Payable days">{pay.payableDays}</Descriptions.Item>
              <Descriptions.Item label="Per day rate">{formatAmount(pay.perDayRate)}</Descriptions.Item>
              <Descriptions.Item label="Salary for payable days (net)">{formatAmount(pay.earnedSalary)}</Descriptions.Item>
              <Descriptions.Item label="Loss of pay">{formatAmount(pay.lossOfPay)}</Descriptions.Item>
            </Descriptions>
            <Text type="secondary" style={{ fontSize: token.fontSizeSM, display: 'block' }}>
              Payable days = present days + {pay.paidLeaveDays} approved leave + {pay.holidayDays} holiday / Sunday. Not paid:
              {' '}{pay.leaveDays} leave days ({pay.absentDays} absent + {pay.unmarkedDays} unmarked + {pay.halfDays} half day
              {pay.halfDays === 1 ? '' : 's'} counted as half) and {pay.upcomingDays} upcoming days that have not finished yet.
              Calculate applies the loss of pay as a deduction, so the net salary is the salary for the payable days.
            </Text>
          </Card>
        </Col>
      </Row>

      {problem && !locked && <Alert type="warning" showIcon style={{ marginTop: token.marginMD }} message={problem} />}
      {!locked && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: token.marginXS, marginTop: token.marginLG }}>
          <Button onClick={() => navigate(PAYROLL_PAGE)}>Cancel</Button>
          <Button type="primary" onClick={save} loading={saveMutation.isPending}>
            Save
          </Button>
        </div>
      )}
    </Card>
  );
}

/** A column heading letter that explains itself on hover. */
function Tooltipped({ label, hint }: { label: string; hint: string }) {
  return <span title={hint}>{label}</span>;
}

export default EditPayrollPage;
