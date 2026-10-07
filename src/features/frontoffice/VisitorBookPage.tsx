import { useMemo, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, Card, Empty, Popconfirm, Result, Space, Table, Tooltip, Typography, theme } from 'antd';
import type { ColumnsType, SorterResult } from 'antd/es/table/interface';
import { CloseOutlined, EditOutlined, MenuOutlined, PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  deleteVisitor,
  fetchAllVisitors,
  fetchVisitors,
  meetingWithLabel,
  type Visitor,
  type VisitorFilter,
  type VisitorSortKey,
} from '../../api/visitors';
import { useAuthStore } from '../../store/authStore';
import { hasPermission } from '../../lib/roles';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { formatDisplayDate, formatDisplayTime } from '../../lib/dates';
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
import { VISITORS_KEY } from './queryKeys';
import VisitorFormModal from './VisitorFormModal';
import VisitorDetailModal from './VisitorDetailModal';

const { Title, Text } = Typography;

const DEFAULT_PAGE_SIZE = 50;
const HIDDEN_COLUMNS_STORAGE_KEY = 'sms.visitorBook.hiddenColumns';

type Sort = { key: string; order: 'ascend' | 'descend' } | null;

/** Columns that can be shown/hidden and exported (everything except Action). `sortKey` null = not sortable. */
const DATA_COLUMNS: { key: string; sortKey: VisitorSortKey | null; title: string; value: (v: Visitor) => string }[] = [
  { key: 'purpose', sortKey: 'purposeName', title: 'Purpose', value: (v) => v.purposeName ?? '' },
  { key: 'meetingWith', sortKey: null, title: 'Meeting With', value: (v) => meetingWithLabel(v) },
  { key: 'visitorName', sortKey: 'visitorName', title: 'Visitor Name', value: (v) => v.visitorName },
  { key: 'phone', sortKey: 'phone', title: 'Phone', value: (v) => v.phone ?? '' },
  { key: 'idCard', sortKey: 'idCard', title: 'ID Card', value: (v) => v.idCard ?? '' },
  {
    key: 'numberOfPersons',
    sortKey: 'numberOfPersons',
    title: 'Number Of Person',
    value: (v) => (v.numberOfPersons == null ? '' : String(v.numberOfPersons)),
  },
  { key: 'visitDate', sortKey: 'visitDate', title: 'Date', value: (v) => formatDisplayDate(v.visitDate) },
  { key: 'inTime', sortKey: 'inTime', title: 'In Time', value: (v) => formatDisplayTime(v.inTime) },
  { key: 'outTime', sortKey: 'outTime', title: 'Out Time', value: (v) => formatDisplayTime(v.outTime) },
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
    // Storage blocked (private mode etc.) -- the choice just won't persist.
  }
}

function VisitorBookPage() {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const permissions = useAuthStore((state) => state.user?.permissions);
  const canView = hasPermission(permissions, 'VISITOR_VIEW');
  const canCreate = hasPermission(permissions, 'VISITOR_CREATE');
  const canEdit = hasPermission(permissions, 'VISITOR_EDIT');
  const canDelete = hasPermission(permissions, 'VISITOR_DELETE');
  const canExport = hasPermission(permissions, 'VISITOR_EXPORT');
  const canPrint = hasPermission(permissions, 'VISITOR_PRINT');

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  const [sort, setSort] = useState<Sort>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [hiddenColumns, setHiddenColumns] = useState<string[]>(readHiddenColumns);
  const [exporting, setExporting] = useState<ExportKind | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Visitor | null>(null);
  const [viewing, setViewing] = useState<Visitor | null>(null);

  const sortKey = DATA_COLUMNS.find((c) => c.key === sort?.key)?.sortKey;
  const listFilter: Omit<VisitorFilter, 'page' | 'size'> = {
    q: debouncedSearch || undefined,
    sort: sort && sortKey ? `${sortKey},${sort.order === 'ascend' ? 'asc' : 'desc'}` : undefined,
  };
  const filter: VisitorFilter = { ...listFilter, page: page - 1, size: pageSize };

  const visitorsQuery = useQuery({
    queryKey: [...VISITORS_KEY, filter],
    queryFn: () => fetchVisitors(filter),
    enabled: canView,
    placeholderData: keepPreviousData,
  });

  const deleteMutation = useMutation({
    mutationFn: (visitor: Visitor) => deleteVisitor(visitor.id).then(() => visitor),
    onSuccess: (visitor) => {
      message.success(`Visitor ${visitor.visitorName} deleted`);
      void queryClient.invalidateQueries({ queryKey: VISITORS_KEY });
    },
    onError: (error) => message.error(serverMessage(error) ?? 'Could not delete the visitor. Please try again.'),
  });

  const visibleDataColumns = useMemo(() => DATA_COLUMNS.filter((c) => !hiddenColumns.includes(c.key)), [hiddenColumns]);

  if (!canView) {
    return <Result status="403" title="Not available" subTitle="You don't have permission to view the Visitor Book." />;
  }

  const openEdit = (visitor: Visitor) => {
    setViewing(null);
    setEditing(visitor);
    setFormOpen(true);
  };

  const handleExport = async (kind: ExportKind) => {
    setExporting(kind);
    try {
      const rows = await fetchAllVisitors(listFilter);
      const columns: ExportColumn<Visitor>[] = visibleDataColumns.map((c) => ({ title: c.title, value: c.value }));
      const fileBase = `visitor-book-${dayjs().format('YYYY-MM-DD')}`;
      const title = 'Visitor List';
      if (kind === 'copy') {
        await copyRows(rows, columns);
        message.success(`Copied ${rows.length} row${rows.length === 1 ? '' : 's'} to the clipboard`);
      } else if (kind === 'csv') downloadCsv(rows, columns, fileBase);
      else if (kind === 'excel') await downloadExcel(rows, columns, fileBase, title);
      else if (kind === 'pdf') await downloadPdf(rows, columns, fileBase, title);
      else printRows(rows, columns, title);
    } catch {
      message.error("Couldn't export the visitors. Please try again.");
    } finally {
      setExporting(null);
    }
  };

  const columns: ColumnsType<Visitor> = [
    ...visibleDataColumns.map((c) => ({
      key: c.key,
      title: c.title,
      sorter: c.sortKey !== null,
      sortOrder: sort?.key === c.key ? sort.order : null,
      render: (_: unknown, record: Visitor) => c.value(record),
    })),
    {
      key: 'action',
      title: 'Action',
      align: 'right',
      fixed: 'right',
      width: 130,
      render: (_: unknown, record: Visitor) => (
        <Space size={token.marginXXS}>
          <Tooltip title="View">
            <Button
              type="primary"
              size="small"
              icon={<MenuOutlined />}
              aria-label={`View ${record.visitorName}`}
              onClick={() => setViewing(record)}
            />
          </Tooltip>
          {canEdit && (
            <Tooltip title="Edit">
              <Button
                type="primary"
                size="small"
                icon={<EditOutlined />}
                aria-label={`Edit ${record.visitorName}`}
                onClick={() => openEdit(record)}
              />
            </Tooltip>
          )}
          {canDelete && (
            <Popconfirm
              title="Delete this visitor?"
              description={`${record.visitorName}'s visit and any attached document will be permanently deleted.`}
              okText="Delete"
              okButtonProps={{ danger: true }}
              onConfirm={() => deleteMutation.mutateAsync(record)}
            >
              <Tooltip title="Delete">
                <Button type="primary" size="small" icon={<CloseOutlined />} aria-label={`Delete ${record.visitorName}`} />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  const data = visitorsQuery.data;

  return (
    <div style={{ width: '100%' }}>
      <Card
        title={<Title level={4} style={{ margin: 0, fontWeight: 500, whiteSpace: 'normal' }}>Visitor List</Title>}
        styles={{ header: { flexWrap: 'wrap', gap: token.marginSM, paddingBlock: token.paddingSM } }}
        extra={
          canCreate && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              Add
            </Button>
          )
        }
      >
        <DataTableToolbar
          search={search}
          onSearchChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
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

        {visitorsQuery.isError ? (
          <Alert
            type="warning"
            showIcon
            message="Couldn't load visitors"
            description="There was a problem reaching the server."
            action={
              <Button size="small" onClick={() => void visitorsQuery.refetch()}>
                Try again
              </Button>
            }
          />
        ) : (
          <Table<Visitor>
            rowKey="id"
            size="middle"
            columns={columns}
            dataSource={data?.content ?? []}
            loading={visitorsQuery.isFetching}
            scroll={{ x: 'max-content' }}
            onChange={(_pagination, _filters, sorter) => {
              const s = (Array.isArray(sorter) ? sorter[0] : sorter) as SorterResult<Visitor>;
              setSort(s?.order && s.columnKey ? { key: String(s.columnKey), order: s.order } : null);
              setPage(1);
            }}
            locale={{
              emptyText: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={debouncedSearch ? 'No visitors match your search' : 'No visitors logged yet'}
                />
              ),
            }}
            pagination={{
              current: page,
              pageSize,
              total: data?.page.totalElements ?? 0,
              showSizeChanger: false,
              showTotal: (count, [start, end]) =>
                count === 0 ? '' : <Text type="secondary">Records: {start} to {end} of {count}</Text>,
              onChange: (nextPage) => setPage(nextPage),
            }}
          />
        )}
      </Card>

      <VisitorFormModal
        open={formOpen}
        visitor={editing}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
      />
      <VisitorDetailModal visitor={viewing} onClose={() => setViewing(null)} onEdit={canEdit ? openEdit : undefined} />
    </div>
  );
}

export default VisitorBookPage;
