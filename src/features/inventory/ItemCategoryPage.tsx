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
  createInventoryCategory,
  deleteInventoryCategory,
  fetchInventoryCategories,
  updateInventoryCategory,
  type InventoryCategory,
} from '../../api/inventory';
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
import { INVENTORY_CATEGORIES_KEY, INVENTORY_ISSUES_KEY, INVENTORY_ITEMS_KEY } from './queryKeys';

const { Title, Text } = Typography;

const DEFAULT_PAGE_SIZE = 50;

const schema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100, 'Keep this under 100 characters'),
});

type FormValues = z.infer<typeof schema>;

/** Inventory -> Item Category (/app/inventory/item-category): the categories items are filed under. */
function ItemCategoryPage() {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const canManage = hasPermission(useAuthStore((state) => state.user?.permissions), 'INVENTORY_MANAGE');

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [exporting, setExporting] = useState<ExportKind | null>(null);
  const [editing, setEditing] = useState<InventoryCategory | null>(null);

  const categoriesQuery = useQuery({ queryKey: INVENTORY_CATEGORIES_KEY, queryFn: fetchInventoryCategories, enabled: canManage });

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { name: '' }, mode: 'onTouched' });

  useEffect(() => {
    reset({ name: editing?.name ?? '' });
  }, [editing, reset]);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: INVENTORY_CATEGORIES_KEY });
    // The item forms and the Issue Item form offer these.
    void queryClient.invalidateQueries({ queryKey: INVENTORY_ITEMS_KEY });
  };

  const saveMutation = useMutation({
    mutationFn: (values: FormValues) => (editing ? updateInventoryCategory(editing.id, values.name.trim()) : createInventoryCategory(values.name.trim())),
    onSuccess: (saved) => {
      message.success(editing ? `Item Category "${saved.name}" updated` : `Item Category "${saved.name}" saved`);
      if (editing) {
        void queryClient.invalidateQueries({ queryKey: INVENTORY_ISSUES_KEY });
      }
      refresh();
      setEditing(null);
      reset({ name: '' });
    },
    onError: (error) => message.error(serverMessage(error) ?? 'Could not save the item category. Please try again.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (type: InventoryCategory) => deleteInventoryCategory(type.id).then(() => type),
    onSuccess: (type) => {
      message.success(`Item Category "${type.name}" deleted`);
      if (editing?.id === type.id) setEditing(null);
      refresh();
    },
    onError: (error) => message.error(serverMessage(error) ?? 'Could not delete the item category. Please try again.'),
  });

  // The list is short, so search runs in the browser over every type.
  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const all = categoriesQuery.data ?? [];
    return term ? all.filter((t) => t.name.toLowerCase().includes(term)) : all;
  }, [categoriesQuery.data, search]);

  if (!canManage) {
    return <Result status="403" title="Not available" subTitle="You don't have permission to manage item categories." />;
  }

  const handleExport = async (kind: ExportKind) => {
    setExporting(kind);
    try {
      const columns: ExportColumn<InventoryCategory>[] = [{ title: 'Name', value: (t) => t.name }];
      const fileBase = `item-categories-${dayjs().format('YYYY-MM-DD')}`;
      const title = 'Item Category List';
      if (kind === 'copy') {
        await copyRows(rows, columns);
        message.success(`Copied ${rows.length} row${rows.length === 1 ? '' : 's'} to the clipboard`);
      } else if (kind === 'csv') downloadCsv(rows, columns, fileBase);
      else if (kind === 'excel') await downloadExcel(rows, columns, fileBase, title);
      else if (kind === 'pdf') await downloadPdf(rows, columns, fileBase, title);
      else printRows(rows, columns, title);
    } catch {
      message.error("Couldn't export the item categories. Please try again.");
    } finally {
      setExporting(null);
    }
  };

  const columns: ColumnsType<InventoryCategory> = [
    {
      key: 'name',
      title: 'Name',
      sorter: (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
      render: (_v, t) => t.name,
    },
    {
      key: 'action',
      title: 'Action',
      align: 'right',
      width: 100,
      render: (_v, t) => (
        <Space size={token.marginXXS}>
          <Tooltip title="Edit">
            <Button type="primary" size="small" icon={<EditOutlined />} aria-label={`Edit item category ${t.name}`} onClick={() => setEditing(t)} />
          </Tooltip>
          <Popconfirm
            title={`Delete "${t.name}"?`}
            description="Item categories that have items can't be deleted."
            okText="Delete"
            okButtonProps={{ danger: true }}
            onConfirm={() => deleteMutation.mutateAsync(t).catch(() => undefined)}
          >
            <Tooltip title="Delete">
              <Button type="primary" size="small" icon={<CloseOutlined />} aria-label={`Delete item category ${t.name}`} />
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

  return (
    <Row gutter={[token.marginLG, token.marginLG]} align="top">
      <Col xs={24} lg={9} xl={7}>
        <Card
          title={cardTitle(editing ? 'Edit Item Category' : 'Add Item Category')}
          styles={{ header: { paddingBlock: token.paddingSM } }}
          actions={[
            <div key="save" style={{ display: 'flex', justifyContent: 'flex-end', gap: token.marginXS, paddingInline: token.paddingLG }}>
              {editing && <Button onClick={() => setEditing(null)}>Cancel</Button>}
              <Button type="primary" onClick={handleSubmit((values) => saveMutation.mutate(values))} loading={saveMutation.isPending}>
                Save
              </Button>
            </div>,
          ]}
        >
          <Form layout="vertical" onFinish={handleSubmit((values) => saveMutation.mutate(values))} data-testid="item-category-form">
            <Controller
              control={control}
              name="name"
              render={({ field }) => (
                <Form.Item
                  label="Name"
                  htmlFor="item-category-name"
                  required
                  style={{ marginBottom: 0 }}
                  validateStatus={errors.name ? 'error' : undefined}
                  help={errors.name?.message}
                >
                  <Input {...field} id="item-category-name" autoComplete="off" />
                </Form.Item>
              )}
            />
            <button type="submit" hidden aria-hidden />
          </Form>
        </Card>
      </Col>

      <Col xs={24} lg={15} xl={17}>
        <Card title={cardTitle('Item Category List')} styles={{ header: { paddingBlock: token.paddingSM } }}>
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
            columns={[{ key: 'name', title: 'Name' }]}
            hiddenColumns={[]}
            onHiddenColumnsChange={() => undefined}
            onExport={(kind) => void handleExport(kind)}
            exporting={exporting}
            canExport={canManage}
            canPrint={canManage}
          />
          {categoriesQuery.isError ? (
            <Alert
              type="warning"
              showIcon
              message="Couldn't load the item categories"
              description="There was a problem reaching the server."
              action={
                <Button size="small" onClick={() => void categoriesQuery.refetch()}>
                  Try again
                </Button>
              }
            />
          ) : (
            <Table<InventoryCategory>
              rowKey="id"
              size="middle"
              columns={columns}
              dataSource={rows}
              loading={categoriesQuery.isFetching}
              rowClassName={(t) => (t.id === editing?.id ? 'ant-table-row-selected' : '')}
              locale={{
                emptyText: (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={search.trim() ? 'No item categories match your search' : 'No item categories yet'} />
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

export default ItemCategoryPage;
