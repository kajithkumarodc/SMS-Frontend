import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Col, Input, Row, Select, Spin, Table, Tag } from 'antd';
import { DollarOutlined } from '@ant-design/icons';
import { fetchStaffPayroll, type StaffPayslip } from '../../../../api/staffMembers';
import { formatDisplayDate } from '../../../../lib/dates';
import { formatAmount } from '../../../fees/format';
import { monthYearLabel } from '../../../payroll/format';
import PayslipModal from '../../../payroll/PayslipModal';
import StatCard from './StatCard';

/** Staff profile > Payroll: totals of the paid payrolls and the payslip history. */
function PayrollTab({ staffId }: { staffId: string }) {
  const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = useState(50);
  const [payslipId, setPayslipId] = useState<string | null>(null);
  const query = useQuery({ queryKey: ['staff-members', 'payroll', staffId], queryFn: () => fetchStaffPayroll(staffId) });

  if (query.isError) {
    return <Alert type="error" showIcon message="Could not load the payroll of this staff member." />;
  }
  if (!query.data) {
    return <Spin />;
  }
  const { totalNetPaid, totalGross, totalEarning, totalDeduction, payslips } = query.data;
  const term = search.trim().toLowerCase();
  const rows = payslips.filter(
    (p) => !term || [monthYearLabel(p.month, p.year), p.modeLabel ?? '', p.status, String(p.netSalary)].some((v) => v.toLowerCase().includes(term)),
  );

  return (
    <div data-testid="staff-payroll">
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} xl={6}>
          <StatCard label="Total Net Salary Paid" value={formatAmount(totalNetPaid)} icon={<DollarOutlined />} />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <StatCard label="Total Gross Salary" value={formatAmount(totalGross)} icon={<DollarOutlined />} />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <StatCard label="Total Earning" value={formatAmount(totalEarning)} icon={<DollarOutlined />} />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <StatCard label="Total Deduction" value={formatAmount(totalDeduction)} icon={<DollarOutlined />} />
        </Col>
      </Row>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <Input.Search allowClear placeholder="Search" aria-label="Search payslips" style={{ maxWidth: 240 }} onChange={(e) => setSearch(e.target.value)} />
        <Select aria-label="Rows per page" value={pageSize} onChange={setPageSize} options={[10, 25, 50, 100].map((n) => ({ value: n, label: n }))} style={{ width: 80 }} />
      </div>
      <Table<StaffPayslip>
        size="small"
        rowKey="id"
        dataSource={rows}
        pagination={{ pageSize, hideOnSinglePage: true, showTotal: (total, [from, to]) => `Showing ${from} to ${to} of ${total} entries` }}
        locale={{ emptyText: 'No payslips yet.' }}
        scroll={{ x: 'max-content' }}
        columns={[
          { title: 'Payslip #', render: (_, __, index) => index + 1 },
          {
            title: 'Month - Year',
            render: (_, p) => monthYearLabel(p.month, p.year),
            sorter: (a, b) => a.year * 12 + a.month - (b.year * 12 + b.month),
          },
          { title: 'Date', dataIndex: 'date', render: (v: string | null) => formatDisplayDate(v) || '' },
          { title: 'Mode', dataIndex: 'modeLabel', render: (v: string | null) => v ?? '' },
          {
            title: 'Status',
            dataIndex: 'status',
            render: (v: StaffPayslip['status']) => <Tag color={v === 'PAID' ? 'success' : 'warning'}>{v === 'PAID' ? 'Paid' : 'Generated'}</Tag>,
          },
          { title: 'Net Salary', dataIndex: 'netSalary', align: 'right', render: (v: number) => formatAmount(v), sorter: (a, b) => a.netSalary - b.netSalary },
          {
            title: 'Action',
            align: 'right',
            render: (_, p) => (p.status === 'PAID' ? <Button size="small" type="primary" onClick={() => setPayslipId(p.id)}>View Payslip</Button> : null),
          },
        ]}
      />
      <PayslipModal payrollId={payslipId} onClose={() => setPayslipId(null)} />
    </div>
  );
}

export default PayrollTab;
