import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, Card, Col, Empty, Form, Input, Popconfirm, Result, Row, Space, Table, Tooltip, Typography, theme } from 'antd';
import type { ColumnsType } from 'antd/es/table/interface';
import { CloseOutlined, EditOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  createInventoryStore,
  deleteInventoryStore,
  fetchInventoryStores,
  updateInventoryStore,
  type InventoryStore,
} from '../../api/inventory';
import { useAuthStore } from '../../store/authStore';
import { hasPermission } from '../../lib/roles';
import { serverMessage } from '../../lib/apiErrors';
import { copyRows, downloadCsv, downloadExcel, downloadPdf, printRows, type ExportColumn, type ExportKind } from '../../lib/tableExport';
import DataTableToolbar from '../../components/DataTableToolbar';
import { INVENTORY_STOCK_KEY, INVENTORY_STORES_KEY } from './queryKeys';

const { Title, Text } = Typography;

const DEFAULT_PAGE_SIZE = 50;

const schema = z.object({
  name: z.string().trim().min(1, 'Item Store is required').max(100, 'Keep this under 100 characters'),
  code: z.string().trim().max(30, 'Keep this under 30 characters'),
  description: z.string().max(500, 'Keep this under 500 characters'),
});

type FormValues = z.infer<typeof schema>;

const EXPORT_COLUMNS: ExportColumn<InventoryStore>[] = [
  { title: 'Item Store Name', value: (s) => s.name },
  { title: 'Item Store Code', value: (s) => s.code ?? '' },
  { title: 'Description', value: (s) => s.description ?? '' },
];

/** Inventory -> Item Store (/app/inventory/item-store): the places items are kept. */
function ItemStorePage() {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const canManage = hasPermission(useAuthStore((state) => state.user?.permissions), 'INVENTORY_MANAGE');

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [exporting, setExporting] = useState<ExportKind | null>(null);
  const [editing, setEditing] = useState<InventoryStore | null>(null);

  const storesQuery = useQuery({ queryKey: INVENTORY_STORES_KEY, queryFn: fetchInventoryStores, enabled: canManage });

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { name: '', code: '', description: '' }, mode: 'onTouched' });

  useEffect(() => {
    reset({ name: editing?.name ?? '', code: editing?.code ?? '', description: editing?.description ?? '' });
  }, [editing, reset]);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: INVENTORY_STORES_KEY });
    void queryClient.invalidateQueries({ queryKey: INVENTORY_STOCK_KEY });
  };

  const saveMutation = useMutation({
    mutationFn: (values: FormValues) => {
      const input = { name: values.name.trim(), code: values.code.trim() || null, description: values.description.trim() || null };
      return editing ? updateInventoryStore(editing.id, input) : createInventoryStore(input);
    },
    onSuccess: (saved) => {
      message.success(editing ? `Item Store "${saved.name}" updated` : `Item Store "${saved.name}" saved`);
      refresh();
      setEditing(null);
      reset({ name: '', code: '', description: '' });
    },
    onError: (error) => message.error(serverMessage(error) ?? 'Could not save the item store. Please try again.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (store: InventoryStore) => deleteInventoryStore(store.id).then(() => store),
    onSuccess: (store) => {
      message.success(`Item Store "${store.name}" deleted`);
      if (editing?.id === store.id) setEditing(null);
      refresh();
    },
    onError: (error) => message.error(serverMessage(error) ?? 'Could not delete the item store. Please try again.'),
  });

  // The list is short, so search runs in the browser over every store.
  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const all = storesQuery.data ?? [];
    return term ? all.filter((s) => EXPORT_COLUMNS.some((c) => String(c.value(s) ?? '').toLowerCase().includes(term))) : all;
  }, [storesQuery.data, search]);

  if (!canManage) {
    return <Result status="403" title="Not available" subTitle="You don't have permission to manage item stores." />;
  }

  const handleExport = async (kind: ExportKind) => {
    setExporting(kind);
    try {
      const fileBase = `item-stores-${dayjs().format('YYYY-MM-DD')}`;
      const title = 'Item Store List';
      if (kind === 'copy') {
        await copyRows(rows, EXPORT_COLUMNS);
        message.success(`Copied ${rows.length} row${rows.length === 1 ? '' : 's'} to the clipboard`);
      } else if (kind === 'csv') downloadCsv(rows, EXPORT_COLUMNS, fileBase);
      else if (kind === 'excel') await downloadExcel(rows, EXPORT_COLUMNS, fileBase, title);
      else if (kind === 'pdf') await downloadPdf(rows, EXPORT_COLUMNS, fileBase, title);
      else printRows(rows, EXPORT_COLUMNS, title);
    } catch {
      message.error("Couldn't export the item stores. Please try again.");
    } finally {
      setExporting(null);
    }
  };

  const columns: ColumnsType<InventoryStore> = [
    { key: 'name', title: 'Item Store Name', sorter: (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }), render: (_v, s) => s.name },
    { key: 'code', title: 'Item Store Code', sorter: (a, b) => (a.code ?? '').localeCompare(b.code ?? ''), render: (_v, s) => s.code ?? '' },
    { key: 'description', title: 'Description', render: (_v, s) => s.description ?? '' },
    {
      key: 'action',
      title: 'Action',
      align: 'right',
      width: 100,
      render: (_v, s) => (
        <Space size={token.marginXXS}>
          <Tooltip title="Edit">
            <Button type="primary" size="small" icon={<EditOutlined />} aria-label={`Edit item store ${s.name}`} onClick={() => setEditing(s)} />
          </Tooltip>
          <Popconfirm
            title={`Delete "${s.name}"?`}
            description="Stores that have stock entries can't be deleted."
            okText="Delete"
            okButtonProps={{ danger: true }}
            onConfirm={() => deleteMutation.mutateAsync(s).catch(() => undefined)}
          >
            <Tooltip title="Delete">
              <Button type="primary" size="small" icon={<CloseOutlined />} aria-label={`Delete item store ${s.name}`} />
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
  const err = (name: keyof FormValues) => ({ validateStatus: errors[name] ? ('error' as const) : undefined, help: errors[name]?.message });
  const save = handleSubmit((values) => saveMutation.mutate(values));

  return (
    <Row gutter={[token.marginLG, token.marginLG]} align="top">
      <Col xs={24} lg={9} xl={7}>
        <Card
          title={cardTitle(editing ? 'Edit Item Store' : 'Add Item Store')}
          actions={[
            <div key="save" style={{ display: 'flex', justifyContent: 'flex-end', gap: token.marginXS, paddingInline: token.paddingLG }}>
              {editing && <Button onClick={() => setEditing(null)}>Cancel</Button>}
              <Button type="primary" onClick={save} loading={saveMutation.isPending}>
                Save
              </Button>
            </div>,
          ]}
        >
          <Form layout="vertical" onFinish={save} data-testid="item-store-form">
            <Controller
              control={control}
              name="name"
              render={({ field }) => (
                <Form.Item label="Item Store Name" htmlFor="store-name" required {...err('name')}>
                  <Input {...field} id="store-name" autoComplete="off" />
                </Form.Item>
              )}
            />
            <Controller
              control={control}
              name="code"
              render={({ field }) => (
                <Form.Item label="Item Store Code" htmlFor="store-code" {...err('code')}>
                  <Input {...field} id="store-code" autoComplete="off" />
                </Form.Item>
              )}
            />
            <Controller
              control={control}
              name="description"
              render={({ field }) => (
                <Form.Item label="Description" htmlFor="store-description" style={{ marginBottom: 0 }} {...err('description')}>
                  <Input.TextArea {...field} id="store-description" rows={3} maxLength={500} />
                </Form.Item>
              )}
            />
            <button type="submit" hidden aria-hidden />
          </Form>
        </Card>
      </Col>

      <Col xs={24} lg={15} xl={17}>
        <Card title={cardTitle('Item Store List')}>
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
            showColumnToggle={false}
          />
          {storesQuery.isError ? (
            <Alert
              type="warning"
              showIcon
              message="Couldn't load the item stores"
              description="There was a problem reaching the server."
              action={
                <Button size="small" onClick={() => void storesQuery.refetch()}>
                  Try again
                </Button>
              }
            />
          ) : (
            <Table<InventoryStore>
              rowKey="id"
              size="middle"
              columns={columns}
              dataSource={rows}
              loading={storesQuery.isFetching}
              rowClassName={(s) => (s.id === editing?.id ? 'ant-table-row-selected' : '')}
              locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={search.trim() ? 'No item stores match your search' : 'No item stores yet'} /> }}
              pagination={{
                current: page,
                pageSize,
                showSizeChanger: false,
                showTotal: (count, [start, end]) => (count === 0 ? '' : <Text type="secondary">Showing {start} to {end} of {count} entries</Text>),
                onChange: (nextPage) => setPage(nextPage),
              }}
            />
          )}
        </Card>
      </Col>
    </Row>
  );
}

export default ItemStorePage;
