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
  createExpenseHead,
  deleteExpenseHead,
  fetchExpenseHeads,
  updateExpenseHead,
  type ExpenseHead,
  type ExpenseHeadInput,
} from '../../api/expenses';
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
import { EXPENSE_HEADS_KEY } from './queryKeys';

const { Title, Text } = Typography;

const DEFAULT_PAGE_SIZE = 50;
const HIDDEN_COLUMNS_STORAGE_KEY = 'sms.expenseHeads.hiddenColumns';

const schema = z.object({
  name: z.string().trim().min(1, 'Expense head is required').max(100, 'Keep this under 100 characters'),
  description: z.string().max(500, 'Keep this under 500 characters'),
});

type FormValues = z.infer<typeof schema>;

const emptyForm = (): FormValues => ({ name: '', description: '' });

type HeadColumnKey = 'name' | 'description';

const DATA_COLUMNS: { key: HeadColumnKey; title: string; value: (h: ExpenseHead) => string }[] = [
  { key: 'name', title: 'Expense Head', value: (h) => h.name },
  { key: 'description', title: 'Description', value: (h) => h.description ?? '' },
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

/** Expenses -> Expense Head (/app/expenses/expense-head): the heads that expenses are filed under. */
function ExpenseHeadPage() {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const permissions = useAuthStore((state) => state.user?.permissions);
  const canView = hasPermission(permissions, 'EXPENSE_VIEW');
  const canEdit = hasPermission(permissions, 'EXPENSE_EDIT');
  const canDelete = hasPermission(permissions, 'EXPENSE_DELETE');
  const canExport = hasPermission(permissions, 'EXPENSE_EXPORT');
  const canPrint = hasPermission(permissions, 'EXPENSE_PRINT');

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [hiddenColumns, setHiddenColumns] = useState<string[]>(readHiddenColumns);
  const [exporting, setExporting] = useState<ExportKind | null>(null);
  const [editing, setEditing] = useState<ExpenseHead | null>(null);

  const headsQuery = useQuery({ queryKey: EXPENSE_HEADS_KEY, queryFn: fetchExpenseHeads, enabled: canView });

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: emptyForm(), mode: 'onTouched' });

  useEffect(() => {
    reset(editing ? { name: editing.name, description: editing.description ?? '' } : emptyForm());
  }, [editing, reset]);

  const saveMutation = useMutation({
    mutationFn: (values: FormValues) => {
      const input: ExpenseHeadInput = { name: values.name.trim(), description: values.description.trim() || null };
      return editing ? updateExpenseHead(editing.id, input) : createExpenseHead(input);
    },
    onSuccess: (saved) => {
      message.success(editing ? `Expense head "${saved.name}" updated` : `Expense head "${saved.name}" saved`);
      void queryClient.invalidateQueries({ queryKey: EXPENSE_HEADS_KEY });
      // Expense rows show the head's name, so refresh them after a rename.
      if (editing) void queryClient.invalidateQueries({ queryKey: ['expenses'] });
      setEditing(null);
      reset(emptyForm());
    },
    onError: (error) => message.error(serverMessage(error) ?? 'Could not save the expense head. Please try again.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (head: ExpenseHead) => deleteExpenseHead(head.id).then(() => head),
    onSuccess: (head) => {
      message.success(`Expense head "${head.name}" deleted`);
      if (editing?.id === head.id) setEditing(null);
      void queryClient.invalidateQueries({ queryKey: EXPENSE_HEADS_KEY });
    },
    onError: (error) => message.error(serverMessage(error) ?? 'Could not delete the expense head. Please try again.'),
  });

  const visibleDataColumns = useMemo(() => DATA_COLUMNS.filter((c) => !hiddenColumns.includes(c.key)), [hiddenColumns]);

  // The list is small, so search runs in the browser over every head.
  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const all = headsQuery.data ?? [];
    return term ? all.filter((h) => `${h.name} ${h.description ?? ''}`.toLowerCase().includes(term)) : all;
  }, [headsQuery.data, search]);

  if (!canView) {
    return <Result status="403" title="Not available" subTitle="You don't have permission to view expense heads." />;
  }

  const showForm = canEdit;
  const submit = handleSubmit((values) => saveMutation.mutate(values));
  const fieldError = (name: keyof FormValues) =>
    errors[name] ? { validateStatus: 'error' as const, help: errors[name]?.message } : {};

  const handleExport = async (kind: ExportKind) => {
    setExporting(kind);
    try {
      const columns: ExportColumn<ExpenseHead>[] = visibleDataColumns.map((c) => ({ title: c.title, value: c.value }));
      const fileBase = `expense-heads-${dayjs().format('YYYY-MM-DD')}`;
      const title = 'Expense Head List';
      if (kind === 'copy') {
        await copyRows(rows, columns);
        message.success(`Copied ${rows.length} row${rows.length === 1 ? '' : 's'} to the clipboard`);
      } else if (kind === 'csv') downloadCsv(rows, columns, fileBase);
      else if (kind === 'excel') await downloadExcel(rows, columns, fileBase, title);
      else if (kind === 'pdf') await downloadPdf(rows, columns, fileBase, title);
      else printRows(rows, columns, title);
    } catch {
      message.error("Couldn't export the expense heads. Please try again.");
    } finally {
      setExporting(null);
    }
  };

  const columns: ColumnsType<ExpenseHead> = [
    ...visibleDataColumns.map((c) => ({
      key: c.key,
      title: c.title,
      sorter: (a: ExpenseHead, b: ExpenseHead) => c.value(a).localeCompare(c.value(b), undefined, { sensitivity: 'base' }),
      render: (_: unknown, record: ExpenseHead) => c.value(record),
    })),
    ...(canEdit || canDelete
      ? [
          {
            key: 'action',
            title: 'Action',
            align: 'right' as const,
            width: 100,
            render: (_: unknown, record: ExpenseHead) => (
              <Space size={token.marginXXS}>
                {canEdit && (
                  <Tooltip title="Edit">
                    <Button
                      type="primary"
                      size="small"
                      icon={<EditOutlined />}
                      aria-label={`Edit expense head ${record.name}`}
                      onClick={() => setEditing(record)}
                    />
                  </Tooltip>
                )}
                {canDelete && (
                  <Popconfirm
                    title={`Delete "${record.name}"?`}
                    description="Heads that have expenses filed under them can't be deleted."
                    okText="Delete"
                    okButtonProps={{ danger: true }}
                    onConfirm={() => deleteMutation.mutateAsync(record).catch(() => undefined)}
                  >
                    <Tooltip title="Delete">
                      <Button
                        type="primary"
                        size="small"
                        icon={<CloseOutlined />}
                        aria-label={`Delete expense head ${record.name}`}
                      />
                    </Tooltip>
                  </Popconfirm>
                )}
              </Space>
            ),
          },
        ]
      : []),
  ];

  const cardTitle = (text: string) => (
    <Title level={4} style={{ margin: 0, fontWeight: 500, whiteSpace: 'normal' }}>
      {text}
    </Title>
  );

  return (
    <Row gutter={[token.marginLG, token.marginLG]} align="top">
      {showForm && (
        <Col xs={24} lg={9} xl={7}>
          <Card
            title={cardTitle(editing ? 'Edit Expense Head' : 'Add Expense Head')}
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
            <Form layout="vertical" onFinish={submit} data-testid="expense-head-form">
              <Controller
                control={control}
                name="name"
                render={({ field }) => (
                  <Form.Item label="Expense Head" htmlFor="expense-head-name" required {...fieldError('name')}>
                    <Input {...field} id="expense-head-name" autoComplete="off" />
                  </Form.Item>
                )}
              />
              <Controller
                control={control}
                name="description"
                render={({ field }) => (
                  <Form.Item label="Description" htmlFor="expense-head-description" style={{ marginBottom: 0 }} {...fieldError('description')}>
                    <Input.TextArea {...field} id="expense-head-description" rows={3} />
                  </Form.Item>
                )}
              />
              <button type="submit" hidden aria-hidden />
            </Form>
          </Card>
        </Col>
      )}

      <Col xs={24} lg={showForm ? 15 : 24} xl={showForm ? 17 : 24}>
        <Card title={cardTitle('Expense Head List')} styles={{ header: { paddingBlock: token.paddingSM } }}>
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
          {headsQuery.isError ? (
            <Alert
              type="warning"
              showIcon
              message="Couldn't load expense heads"
              description="There was a problem reaching the server."
              action={
                <Button size="small" onClick={() => void headsQuery.refetch()}>
                  Try again
                </Button>
              }
            />
          ) : (
            <Table<ExpenseHead>
              rowKey="id"
              size="middle"
              columns={columns}
              dataSource={rows}
              loading={headsQuery.isFetching}
              scroll={{ x: 'max-content' }}
              rowClassName={(record) => (record.id === editing?.id ? 'ant-table-row-selected' : '')}
              locale={{
                emptyText: (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={search.trim() ? 'No expense heads match your search' : 'No expense heads yet'}
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

export default ExpenseHeadPage;
