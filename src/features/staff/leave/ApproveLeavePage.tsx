import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, Card, Empty, Popconfirm, Result, Space, Table, Tag, Tooltip, Typography, theme } from 'antd';
import type { ColumnsType } from 'antd/es/table/interface';
import { CloseOutlined, MenuOutlined, PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  deleteLeaveRequest,
  fetchLeaveRequests,
  HALF_DAY_LABEL,
  LEAVE_STATUS_LABEL,
  type LeaveRequestRow,
} from '../../../api/leaveManagement';
import { useAuthStore } from '../../../store/authStore';
import { hasPermission, hasRole } from '../../../lib/roles';
import { formatDisplayDate } from '../../../lib/dates';
import { serverMessage } from '../../../lib/apiErrors';
import {
  copyRows,
  downloadCsv,
  downloadExcel,
  downloadPdf,
  printRows,
  type ExportColumn,
  type ExportKind,
} from '../../../lib/tableExport';
import DataTableToolbar from '../../../components/DataTableToolbar';
import LeaveFormModal from './LeaveFormModal';
import { LEAVE_REQUESTS_KEY } from './queryKeys';

const { Title, Text } = Typography;

const DEFAULT_PAGE_SIZE = 50;
const HIDDEN_COLUMNS_STORAGE_KEY = 'sms.leaveRequests.hiddenColumns';
const STATUS_COLOR = { PENDING: 'warning', APPROVED: 'success', REJECTED: 'error' } as const;

const staffLabel = (r: LeaveRequestRow) => `${r.staffName ?? '—'}${r.staffId ? ` (${r.staffId})` : ''}`;
const leaveDates = (r: LeaveRequestRow) => `${formatDisplayDate(r.fromDate)} - ${formatDisplayDate(r.toDate)}`;

const DATA_COLUMNS: { key: string; title: string; value: (r: LeaveRequestRow) => string; sortValue?: (r: LeaveRequestRow) => string | number; align?: 'right' }[] = [
  { key: 'staff', title: 'Staff', value: staffLabel },
  { key: 'leaveType', title: 'Leave Type', value: (r) => r.leaveTypeName },
  { key: 'sentTo', title: 'Sent To', value: (r) => r.approverLabel },
  { key: 'halfDay', title: 'Half Day', value: (r) => (r.halfDay ? HALF_DAY_LABEL[r.halfDay] : '') },
  { key: 'leaveDate', title: 'Leave Date', value: leaveDates, sortValue: (r) => r.fromDate },
  { key: 'days', title: 'Days', value: (r) => r.days.toFixed(2), sortValue: (r) => r.days, align: 'right' },
  { key: 'applyDate', title: 'Apply Date', value: (r) => formatDisplayDate(r.applyDate), sortValue: (r) => r.applyDate },
  { key: 'status', title: 'Status', value: (r) => LEAVE_STATUS_LABEL[r.status] },
];

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

/** Human Resource -> Approve Leave Request (/app/human-resource/approve-leave-request). */
function ApproveLeavePage() {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const permissions = useAuthStore((state) => state.user?.permissions);
  const roles = useAuthStore((state) => state.user?.roles);
  const canView = hasPermission(permissions, 'LEAVE_VIEW');
  const canAdd = hasPermission(permissions, 'LEAVE_CREATE');
  const canApprove = hasPermission(permissions, 'LEAVE_APPROVE');
  const canExport = canApprove;
  const isPrincipal = hasRole(roles, 'PRINCIPAL');

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [hiddenColumns, setHiddenColumns] = useState<string[]>(readHiddenColumns);
  const [exporting, setExporting] = useState<ExportKind | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<LeaveRequestRow | null>(null);

  const requestsQuery = useQuery({ queryKey: LEAVE_REQUESTS_KEY, queryFn: fetchLeaveRequests, enabled: canView });

  const deleteMutation = useMutation({
    mutationFn: (row: LeaveRequestRow) => deleteLeaveRequest(row.id).then(() => row),
    onSuccess: (row) => {
      message.success(`Leave request of ${row.staffName ?? 'the staff member'} deleted`);
      void queryClient.invalidateQueries({ queryKey: LEAVE_REQUESTS_KEY });
    },
    onError: (error) => message.error(serverMessage(error) ?? 'Could not delete the leave request. Please try again.'),
  });

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const all = requestsQuery.data ?? [];
    return term ? all.filter((r) => DATA_COLUMNS.some((c) => c.value(r).toLowerCase().includes(term))) : all;
  }, [requestsQuery.data, search]);
  const visibleDataColumns = useMemo(() => DATA_COLUMNS.filter((c) => !hiddenColumns.includes(c.key)), [hiddenColumns]);

  if (!canView) {
    return <Result status="403" title="Not available" subTitle="You don't have permission to view leave requests." />;
  }

  const handleExport = async (kind: ExportKind) => {
    setExporting(kind);
    try {
      const columns: ExportColumn<LeaveRequestRow>[] = visibleDataColumns.map((c) => ({ title: c.title, value: c.value }));
      const fileBase = `leave-requests-${dayjs().format('YYYY-MM-DD')}`;
      const title = 'Approve Leave Request';
      if (kind === 'copy') {
        await copyRows(rows, columns);
        message.success(`Copied ${rows.length} row${rows.length === 1 ? '' : 's'} to the clipboard`);
      } else if (kind === 'csv') downloadCsv(rows, columns, fileBase);
      else if (kind === 'excel') await downloadExcel(rows, columns, fileBase, title);
      else if (kind === 'pdf') await downloadPdf(rows, columns, fileBase, title);
      else printRows(rows, columns, title);
    } catch {
      message.error("Couldn't export the leave requests. Please try again.");
    } finally {
      setExporting(null);
    }
  };

  const columns: ColumnsType<LeaveRequestRow> = [
    ...visibleDataColumns.map((c) => ({
      key: c.key,
      title: c.title,
      align: c.align,
      sorter: (a: LeaveRequestRow, b: LeaveRequestRow) => {
        const x = c.sortValue ? c.sortValue(a) : c.value(a);
        const y = c.sortValue ? c.sortValue(b) : c.value(b);
        return typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true, sensitivity: 'base' });
      },
      render: (_: unknown, record: LeaveRequestRow) =>
        c.key === 'status' ? <Tag color={STATUS_COLOR[record.status]}>{c.value(record)}</Tag> : c.value(record),
    })),
    {
      key: 'action',
      title: 'Action',
      align: 'right',
      width: 100,
      render: (_: unknown, record: LeaveRequestRow) => (
        <Space size={token.marginXXS}>
          <Tooltip title={record.canDecide ? 'Edit' : 'View'}>
            <Button
              type="primary"
              size="small"
              icon={<MenuOutlined />}
              aria-label={`${record.canDecide ? 'Edit' : 'View'} leave request of ${record.staffName ?? ''}`}
              onClick={() => {
                setEditing(record);
                setFormOpen(true);
              }}
            />
          </Tooltip>
          {canApprove && record.canDecide && (
            <Popconfirm
              title="Delete this leave request?"
              description={`${staffLabel(record)}, ${leaveDates(record)}. Its document is deleted too.`}
              okText="Delete"
              okButtonProps={{ danger: true }}
              onConfirm={() => deleteMutation.mutateAsync(record).catch(() => undefined)}
            >
              <Tooltip title="Delete">
                <Button type="primary" size="small" icon={<CloseOutlined />} aria-label={`Delete leave request of ${record.staffName ?? ''}`} />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <Card
      title={
        <Title level={4} style={{ margin: 0, fontWeight: 500 }}>
          Approve Leave Request
        </Title>
      }
      extra={
        canAdd && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            Add Leave Request
          </Button>
        )
      }
    >
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: token.marginMD }}
        message={
          canApprove
            ? isPrincipal
              ? 'You approve the leave requests of teachers, librarians and other staff. Your own leave goes to the Super Admin.'
              : 'Teacher, Librarian and other staff requests go to the Principal; the Principal\'s request goes to the Super Admin. Super Admin and School Admin can approve any request except their own.'
            : 'Your leave request goes to ' + (hasRole(roles, 'PRINCIPAL') ? 'the Super Admin' : 'the Principal') + ' for approval, and you are notified of the decision.'
        }
      />
      <DataTableToolbar
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
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
        canPrint={canExport}
      />
      {requestsQuery.isError ? (
        <Alert
          type="warning"
          showIcon
          message="Couldn't load the leave requests"
          description="There was a problem reaching the server."
          action={
            <Button size="small" onClick={() => void requestsQuery.refetch()}>
              Try again
            </Button>
          }
        />
      ) : (
        <Table<LeaveRequestRow>
          rowKey="id"
          size="middle"
          columns={columns}
          dataSource={rows}
          loading={requestsQuery.isFetching}
          scroll={{ x: 'max-content' }}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={search.trim() ? 'No leave requests match your search' : 'No leave requests yet'}
              />
            ),
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
      )}
      <LeaveFormModal open={formOpen} editing={editing} onClose={() => setFormOpen(false)} />
    </Card>
  );
}

export default ApproveLeavePage;
