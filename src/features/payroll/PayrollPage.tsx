import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, Card, Col, Empty, Form, Popconfirm, Result, Row, Select, Space, Spin, Table, Tag, Tooltip, Typography, theme } from 'antd';
import type { ColumnsType } from 'antd/es/table/interface';
import { EditOutlined, RollbackOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  fetchPayrollRoles,
  fetchPayrollRows,
  generateStaffPayroll,
  revertPayroll,
  type PayrollRow,
} from '../../api/payrollManagement';
import { useAuthStore } from '../../store/authStore';
import { hasPermission } from '../../lib/roles';
import { serverMessage } from '../../lib/apiErrors';
import {
  copyRows,
  downloadCsv,
  downloadExcel,
  downloadPdf,
  printRows,
  type ExportColumn,
  type ExportKind,
} from '../../lib/tableExport';
import DataTableToolbar from '../../components/DataTableToolbar';
import { MONTH_NAMES, PAYROLL_STATUS_LABEL, monthYearLabel } from './format';
import { PAYROLL_ROLES_KEY, PAYROLL_ROWS_KEY } from './queryKeys';
import ProceedToPayModal from './ProceedToPayModal';
import PayslipModal from './PayslipModal';

const { Title, Text } = Typography;

const DEFAULT_PAGE_SIZE = 50;
const HIDDEN_COLUMNS_STORAGE_KEY = 'sms.payroll.hiddenColumns';
const STATUS_COLOR = { NOT_GENERATED: 'default', GENERATED: 'warning', PAID: 'success' } as const;

const DATA_COLUMNS: { key: string; title: string; value: (r: PayrollRow) => string; align?: 'right' }[] = [
  { key: 'staffId', title: 'Staff ID', value: (r) => r.staffId },
  { key: 'fullName', title: 'Name', value: (r) => r.fullName },
  { key: 'roleName', title: 'Role', value: (r) => r.roleName ?? '' },
  { key: 'departmentName', title: 'Department', value: (r) => r.departmentName ?? '' },
  { key: 'designationName', title: 'Designation', value: (r) => r.designationName ?? '' },
  { key: 'phone', title: 'Phone', value: (r) => r.phone ?? '', align: 'right' },
  { key: 'status', title: 'Status', value: (r) => PAYROLL_STATUS_LABEL[r.status] },
];

const SEARCH_STORAGE_KEY = 'sms.payroll.lastSearch';

type Searched = { roleId: string; month: number; year: number };

function readLastSearch(): Searched | null {
  try {
    const parsed: unknown = JSON.parse(sessionStorage.getItem(SEARCH_STORAGE_KEY) ?? 'null');
    const s = parsed as Partial<Searched> | null;
    return s && typeof s.roleId === 'string' && typeof s.month === 'number' && typeof s.year === 'number' ? (s as Searched) : null;
  } catch {
    return null;
  }
}

function writeLastSearch(search: Searched) {
  try {
    sessionStorage.setItem(SEARCH_STORAGE_KEY, JSON.stringify(search));
  } catch {
    // Storage blocked -- the list just will not come back by itself.
  }
}

function readHiddenColumns(): string[] {
  try {
    const raw = localStorage.getItem(HIDDEN_COLUMNS_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

function writeHiddenColumns(hidden: string[]) {
  try {
    localStorage.setItem(HIDDEN_COLUMNS_STORAGE_KEY, JSON.stringify(hidden));
  } catch {
    // Storage blocked -- the choice just won't persist.
  }
}

/** Human Resource -> Payroll (/app/human-resource/payroll): generate, edit, pay and revert a role's monthly payroll. */
function PayrollPage() {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const permissions = useAuthStore((state) => state.user?.permissions);
  const canView = hasPermission(permissions, 'PAYROLL_VIEW');
  const canGenerate = hasPermission(permissions, 'PAYROLL_CREATE');
  const canPay = hasPermission(permissions, 'PAYROLL_APPROVE');
  const canExport = hasPermission(permissions, 'PAYROLL_EXPORT');
  const canPrint = hasPermission(permissions, 'PAYROLL_PRINT');

  const now = dayjs();
  const [last] = useState(readLastSearch);
  const [roleId, setRoleId] = useState<string | undefined>(last?.roleId);
  const [month, setMonth] = useState(last?.month ?? now.month() + 1);
  const [year, setYear] = useState(last?.year ?? now.year());
  const [roleError, setRoleError] = useState<string>();
  /** What was last searched; the Staff List shows once this is set. */
  const [searched, setSearched] = useState<Searched | null>(last);
  const [tableSearch, setTableSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [hiddenColumns, setHiddenColumns] = useState<string[]>(readHiddenColumns);
  const [exporting, setExporting] = useState<ExportKind | null>(null);
  const [paying, setPaying] = useState<PayrollRow | null>(null);
  const [payslipId, setPayslipId] = useState<string | null>(null);

  const rolesQuery = useQuery({ queryKey: PAYROLL_ROLES_KEY, queryFn: fetchPayrollRoles, enabled: canView });
  const rowsQuery = useQuery({
    queryKey: [...PAYROLL_ROWS_KEY, searched?.roleId, searched?.month, searched?.year],
    queryFn: () => fetchPayrollRows(searched!.roleId, searched!.month, searched!.year),
    enabled: canView && searched !== null,
  });
  const rows = useMemo(() => rowsQuery.data ?? [], [rowsQuery.data]);
  const visibleDataColumns = useMemo(() => DATA_COLUMNS.filter((c) => !hiddenColumns.includes(c.key)), [hiddenColumns]);
  const tableRows = useMemo(() => {
    const term = tableSearch.trim().toLowerCase();
    return term ? rows.filter((r) => DATA_COLUMNS.some((c) => c.value(r).toLowerCase().includes(term))) : rows;
  }, [rows, tableSearch]);

  const refresh = () => void queryClient.invalidateQueries({ queryKey: PAYROLL_ROWS_KEY });

  const generateMutation = useMutation({
    mutationFn: (row: PayrollRow) => generateStaffPayroll(row.staffProfileId, searched!.month, searched!.year),
    onSuccess: (payroll) => {
      message.success(`Payroll generated for ${payroll.staff.fullName}`);
      refresh();
    },
    onError: (error) => message.error(serverMessage(error) ?? 'Could not generate the payroll. Please try again.'),
  });

  const revertMutation = useMutation({
    mutationFn: (row: PayrollRow) => revertPayroll(row.payrollId as string),
    onSuccess: (_data, row) => {
      message.success(row.status === 'PAID' ? `Payment of ${row.fullName} reverted` : `Payroll of ${row.fullName} removed`);
      refresh();
    },
    onError: (error) => message.error(serverMessage(error) ?? 'Could not revert the payroll. Please try again.'),
  });

  if (!canView) {
    return <Result status="403" title="Not available" subTitle="You don't have permission to view payroll." />;
  }

  const search = () => {
    if (!roleId) {
      setRoleError('Role is required');
      return;
    }
    setRoleError(undefined);
    setSearched({ roleId, month, year });
    writeLastSearch({ roleId, month, year });
    setTableSearch('');
    setPage(1);
  };

  const handleExport = async (kind: ExportKind) => {
    setExporting(kind);
    try {
      const columns: ExportColumn<PayrollRow>[] = visibleDataColumns.map((c) => ({ title: c.title, value: c.value }));
      const fileBase = `payroll-${monthYearLabel(searched!.month, searched!.year).toLowerCase()}`;
      const title = `Payroll ${monthYearLabel(searched!.month, searched!.year)}`;
      if (kind === 'copy') {
        await copyRows(tableRows, columns);
        message.success(`Copied ${tableRows.length} row${tableRows.length === 1 ? '' : 's'} to the clipboard`);
      } else if (kind === 'csv') downloadCsv(tableRows, columns, fileBase);
      else if (kind === 'excel') await downloadExcel(tableRows, columns, fileBase, title);
      else if (kind === 'pdf') await downloadPdf(tableRows, columns, fileBase, title);
      else printRows(tableRows, columns, title);
    } catch {
      message.error("Couldn't export the payroll list. Please try again.");
    } finally {
      setExporting(null);
    }
  };

  const actions = (row: PayrollRow) => {
    const revert = (label: string, description: string) => (
      <Popconfirm title={label} description={description} okText="Revert" okButtonProps={{ danger: true }} onConfirm={() => revertMutation.mutate(row)}>
        <Tooltip title="Revert">
          <Button type="primary" size="small" icon={<RollbackOutlined />} aria-label={`Revert payroll of ${row.fullName}`} />
        </Tooltip>
      </Popconfirm>
    );
    if (row.status === 'NOT_GENERATED') {
      return canGenerate ? (
        <Button type="primary" size="small" loading={generateMutation.isPending && generateMutation.variables?.staffProfileId === row.staffProfileId} onClick={() => generateMutation.mutate(row)}>
          Generate Payroll
        </Button>
      ) : null;
    }
    if (row.status === 'GENERATED') {
      return (
        <Space size={token.marginXXS}>
          {canGenerate && (
            <Tooltip title="Edit">
              <Button type="primary" size="small" icon={<EditOutlined />} aria-label={`Edit payroll of ${row.fullName}`} onClick={() => navigate(`/app/human-resource/payroll/${row.payrollId}/edit`)} />
            </Tooltip>
          )}
          {canGenerate && revert(`Remove the payroll of ${row.fullName}?`, 'Its earnings, deductions and tax will be deleted. You can generate it again.')}
          {canPay && (
            <Button type="primary" size="small" onClick={() => setPaying(row)}>
              Proceed To Pay
            </Button>
          )}
        </Space>
      );
    }
    return (
      <Space size={token.marginXXS}>
        {canPay && revert(`Revert the payment of ${row.fullName}?`, 'The payroll goes back to Generated and the payment details are cleared.')}
        <Button type="primary" size="small" onClick={() => setPayslipId(row.payrollId)}>
          View Payslip
        </Button>
      </Space>
    );
  };

  const columns: ColumnsType<PayrollRow> = [
    ...visibleDataColumns.map((c) => ({
      key: c.key,
      title: c.title,
      align: c.align,
      sorter: (a: PayrollRow, b: PayrollRow) => c.value(a).localeCompare(c.value(b), undefined, { numeric: true, sensitivity: 'base' }),
      render: (_: unknown, record: PayrollRow) =>
        c.key === 'status' ? <Tag color={STATUS_COLOR[record.status]}>{c.value(record)}</Tag> : c.value(record),
    })),
    { key: 'action', title: 'Action', align: 'right', render: (_: unknown, record: PayrollRow) => actions(record) },
  ];

  const roleName = rolesQuery.data?.find((r) => r.id === searched?.roleId)?.name;
  const yearOptions = Array.from({ length: 6 }, (_, i) => now.year() - i).map((y) => ({ value: y, label: String(y) }));

  return (
    <div>
      <Card title={<Title level={4} style={{ margin: 0, fontWeight: 500 }}>Select Criteria</Title>} style={{ marginBottom: token.marginLG }}>
        <Form layout="vertical" onFinish={search}>
          <Row gutter={token.marginLG}>
            <Col xs={24} md={8}>
              <Form.Item label="Role" htmlFor="payroll-role" required validateStatus={roleError ? 'error' : undefined} help={roleError}>
                <Select
                  id="payroll-role"
                  placeholder="Select"
                  showSearch
                  optionFilterProp="label"
                  loading={rolesQuery.isLoading}
                  options={(rolesQuery.data ?? []).map((r) => ({ value: r.id, label: r.name }))}
                  value={roleId}
                  onChange={(value: string) => {
                    setRoleId(value);
                    setRoleError(undefined);
                  }}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item label="Month" htmlFor="payroll-month">
                <Select id="payroll-month" options={MONTH_NAMES.map((m, i) => ({ value: i + 1, label: m }))} value={month} onChange={setMonth} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item label="Year" htmlFor="payroll-year">
                <Select id="payroll-year" options={yearOptions} value={year} onChange={setYear} />
              </Form.Item>
            </Col>
          </Row>
          <div style={{ textAlign: 'right' }}>
            <Button type="primary" htmlType="submit" icon={<SearchOutlined />} aria-label="Search staff">
              Search
            </Button>
          </div>
        </Form>
      </Card>

      {searched && (
        <Card title={<Title level={4} style={{ margin: 0, fontWeight: 500 }}>Staff List</Title>}>
          {rowsQuery.isError ? (
            <Alert
              type="warning"
              showIcon
              message="Couldn't load the staff list"
              description="There was a problem reaching the server."
              action={
                <Button size="small" onClick={() => void rowsQuery.refetch()}>
                  Try again
                </Button>
              }
            />
          ) : rowsQuery.isLoading ? (
            <div style={{ textAlign: 'center', padding: token.paddingXL }}>
              <Spin />
            </div>
          ) : (
            <>
              <Text type="secondary" style={{ display: 'block', marginBottom: token.marginSM }}>
                {roleName ?? 'Staff'} &middot; {monthYearLabel(searched.month, searched.year)}
              </Text>
              <DataTableToolbar
                search={tableSearch}
                onSearchChange={(value) => {
                  setTableSearch(value);
                  setPage(1);
                }}
                searchPlaceholder="Search"
                pageSize={pageSize}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setPage(1);
                }}
                columns={DATA_COLUMNS.map((c) => ({ key: c.key, title: c.title }))}
                hiddenColumns={hiddenColumns}
                onHiddenColumnsChange={(hidden) => {
                  setHiddenColumns(hidden);
                  writeHiddenColumns(hidden);
                }}
                onExport={(kind) => void handleExport(kind)}
                exporting={exporting}
                canExport={canExport}
                canPrint={canPrint}
              />
              <Table<PayrollRow>
                rowKey="staffProfileId"
                size="middle"
                columns={columns}
                dataSource={tableRows}
                scroll={{ x: 'max-content' }}
                locale={{
                  emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No active staff with this role. Try a different role." />,
                }}
                pagination={{
                  current: page,
                  pageSize,
                  showSizeChanger: false,
                  showTotal: (count, [start, end]) =>
                    count === 0 ? '' : <Text type="secondary">Showing {start} to {end} of {count} entries</Text>,
                  onChange: (nextPage) => setPage(nextPage),
                }}
              />
            </>
          )}
        </Card>
      )}

      <ProceedToPayModal row={paying} month={searched?.month ?? month} year={searched?.year ?? year} onClose={() => setPaying(null)} />
      <PayslipModal payrollId={payslipId} onClose={() => setPayslipId(null)} />
    </div>
  );
}

export default PayrollPage;
