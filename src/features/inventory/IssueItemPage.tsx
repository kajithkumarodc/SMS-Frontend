import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, Card, Empty, Popconfirm, Result, Table, Tag, Tooltip, Typography, theme } from 'antd';
import type { ColumnsType } from 'antd/es/table/interface';
import { CloseOutlined, PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  deleteInventoryIssue,
  fetchInventoryIssues,
  returnInventoryIssue,
  type InventoryIssue,
} from '../../api/inventory';
import { useAuthStore } from '../../store/authStore';
import { hasPermission } from '../../lib/roles';
import { formatDisplayDate } from '../../lib/dates';
import { serverMessage } from '../../lib/apiErrors';
import { copyRows, downloadCsv, downloadExcel, downloadPdf, printRows, type ExportColumn, type ExportKind } from '../../lib/tableExport';
import DataTableToolbar from '../../components/DataTableToolbar';
import { INVENTORY_ISSUES_KEY, INVENTORY_ITEMS_KEY } from './queryKeys';

const { Title, Text } = Typography;

const DEFAULT_PAGE_SIZE = 50;

const person = (name: string | null, code: string | null) => (name ? `${name}${code ? ` (${code})` : ''}` : '');
const issueReturn = (i: InventoryIssue) =>
  `${formatDisplayDate(i.issueDate)}${i.returnDate ? ` - ${formatDisplayDate(i.returnDate)}` : ''}`;
const statusLabel = (i: InventoryIssue) => (i.status === 'RETURNED' ? 'Returned' : 'Click To Return');

const EXPORT_COLUMNS: ExportColumn<InventoryIssue>[] = [
  { title: 'Item', value: (i) => i.itemName ?? '' },
  { title: 'Note', value: (i) => i.note ?? '' },
  { title: 'Item Category', value: (i) => i.categoryName ?? '' },
  { title: 'Issue - Return', value: issueReturn },
  { title: 'Issue To', value: (i) => person(i.issueToName, i.issueToCode) },
  { title: 'Issued By', value: (i) => person(i.issuedByName, i.issuedByCode) },
  { title: 'Quantity', value: (i) => String(i.quantity) },
  { title: 'Status', value: (i) => (i.status === 'RETURNED' ? 'Returned' : 'Issued') },
];

/** Inventory -> Issue Item (/app/inventory/issue-item): the items issued to staff, with return and delete. */
function IssueItemPage() {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const permissions = useAuthStore((state) => state.user?.permissions);
  const canView = hasPermission(permissions, 'INVENTORY_VIEW');
  const canIssue = hasPermission(permissions, 'INVENTORY_ISSUE');

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [exporting, setExporting] = useState<ExportKind | null>(null);

  const issuesQuery = useQuery({ queryKey: INVENTORY_ISSUES_KEY, queryFn: fetchInventoryIssues, enabled: canView });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: INVENTORY_ISSUES_KEY });
    // Stock changes with every return and delete.
    void queryClient.invalidateQueries({ queryKey: INVENTORY_ITEMS_KEY });
  };

  const returnMutation = useMutation({
    mutationFn: (issue: InventoryIssue) => returnInventoryIssue(issue.id),
    onSuccess: (issue) => {
      message.success(`${issue.itemName ?? 'Item'} returned`);
      refresh();
    },
    onError: (error) => message.error(serverMessage(error) ?? 'Could not mark the item as returned. Please try again.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (issue: InventoryIssue) => deleteInventoryIssue(issue.id),
    onSuccess: () => {
      message.success('Issue deleted');
      refresh();
    },
    onError: (error) => message.error(serverMessage(error) ?? 'Could not delete the issue. Please try again.'),
  });

  // The list is short, so search runs in the browser over every issue.
  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const all = issuesQuery.data ?? [];
    if (!term) return all;
    return all.filter((i) => EXPORT_COLUMNS.some((c) => String(c.value(i) ?? '').toLowerCase().includes(term)) || statusLabel(i).toLowerCase().includes(term));
  }, [issuesQuery.data, search]);

  if (!canView) {
    return <Result status="403" title="Not available" subTitle="You don't have permission to view inventory." />;
  }

  const handleExport = async (kind: ExportKind) => {
    setExporting(kind);
    try {
      const fileBase = `issue-items-${dayjs().format('YYYY-MM-DD')}`;
      const title = 'Issue Item List';
      if (kind === 'copy') {
        await copyRows(rows, EXPORT_COLUMNS);
        message.success(`Copied ${rows.length} row${rows.length === 1 ? '' : 's'} to the clipboard`);
      } else if (kind === 'csv') downloadCsv(rows, EXPORT_COLUMNS, fileBase);
      else if (kind === 'excel') await downloadExcel(rows, EXPORT_COLUMNS, fileBase, title);
      else if (kind === 'pdf') await downloadPdf(rows, EXPORT_COLUMNS, fileBase, title);
      else printRows(rows, EXPORT_COLUMNS, title);
    } catch {
      message.error("Couldn't export the issued items. Please try again.");
    } finally {
      setExporting(null);
    }
  };

  const columns: ColumnsType<InventoryIssue> = [
    { key: 'item', title: 'Item', sorter: (a, b) => (a.itemName ?? '').localeCompare(b.itemName ?? ''), render: (_v, i) => i.itemName },
    { key: 'note', title: 'Note', sorter: (a, b) => (a.note ?? '').localeCompare(b.note ?? ''), render: (_v, i) => i.note ?? '' },
    {
      key: 'category',
      title: 'Item Category',
      sorter: (a, b) => (a.categoryName ?? '').localeCompare(b.categoryName ?? ''),
      render: (_v, i) => i.categoryName,
    },
    {
      key: 'dates',
      title: 'Issue - Return',
      sorter: (a, b) => a.issueDate.localeCompare(b.issueDate),
      render: (_v, i) => issueReturn(i),
    },
    {
      key: 'to',
      title: 'Issue To',
      sorter: (a, b) => (a.issueToName ?? '').localeCompare(b.issueToName ?? ''),
      render: (_v, i) => person(i.issueToName, i.issueToCode),
    },
    {
      key: 'by',
      title: 'Issued By',
      sorter: (a, b) => (a.issuedByName ?? '').localeCompare(b.issuedByName ?? ''),
      render: (_v, i) => person(i.issuedByName, i.issuedByCode),
    },
    { key: 'quantity', title: 'Quantity', align: 'right', sorter: (a, b) => a.quantity - b.quantity, render: (_v, i) => i.quantity },
    {
      key: 'status',
      title: 'Status',
      sorter: (a, b) => a.status.localeCompare(b.status),
      render: (_v, i) =>
        i.status === 'RETURNED' ? (
          <Tag color="success">Returned</Tag>
        ) : canIssue ? (
          <Popconfirm
            title={`Mark ${i.itemName ?? 'this item'} as returned?`}
            description={`${i.quantity} unit${i.quantity === 1 ? '' : 's'} go back in stock.`}
            okText="Return"
            onConfirm={() => returnMutation.mutateAsync(i).catch(() => undefined)}
          >
            <Button size="small" danger type="primary" loading={returnMutation.isPending && returnMutation.variables?.id === i.id}>
              Click To Return
            </Button>
          </Popconfirm>
        ) : (
          <Tag color="error">Issued</Tag>
        ),
    },
    ...(canIssue
      ? [
          {
            key: 'action',
            title: 'Action',
            align: 'right' as const,
            width: 90,
            render: (_v: unknown, i: InventoryIssue) => (
              <Popconfirm
                title="Delete this issue?"
                description={i.status === 'ISSUED' ? 'The units still out go back in stock.' : undefined}
                okText="Delete"
                okButtonProps={{ danger: true }}
                onConfirm={() => deleteMutation.mutateAsync(i).catch(() => undefined)}
              >
                <Tooltip title="Delete">
                  <Button type="primary" size="small" icon={<CloseOutlined />} aria-label={`Delete issue of ${i.itemName ?? 'item'}`} />
                </Tooltip>
              </Popconfirm>
            ),
          },
        ]
      : []),
  ];

  return (
    <Card
      title={
        <Title level={4} style={{ margin: 0, fontWeight: 500 }}>
          Issue Item List
        </Title>
      }
      extra={
        canIssue && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/app/inventory/issue-item/create')}>
            Issue Item
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
        searchPlaceholder="Search"
        pageSize={pageSize}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
        }}
        columns={[]}
        hiddenColumns={[]}
        onHiddenColumnsChange={() => undefined}
        onExport={(kind) => void handleExport(kind)}
        exporting={exporting}
        canExport
        canPrint
        exportKinds={['excel', 'csv', 'pdf', 'print']}
        showColumnToggle={false}
      />
      {issuesQuery.isError ? (
        <Alert
          type="warning"
          showIcon
          message="Couldn't load the issued items"
          description="There was a problem reaching the server."
          action={
            <Button size="small" onClick={() => void issuesQuery.refetch()}>
              Try again
            </Button>
          }
        />
      ) : (
        <Table<InventoryIssue>
          rowKey="id"
          size="middle"
          columns={columns}
          dataSource={rows}
          loading={issuesQuery.isFetching}
          scroll={{ x: 'max-content' }}
          locale={{
            emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={search.trim() ? 'No issued items match your search' : 'No items issued yet'} />,
          }}
          pagination={{
            current: page,
            pageSize,
            showSizeChanger: false,
            showTotal: (count, [start, end]) => (count === 0 ? '' : <Text type="secondary">Showing {start} to {end} of {count} entries</Text>),
            onChange: (nextPage) => setPage(nextPage),
          }}
        />
      )}
      <div style={{ height: token.marginXXS }} />
    </Card>
  );
}

export default IssueItemPage;
