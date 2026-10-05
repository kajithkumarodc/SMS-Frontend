import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, Card, Col, Empty, Form, Input, InputNumber, Popconfirm, Result, Row, Select, Space, Table, Tooltip, Typography, theme } from 'antd';
import type { ColumnsType } from 'antd/es/table/interface';
import { CloseOutlined, EditOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  createInventoryItem,
  deleteInventoryItem,
  fetchInventoryCategories,
  fetchInventoryItems,
  updateInventoryItem,
  type InventoryItem,
} from '../../api/inventory';
import { useAuthStore } from '../../store/authStore';
import { hasPermission } from '../../lib/roles';
import { serverMessage } from '../../lib/apiErrors';
import { copyRows, downloadCsv, downloadExcel, downloadPdf, printRows, type ExportColumn, type ExportKind } from '../../lib/tableExport';
import DataTableToolbar from '../../components/DataTableToolbar';
import { INVENTORY_CATEGORIES_KEY, INVENTORY_ISSUES_KEY, INVENTORY_ITEMS_KEY } from './queryKeys';

const { Title, Text } = Typography;

const DEFAULT_PAGE_SIZE = 50;

const schema = z.object({
  categoryId: z.string().min(1, 'Item Category is required'),
  name: z.string().trim().min(1, 'Item is required').max(100, 'Keep this under 100 characters'),
  stock: z.number({ invalid_type_error: 'Stock is required' }).int('Use a whole number').min(0, 'Stock can\'t be negative'),
});

type FormValues = z.infer<typeof schema>;

const EXPORT_COLUMNS: ExportColumn<InventoryItem>[] = [
  { title: 'Item', value: (i) => i.name },
  { title: 'Item Category', value: (i) => i.categoryName },
  { title: 'Stock', value: (i) => String(i.stock) },
];

/** Inventory -> Add Item (/app/inventory/add-item): the items in each category and the units in stock. */
function AddItemPage() {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const canManage = hasPermission(useAuthStore((state) => state.user?.permissions), 'INVENTORY_MANAGE');

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [exporting, setExporting] = useState<ExportKind | null>(null);
  const [editing, setEditing] = useState<InventoryItem | null>(null);

  const itemsQuery = useQuery({ queryKey: [...INVENTORY_ITEMS_KEY, 'all'], queryFn: () => fetchInventoryItems(), enabled: canManage });
  const categoriesQuery = useQuery({ queryKey: INVENTORY_CATEGORIES_KEY, queryFn: fetchInventoryCategories, enabled: canManage });

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { categoryId: '', name: '', stock: 0 },
    mode: 'onTouched',
  });

  useEffect(() => {
    reset(editing ? { categoryId: editing.categoryId, name: editing.name, stock: editing.stock } : { categoryId: '', name: '', stock: 0 });
  }, [editing, reset]);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: INVENTORY_ITEMS_KEY });
    void queryClient.invalidateQueries({ queryKey: INVENTORY_ISSUES_KEY });
  };

  const saveMutation = useMutation({
    mutationFn: (values: FormValues) =>
      editing ? updateInventoryItem(editing.id, { ...values, name: values.name.trim() }) : createInventoryItem({ ...values, name: values.name.trim() }),
    onSuccess: (saved) => {
      message.success(editing ? `Item "${saved.name}" updated` : `Item "${saved.name}" saved`);
      refresh();
      setEditing(null);
      reset({ categoryId: '', name: '', stock: 0 });
    },
    onError: (error) => message.error(serverMessage(error) ?? 'Could not save the item. Please try again.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (item: InventoryItem) => deleteInventoryItem(item.id).then(() => item),
    onSuccess: (item) => {
      message.success(`Item "${item.name}" deleted`);
      if (editing?.id === item.id) setEditing(null);
      refresh();
    },
    onError: (error) => message.error(serverMessage(error) ?? 'Could not delete the item. Please try again.'),
  });

  // The list is short, so search runs in the browser over every item.
  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const all = itemsQuery.data ?? [];
    return term ? all.filter((i) => EXPORT_COLUMNS.some((c) => String(c.value(i) ?? '').toLowerCase().includes(term))) : all;
  }, [itemsQuery.data, search]);

  if (!canManage) {
    return <Result status="403" title="Not available" subTitle="You don't have permission to manage inventory items." />;
  }

  const handleExport = async (kind: ExportKind) => {
    setExporting(kind);
    try {
      const fileBase = `items-${dayjs().format('YYYY-MM-DD')}`;
      const title = 'Item List';
      if (kind === 'copy') {
        await copyRows(rows, EXPORT_COLUMNS);
        message.success(`Copied ${rows.length} row${rows.length === 1 ? '' : 's'} to the clipboard`);
      } else if (kind === 'csv') downloadCsv(rows, EXPORT_COLUMNS, fileBase);
      else if (kind === 'excel') await downloadExcel(rows, EXPORT_COLUMNS, fileBase, title);
      else if (kind === 'pdf') await downloadPdf(rows, EXPORT_COLUMNS, fileBase, title);
      else printRows(rows, EXPORT_COLUMNS, title);
    } catch {
      message.error("Couldn't export the items. Please try again.");
    } finally {
      setExporting(null);
    }
  };

  const columns: ColumnsType<InventoryItem> = [
    { key: 'name', title: 'Item', sorter: (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }), render: (_v, i) => i.name },
    { key: 'category', title: 'Item Category', sorter: (a, b) => a.categoryName.localeCompare(b.categoryName), render: (_v, i) => i.categoryName },
    { key: 'stock', title: 'Stock', align: 'right', sorter: (a, b) => a.stock - b.stock, render: (_v, i) => i.stock },
    {
      key: 'action',
      title: 'Action',
      align: 'right',
      width: 100,
      render: (_v, i) => (
        <Space size={token.marginXXS}>
          <Tooltip title="Edit">
            <Button type="primary" size="small" icon={<EditOutlined />} aria-label={`Edit item ${i.name}`} onClick={() => setEditing(i)} />
          </Tooltip>
          <Popconfirm
            title={`Delete "${i.name}"?`}
            description="Items that have been issued can't be deleted."
            okText="Delete"
            okButtonProps={{ danger: true }}
            onConfirm={() => deleteMutation.mutateAsync(i).catch(() => undefined)}
          >
            <Tooltip title="Delete">
              <Button type="primary" size="small" icon={<CloseOutlined />} aria-label={`Delete item ${i.name}`} />
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
  const save = handleSubmit((values) => saveMutation.mutate(values));

  return (
    <Row gutter={[token.marginLG, token.marginLG]} align="top">
      <Col xs={24} lg={9} xl={7}>
        <Card
          title={cardTitle(editing ? 'Edit Item' : 'Add Item')}
          actions={[
            <div key="save" style={{ display: 'flex', justifyContent: 'flex-end', gap: token.marginXS, paddingInline: token.paddingLG }}>
              {editing && <Button onClick={() => setEditing(null)}>Cancel</Button>}
              <Button type="primary" onClick={save} loading={saveMutation.isPending}>
                Save
              </Button>
            </div>,
          ]}
        >
          <Form layout="vertical" onFinish={save} data-testid="item-form">
            <Controller
              control={control}
              name="categoryId"
              render={({ field }) => (
                <Form.Item label="Item Category" htmlFor="item-category" required validateStatus={errors.categoryId ? 'error' : undefined} help={errors.categoryId?.message}>
                  <Select
                    id="item-category"
                    placeholder="Select"
                    showSearch
                    optionFilterProp="label"
                    loading={categoriesQuery.isLoading}
                    options={(categoriesQuery.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
                    value={field.value || undefined}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                  />
                </Form.Item>
              )}
            />
            <Controller
              control={control}
              name="name"
              render={({ field }) => (
                <Form.Item label="Item" htmlFor="item-name" required validateStatus={errors.name ? 'error' : undefined} help={errors.name?.message}>
                  <Input {...field} id="item-name" autoComplete="off" />
                </Form.Item>
              )}
            />
            <Controller
              control={control}
              name="stock"
              render={({ field }) => (
                <Form.Item
                  label="Stock"
                  htmlFor="item-stock"
                  required
                  style={{ marginBottom: 0 }}
                  validateStatus={errors.stock ? 'error' : undefined}
                  help={errors.stock?.message}
                >
                  <InputNumber
                    id="item-stock"
                    style={{ width: '100%' }}
                    min={0}
                    precision={0}
                    value={field.value ?? null}
                    onChange={(v) => field.onChange(v ?? undefined)}
                    onBlur={field.onBlur}
                  />
                </Form.Item>
              )}
            />
            <button type="submit" hidden aria-hidden />
          </Form>
        </Card>
      </Col>

      <Col xs={24} lg={15} xl={17}>
        <Card title={cardTitle('Item List')}>
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
          {itemsQuery.isError ? (
            <Alert
              type="warning"
              showIcon
              message="Couldn't load the items"
              description="There was a problem reaching the server."
              action={
                <Button size="small" onClick={() => void itemsQuery.refetch()}>
                  Try again
                </Button>
              }
            />
          ) : (
            <Table<InventoryItem>
              rowKey="id"
              size="middle"
              columns={columns}
              dataSource={rows}
              loading={itemsQuery.isFetching}
              rowClassName={(i) => (i.id === editing?.id ? 'ant-table-row-selected' : '')}
              locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={search.trim() ? 'No items match your search' : 'No items yet'} /> }}
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

export default AddItemPage;
