import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, Card, Col, Empty, Form, Input, Popconfirm, Result, Row, Space, Table, Tooltip, Typography, theme } from 'antd';
import type { ColumnsType } from 'antd/es/table/interface';
import { BankOutlined, CloseOutlined, EditOutlined, MailFilled, PhoneFilled, UserOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  createInventorySupplier,
  deleteInventorySupplier,
  fetchInventorySuppliers,
  updateInventorySupplier,
  type InventorySupplier,
} from '../../api/inventory';
import { useAuthStore } from '../../store/authStore';
import { hasPermission } from '../../lib/roles';
import { serverMessage } from '../../lib/apiErrors';
import { copyRows, downloadCsv, downloadExcel, downloadPdf, printRows, type ExportColumn, type ExportKind } from '../../lib/tableExport';
import DataTableToolbar from '../../components/DataTableToolbar';
import { INVENTORY_STOCK_KEY, INVENTORY_SUPPLIERS_KEY } from './queryKeys';

const { Title, Text } = Typography;

const DEFAULT_PAGE_SIZE = 50;

const optionalEmail = z
  .string()
  .trim()
  .max(150, 'Keep this under 150 characters')
  .refine((v) => v === '' || z.string().email().safeParse(v).success, 'Enter a valid email address');

const schema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100, 'Keep this under 100 characters'),
  phone: z.string().trim().max(30, 'Keep this under 30 characters'),
  email: optionalEmail,
  address: z.string().trim().max(300, 'Keep this under 300 characters'),
  contactPersonName: z.string().trim().max(100, 'Keep this under 100 characters'),
  contactPersonPhone: z.string().trim().max(30, 'Keep this under 30 characters'),
  contactPersonEmail: optionalEmail,
  description: z.string().max(500, 'Keep this under 500 characters'),
});

type FormValues = z.infer<typeof schema>;

const EMPTY: FormValues = {
  name: '',
  phone: '',
  email: '',
  address: '',
  contactPersonName: '',
  contactPersonPhone: '',
  contactPersonEmail: '',
  description: '',
};

const nullable = (value: string) => value.trim() || null;

const EXPORT_COLUMNS: ExportColumn<InventorySupplier>[] = [
  { title: 'Item Supplier', value: (s) => s.name },
  { title: 'Phone', value: (s) => s.phone ?? '' },
  { title: 'Email', value: (s) => s.email ?? '' },
  { title: 'Address', value: (s) => s.address ?? '' },
  { title: 'Contact Person Name', value: (s) => s.contactPersonName ?? '' },
  { title: 'Contact Person Phone', value: (s) => s.contactPersonPhone ?? '' },
  { title: 'Contact Person Email', value: (s) => s.contactPersonEmail ?? '' },
  { title: 'Description', value: (s) => s.description ?? '' },
];

/** Inventory -> Item Supplier (/app/inventory/item-supplier): who items are bought from. */
function ItemSupplierPage() {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const canManage = hasPermission(useAuthStore((state) => state.user?.permissions), 'INVENTORY_MANAGE');

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [exporting, setExporting] = useState<ExportKind | null>(null);
  const [editing, setEditing] = useState<InventorySupplier | null>(null);

  const suppliersQuery = useQuery({ queryKey: INVENTORY_SUPPLIERS_KEY, queryFn: fetchInventorySuppliers, enabled: canManage });

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: EMPTY, mode: 'onTouched' });

  useEffect(() => {
    reset(
      editing
        ? {
            name: editing.name,
            phone: editing.phone ?? '',
            email: editing.email ?? '',
            address: editing.address ?? '',
            contactPersonName: editing.contactPersonName ?? '',
            contactPersonPhone: editing.contactPersonPhone ?? '',
            contactPersonEmail: editing.contactPersonEmail ?? '',
            description: editing.description ?? '',
          }
        : EMPTY,
    );
  }, [editing, reset]);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: INVENTORY_SUPPLIERS_KEY });
    void queryClient.invalidateQueries({ queryKey: INVENTORY_STOCK_KEY });
  };

  const saveMutation = useMutation({
    mutationFn: (values: FormValues) => {
      const input = {
        name: values.name.trim(),
        phone: nullable(values.phone),
        email: nullable(values.email),
        address: nullable(values.address),
        contactPersonName: nullable(values.contactPersonName),
        contactPersonPhone: nullable(values.contactPersonPhone),
        contactPersonEmail: nullable(values.contactPersonEmail),
        description: nullable(values.description),
      };
      return editing ? updateInventorySupplier(editing.id, input) : createInventorySupplier(input);
    },
    onSuccess: (saved) => {
      message.success(editing ? `Item Supplier "${saved.name}" updated` : `Item Supplier "${saved.name}" saved`);
      refresh();
      setEditing(null);
      reset(EMPTY);
    },
    onError: (error) => message.error(serverMessage(error) ?? 'Could not save the item supplier. Please try again.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (supplier: InventorySupplier) => deleteInventorySupplier(supplier.id).then(() => supplier),
    onSuccess: (supplier) => {
      message.success(`Item Supplier "${supplier.name}" deleted`);
      if (editing?.id === supplier.id) setEditing(null);
      refresh();
    },
    onError: (error) => message.error(serverMessage(error) ?? 'Could not delete the item supplier. Please try again.'),
  });

  // The list is short, so search runs in the browser over every supplier.
  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const all = suppliersQuery.data ?? [];
    return term ? all.filter((s) => EXPORT_COLUMNS.some((c) => String(c.value(s) ?? '').toLowerCase().includes(term))) : all;
  }, [suppliersQuery.data, search]);

  if (!canManage) {
    return <Result status="403" title="Not available" subTitle="You don't have permission to manage item suppliers." />;
  }

  const handleExport = async (kind: ExportKind) => {
    setExporting(kind);
    try {
      const fileBase = `item-suppliers-${dayjs().format('YYYY-MM-DD')}`;
      const title = 'Item Supplier List';
      if (kind === 'copy') {
        await copyRows(rows, EXPORT_COLUMNS);
        message.success(`Copied ${rows.length} row${rows.length === 1 ? '' : 's'} to the clipboard`);
      } else if (kind === 'csv') downloadCsv(rows, EXPORT_COLUMNS, fileBase);
      else if (kind === 'excel') await downloadExcel(rows, EXPORT_COLUMNS, fileBase, title);
      else if (kind === 'pdf') await downloadPdf(rows, EXPORT_COLUMNS, fileBase, title);
      else printRows(rows, EXPORT_COLUMNS, title);
    } catch {
      message.error("Couldn't export the item suppliers. Please try again.");
    } finally {
      setExporting(null);
    }
  };

  const columns: ColumnsType<InventorySupplier> = [
    {
      key: 'name',
      title: 'Item Supplier',
      sorter: (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
      render: (_v, s) => (
        <div>
          <div>{s.name}</div>
          {s.phone && <div><PhoneFilled aria-label="Phone" /> {s.phone}</div>}
          {s.email && <div><MailFilled aria-label="Email" /> {s.email}</div>}
        </div>
      ),
    },
    {
      key: 'contact',
      title: 'Contact Person',
      sorter: (a, b) => (a.contactPersonName ?? '').localeCompare(b.contactPersonName ?? ''),
      render: (_v, s) => (
        <div>
          {s.contactPersonName && <div><UserOutlined aria-label="Contact person" /> {s.contactPersonName}</div>}
          {s.contactPersonPhone && <div><PhoneFilled aria-label="Phone" /> {s.contactPersonPhone}</div>}
          {s.contactPersonEmail && <div><MailFilled aria-label="Email" /> {s.contactPersonEmail}</div>}
        </div>
      ),
    },
    {
      key: 'address',
      title: 'Address',
      sorter: (a, b) => (a.address ?? '').localeCompare(b.address ?? ''),
      render: (_v, s) => (s.address ? <span><BankOutlined aria-label="Address" /> {s.address}</span> : ''),
    },
    {
      key: 'action',
      title: 'Action',
      align: 'right',
      width: 100,
      render: (_v, s) => (
        <Space size={token.marginXXS}>
          <Tooltip title="Edit">
            <Button type="primary" size="small" icon={<EditOutlined />} aria-label={`Edit item supplier ${s.name}`} onClick={() => setEditing(s)} />
          </Tooltip>
          <Popconfirm
            title={`Delete "${s.name}"?`}
            description="Suppliers that have stock entries can't be deleted."
            okText="Delete"
            okButtonProps={{ danger: true }}
            onConfirm={() => deleteMutation.mutateAsync(s).catch(() => undefined)}
          >
            <Tooltip title="Delete">
              <Button type="primary" size="small" icon={<CloseOutlined />} aria-label={`Delete item supplier ${s.name}`} />
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
  const field = (name: keyof FormValues, label: string, id: string, required = false) => (
    <Controller
      control={control}
      name={name}
      render={({ field: f }) => (
        <Form.Item label={label} htmlFor={id} required={required} {...err(name)}>
          {name === 'description' || name === 'address' ? <Input.TextArea {...f} id={id} rows={2} /> : <Input {...f} id={id} autoComplete="off" />}
        </Form.Item>
      )}
    />
  );

  return (
    <Row gutter={[token.marginLG, token.marginLG]} align="top">
      <Col xs={24} lg={9} xl={8}>
        <Card
          title={cardTitle(editing ? 'Edit Item Supplier' : 'Add Item Supplier')}
          actions={[
            <div key="save" style={{ display: 'flex', justifyContent: 'flex-end', gap: token.marginXS, paddingInline: token.paddingLG }}>
              {editing && <Button onClick={() => setEditing(null)}>Cancel</Button>}
              <Button type="primary" onClick={save} loading={saveMutation.isPending}>
                Save
              </Button>
            </div>,
          ]}
        >
          <Form layout="vertical" onFinish={save} data-testid="item-supplier-form">
            {field('name', 'Name', 'supplier-name', true)}
            {field('phone', 'Phone', 'supplier-phone')}
            {field('email', 'Email', 'supplier-email')}
            {field('address', 'Address', 'supplier-address')}
            {field('contactPersonName', 'Contact Person Name', 'supplier-contact-name')}
            {field('contactPersonPhone', 'Contact Person Phone', 'supplier-contact-phone')}
            {field('contactPersonEmail', 'Contact Person Email', 'supplier-contact-email')}
            {field('description', 'Description', 'supplier-description')}
            <button type="submit" hidden aria-hidden />
          </Form>
        </Card>
      </Col>

      <Col xs={24} lg={15} xl={16}>
        <Card title={cardTitle('Item Supplier List')}>
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
          {suppliersQuery.isError ? (
            <Alert
              type="warning"
              showIcon
              message="Couldn't load the item suppliers"
              description="There was a problem reaching the server."
              action={
                <Button size="small" onClick={() => void suppliersQuery.refetch()}>
                  Try again
                </Button>
              }
            />
          ) : (
            <Table<InventorySupplier>
              rowKey="id"
              size="middle"
              columns={columns}
              dataSource={rows}
              loading={suppliersQuery.isFetching}
              scroll={{ x: 'max-content' }}
              rowClassName={(s) => (s.id === editing?.id ? 'ant-table-row-selected' : '')}
              locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={search.trim() ? 'No item suppliers match your search' : 'No item suppliers yet'} /> }}
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

export default ItemSupplierPage;
