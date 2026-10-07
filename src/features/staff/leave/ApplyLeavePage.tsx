import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, Card, Descriptions, Empty, Modal, Popconfirm, Result, Space, Table, Tag, Tooltip, Typography, theme } from 'antd';
import type { ColumnsType } from 'antd/es/table/interface';
import { CloseOutlined, DownloadOutlined, MenuOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  cancelLeaveRequest,
  fetchMyLeaveInfo,
  fetchMyLeaveRequests,
  HALF_DAY_LABEL,
  LEAVE_STATUS_LABEL,
  leaveAttachmentUrl,
  type LeaveRequestRow,
} from '../../../api/leaveManagement';
import { useAuthStore } from '../../../store/authStore';
import { hasPermission } from '../../../lib/roles';
import { formatDisplayDate } from '../../../lib/dates';
import { formatFileSize } from '../../../lib/files';
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
import ApplyLeaveModal from './ApplyLeaveModal';
import { LEAVE_REQUESTS_KEY, MY_LEAVE_INFO_KEY, MY_LEAVE_REQUESTS_KEY } from './queryKeys';

const { Title, Text } = Typography;

const DEFAULT_PAGE_SIZE = 50;
const HIDDEN_COLUMNS_STORAGE_KEY = 'sms.applyLeave.hiddenColumns';
const STATUS_COLOR = { PENDING: 'warning', APPROVED: 'success', REJECTED: 'error' } as const;

const leaveDates = (r: LeaveRequestRow) => `${formatDisplayDate(r.fromDate)} - ${formatDisplayDate(r.toDate)}`;

const DATA_COLUMNS: { key: string; title: string; value: (r: LeaveRequestRow) => string; sortValue?: (r: LeaveRequestRow) => string | number; align?: 'right' }[] = [
  { key: 'staff', title: 'Staff', value: (r) => `${r.staffName ?? '—'}${r.staffId ? ` (${r.staffId})` : ''}` },
  { key: 'leaveType', title: 'Leave Type', value: (r) => r.leaveTypeName },
  { key: 'halfDay', title: 'Half Day', value: (r) => (r.halfDay ? HALF_DAY_LABEL[r.halfDay] : '') },
  { key: 'leaveDate', title: 'Leave Date', value: leaveDates, sortValue: (r) => r.fromDate },
  { key: 'days', title: 'Days', value: (r) => r.days.toFixed(2), sortValue: (r) => r.days, align: 'right' },
  { key: 'applyDate', title: 'Apply Date', value: (r) => formatDisplayDate(r.applyDate), sortValue: (r) => r.applyDate },
  { key: 'sentTo', title: 'Sent To', value: (r) => r.approverLabel },
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

/** Human Resource -> Apply Leave (/app/human-resource/apply-leave): the signed-in staff member's own leave. */
function ApplyLeavePage() {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const canApply = hasPermission(useAuthStore((state) => state.user?.permissions), 'LEAVE_CREATE');

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [hiddenColumns, setHiddenColumns] = useState<string[]>(readHiddenColumns);
  const [exporting, setExporting] = useState<ExportKind | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [viewing, setViewing] = useState<LeaveRequestRow | null>(null);

  const requestsQuery = useQuery({ queryKey: MY_LEAVE_REQUESTS_KEY, queryFn: fetchMyLeaveRequests, enabled: canApply });
  const infoQuery = useQuery({ queryKey: MY_LEAVE_INFO_KEY, queryFn: () => fetchMyLeaveInfo(), enabled: canApply, retry: false });
  const noProfile = (infoQuery.error as { response?: { status?: number } } | null)?.response?.status === 404;

  const cancelMutation = useMutation({
    mutationFn: (row: LeaveRequestRow) => cancelLeaveRequest(row.id).then(() => row),
    onSuccess: () => {
      message.success('Leave request cancelled');
      void queryClient.invalidateQueries({ queryKey: MY_LEAVE_REQUESTS_KEY });
      void queryClient.invalidateQueries({ queryKey: MY_LEAVE_INFO_KEY });
      void queryClient.invalidateQueries({ queryKey: LEAVE_REQUESTS_KEY });
    },
    onError: (error) => message.error(serverMessage(error) ?? 'Could not cancel the leave request. Please try again.'),
  });

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const all = requestsQuery.data ?? [];
    return term ? all.filter((r) => DATA_COLUMNS.some((c) => c.value(r).toLowerCase().includes(term))) : all;
  }, [requestsQuery.data, search]);
  const visibleDataColumns = useMemo(() => DATA_COLUMNS.filter((c) => !hiddenColumns.includes(c.key)), [hiddenColumns]);

  if (!canApply) {
    return <Result status="403" title="Not available" subTitle="You don't have permission to apply for leave." />;
  }

  const handleExport = async (kind: ExportKind) => {
    setExporting(kind);
    try {
      const columns: ExportColumn<LeaveRequestRow>[] = visibleDataColumns.map((c) => ({ title: c.title, value: c.value }));
      const fileBase = `my-leaves-${dayjs().format('YYYY-MM-DD')}`;
      const title = 'Leaves';
      if (kind === 'copy') {
        await copyRows(rows, columns);
        message.success(`Copied ${rows.length} row${rows.length === 1 ? '' : 's'} to the clipboard`);
      } else if (kind === 'csv') downloadCsv(rows, columns, fileBase);
      else if (kind === 'excel') await downloadExcel(rows, columns, fileBase, title);
      else if (kind === 'pdf') await downloadPdf(rows, columns, fileBase, title);
      else printRows(rows, columns, title);
    } catch {
      message.error("Couldn't export your leaves. Please try again.");
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
          <Tooltip title="View">
            <Button type="primary" size="small" icon={<MenuOutlined />} aria-label={`View leave ${leaveDates(record)}`} onClick={() => setViewing(record)} />
          </Tooltip>
          {record.status === 'PENDING' && (
            <Popconfirm
              title="Cancel this leave request?"
              description={`${record.leaveTypeName}, ${leaveDates(record)}. You can apply again afterwards.`}
              okText="Cancel request"
              cancelText="Keep"
              okButtonProps={{ danger: true }}
              onConfirm={() => cancelMutation.mutateAsync(record).catch(() => undefined)}
            >
              <Tooltip title="Cancel request">
                <Button type="primary" size="small" icon={<CloseOutlined />} aria-label={`Cancel leave ${leaveDates(record)}`} />
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
          Leaves
        </Title>
      }
      extra={
        <Button type="primary" disabled={!infoQuery.data} onClick={() => setFormOpen(true)}>
          Apply Leave
        </Button>
      }
    >
      {noProfile ? (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: token.marginMD }}
          message="Your account has no staff profile"
          description="Leave is applied for by staff members. Ask the school office to add you to the Staff Directory."
        />
      ) : (
        infoQuery.data && (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: token.marginMD }}
            message={`Your leave requests are sent to the ${infoQuery.data.approverLabel} for approval, and you are notified of the decision.`}
          />
        )
      )}
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
        canExport
        canPrint
      />
      {requestsQuery.isError ? (
        <Alert
          type="warning"
          showIcon
          message="Couldn't load your leaves"
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
                description={search.trim() ? 'No leaves match your search' : 'No leaves yet. Press Apply Leave to add one.'}
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

      <ApplyLeaveModal open={formOpen} info={infoQuery.data ?? null} onClose={() => setFormOpen(false)} />

      <Modal
        title={<span style={{ color: token.colorWhite, fontSize: token.fontSizeLG, fontWeight: 500 }}>Leave Details</span>}
        open={viewing !== null}
        onCancel={() => setViewing(null)}
        footer={null}
        width={620}
        destroyOnHidden
        closeIcon={<CloseOutlined style={{ color: token.colorWhite, fontSize: 16 }} />}
        styles={{
          content: { padding: 0, overflow: 'hidden' },
          header: { background: token.colorPrimary, padding: `${token.paddingSM}px ${token.paddingLG}px`, margin: 0 },
          body: { padding: token.paddingLG },
        }}
      >
        {viewing && (
          <Descriptions size="small" bordered column={1} data-testid="leave-details">
            <Descriptions.Item label="Leave Type">{viewing.leaveTypeName}</Descriptions.Item>
            <Descriptions.Item label="Leave Date">{leaveDates(viewing)}</Descriptions.Item>
            <Descriptions.Item label="Half Day">{viewing.halfDay ? HALF_DAY_LABEL[viewing.halfDay] : 'No (full day)'}</Descriptions.Item>
            <Descriptions.Item label="Days">{viewing.days.toFixed(2)}</Descriptions.Item>
            <Descriptions.Item label="Apply Date">{formatDisplayDate(viewing.applyDate)}</Descriptions.Item>
            <Descriptions.Item label="Sent To">{viewing.approverLabel}</Descriptions.Item>
            <Descriptions.Item label="Status">
              <Tag color={STATUS_COLOR[viewing.status]}>{LEAVE_STATUS_LABEL[viewing.status]}</Tag>
              {viewing.decidedAt && <Text type="secondary">on {formatDisplayDate(viewing.decidedAt.slice(0, 10))}</Text>}
            </Descriptions.Item>
            <Descriptions.Item label="Reason">{viewing.reason ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="Note">{viewing.note ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="Document">
              {viewing.attachment ? (
                <>
                  <Button type="link" size="small" icon={<DownloadOutlined />} href={leaveAttachmentUrl(viewing.id)} style={{ padding: 0 }}>
                    {viewing.attachment.fileName}
                  </Button>{' '}
                  <Text type="secondary">({formatFileSize(viewing.attachment.sizeBytes)})</Text>
                </>
              ) : (
                '—'
              )}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </Card>
  );
}

export default ApplyLeavePage;
