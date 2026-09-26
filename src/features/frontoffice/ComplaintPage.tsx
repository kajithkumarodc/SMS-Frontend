import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
  Input,
  Popconfirm,
  Result,
  Row,
  Select,
  Space,
  Table,
  Tooltip,
  Typography,
  Upload,
  theme,
} from 'antd';
import type { ColumnsType, SorterResult } from 'antd/es/table/interface';
import {
  CloseOutlined,
  CloudUploadOutlined,
  DeleteOutlined,
  EditOutlined,
  MenuOutlined,
  PaperClipOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  createComplaint,
  deleteComplaint,
  fetchAllComplaints,
  fetchComplaintTypes,
  fetchComplaints,
  removeComplaintAttachment,
  updateComplaint,
  uploadComplaintAttachment,
  type Complaint,
  type ComplaintFilter,
  type ComplaintInput,
  type ComplaintSortKey,
} from '../../api/complaints';
import { fetchEnquirySources } from '../../api/enquiries';
import { useAuthStore } from '../../store/authStore';
import { hasPermission } from '../../lib/roles';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { API_DATE_FORMAT, DISPLAY_DATE_FORMAT, formatDisplayDate, todayApiDate } from '../../lib/dates';
import { serverMessage } from '../../lib/apiErrors';
import { ALLOWED_UPLOAD_TYPES, uploadProblem } from '../../lib/files';
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
import { COMPLAINTS_KEY, COMPLAINT_KEY, COMPLAINT_TYPES_KEY, ENQUIRY_SOURCES_KEY } from './queryKeys';
import ComplaintDetailModal from './ComplaintDetailModal';

const { Title, Text } = Typography;

const DEFAULT_PAGE_SIZE = 50;
const HIDDEN_COLUMNS_STORAGE_KEY = 'sms.complaints.hiddenColumns';
/** Same rule as the backend's `EnquiryDtos.PHONE_PATTERN`. */
const PHONE_PATTERN = /^\+?[0-9][0-9 ()-]{4,28}[0-9]$/;

const schema = z.object({
  complaintTypeId: z.string(),
  sourceId: z.string(),
  complainBy: z.string().trim().min(1, 'Complain by is required').max(200, 'Keep this under 200 characters'),
  phone: z
    .string()
    .trim()
    .refine((v) => v === '' || PHONE_PATTERN.test(v), 'Enter a valid phone number'),
  complaintDate: z.string().min(1, 'Date is required'),
  description: z.string().max(2000, 'Keep this under 2000 characters'),
  actionTaken: z.string().trim().max(500, 'Keep this under 500 characters'),
  assigned: z.string().trim().max(200, 'Keep this under 200 characters'),
  note: z.string().max(2000, 'Keep this under 2000 characters'),
});

type FormValues = z.infer<typeof schema>;

function emptyForm(): FormValues {
  return {
    complaintTypeId: '',
    sourceId: '',
    complainBy: '',
    phone: '',
    complaintDate: todayApiDate(),
    description: '',
    actionTaken: '',
    assigned: '',
    note: '',
  };
}

function fromComplaint(c: Complaint): FormValues {
  return {
    complaintTypeId: c.complaintTypeId ?? '',
    sourceId: c.sourceId ?? '',
    complainBy: c.complainBy,
    phone: c.phone ?? '',
    complaintDate: c.complaintDate,
    description: c.description ?? '',
    actionTaken: c.actionTaken ?? '',
    assigned: c.assigned ?? '',
    note: c.note ?? '',
  };
}

function toInput(v: FormValues): ComplaintInput {
  const orNull = (s: string) => s.trim() || null;
  return {
    complaintTypeId: v.complaintTypeId || null,
    sourceId: v.sourceId || null,
    complainBy: v.complainBy.trim(),
    phone: orNull(v.phone),
    complaintDate: v.complaintDate,
    description: orNull(v.description),
    actionTaken: orNull(v.actionTaken),
    assigned: orNull(v.assigned),
    note: orNull(v.note),
  };
}

const DATA_COLUMNS: { key: ComplaintSortKey; title: string; value: (c: Complaint) => string }[] = [
  { key: 'complaintNo', title: 'Complain #', value: (c) => String(c.complaintNo) },
  { key: 'complaintTypeName', title: 'Complaint Type', value: (c) => c.complaintTypeName ?? '' },
  { key: 'complainBy', title: 'Name', value: (c) => c.complainBy },
  { key: 'phone', title: 'Phone', value: (c) => c.phone ?? '' },
  { key: 'complaintDate', title: 'Date', value: (c) => formatDisplayDate(c.complaintDate) },
];

type Sort = { key: ComplaintSortKey; order: 'ascend' | 'descend' } | null;

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

function ComplaintPage() {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const permissions = useAuthStore((state) => state.user?.permissions);
  const canView = hasPermission(permissions, 'COMPLAINT_VIEW');
  const canCreate = hasPermission(permissions, 'COMPLAINT_CREATE');
  const canEdit = hasPermission(permissions, 'COMPLAINT_EDIT');
  const canDelete = hasPermission(permissions, 'COMPLAINT_DELETE');
  const canExport = hasPermission(permissions, 'COMPLAINT_EXPORT');
  const canPrint = hasPermission(permissions, 'COMPLAINT_PRINT');

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  const [sort, setSort] = useState<Sort>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [hiddenColumns, setHiddenColumns] = useState<string[]>(readHiddenColumns);
  const [exporting, setExporting] = useState<ExportKind | null>(null);
  const [editing, setEditing] = useState<Complaint | null>(null);
  const [viewing, setViewing] = useState<Complaint | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [removeExisting, setRemoveExisting] = useState(false);
  const [fileError, setFileError] = useState<string>();

  const listFilter: Omit<ComplaintFilter, 'page' | 'size'> = {
    q: debouncedSearch || undefined,
    sort: sort ? `${sort.key},${sort.order === 'ascend' ? 'asc' : 'desc'}` : undefined,
  };
  const filter: ComplaintFilter = { ...listFilter, page: page - 1, size: pageSize };

  const complaintsQuery = useQuery({
    queryKey: [...COMPLAINTS_KEY, filter],
    queryFn: () => fetchComplaints(filter),
    enabled: canView,
    placeholderData: keepPreviousData,
  });
  const typesQuery = useQuery({ queryKey: COMPLAINT_TYPES_KEY, queryFn: fetchComplaintTypes, enabled: canView });
  const sourcesQuery = useQuery({ queryKey: ENQUIRY_SOURCES_KEY, queryFn: fetchEnquirySources, enabled: canView });

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: emptyForm(), mode: 'onTouched' });

  const resetDocument = () => {
    setPendingFile(null);
    setRemoveExisting(false);
    setFileError(undefined);
  };

  useEffect(() => {
    reset(editing ? fromComplaint(editing) : emptyForm());
    resetDocument();
  }, [editing, reset]);

  const saveMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const saved = editing ? await updateComplaint(editing.id, toInput(values)) : await createComplaint(toInput(values));
      try {
        if (pendingFile) return { saved: await uploadComplaintAttachment(saved.id, pendingFile), problem: undefined };
        if (removeExisting && saved.attachment) return { saved: await removeComplaintAttachment(saved.id), problem: undefined };
      } catch (error) {
        return { saved, problem: serverMessage(error) ?? 'the document could not be saved' };
      }
      return { saved, problem: undefined };
    },
    onSuccess: ({ saved, problem }) => {
      if (problem) message.warning(`Complaint #${saved.complaintNo} saved, but ${problem}`);
      else message.success(editing ? `Complaint #${saved.complaintNo} updated` : `Complaint #${saved.complaintNo} saved`);
      void queryClient.invalidateQueries({ queryKey: COMPLAINTS_KEY });
      void queryClient.invalidateQueries({ queryKey: [...COMPLAINT_KEY, saved.id] });
      if (editing) setEditing(null);
      else {
        reset(emptyForm());
        resetDocument();
      }
    },
    onError: (error) => message.error(serverMessage(error) ?? 'Could not save the complaint. Please try again.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (complaint: Complaint) => deleteComplaint(complaint.id).then(() => complaint),
    onSuccess: (complaint) => {
      message.success(`Complaint #${complaint.complaintNo} deleted`);
      if (editing?.id === complaint.id) setEditing(null);
      void queryClient.invalidateQueries({ queryKey: COMPLAINTS_KEY });
    },
    onError: (error) => message.error(serverMessage(error) ?? 'Could not delete the complaint. Please try again.'),
  });

  const visibleDataColumns = useMemo(() => DATA_COLUMNS.filter((c) => !hiddenColumns.includes(c.key)), [hiddenColumns]);

  if (!canView) {
    return <Result status="403" title="Not available" subTitle="You don't have permission to view complaints." />;
  }

  const submit = handleSubmit((values) => saveMutation.mutate(values));
  const fieldError = (name: keyof FormValues) =>
    errors[name] ? { validateStatus: 'error' as const, help: errors[name]?.message } : {};
  const fid = (name: string) => `complaint-${name}`;
  const showForm = canCreate || (editing !== null && canEdit);
  const shownFileName = pendingFile?.name ?? (!removeExisting ? editing?.attachment?.fileName : undefined);

  const pickFile = (file: File) => {
    const problem = uploadProblem(file);
    if (problem) setFileError(problem);
    else {
      setFileError(undefined);
      setPendingFile(file);
    }
    return false; // uploaded after the complaint is saved
  };

  const handleExport = async (kind: ExportKind) => {
    setExporting(kind);
    try {
      const rows = await fetchAllComplaints(listFilter);
      const columns: ExportColumn<Complaint>[] = visibleDataColumns.map((c) => ({ title: c.title, value: c.value }));
      const fileBase = `complaints-${dayjs().format('YYYY-MM-DD')}`;
      const title = 'Complaint List';
      if (kind === 'copy') {
        await copyRows(rows, columns);
        message.success(`Copied ${rows.length} row${rows.length === 1 ? '' : 's'} to the clipboard`);
      } else if (kind === 'csv') downloadCsv(rows, columns, fileBase);
      else if (kind === 'excel') await downloadExcel(rows, columns, fileBase, title);
      else if (kind === 'pdf') await downloadPdf(rows, columns, fileBase, title);
      else printRows(rows, columns, title);
    } catch {
      message.error("Couldn't export the complaints. Please try again.");
    } finally {
      setExporting(null);
    }
  };

  const columns: ColumnsType<Complaint> = [
    ...visibleDataColumns.map((c) => ({
      key: c.key,
      title: c.title,
      sorter: true,
      sortOrder: sort?.key === c.key ? sort.order : null,
      render: (_: unknown, record: Complaint) => c.value(record),
    })),
    {
      key: 'action',
      title: 'Action',
      align: 'right',
      width: 110,
      render: (_: unknown, record: Complaint) => (
        <Space size={token.marginXXS}>
          <Tooltip title="View">
            <Button
              type="primary"
              size="small"
              icon={<MenuOutlined />}
              aria-label={`View complaint ${record.complaintNo}`}
              onClick={() => setViewing(record)}
            />
          </Tooltip>
          {canEdit && (
            <Tooltip title="Edit">
              <Button
                type="primary"
                size="small"
                icon={<EditOutlined />}
                aria-label={`Edit complaint ${record.complaintNo}`}
                onClick={() => setEditing(record)}
              />
            </Tooltip>
          )}
          {canDelete && (
            <Popconfirm
              title={`Delete complaint #${record.complaintNo}?`}
              description="The complaint and its document will be permanently deleted."
              okText="Delete"
              okButtonProps={{ danger: true }}
              onConfirm={() => deleteMutation.mutateAsync(record)}
            >
              <Tooltip title="Delete">
                <Button
                  type="primary"
                  size="small"
                  icon={<CloseOutlined />}
                  aria-label={`Delete complaint ${record.complaintNo}`}
                />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  const cardTitle = (text: string) => (
    <Title level={4} style={{ margin: 0, fontWeight: 500, whiteSpace: 'normal' }}>
      {text}
    </Title>
  );
  const textInput = (name: 'complainBy' | 'phone' | 'actionTaken' | 'assigned', label: string, required = false) => (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <Form.Item label={label} htmlFor={fid(name)} required={required} {...fieldError(name)}>
          <Input {...field} id={fid(name)} autoComplete="off" inputMode={name === 'phone' ? 'tel' : undefined} />
        </Form.Item>
      )}
    />
  );
  const textArea = (name: 'description' | 'note', label: string) => (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <Form.Item label={label} htmlFor={fid(name)} {...fieldError(name)}>
          <Input.TextArea {...field} id={fid(name)} rows={3} />
        </Form.Item>
      )}
    />
  );
  const lookup = (name: 'complaintTypeId' | 'sourceId', label: string, options: { value: string; label: string }[], loading: boolean) => (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <Form.Item label={label} htmlFor={fid(name)} {...fieldError(name)}>
          <Select
            id={fid(name)}
            placeholder="Select"
            allowClear
            showSearch
            optionFilterProp="label"
            loading={loading}
            options={options}
            value={field.value || undefined}
            onChange={(v) => field.onChange(v ?? '')}
            onBlur={field.onBlur}
          />
        </Form.Item>
      )}
    />
  );
  const data = complaintsQuery.data;

  return (
    <Row gutter={[token.marginLG, token.marginLG]} align="top">
      {showForm && (
        <Col xs={24} lg={9} xl={7}>
          <Card
            title={cardTitle(editing ? `Edit Complain #${editing.complaintNo}` : 'Add Complain')}
            styles={{ header: { paddingBlock: token.paddingSM } }}
            actions={[
              <div key="save" style={{ display: 'flex', justifyContent: 'flex-end', gap: token.marginXS, paddingInline: token.paddingLG }}>
                {editing && <Button onClick={() => setEditing(null)}>Cancel</Button>}
                <Button type="primary" onClick={submit} loading={saveMutation.isPending}>
                  Save
                </Button>
              </div>,
            ]}
          >
            <Form layout="vertical" onFinish={submit} data-testid="complaint-form">
              {lookup(
                'complaintTypeId',
                'Complaint Type',
                (typesQuery.data ?? []).map((t) => ({ value: t.id, label: t.name })),
                typesQuery.isLoading,
              )}
              {lookup(
                'sourceId',
                'Source',
                (sourcesQuery.data ?? []).map((s) => ({ value: s.id, label: s.name })),
                sourcesQuery.isLoading,
              )}
              {textInput('complainBy', 'Complain By', true)}
              {textInput('phone', 'Phone')}
              <Controller
                control={control}
                name="complaintDate"
                render={({ field }) => (
                  <Form.Item label="Date" htmlFor={fid('complaintDate')} required {...fieldError('complaintDate')}>
                    <DatePicker
                      id={fid('complaintDate')}
                      style={{ width: '100%' }}
                      format={DISPLAY_DATE_FORMAT}
                      allowClear={false}
                      value={field.value ? dayjs(field.value) : null}
                      onChange={(d) => field.onChange(d ? d.format(API_DATE_FORMAT) : '')}
                      onBlur={field.onBlur}
                    />
                  </Form.Item>
                )}
              />
              {textArea('description', 'Description')}
              {textInput('actionTaken', 'Action Taken')}
              {textInput('assigned', 'Assigned')}
              {textArea('note', 'Note')}
              <Form.Item
                label="Attach Document"
                validateStatus={fileError ? 'error' : undefined}
                help={fileError}
                style={{ marginBottom: 0 }}
              >
                {shownFileName ? (
                  <Space
                    style={{
                      width: '100%',
                      justifyContent: 'space-between',
                      border: `1px solid ${token.colorBorder}`,
                      borderRadius: token.borderRadius,
                      padding: `${token.paddingXXS}px ${token.paddingXS}px`,
                    }}
                  >
                    <Text ellipsis style={{ maxWidth: 240 }}>
                      <PaperClipOutlined /> {shownFileName}
                    </Text>
                    <Button
                      type="text"
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      aria-label="Remove document"
                      onClick={() => {
                        if (pendingFile) setPendingFile(null);
                        else setRemoveExisting(true);
                      }}
                    />
                  </Space>
                ) : (
                  <Upload.Dragger
                    accept={ALLOWED_UPLOAD_TYPES.join(',')}
                    multiple={false}
                    showUploadList={false}
                    beforeUpload={pickFile}
                    style={{ padding: 0 }}
                  >
                    <Space size="small" style={{ paddingBlock: 2 }}>
                      <CloudUploadOutlined style={{ fontSize: 18, color: token.colorPrimary }} />
                      <span>Drag and drop a file here or click</span>
                    </Space>
                  </Upload.Dragger>
                )}
              </Form.Item>
              <button type="submit" hidden aria-hidden />
            </Form>
          </Card>
        </Col>
      )}

      <Col xs={24} lg={showForm ? 15 : 24} xl={showForm ? 17 : 24}>
        <Card title={cardTitle('Complaint List')} styles={{ header: { paddingBlock: token.paddingSM } }}>
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
            canPrint={canPrint}
          />
          {complaintsQuery.isError ? (
            <Alert
              type="warning"
              showIcon
              message="Couldn't load complaints"
              description="There was a problem reaching the server."
              action={
                <Button size="small" onClick={() => void complaintsQuery.refetch()}>
                  Try again
                </Button>
              }
            />
          ) : (
            <Table<Complaint>
              rowKey="id"
              size="middle"
              columns={columns}
              dataSource={data?.content ?? []}
              loading={complaintsQuery.isFetching}
              scroll={{ x: 'max-content' }}
              rowClassName={(record) => (record.id === editing?.id ? 'ant-table-row-selected' : '')}
              onChange={(_pagination, _filters, sorter) => {
                const s = (Array.isArray(sorter) ? sorter[0] : sorter) as SorterResult<Complaint>;
                setSort(s?.order && s.columnKey ? { key: s.columnKey as ComplaintSortKey, order: s.order } : null);
                setPage(1);
              }}
              locale={{
                emptyText: (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={debouncedSearch ? 'No complaints match your search' : 'No complaints recorded yet'}
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
      </Col>

      <ComplaintDetailModal complaint={viewing} onClose={() => setViewing(null)} />
    </Row>
  );
}

export default ComplaintPage;
