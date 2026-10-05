import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, Card, Col, DatePicker, Empty, Form, Input, InputNumber, Popconfirm, Result, Row, Select, Space, Table, Tooltip, Typography, Upload, theme } from 'antd';
import type { ColumnsType } from 'antd/es/table/interface';
import { CloseOutlined, CloudUploadOutlined, EditOutlined, PaperClipOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  createStockEntry,
  deleteStockEntry,
  fetchInventoryCategories,
  fetchInventoryItems,
  fetchInventoryStores,
  fetchInventorySuppliers,
  fetchStockEntries,
  removeStockDocument,
  stockDocumentUrl,
  updateStockEntry,
  uploadStockDocument,
  type StockEntry,
} from '../../api/inventory';
import { useAuthStore } from '../../store/authStore';
import { hasPermission } from '../../lib/roles';
import { API_DATE_FORMAT, DISPLAY_DATE_FORMAT, formatDisplayDate, todayApiDate } from '../../lib/dates';
import { serverMessage } from '../../lib/apiErrors';
import { copyRows, downloadCsv, downloadExcel, downloadPdf, printRows, type ExportColumn, type ExportKind } from '../../lib/tableExport';
import DataTableToolbar from '../../components/DataTableToolbar';
import { formatAmount } from '../fees/format';
import {
  INVENTORY_CATEGORIES_KEY,
  INVENTORY_ISSUES_KEY,
  INVENTORY_ITEMS_KEY,
  INVENTORY_STOCK_KEY,
  INVENTORY_STORES_KEY,
  INVENTORY_SUPPLIERS_KEY,
} from './queryKeys';

const { Title, Text } = Typography;

const DEFAULT_PAGE_SIZE = 50;

const schema = z.object({
  categoryId: z.string().min(1, 'Item Category is required'),
  itemId: z.string().min(1, 'Item is required'),
  supplierId: z.string(),
  storeId: z.string(),
  /** Whether the units are added (+) or taken out (-). */
  sign: z.enum(['+', '-']),
  amount: z.number({ invalid_type_error: 'Quantity is required' }).int('Use a whole number').min(1, 'Quantity must be at least 1'),
  purchasePrice: z.number({ invalid_type_error: 'Purchase Price is required' }).min(0, 'Purchase Price can\'t be negative'),
  date: z.string().min(1, 'Date is required'),
  description: z.string().max(500, 'Keep this under 500 characters'),
});

type FormValues = z.infer<typeof schema>;

const emptyForm = (): FormValues => ({
  categoryId: '',
  itemId: '',
  supplierId: '',
  storeId: '',
  sign: '+',
  amount: undefined as unknown as number,
  purchasePrice: undefined as unknown as number,
  date: todayApiDate(),
  description: '',
});

const EXPORT_COLUMNS: ExportColumn<StockEntry>[] = [
  { title: 'Item', value: (e) => e.itemName ?? '' },
  { title: 'Category', value: (e) => e.categoryName ?? '' },
  { title: 'Supplier', value: (e) => e.supplierName ?? '' },
  { title: 'Store', value: (e) => e.storeName ?? '' },
  { title: 'Quantity', value: (e) => String(e.quantity) },
  { title: 'Purchase Price ($)', value: (e) => formatAmount(e.purchasePrice) },
  { title: 'Date', value: (e) => formatDisplayDate(e.date) },
];

/** Inventory -> Add Item Stock (/app/inventory/add-item-stock): units bought in (or written off) per item. */
function AddItemStockPage() {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const canManage = hasPermission(useAuthStore((state) => state.user?.permissions), 'INVENTORY_MANAGE');

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [exporting, setExporting] = useState<ExportKind | null>(null);
  const [editing, setEditing] = useState<StockEntry | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [removeDocument, setRemoveDocument] = useState(false);

  const stockQuery = useQuery({ queryKey: INVENTORY_STOCK_KEY, queryFn: fetchStockEntries, enabled: canManage });
  const categoriesQuery = useQuery({ queryKey: INVENTORY_CATEGORIES_KEY, queryFn: fetchInventoryCategories, enabled: canManage });
  const suppliersQuery = useQuery({ queryKey: INVENTORY_SUPPLIERS_KEY, queryFn: fetchInventorySuppliers, enabled: canManage });
  const storesQuery = useQuery({ queryKey: INVENTORY_STORES_KEY, queryFn: fetchInventoryStores, enabled: canManage });

  const {
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: emptyForm(), mode: 'onTouched' });
  const categoryId = watch('categoryId');

  const itemsQuery = useQuery({
    queryKey: [...INVENTORY_ITEMS_KEY, categoryId],
    queryFn: () => fetchInventoryItems(categoryId),
    enabled: canManage && categoryId !== '',
  });

  useEffect(() => {
    setFile(null);
    setRemoveDocument(false);
    reset(
      editing
        ? {
            categoryId: editing.categoryId ?? '',
            itemId: editing.itemId,
            supplierId: editing.supplierId ?? '',
            storeId: editing.storeId ?? '',
            sign: editing.quantity < 0 ? '-' : '+',
            amount: Math.abs(editing.quantity),
            purchasePrice: editing.purchasePrice,
            date: editing.date,
            description: editing.description ?? '',
          }
        : emptyForm(),
    );
  }, [editing, reset]);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: INVENTORY_STOCK_KEY });
    // The item's stock changed.
    void queryClient.invalidateQueries({ queryKey: INVENTORY_ITEMS_KEY });
    void queryClient.invalidateQueries({ queryKey: INVENTORY_ISSUES_KEY });
  };

  const saveMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const input = {
        itemId: values.itemId,
        supplierId: values.supplierId || null,
        storeId: values.storeId || null,
        quantity: values.sign === '-' ? -values.amount : values.amount,
        purchasePrice: values.purchasePrice,
        date: values.date,
        description: values.description.trim() || null,
      };
      let saved = editing ? await updateStockEntry(editing.id, input) : await createStockEntry(input);
      // The entry is saved; a failing document upload should not look like a failed save.
      try {
        if (file) saved = await uploadStockDocument(saved.id, file);
        else if (editing && removeDocument && editing.attachment) saved = await removeStockDocument(saved.id);
      } catch {
        return { saved, documentFailed: true };
      }
      return { saved, documentFailed: false };
    },
    onSuccess: ({ saved, documentFailed }) => {
      if (documentFailed) message.warning('The stock was saved, but the document could not be uploaded. Edit the entry to try again.');
      else message.success(editing ? 'Item stock updated' : `Stock of "${saved.itemName ?? 'item'}" saved`);
      refresh();
      setEditing(null);
      reset(emptyForm());
      setFile(null);
    },
    onError: (error) => message.error(serverMessage(error) ?? 'Could not save the item stock. Please try again.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (entry: StockEntry) => deleteStockEntry(entry.id).then(() => entry),
    onSuccess: (entry) => {
      message.success('Stock entry deleted');
      if (editing?.id === entry.id) setEditing(null);
      refresh();
    },
    onError: (error) => message.error(serverMessage(error) ?? 'Could not delete the stock entry. Please try again.'),
  });

  // The list is short, so search runs in the browser over every entry.
  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const all = stockQuery.data ?? [];
    return term ? all.filter((e) => EXPORT_COLUMNS.some((c) => String(c.value(e) ?? '').toLowerCase().includes(term))) : all;
  }, [stockQuery.data, search]);

  if (!canManage) {
    return <Result status="403" title="Not available" subTitle="You don't have permission to manage item stock." />;
  }

  const handleExport = async (kind: ExportKind) => {
    setExporting(kind);
    try {
      const fileBase = `item-stock-${dayjs().format('YYYY-MM-DD')}`;
      const title = 'Item Stock List';
      if (kind === 'copy') {
        await copyRows(rows, EXPORT_COLUMNS);
        message.success(`Copied ${rows.length} row${rows.length === 1 ? '' : 's'} to the clipboard`);
      } else if (kind === 'csv') downloadCsv(rows, EXPORT_COLUMNS, fileBase);
      else if (kind === 'excel') await downloadExcel(rows, EXPORT_COLUMNS, fileBase, title);
      else if (kind === 'pdf') await downloadPdf(rows, EXPORT_COLUMNS, fileBase, title);
      else printRows(rows, EXPORT_COLUMNS, title);
    } catch {
      message.error("Couldn't export the item stock. Please try again.");
    } finally {
      setExporting(null);
    }
  };

  const columns: ColumnsType<StockEntry> = [
    { key: 'item', title: 'Item', sorter: (a, b) => (a.itemName ?? '').localeCompare(b.itemName ?? ''), render: (_v, e) => e.itemName },
    { key: 'category', title: 'Category', sorter: (a, b) => (a.categoryName ?? '').localeCompare(b.categoryName ?? ''), render: (_v, e) => e.categoryName },
    { key: 'supplier', title: 'Supplier', sorter: (a, b) => (a.supplierName ?? '').localeCompare(b.supplierName ?? ''), render: (_v, e) => e.supplierName ?? '' },
    { key: 'store', title: 'Store', sorter: (a, b) => (a.storeName ?? '').localeCompare(b.storeName ?? ''), render: (_v, e) => e.storeName ?? '' },
    { key: 'quantity', title: 'Quantity', align: 'right', sorter: (a, b) => a.quantity - b.quantity, render: (_v, e) => e.quantity },
    {
      key: 'price',
      title: 'Purchase Price ($)',
      align: 'right',
      sorter: (a, b) => a.purchasePrice - b.purchasePrice,
      render: (_v, e) => formatAmount(e.purchasePrice),
    },
    { key: 'date', title: 'Date', sorter: (a, b) => a.date.localeCompare(b.date), render: (_v, e) => formatDisplayDate(e.date) },
    {
      key: 'action',
      title: 'Action',
      align: 'right',
      width: 130,
      render: (_v, e) => (
        <Space size={token.marginXXS}>
          {e.attachment && (
            <Tooltip title={e.attachment.fileName}>
              <Button size="small" icon={<PaperClipOutlined />} href={stockDocumentUrl(e.id)} aria-label={`Download document of ${e.itemName ?? 'entry'}`} />
            </Tooltip>
          )}
          <Tooltip title="Edit">
            <Button type="primary" size="small" icon={<EditOutlined />} aria-label={`Edit stock of ${e.itemName ?? 'item'}`} onClick={() => setEditing(e)} />
          </Tooltip>
          <Popconfirm
            title="Delete this stock entry?"
            description="Its quantity is taken back off the item."
            okText="Delete"
            okButtonProps={{ danger: true }}
            onConfirm={() => deleteMutation.mutateAsync(e).catch(() => undefined)}
          >
            <Tooltip title="Delete">
              <Button type="primary" size="small" icon={<CloseOutlined />} aria-label={`Delete stock of ${e.itemName ?? 'item'}`} />
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
      <Col xs={24} lg={9} xl={8}>
        <Card
          title={cardTitle(editing ? 'Edit Item Stock' : 'Add Item Stock')}
          actions={[
            <div key="save" style={{ display: 'flex', justifyContent: 'flex-end', gap: token.marginXS, paddingInline: token.paddingLG }}>
              {editing && <Button onClick={() => setEditing(null)}>Cancel</Button>}
              <Button type="primary" onClick={save} loading={saveMutation.isPending}>
                Save
              </Button>
            </div>,
          ]}
        >
          <Form layout="vertical" onFinish={save} data-testid="item-stock-form">
            <Controller
              control={control}
              name="categoryId"
              render={({ field }) => (
                <Form.Item label="Item Category" htmlFor="stock-category" required {...err('categoryId')}>
                  <Select
                    id="stock-category"
                    placeholder="Select"
                    showSearch
                    optionFilterProp="label"
                    loading={categoriesQuery.isLoading}
                    options={(categoriesQuery.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
                    value={field.value || undefined}
                    onChange={(value: string) => {
                      field.onChange(value);
                      setValue('itemId', '');
                    }}
                    onBlur={field.onBlur}
                  />
                </Form.Item>
              )}
            />
            <Controller
              control={control}
              name="itemId"
              render={({ field }) => (
                <Form.Item label="Item" htmlFor="stock-item" required {...err('itemId')}>
                  <Select
                    id="stock-item"
                    placeholder="Select"
                    showSearch
                    optionFilterProp="label"
                    disabled={!categoryId}
                    loading={itemsQuery.isFetching}
                    options={(itemsQuery.data ?? []).map((i) => ({ value: i.id, label: i.name }))}
                    value={field.value || undefined}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                  />
                </Form.Item>
              )}
            />
            <Controller
              control={control}
              name="supplierId"
              render={({ field }) => (
                <Form.Item label="Supplier" htmlFor="stock-supplier">
                  <Select
                    id="stock-supplier"
                    placeholder="Select"
                    allowClear
                    showSearch
                    optionFilterProp="label"
                    loading={suppliersQuery.isLoading}
                    options={(suppliersQuery.data ?? []).map((s) => ({ value: s.id, label: s.name }))}
                    value={field.value || undefined}
                    onChange={(value?: string) => field.onChange(value ?? '')}
                  />
                </Form.Item>
              )}
            />
            <Controller
              control={control}
              name="storeId"
              render={({ field }) => (
                <Form.Item label="Store" htmlFor="stock-store">
                  <Select
                    id="stock-store"
                    placeholder="Select"
                    allowClear
                    showSearch
                    optionFilterProp="label"
                    loading={storesQuery.isLoading}
                    options={(storesQuery.data ?? []).map((s) => ({ value: s.id, label: s.code ? `${s.name} (${s.code})` : s.name }))}
                    value={field.value || undefined}
                    onChange={(value?: string) => field.onChange(value ?? '')}
                  />
                </Form.Item>
              )}
            />
            <Form.Item label="Quantity" htmlFor="stock-quantity" required {...(errors.amount ? err('amount') : {})}>
              <Space.Compact style={{ width: '100%' }}>
                <Controller
                  control={control}
                  name="sign"
                  render={({ field }) => (
                    <Select
                      aria-label="Add or take out"
                      style={{ width: 84 }}
                      value={field.value}
                      onChange={field.onChange}
                      options={[
                        { value: '+', label: '+ Add' },
                        { value: '-', label: '− Take out' },
                      ]}
                      popupMatchSelectWidth={false}
                    />
                  )}
                />
                <Controller
                  control={control}
                  name="amount"
                  render={({ field }) => (
                    <InputNumber
                      id="stock-quantity"
                      style={{ width: '100%' }}
                      min={1}
                      precision={0}
                      value={field.value ?? null}
                      onChange={(v) => field.onChange(v ?? undefined)}
                      onBlur={field.onBlur}
                    />
                  )}
                />
              </Space.Compact>
            </Form.Item>
            <Controller
              control={control}
              name="purchasePrice"
              render={({ field }) => (
                <Form.Item label="Purchase Price ($)" htmlFor="stock-price" required {...err('purchasePrice')}>
                  <InputNumber
                    id="stock-price"
                    style={{ width: '100%' }}
                    min={0}
                    precision={2}
                    value={field.value ?? null}
                    onChange={(v) => field.onChange(v ?? undefined)}
                    onBlur={field.onBlur}
                  />
                </Form.Item>
              )}
            />
            <Controller
              control={control}
              name="date"
              render={({ field }) => (
                <Form.Item label="Date" htmlFor="stock-date" required {...err('date')}>
                  <DatePicker
                    id="stock-date"
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
            <Form.Item label="Attach Document">
              {editing?.attachment && !removeDocument && !file && (
                <div style={{ marginBottom: token.marginXS }}>
                  <PaperClipOutlined /> <a href={stockDocumentUrl(editing.id)}>{editing.attachment.fileName}</a>{' '}
                  <Button type="link" size="small" danger onClick={() => setRemoveDocument(true)}>
                    Remove
                  </Button>
                </div>
              )}
              <Upload.Dragger
                multiple={false}
                maxCount={1}
                showUploadList={{ showRemoveIcon: true }}
                accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
                fileList={file ? [{ uid: 'stock-doc', name: file.name, status: 'done' }] : []}
                beforeUpload={(f) => {
                  if (f.size > 10 * 1024 * 1024) {
                    message.error('The file exceeds the 10 MB limit');
                    return Upload.LIST_IGNORE;
                  }
                  setFile(f);
                  return false;
                }}
                onRemove={() => setFile(null)}
                style={{ padding: 0 }}
              >
                <span>
                  <CloudUploadOutlined /> Drag and drop a file here or click
                </span>
              </Upload.Dragger>
            </Form.Item>
            <Controller
              control={control}
              name="description"
              render={({ field }) => (
                <Form.Item label="Description" htmlFor="stock-description" style={{ marginBottom: 0 }} {...err('description')}>
                  <Input.TextArea {...field} id="stock-description" rows={3} maxLength={500} />
                </Form.Item>
              )}
            />
            <button type="submit" hidden aria-hidden />
          </Form>
        </Card>
      </Col>

      <Col xs={24} lg={15} xl={16}>
        <Card title={cardTitle('Item Stock List')}>
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
          {stockQuery.isError ? (
            <Alert
              type="warning"
              showIcon
              message="Couldn't load the item stock"
              description="There was a problem reaching the server."
              action={
                <Button size="small" onClick={() => void stockQuery.refetch()}>
                  Try again
                </Button>
              }
            />
          ) : (
            <Table<StockEntry>
              rowKey="id"
              size="middle"
              columns={columns}
              dataSource={rows}
              loading={stockQuery.isFetching}
              scroll={{ x: 'max-content' }}
              rowClassName={(e) => (e.id === editing?.id ? 'ant-table-row-selected' : '')}
              locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={search.trim() ? 'No stock entries match your search' : 'No stock added yet'} /> }}
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

export default AddItemStockPage;
