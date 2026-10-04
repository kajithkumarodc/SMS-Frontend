import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, Card, Empty, Popconfirm, Rate, Result, Space, Table, Tag, Tooltip, Typography, theme } from 'antd';
import type { ColumnsType } from 'antd/es/table/interface';
import { CloseOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  approveTeacherRating,
  deleteTeacherRating,
  fetchTeacherRatings,
  type RatingRow,
} from '../../../api/teacherRatings';
import { useAuthStore } from '../../../store/authStore';
import { hasPermission } from '../../../lib/roles';
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
import { PENDING_RATINGS_KEY, RATINGS_KEY } from './queryKeys';

const { Title, Text } = Typography;

const DEFAULT_PAGE_SIZE = 50;
const HIDDEN_COLUMNS_STORAGE_KEY = 'sms.teacherRatings.hiddenColumns';
const STATUS_LABEL = { PENDING: 'Pending', APPROVED: 'Approved' } as const;
const STATUS_COLOR = { PENDING: 'warning', APPROVED: 'success' } as const;

const staffLabel = (r: RatingRow) => `${r.staffName ?? '—'} ( ${r.staffId ?? '—'} )`;
const studentLabel = (r: RatingRow) =>
  `${r.studentName ?? '—'}${r.studentAdmissionNumber ? ` ( ${r.studentAdmissionNumber} )` : ''}`;

const DATA_COLUMNS: { key: string; title: string; value: (r: RatingRow) => string; sortValue?: (r: RatingRow) => string | number; align?: 'right' }[] = [
  { key: 'staffId', title: 'Staff ID', value: (r) => r.staffId ?? '' },
  { key: 'name', title: 'Name', value: staffLabel },
  { key: 'rating', title: 'Rating', value: (r) => String(r.rating), sortValue: (r) => r.rating, align: 'right' },
  { key: 'comment', title: 'Comment', value: (r) => r.comment ?? '' },
  { key: 'status', title: 'Status', value: (r) => STATUS_LABEL[r.status] },
  { key: 'student', title: 'Student Name', value: studentLabel },
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

/** Human Resource -> Teachers Rating (/app/human-resource/teachers-rating): the ratings students gave their teachers. */
function TeachersRatingPage() {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const permissions = useAuthStore((state) => state.user?.permissions);
  const canView = hasPermission(permissions, 'TEACHER_RATING_VIEW');
  const canManage = hasPermission(permissions, 'TEACHER_RATING_MANAGE');

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [hiddenColumns, setHiddenColumns] = useState<string[]>(readHiddenColumns);
  const [exporting, setExporting] = useState<ExportKind | null>(null);

  const ratingsQuery = useQuery({ queryKey: RATINGS_KEY, queryFn: fetchTeacherRatings, enabled: canView });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: RATINGS_KEY });
    void queryClient.invalidateQueries({ queryKey: PENDING_RATINGS_KEY });
  };

  const approveMutation = useMutation({
    mutationFn: (row: RatingRow) => approveTeacherRating(row.id).then(() => row),
    onSuccess: (row) => {
      message.success(`Rating of ${row.staffName ?? 'the teacher'} approved`);
      refresh();
    },
    onError: (error) => message.error(serverMessage(error) ?? 'Could not approve the rating. Please try again.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (row: RatingRow) => deleteTeacherRating(row.id).then(() => row),
    onSuccess: (row) => {
      message.success(`Rating of ${row.staffName ?? 'the teacher'} deleted`);
      refresh();
    },
    onError: (error) => message.error(serverMessage(error) ?? 'Could not delete the rating. Please try again.'),
  });

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const all = ratingsQuery.data ?? [];
    return term ? all.filter((r) => DATA_COLUMNS.some((c) => c.value(r).toLowerCase().includes(term))) : all;
  }, [ratingsQuery.data, search]);
  const visibleDataColumns = useMemo(() => DATA_COLUMNS.filter((c) => !hiddenColumns.includes(c.key)), [hiddenColumns]);

  if (!canView) {
    return <Result status="403" title="Not available" subTitle="You don't have permission to view teacher ratings." />;
  }

  const handleExport = async (kind: ExportKind) => {
    setExporting(kind);
    try {
      const columns: ExportColumn<RatingRow>[] = visibleDataColumns.map((c) => ({ title: c.title, value: c.value }));
      const fileBase = `teachers-rating-${dayjs().format('YYYY-MM-DD')}`;
      const title = 'Teachers Rating List';
      if (kind === 'copy') {
        await copyRows(rows, columns);
        message.success(`Copied ${rows.length} row${rows.length === 1 ? '' : 's'} to the clipboard`);
      } else if (kind === 'csv') downloadCsv(rows, columns, fileBase);
      else if (kind === 'excel') await downloadExcel(rows, columns, fileBase, title);
      else if (kind === 'pdf') await downloadPdf(rows, columns, fileBase, title);
      else printRows(rows, columns, title);
    } catch {
      message.error("Couldn't export the ratings. Please try again.");
    } finally {
      setExporting(null);
    }
  };

  const columns: ColumnsType<RatingRow> = [
    ...visibleDataColumns.map((c) => ({
      key: c.key,
      title: c.title,
      align: c.align,
      sorter: (a: RatingRow, b: RatingRow) => {
        const x = c.sortValue ? c.sortValue(a) : c.value(a);
        const y = c.sortValue ? c.sortValue(b) : c.value(b);
        return typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true, sensitivity: 'base' });
      },
      render: (_: unknown, record: RatingRow) => {
        if (c.key === 'name') return <Link to={`/app/human-resource/staff-directory/${record.staffProfileId}`}>{c.value(record)}</Link>;
        if (c.key === 'rating') {
          return (
            <Space size={token.marginXXS}>
              <Rate disabled value={record.rating} aria-label={`${record.rating} out of 5`} style={{ fontSize: token.fontSizeSM }} />
              <Text>{record.rating}</Text>
            </Space>
          );
        }
        if (c.key === 'status') return <Tag color={STATUS_COLOR[record.status]}>{c.value(record)}</Tag>;
        return c.value(record);
      },
    })),
    ...(canManage
      ? [
          {
            key: 'action',
            title: 'Action',
            align: 'right' as const,
            render: (_: unknown, record: RatingRow) => (
              <Space size={token.marginXXS}>
                {record.status === 'PENDING' && (
                  <Button
                    type="primary"
                    size="small"
                    loading={approveMutation.isPending && approveMutation.variables?.id === record.id}
                    onClick={() => approveMutation.mutate(record)}
                  >
                    Approve
                  </Button>
                )}
                <Popconfirm
                  title="Delete this rating?"
                  description={`${record.rating} star(s) for ${record.staffName ?? 'the teacher'} from ${record.studentName ?? 'the student'}.`}
                  okText="Delete"
                  okButtonProps={{ danger: true }}
                  onConfirm={() => deleteMutation.mutateAsync(record).catch(() => undefined)}
                >
                  <Tooltip title="Delete">
                    <Button type="primary" size="small" icon={<CloseOutlined />} aria-label={`Delete rating of ${record.staffName ?? ''} by ${record.studentName ?? ''}`} />
                  </Tooltip>
                </Popconfirm>
              </Space>
            ),
          },
        ]
      : []),
  ];

  return (
    <Card
      title={
        <Title level={4} style={{ margin: 0, fontWeight: 500 }}>
          Teachers Rating List
        </Title>
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
        columns={DATA_COLUMNS.map((c) => ({ key: c.key, title: c.title }))}
        hiddenColumns={hiddenColumns}
        onHiddenColumnsChange={(hidden) => {
          setHiddenColumns(hidden);
          writeHiddenColumns(hidden);
        }}
        onExport={(kind) => void handleExport(kind)}
        exporting={exporting}
        canExport={canView}
        canPrint={canView}
      />
      {ratingsQuery.isError ? (
        <Alert
          type="warning"
          showIcon
          message="Couldn't load the ratings"
          description="There was a problem reaching the server."
          action={
            <Button size="small" onClick={() => void ratingsQuery.refetch()}>
              Try again
            </Button>
          }
        />
      ) : (
        <Table<RatingRow>
          rowKey="id"
          size="middle"
          columns={columns}
          dataSource={rows}
          loading={ratingsQuery.isFetching}
          scroll={{ x: 'max-content' }}
          locale={{
            emptyText: (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={search.trim() ? 'No ratings match your search' : 'No ratings yet'} />
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
    </Card>
  );
}

export default TeachersRatingPage;
