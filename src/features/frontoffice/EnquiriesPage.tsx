import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  DatePicker,
  Empty,
  Form,
  Popconfirm,
  Result,
  Row,
  Select,
  Space,
  Table,
  Tooltip,
  Typography,
  theme,
} from 'antd';
import type { ColumnsType, SorterResult } from 'antd/es/table/interface';
import { CloseOutlined, EditOutlined, PhoneOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import {
  fetchAllEnquiries,
  fetchEnquiries,
  fetchEnquirySources,
  setEnquiryArchived,
  type Enquiry,
  type EnquiryFilter,
  type EnquirySortKey,
  type EnquiryStatus,
} from '../../api/enquiries';
import { fetchClasses } from '../../api/classes';
import { useAuthStore } from '../../store/authStore';
import { hasPermission } from '../../lib/roles';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { API_DATE_FORMAT, DISPLAY_DATE_FORMAT, formatDisplayDate } from '../../lib/dates';
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
import { ENQUIRIES_KEY, ENQUIRY_SOURCES_KEY, ENQUIRY_SUMMARY_KEY } from './queryKeys';
import { CLASSES_QUERY_KEY } from '../classes/queryKeys';
import { ENQUIRY_STATUS_OPTIONS, enquiryStatusLabel } from './status';
import EnquiryFormModal from './EnquiryFormModal';
import EnquiryFollowUpModal from './EnquiryFollowUpModal';

const { Title, Text } = Typography;

const DEFAULT_PAGE_SIZE = 50;
const HIDDEN_COLUMNS_STORAGE_KEY = 'sms.admissionEnquiry.hiddenColumns';
const OVERDUE_ROW_CLASS = 'enquiry-row-overdue';
const CLOSED_STATUSES: EnquiryStatus[] = ['WON', 'LOST', 'DEAD'];

/** Applied "Select Criteria" -- only changes when Search is pressed. */
type Criteria = {
  classId?: string;
  sourceId?: string;
  from?: string;
  to?: string;
  status?: EnquiryStatus;
};

type Sort = { key: EnquirySortKey; order: 'ascend' | 'descend' } | null;

/** A still-open enquiry whose next follow-up date has passed -- highlighted in the list. */
function isOverdue(e: Enquiry): boolean {
  return Boolean(e.followUpDate) && !CLOSED_STATUSES.includes(e.status) && e.followUpDate! < dayjs().format(API_DATE_FORMAT);
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
    // Storage blocked (private mode etc.) -- the choice just won't persist.
  }
}

/** Table columns that can be shown/hidden and exported (everything except Action). */
const DATA_COLUMNS: { key: EnquirySortKey; title: string; value: (e: Enquiry) => string }[] = [
  { key: 'applicantName', title: 'Name', value: (e) => e.applicantName },
  { key: 'phone', title: 'Phone', value: (e) => e.phone ?? '' },
  { key: 'sourceName', title: 'Source', value: (e) => e.sourceName ?? '' },
  { key: 'enquiryDate', title: 'Enquiry Date', value: (e) => formatDisplayDate(e.enquiryDate) },
  { key: 'lastFollowUpDate', title: 'Last Follow Up Date', value: (e) => formatDisplayDate(e.lastFollowUpDate) },
  { key: 'followUpDate', title: 'Next Follow Up Date', value: (e) => formatDisplayDate(e.followUpDate) },
  { key: 'status', title: 'Status', value: (e) => enquiryStatusLabel(e.status) },
];

function EnquiriesPage() {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const permissions = useAuthStore((state) => state.user?.permissions);
  const canView = hasPermission(permissions, 'ENQUIRY_VIEW');
  const canCreate = hasPermission(permissions, 'ENQUIRY_CREATE');
  const canEdit = hasPermission(permissions, 'ENQUIRY_EDIT');
  const canDelete = hasPermission(permissions, 'ENQUIRY_DELETE');
  const canFollowUp = hasPermission(permissions, 'ENQUIRY_FOLLOWUP');
  const canConvert = hasPermission(permissions, 'ENQUIRY_CONVERT');
  const canExport = hasPermission(permissions, 'ENQUIRY_EXPORT');
  const canPrint = hasPermission(permissions, 'ENQUIRY_PRINT');

  // The Front Office overview links here with ?sourceId= / ?classId= -- start with those applied.
  const [searchParams] = useSearchParams();
  const linkedCriteria: Criteria = {
    sourceId: searchParams.get('sourceId') ?? undefined,
    classId: searchParams.get('classId') ?? undefined,
  };

  const [draft, setDraft] = useState<Criteria>({ status: 'ACTIVE', ...linkedCriteria });
  const [draftErrors, setDraftErrors] = useState<{ from?: string; to?: string }>({});
  const [criteria, setCriteria] = useState<Criteria>({ status: 'ACTIVE', ...linkedCriteria });
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  const [sort, setSort] = useState<Sort>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [hiddenColumns, setHiddenColumns] = useState<string[]>(readHiddenColumns);
  const [exporting, setExporting] = useState<ExportKind | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Enquiry | null>(null);
  const [followingUp, setFollowingUp] = useState<Enquiry | null>(null);

  const listFilter: Omit<EnquiryFilter, 'page' | 'size'> = {
    ...criteria,
    q: debouncedSearch || undefined,
    sort: sort ? `${sort.key},${sort.order === 'ascend' ? 'asc' : 'desc'}` : undefined,
  };
  const filter: EnquiryFilter = { ...listFilter, page: page - 1, size: pageSize };

  const enquiriesQuery = useQuery({
    queryKey: [...ENQUIRIES_KEY, filter],
    queryFn: () => fetchEnquiries(filter),
    enabled: canView,
    placeholderData: keepPreviousData,
  });
  const sourcesQuery = useQuery({ queryKey: ENQUIRY_SOURCES_KEY, queryFn: fetchEnquirySources, enabled: canView });
  const classesQuery = useQuery({ queryKey: CLASSES_QUERY_KEY, queryFn: fetchClasses, enabled: canView });

  const deleteMutation = useMutation({
    mutationFn: (enquiry: Enquiry) => setEnquiryArchived(enquiry.id, true),
    onSuccess: (saved) => {
      message.success(`Enquiry for ${saved.applicantName} deleted`);
      void queryClient.invalidateQueries({ queryKey: ENQUIRIES_KEY });
      void queryClient.invalidateQueries({ queryKey: ENQUIRY_SUMMARY_KEY });
    },
    onError: () => message.error('Could not delete the enquiry. Please try again.'),
  });

  const visibleDataColumns = useMemo(
    () => DATA_COLUMNS.filter((c) => !hiddenColumns.includes(c.key)),
    [hiddenColumns],
  );

  if (!canView) {
    return <Result status="403" title="Not available" subTitle="You don't have permission to view enquiries." />;
  }

  const applyCriteria = () => {
    const errors: { from?: string; to?: string } = {};
    if (!draft.from) errors.from = 'Enquiry from date is required';
    if (!draft.to) errors.to = 'Enquiry to date is required';
    if (draft.from && draft.to && draft.from > draft.to) errors.to = "Can't be before the from date";
    setDraftErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setCriteria({ ...draft });
    setPage(1);
  };

  const handleExport = async (kind: ExportKind) => {
    setExporting(kind);
    try {
      const rows = await fetchAllEnquiries(listFilter);
      const columns: ExportColumn<Enquiry>[] = visibleDataColumns.map((c) => ({ title: c.title, value: c.value }));
      const fileBase = `admission-enquiries-${dayjs().format('YYYY-MM-DD')}`;
      const title = 'Admission Enquiry';
      if (kind === 'copy') {
        await copyRows(rows, columns);
        message.success(`Copied ${rows.length} row${rows.length === 1 ? '' : 's'} to the clipboard`);
      } else if (kind === 'csv') downloadCsv(rows, columns, fileBase);
      else if (kind === 'excel') await downloadExcel(rows, columns, fileBase, title);
      else if (kind === 'pdf') await downloadPdf(rows, columns, fileBase, title);
      else printRows(rows, columns, title);
    } catch {
      message.error("Couldn't export the enquiries. Please try again.");
    } finally {
      setExporting(null);
    }
  };

  const sortOrderFor = (key: EnquirySortKey) => (sort?.key === key ? sort.order : null);

  const columns: ColumnsType<Enquiry> = [
    ...visibleDataColumns.map((c) => ({
      key: c.key,
      title: c.title,
      sorter: true,
      sortOrder: sortOrderFor(c.key),
      render: (_: unknown, record: Enquiry) => c.value(record),
      ...(c.key === 'phone' ? { align: 'right' as const } : {}),
    })),
    {
      key: 'action',
      title: 'Action',
      align: 'right',
      fixed: 'right',
      width: 130,
      render: (_: unknown, record: Enquiry) => (
        <Space size={token.marginXXS}>
          {(canFollowUp || canEdit || canConvert) && (
            <Tooltip title="Follow up">
              <Button
                type="primary"
                size="small"
                icon={<PhoneOutlined />}
                aria-label={`Follow up ${record.applicantName}`}
                onClick={() => setFollowingUp(record)}
              />
            </Tooltip>
          )}
          {canEdit && (
            <Tooltip title="Edit">
              <Button
                type="primary"
                size="small"
                icon={<EditOutlined />}
                aria-label={`Edit ${record.applicantName}`}
                onClick={() => {
                  setEditing(record);
                  setFormOpen(true);
                }}
              />
            </Tooltip>
          )}
          {canDelete && (
            <Popconfirm
              title="Delete this enquiry?"
              description={`${record.applicantName}'s enquiry and its follow ups will be removed from the list.`}
              okText="Delete"
              okButtonProps={{ danger: true }}
              onConfirm={() => deleteMutation.mutateAsync(record)}
            >
              <Tooltip title="Delete">
                <Button
                  type="primary"
                  size="small"
                  icon={<CloseOutlined />}
                  aria-label={`Delete ${record.applicantName}`}
                />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  const data = enquiriesQuery.data;
  const total = data?.page.totalElements ?? 0;
  const pickerValue = (v?: string): Dayjs | null => (v ? dayjs(v) : null);

  return (
    <div style={{ width: '100%' }}>
      {/* Overdue rows: a soft red tint that survives antd's per-cell backgrounds and hover. */}
      <style>{`
        .${OVERDUE_ROW_CLASS} > td { background: ${token.colorErrorBg} !important; }
        .${OVERDUE_ROW_CLASS}:hover > td { background: ${token.colorErrorBgHover} !important; }
      `}</style>

      <Card
        title={<Title level={4} style={{ margin: 0, fontWeight: 500, whiteSpace: 'normal' }}>Select Criteria</Title>}
        style={{ marginBottom: token.marginLG }}
      >
        <Form layout="vertical" onFinish={applyCriteria} data-testid="enquiry-criteria">
          <Row gutter={token.marginMD} align="bottom">
            <Col xs={24} sm={12} lg={4}>
              <Form.Item label="Class" htmlFor="enquiry-criteria-class">
                <Select
                  id="enquiry-criteria-class"
                  placeholder="Select"
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  loading={classesQuery.isLoading}
                  options={(classesQuery.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
                  value={draft.classId}
                  onChange={(v) => setDraft((d) => ({ ...d, classId: v }))}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} lg={4}>
              <Form.Item label="Source" htmlFor="enquiry-criteria-source">
                <Select
                  id="enquiry-criteria-source"
                  placeholder="Select"
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  loading={sourcesQuery.isLoading}
                  options={(sourcesQuery.data ?? []).map((s) => ({ value: s.id, label: s.name }))}
                  value={draft.sourceId}
                  onChange={(v) => setDraft((d) => ({ ...d, sourceId: v }))}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} lg={4}>
              <Form.Item
                label="Enquiry From Date"
                htmlFor="enquiry-criteria-from"
                required
                validateStatus={draftErrors.from ? 'error' : undefined}
                help={draftErrors.from}
              >
                <DatePicker
                  style={{ width: '100%' }}
                  format={DISPLAY_DATE_FORMAT}
                  value={pickerValue(draft.from)}
                  id="enquiry-criteria-from"
                  onChange={(d) => setDraft((prev) => ({ ...prev, from: d ? d.format(API_DATE_FORMAT) : undefined }))}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} lg={4}>
              <Form.Item
                label="Enquiry To Date"
                htmlFor="enquiry-criteria-to"
                required
                validateStatus={draftErrors.to ? 'error' : undefined}
                help={draftErrors.to}
              >
                <DatePicker
                  style={{ width: '100%' }}
                  format={DISPLAY_DATE_FORMAT}
                  value={pickerValue(draft.to)}
                  id="enquiry-criteria-to"
                  onChange={(d) => setDraft((prev) => ({ ...prev, to: d ? d.format(API_DATE_FORMAT) : undefined }))}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} lg={4}>
              <Form.Item label="Status" htmlFor="enquiry-criteria-status">
                <Select
                  id="enquiry-criteria-status"
                  placeholder="All"
                  allowClear
                  options={ENQUIRY_STATUS_OPTIONS}
                  value={draft.status}
                  onChange={(v) => setDraft((d) => ({ ...d, status: v }))}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} lg={4} style={{ textAlign: 'right' }}>
              <Form.Item>
                <Button type="primary" htmlType="submit" icon={<SearchOutlined />}>
                  Search
                </Button>
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Card>

      <Card
        title={<Title level={4} style={{ margin: 0, fontWeight: 500, whiteSpace: 'normal' }}>Admission Enquiry</Title>}
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

        {enquiriesQuery.isError ? (
          <Alert
            type="warning"
            showIcon
            message="Couldn't load enquiries"
            description="There was a problem reaching the server."
            action={
              <Button size="small" onClick={() => void enquiriesQuery.refetch()}>
                Try again
              </Button>
            }
          />
        ) : (
          <Table<Enquiry>
            rowKey="id"
            size="middle"
            columns={columns}
            dataSource={data?.content ?? []}
            loading={enquiriesQuery.isFetching}
            scroll={{ x: 'max-content' }}
            rowClassName={(record) => (isOverdue(record) ? OVERDUE_ROW_CLASS : '')}
            onChange={(_pagination, _filters, sorter) => {
              const s = (Array.isArray(sorter) ? sorter[0] : sorter) as SorterResult<Enquiry>;
              setSort(s?.order && s.columnKey ? { key: s.columnKey as EnquirySortKey, order: s.order } : null);
              setPage(1);
            }}
            locale={{
              emptyText: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={
                    debouncedSearch || criteria.from || criteria.classId || criteria.sourceId
                      ? 'No enquiries match these criteria'
                      : 'No enquiries yet'
                  }
                />
              ),
            }}
            pagination={{
              current: page,
              pageSize,
              total,
              showSizeChanger: false,
              showTotal: (count, [start, end]) =>
                count === 0 ? '' : <Text type="secondary">Records: {start} to {end} of {count}</Text>,
              onChange: (nextPage) => setPage(nextPage),
            }}
          />
        )}
      </Card>

      <EnquiryFormModal
        open={formOpen}
        enquiry={editing}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
      />
      <EnquiryFollowUpModal
        enquiry={followingUp}
        onClose={() => setFollowingUp(null)}
        onEdit={(enquiry) => {
          setFollowingUp(null);
          setEditing(enquiry);
          setFormOpen(true);
        }}
        canFollowUp={canFollowUp}
        canEdit={canEdit}
        canConvert={canConvert}
      />
    </div>
  );
}

export default EnquiriesPage;
