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
  List,
  Popconfirm,
  Result,
  Row,
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
  LockOutlined,
  MenuOutlined,
  PaperClipOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  MAX_RECEIVE_DOCUMENTS,
  createReceive,
  deleteReceive,
  deleteReceiveDocument,
  fetchAllReceives,
  fetchReceives,
  updateReceive,
  uploadReceiveDocument,
  type ReceiveFilter,
  type ReceiveSortKey,
  type PostalReceive,
  type PostalReceiveInput,
} from '../../api/postalReceives';
import { useAuthStore } from '../../store/authStore';
import { hasPermission } from '../../lib/roles';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { API_DATE_FORMAT, DISPLAY_DATE_FORMAT, formatDisplayDate, todayApiDate } from '../../lib/dates';
import { serverMessage } from '../../lib/apiErrors';
import { ALLOWED_UPLOAD_TYPES, formatFileSize, uploadProblem } from '../../lib/files';
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
import { POSTAL_RECEIVES_KEY, POSTAL_RECEIVE_KEY } from './queryKeys';
import PostalReceiveDetailModal from './PostalReceiveDetailModal';

const { Title, Text } = Typography;

const DEFAULT_PAGE_SIZE = 50;
const HIDDEN_COLUMNS_STORAGE_KEY = 'sms.postalReceive.hiddenColumns';

const schema = z.object({
  fromTitle: z.string().trim().min(1, 'From title is required').max(200, 'Keep this under 200 characters'),
  address: z.string().max(1000, 'Keep this under 1000 characters'),
  note: z.string().max(2000, 'Keep this under 2000 characters'),
  toTitle: z.string().trim().max(200, 'Keep this under 200 characters'),
  receiveDate: z.string().min(1, 'Date is required'),
});

type FormValues = z.infer<typeof schema>;

function emptyForm(): FormValues {
  return { fromTitle: '', address: '', note: '', toTitle: '', receiveDate: todayApiDate() };
}

function fromReceive(d: PostalReceive): FormValues {
  return {
    fromTitle: d.fromTitle,
    address: d.address ?? '',
    note: d.note ?? '',
    toTitle: d.toTitle ?? '',
    receiveDate: d.receiveDate,
  };
}

function toInput(v: FormValues): PostalReceiveInput {
  const orNull = (s: string) => s.trim() || null;
  return {
    fromTitle: v.fromTitle.trim(),
    toTitle: orNull(v.toTitle),
    address: orNull(v.address),
    note: orNull(v.note),
    receiveDate: v.receiveDate,
  };
}

const DATA_COLUMNS: { key: ReceiveSortKey; title: string; value: (d: PostalReceive) => string }[] = [
  { key: 'fromTitle', title: 'From Title', value: (d) => d.fromTitle },
  { key: 'referenceNo', title: 'Reference No', value: (d) => d.referenceNo },
  { key: 'toTitle', title: 'To Title', value: (d) => d.toTitle ?? '' },
  { key: 'receiveDate', title: 'Date', value: (d) => formatDisplayDate(d.receiveDate) },
];

type Sort = { key: ReceiveSortKey; order: 'ascend' | 'descend' } | null;

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

function PostalReceivePage() {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const permissions = useAuthStore((state) => state.user?.permissions);
  const canView = hasPermission(permissions, 'POSTAL_RECEIVE_VIEW');
  const canCreate = hasPermission(permissions, 'POSTAL_RECEIVE_CREATE');
  const canEdit = hasPermission(permissions, 'POSTAL_RECEIVE_EDIT');
  const canDelete = hasPermission(permissions, 'POSTAL_RECEIVE_DELETE');
  const canExport = hasPermission(permissions, 'POSTAL_RECEIVE_EXPORT');
  const canPrint = hasPermission(permissions, 'POSTAL_RECEIVE_PRINT');

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  const [sort, setSort] = useState<Sort>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [hiddenColumns, setHiddenColumns] = useState<string[]>(readHiddenColumns);
  const [exporting, setExporting] = useState<ExportKind | null>(null);
  const [editing, setEditing] = useState<PostalReceive | null>(null);
  const [viewing, setViewing] = useState<PostalReceive | null>(null);
  // Documents: new files to upload after saving, and existing ones marked for removal (edit only).
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [removedDocIds, setRemovedDocIds] = useState<string[]>([]);
  const [fileError, setFileError] = useState<string>();

  const listFilter: Omit<ReceiveFilter, 'page' | 'size'> = {
    q: debouncedSearch || undefined,
    sort: sort ? `${sort.key},${sort.order === 'ascend' ? 'asc' : 'desc'}` : undefined,
  };
  const filter: ReceiveFilter = { ...listFilter, page: page - 1, size: pageSize };

  const receivesQuery = useQuery({
    queryKey: [...POSTAL_RECEIVES_KEY, filter],
    queryFn: () => fetchReceives(filter),
    enabled: canView,
    placeholderData: keepPreviousData,
  });

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: emptyForm(), mode: 'onTouched' });

  useEffect(() => {
    reset(editing ? fromReceive(editing) : emptyForm());
    setPendingFiles([]);
    setRemovedDocIds([]);
    setFileError(undefined);
  }, [editing, reset]);

  const keptDocuments = (editing?.documents ?? []).filter((d) => !removedDocIds.includes(d.id));
  const documentSlotsLeft = MAX_RECEIVE_DOCUMENTS - keptDocuments.length - pendingFiles.length;

  const saveMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const saved = editing ? await updateReceive(editing.id, toInput(values)) : await createReceive(toInput(values));
      // Removals first so a full receive has room for the new files.
      const problems: string[] = [];
      for (const docId of removedDocIds) {
        await deleteReceiveDocument(saved.id, docId).catch((e) => problems.push(serverMessage(e) ?? 'A document could not be removed'));
      }
      for (const file of pendingFiles) {
        await uploadReceiveDocument(saved.id, file).catch((e) => problems.push(`${file.name}: ${serverMessage(e) ?? 'upload failed'}`));
      }
      return { saved, problems };
    },
    onSuccess: ({ saved, problems }) => {
      if (problems.length > 0) {
        message.warning(`Postal receive ${saved.referenceNo} saved, but: ${problems.join('; ')}`);
      } else {
        message.success(editing ? `Postal receive ${saved.referenceNo} updated` : `Postal receive ${saved.referenceNo} saved`);
      }
      void queryClient.invalidateQueries({ queryKey: POSTAL_RECEIVES_KEY });
      void queryClient.invalidateQueries({ queryKey: [...POSTAL_RECEIVE_KEY, saved.id] });
      if (editing) setEditing(null);
      else {
        reset(emptyForm());
        setPendingFiles([]);
        setFileError(undefined);
      }
    },
    onError: (error) => message.error(serverMessage(error) ?? 'Could not save the received item. Please try again.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (receive: PostalReceive) => deleteReceive(receive.id).then(() => receive),
    onSuccess: (receive) => {
      message.success(`Postal receive ${receive.referenceNo} deleted`);
      if (editing?.id === receive.id) setEditing(null);
      void queryClient.invalidateQueries({ queryKey: POSTAL_RECEIVES_KEY });
    },
    onError: (error) => message.error(serverMessage(error) ?? 'Could not delete the received item. Please try again.'),
  });

  const visibleDataColumns = useMemo(() => DATA_COLUMNS.filter((c) => !hiddenColumns.includes(c.key)), [hiddenColumns]);

  if (!canView) {
    return <Result status="403" title="Not available" subTitle="You don't have permission to view Postal Receive." />;
  }

  const submit = handleSubmit((values) => saveMutation.mutate(values));
  const fieldError = (name: keyof FormValues) =>
    errors[name] ? { validateStatus: 'error' as const, help: errors[name]?.message } : {};
  const fid = (name: string) => `postal-receive-${name}`;
  const showForm = canCreate || (editing !== null && canEdit);

  const pickFile = (file: File) => {
    const problem = uploadProblem(file);
    if (problem) {
      setFileError(problem);
    } else if (documentSlotsLeft <= 0) {
      setFileError(`A received item can have at most ${MAX_RECEIVE_DOCUMENTS} documents`);
    } else {
      setFileError(undefined);
      setPendingFiles((files) => [...files, file]);
    }
    return false; // uploaded after the received item is saved
  };

  const handleExport = async (kind: ExportKind) => {
    setExporting(kind);
    try {
      const rows = await fetchAllReceives(listFilter);
      const columns: ExportColumn<PostalReceive>[] = visibleDataColumns.map((c) => ({ title: c.title, value: c.value }));
      const fileBase = `postal-receive-${dayjs().format('YYYY-MM-DD')}`;
      const title = 'Postal Receive List';
      if (kind === 'copy') {
        await copyRows(rows, columns);
        message.success(`Copied ${rows.length} row${rows.length === 1 ? '' : 's'} to the clipboard`);
      } else if (kind === 'csv') downloadCsv(rows, columns, fileBase);
      else if (kind === 'excel') await downloadExcel(rows, columns, fileBase, title);
      else if (kind === 'pdf') await downloadPdf(rows, columns, fileBase, title);
      else printRows(rows, columns, title);
    } catch {
      message.error("Couldn't export the received items. Please try again.");
    } finally {
      setExporting(null);
    }
  };

  const columns: ColumnsType<PostalReceive> = [
    ...visibleDataColumns.map((c) => ({
      key: c.key,
      title: c.title,
      sorter: true,
      sortOrder: sort?.key === c.key ? sort.order : null,
      render: (_: unknown, record: PostalReceive) => c.value(record),
    })),
    {
      key: 'action',
      title: 'Action',
      align: 'right',
      width: 110,
      render: (_: unknown, record: PostalReceive) => (
        <Space size={token.marginXXS}>
          <Tooltip title="View">
            <Button
              type="primary"
              size="small"
              icon={<MenuOutlined />}
              aria-label={`View ${record.referenceNo}`}
              onClick={() => setViewing(record)}
            />
          </Tooltip>
          {canEdit && (
            <Tooltip title="Edit">
              <Button
                type="primary"
                size="small"
                icon={<EditOutlined />}
                aria-label={`Edit ${record.referenceNo}`}
                onClick={() => setEditing(record)}
              />
            </Tooltip>
          )}
          {canDelete && (
            <Popconfirm
              title={`Delete ${record.referenceNo}?`}
              description="The received item and its documents will be permanently deleted."
              okText="Delete"
              okButtonProps={{ danger: true }}
              onConfirm={() => deleteMutation.mutateAsync(record)}
            >
              <Tooltip title="Delete">
                <Button type="primary" size="small" icon={<CloseOutlined />} aria-label={`Delete ${record.referenceNo}`} />
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
  const textArea = (name: 'address' | 'note', label: string) => (
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
  const data = receivesQuery.data;

  return (
    <Row gutter={[token.marginLG, token.marginLG]} align="top">
      {showForm && (
        <Col xs={24} lg={9} xl={7}>
          <Card
            title={cardTitle(editing ? 'Edit Postal Receive' : 'Add Postal Receive')}
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
            <Form layout="vertical" onFinish={submit} data-testid="postal-receive-form">
              <Controller
                control={control}
                name="fromTitle"
                render={({ field }) => (
                  <Form.Item label="From Title" htmlFor={fid('fromTitle')} required {...fieldError('fromTitle')}>
                    <Input {...field} id={fid('fromTitle')} autoComplete="off" />
                  </Form.Item>
                )}
              />
              <Form.Item
                label="Reference No"
                htmlFor={fid('referenceNo')}
                help={editing ? 'Assigned automatically and can’t be changed' : undefined}
              >
                <Input
                  id={fid('referenceNo')}
                  readOnly
                  value={editing?.referenceNo ?? ''}
                  placeholder="Auto-generated on save (PRC-YYYY-00001)"
                  prefix={<LockOutlined style={{ color: token.colorTextTertiary }} />}
                  style={{ background: token.colorFillTertiary }}
                  aria-readonly
                />
              </Form.Item>
              {textArea('address', 'Address')}
              {textArea('note', 'Note')}
              <Controller
                control={control}
                name="toTitle"
                render={({ field }) => (
                  <Form.Item label="To Title" htmlFor={fid('toTitle')} {...fieldError('toTitle')}>
                    <Input {...field} id={fid('toTitle')} autoComplete="off" />
                  </Form.Item>
                )}
              />
              <Controller
                control={control}
                name="receiveDate"
                render={({ field }) => (
                  <Form.Item label="Date" htmlFor={fid('receiveDate')} required {...fieldError('receiveDate')}>
                    <DatePicker
                      id={fid('receiveDate')}
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
              <Form.Item
                label="Attach Document"
                validateStatus={fileError ? 'error' : undefined}
                help={fileError ?? `Up to ${MAX_RECEIVE_DOCUMENTS} files · PDF, JPG, PNG, WEBP, DOC, DOCX · 10 MB each`}
                style={{ marginBottom: 0 }}
              >
                <Upload.Dragger
                  accept={ALLOWED_UPLOAD_TYPES.join(',')}
                  multiple
                  showUploadList={false}
                  beforeUpload={pickFile}
                  disabled={documentSlotsLeft <= 0}
                  style={{ padding: 0 }}
                >
                  <Space size="small" style={{ paddingBlock: 2 }}>
                    <CloudUploadOutlined style={{ fontSize: 18, color: token.colorPrimary }} />
                    <span>Drag and drop files here or click</span>
                  </Space>
                </Upload.Dragger>
                {(keptDocuments.length > 0 || pendingFiles.length > 0) && (
                  <List
                    size="small"
                    style={{ marginTop: token.marginXS }}
                    data-testid="receive-form-documents"
                    dataSource={[
                      ...keptDocuments.map((d) => ({ key: d.id, name: d.fileName, size: d.sizeBytes, pending: false, index: -1 })),
                      ...pendingFiles.map((f, i) => ({ key: `new-${i}`, name: f.name, size: f.size, pending: true, index: i })),
                    ]}
                    renderItem={(item) => (
                      <List.Item
                        style={{ paddingInline: 0 }}
                        actions={[
                          <Button
                            key="remove"
                            type="text"
                            size="small"
                            danger
                            icon={<DeleteOutlined />}
                            aria-label={`Remove ${item.name}`}
                            onClick={() => {
                              if (item.pending) setPendingFiles((files) => files.filter((_, i) => i !== item.index));
                              else setRemovedDocIds((ids) => [...ids, item.key]);
                            }}
                          />,
                        ]}
                      >
                        <Text ellipsis style={{ maxWidth: 200 }}>
                          <PaperClipOutlined /> {item.name}
                        </Text>
                        <Text type="secondary" style={{ fontSize: token.fontSizeSM, marginInlineStart: token.marginXS }}>
                          {item.pending ? 'new · ' : ''}
                          {formatFileSize(item.size)}
                        </Text>
                      </List.Item>
                    )}
                  />
                )}
              </Form.Item>
              <button type="submit" hidden aria-hidden />
            </Form>
          </Card>
        </Col>
      )}

      <Col xs={24} lg={showForm ? 15 : 24} xl={showForm ? 17 : 24}>
        <Card title={cardTitle('Postal Receive List')} styles={{ header: { paddingBlock: token.paddingSM } }}>
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
          {receivesQuery.isError ? (
            <Alert
              type="warning"
              showIcon
              message="Couldn't load received items"
              description="There was a problem reaching the server."
              action={
                <Button size="small" onClick={() => void receivesQuery.refetch()}>
                  Try again
                </Button>
              }
            />
          ) : (
            <Table<PostalReceive>
              rowKey="id"
              size="middle"
              columns={columns}
              dataSource={data?.content ?? []}
              loading={receivesQuery.isFetching}
              scroll={{ x: 'max-content' }}
              rowClassName={(record) => (record.id === editing?.id ? 'ant-table-row-selected' : '')}
              onChange={(_pagination, _filters, sorter) => {
                const s = (Array.isArray(sorter) ? sorter[0] : sorter) as SorterResult<PostalReceive>;
                setSort(s?.order && s.columnKey ? { key: s.columnKey as ReceiveSortKey, order: s.order } : null);
                setPage(1);
              }}
              locale={{
                emptyText: (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={debouncedSearch ? 'No received items match your search' : 'No received items recorded yet'}
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

      <PostalReceiveDetailModal receive={viewing} onClose={() => setViewing(null)} />
    </Row>
  );
}

export default PostalReceivePage;
