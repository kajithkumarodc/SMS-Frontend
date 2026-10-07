import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Empty,
  Form,
  Input,
  Menu,
  Popconfirm,
  Result,
  Row,
  Space,
  Table,
  Tooltip,
  Typography,
  theme,
} from 'antd';
import type { ColumnsType, SorterResult } from 'antd/es/table/interface';
import { CloseOutlined, EditOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  createSetupItem,
  deleteSetupItem,
  fetchSetupItems,
  updateSetupItem,
  type SetupItem,
  type SetupListKey,
} from '../../api/frontOfficeSetup';
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
import {
  COMPLAINT_TYPES_KEY,
  ENQUIRY_REFERENCES_KEY,
  ENQUIRY_SOURCES_KEY,
  FRONT_OFFICE_PURPOSES_KEY,
  FRONT_OFFICE_SETUP_KEY,
} from './queryKeys';

const { Title, Text } = Typography;

type ListConfig = {
  key: SetupListKey;
  /** Singular label: menu item, form field and list column. */
  label: string;
  /** The dropdown query the Front Office forms use -- refreshed after every change here. */
  formQueryKey: readonly string[];
};

const LISTS: ListConfig[] = [
  { key: 'purposes', label: 'Purpose', formQueryKey: FRONT_OFFICE_PURPOSES_KEY },
  { key: 'complaint-types', label: 'Complaint Type', formQueryKey: COMPLAINT_TYPES_KEY },
  { key: 'sources', label: 'Source', formQueryKey: ENQUIRY_SOURCES_KEY },
  { key: 'references', label: 'Reference', formQueryKey: ENQUIRY_REFERENCES_KEY },
];

const HIDDEN_COLUMNS_STORAGE_KEY = 'sms.frontOfficeSetup.hiddenColumns';

type FormValues = { name: string; description: string };

type Sort = { key: 'name' | 'description'; order: 'ascend' | 'descend' } | null;

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

/** Setup Front Office: manage the Purpose, Complaint Type, Source and Reference lists the Front Office forms use. */
function FrontOfficeSetupPage() {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const canManage = hasPermission(useAuthStore((state) => state.user?.permissions), 'FRONT_OFFICE_SETUP');

  const [searchParams, setSearchParams] = useSearchParams();
  const current = LISTS.find((l) => l.key === searchParams.get('list')) ?? LISTS[0];

  const [editing, setEditing] = useState<SetupItem | null>(null);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<Sort>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [hiddenColumns, setHiddenColumns] = useState<string[]>(readHiddenColumns);
  const [exporting, setExporting] = useState<ExportKind | null>(null);

  const schema = useMemo(
    () =>
      z.object({
        name: z.string().trim().min(1, `${current.label} is required`).max(100, 'Keep this under 100 characters'),
        description: z.string().max(500, 'Keep this under 500 characters'),
      }),
    [current.label],
  );
  const {
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { name: '', description: '' }, mode: 'onTouched' });

  // Switching lists starts fresh.
  useEffect(() => {
    setEditing(null);
    setSearch('');
    setSort(null);
    setPage(1);
  }, [current.key]);

  useEffect(() => {
    reset(editing ? { name: editing.name, description: editing.description ?? '' } : { name: '', description: '' });
  }, [editing, reset, current.key]);

  const itemsQuery = useQuery({
    queryKey: [...FRONT_OFFICE_SETUP_KEY, current.key],
    queryFn: () => fetchSetupItems(current.key),
    enabled: canManage,
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: [...FRONT_OFFICE_SETUP_KEY, current.key] });
    void queryClient.invalidateQueries({ queryKey: current.formQueryKey });
  };

  const saveMutation = useMutation({
    mutationFn: (values: FormValues) => {
      const input = { name: values.name.trim(), description: values.description.trim() || null };
      return editing ? updateSetupItem(current.key, editing.id, input) : createSetupItem(current.key, input);
    },
    onSuccess: (saved) => {
      message.success(`${current.label} "${saved.name}" ${editing ? 'updated' : 'saved'}`);
      refresh();
      setEditing(null);
      reset({ name: '', description: '' });
    },
    onError: (error) => {
      const detail = serverMessage(error);
      if (detail) setError('name', { message: detail });
      else message.error(`Could not save the ${current.label.toLowerCase()}. Please try again.`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (item: SetupItem) => deleteSetupItem(current.key, item.id).then((result) => ({ item, result })),
    onSuccess: ({ item, result }) => {
      if (result.outcome === 'DELETED') {
        message.success(`${current.label} "${item.name}" deleted`);
      } else {
        message.info(
          `"${item.name}" is used by ${result.usageCount} record${result.usageCount === 1 ? '' : 's'}, so it was ` +
            'hidden from the forms instead of deleted. Existing records still show it; add it again to restore it.',
          6,
        );
      }
      if (editing?.id === item.id) setEditing(null);
      refresh();
    },
    onError: (error) => message.error(serverMessage(error) ?? 'Could not delete it. Please try again.'),
  });

  // Search, sort and page in the browser: these lists are short and loaded whole.
  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const filtered = (itemsQuery.data ?? []).filter(
      (i) => !needle || i.name.toLowerCase().includes(needle) || (i.description ?? '').toLowerCase().includes(needle),
    );
    if (!sort) return filtered;
    const dir = sort.order === 'ascend' ? 1 : -1;
    return [...filtered].sort((a, b) => dir * (a[sort.key] ?? '').localeCompare(b[sort.key] ?? '', undefined, { sensitivity: 'base' }));
  }, [itemsQuery.data, search, sort]);

  if (!canManage) {
    return <Result status="403" title="Not available" subTitle="You don't have permission to set up Front Office." />;
  }

  const dataColumns: { key: 'name' | 'description'; title: string; value: (i: SetupItem) => string }[] = [
    { key: 'name', title: current.label, value: (i) => i.name },
    { key: 'description', title: 'Description', value: (i) => i.description ?? '' },
  ];
  const visibleColumns = dataColumns.filter((c) => !hiddenColumns.includes(c.key));

  const handleExport = async (kind: ExportKind) => {
    setExporting(kind);
    try {
      const columns: ExportColumn<SetupItem>[] = visibleColumns.map((c) => ({ title: c.title, value: c.value }));
      const fileBase = `${current.key}-${dayjs().format('YYYY-MM-DD')}`;
      const title = `${current.label} List`;
      if (kind === 'copy') {
        await copyRows(rows, columns);
        message.success(`Copied ${rows.length} row${rows.length === 1 ? '' : 's'} to the clipboard`);
      } else if (kind === 'csv') downloadCsv(rows, columns, fileBase);
      else if (kind === 'excel') await downloadExcel(rows, columns, fileBase, title);
      else if (kind === 'pdf') await downloadPdf(rows, columns, fileBase, title);
      else printRows(rows, columns, title);
    } catch {
      message.error("Couldn't export the list. Please try again.");
    } finally {
      setExporting(null);
    }
  };

  const columns: ColumnsType<SetupItem> = [
    ...visibleColumns.map((c) => ({
      key: c.key,
      title: c.title,
      sorter: true,
      sortOrder: sort?.key === c.key ? sort.order : null,
      render: (_: unknown, record: SetupItem) =>
        c.value(record) || (c.key === 'description' ? <Text type="secondary">—</Text> : ''),
    })),
    {
      key: 'action',
      title: 'Action',
      align: 'right',
      width: 90,
      render: (_: unknown, record: SetupItem) => (
        <Space size={token.marginXXS}>
          <Tooltip title="Edit">
            <Button
              type="primary"
              size="small"
              icon={<EditOutlined />}
              aria-label={`Edit ${record.name}`}
              onClick={() => setEditing(record)}
            />
          </Tooltip>
          <Popconfirm
            title={`Delete "${record.name}"?`}
            description="If records use it, it's hidden from the forms instead, and they keep it."
            okText="Delete"
            okButtonProps={{ danger: true }}
            onConfirm={() => deleteMutation.mutateAsync(record)}
          >
            <Tooltip title="Delete">
              <Button type="primary" size="small" icon={<CloseOutlined />} aria-label={`Delete ${record.name}`} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const cardTitle = (text: string) => (
    <Title level={4} style={{ margin: 0, fontWeight: 500, whiteSpace: 'normal' }}>
      {text}
    </Title>
  );
  const submit = handleSubmit((values) => saveMutation.mutate(values));
  const fieldError = (name: keyof FormValues) =>
    errors[name] ? { validateStatus: 'error' as const, help: errors[name]?.message } : {};

  return (
    <Row gutter={[token.marginLG, token.marginLG]} align="top">
      <Col xs={24} md={6} xl={4}>
        <Card styles={{ body: { padding: token.paddingXS } }}>
          <Menu
            data-testid="setup-lists"
            mode="inline"
            selectedKeys={[current.key]}
            style={{ border: 'none' }}
            items={LISTS.map((l) => ({ key: l.key, label: l.label }))}
            onClick={({ key }) => setSearchParams({ list: key })}
          />
        </Card>
      </Col>

      <Col xs={24} md={18} xl={7}>
        <Card
          title={cardTitle(`${editing ? 'Edit' : 'Add'} ${current.label}`)}
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
          <Form layout="vertical" onFinish={submit} data-testid="setup-form">
            <Controller
              control={control}
              name="name"
              render={({ field }) => (
                <Form.Item label={current.label} htmlFor="setup-name" required {...fieldError('name')}>
                  <Input {...field} id="setup-name" autoComplete="off" />
                </Form.Item>
              )}
            />
            <Controller
              control={control}
              name="description"
              render={({ field }) => (
                <Form.Item label="Description" htmlFor="setup-description" style={{ marginBottom: 0 }} {...fieldError('description')}>
                  <Input.TextArea {...field} id="setup-description" rows={3} />
                </Form.Item>
              )}
            />
            <button type="submit" hidden aria-hidden />
          </Form>
        </Card>
      </Col>

      <Col xs={24} xl={13}>
        <Card title={cardTitle(`${current.label} List`)} styles={{ header: { paddingBlock: token.paddingSM } }}>
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
            columns={dataColumns.map((c) => ({ key: c.key, title: c.title }))}
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
          {itemsQuery.isError ? (
            <Alert
              type="warning"
              showIcon
              message="Couldn't load the list"
              description="There was a problem reaching the server."
              action={
                <Button size="small" onClick={() => void itemsQuery.refetch()}>
                  Try again
                </Button>
              }
            />
          ) : (
            <Table<SetupItem>
              rowKey="id"
              size="middle"
              columns={columns}
              dataSource={rows}
              loading={itemsQuery.isFetching}
              scroll={{ x: 'max-content' }}
              rowClassName={(record) => (record.id === editing?.id ? 'ant-table-row-selected' : '')}
              onChange={(_pagination, _filters, sorter) => {
                const s = (Array.isArray(sorter) ? sorter[0] : sorter) as SorterResult<SetupItem>;
                setSort(s?.order && s.columnKey ? { key: s.columnKey as 'name' | 'description', order: s.order } : null);
              }}
              locale={{
                emptyText: (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={search ? 'Nothing matches your search' : `No ${current.label.toLowerCase()} entries yet`}
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
        </Card>
      </Col>
    </Row>
  );
}

export default FrontOfficeSetupPage;
