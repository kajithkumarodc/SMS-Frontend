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
import { DeleteOutlined, CloudUploadOutlined, EditOutlined, PaperClipOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  createExpense,
  deleteExpense,
  expenseAttachmentUrl,
  fetchAllExpenses,
  fetchExpenseHeads,
  fetchExpenses,
  removeExpenseAttachment,
  updateExpense,
  uploadExpenseAttachment,
  type Expense,
  type ExpenseFilter,
  type ExpenseInput,
  type ExpenseSortKey,
} from '../../api/expenses';
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
import { formatAmount } from '../fees/format';
import { EXPENSES_KEY, EXPENSE_HEADS_KEY } from './queryKeys';

const { Title, Text } = Typography;

const DEFAULT_PAGE_SIZE = 50;
const HIDDEN_COLUMNS_STORAGE_KEY = 'sms.expenses.hiddenColumns';
/** Up to 10 digits and 2 decimals, as the backend's `ExpenseRequest.amount` allows. */
const AMOUNT_PATTERN = /^\d{1,10}(\.\d{1,2})?$/;

const schema = z.object({
  expenseHeadId: z.string().min(1, 'Expense head is required'),
  name: z.string().trim().min(1, 'Name is required').max(200, 'Keep this under 200 characters'),
  invoiceNumber: z.string().trim().max(100, 'Keep this under 100 characters'),
  expenseDate: z.string().min(1, 'Date is required'),
  amount: z
    .string()
    .trim()
    .min(1, 'Amount is required')
    .refine((v) => v === '' || AMOUNT_PATTERN.test(v), 'Enter an amount with at most 2 decimal places')
    .refine((v) => !AMOUNT_PATTERN.test(v) || Number(v) > 0, 'Amount must be greater than zero'),
  description: z.string().max(2000, 'Keep this under 2000 characters'),
});

type FormValues = z.infer<typeof schema>;

function emptyForm(): FormValues {
  return { expenseHeadId: '', name: '', invoiceNumber: '', expenseDate: todayApiDate(), amount: '', description: '' };
}

function fromExpense(e: Expense): FormValues {
  return {
    expenseHeadId: e.expenseHeadId,
    name: e.name,
    invoiceNumber: e.invoiceNumber ?? '',
    expenseDate: e.expenseDate,
    amount: String(e.amount),
    description: e.description ?? '',
  };
}

function toInput(v: FormValues): ExpenseInput {
  const orNull = (s: string) => s.trim() || null;
  return {
    expenseHeadId: v.expenseHeadId,
    name: v.name.trim(),
    invoiceNumber: orNull(v.invoiceNumber),
    expenseDate: v.expenseDate,
    amount: Number(v.amount.trim()),
    description: orNull(v.description),
  };
}

const DATA_COLUMNS: { key: ExpenseSortKey; title: string; value: (e: Expense) => string; align?: 'right' }[] = [
  { key: 'name', title: 'Name', value: (e) => e.name },
  { key: 'description', title: 'Description', value: (e) => e.description ?? 'No Description' },
  { key: 'invoiceNumber', title: 'Invoice Number', value: (e) => e.invoiceNumber ?? '' },
  { key: 'expenseDate', title: 'Date', value: (e) => formatDisplayDate(e.expenseDate) },
  { key: 'expenseHeadName', title: 'Expense Head', value: (e) => e.expenseHeadName ?? '' },
  { key: 'amount', title: 'Amount', value: (e) => formatAmount(e.amount), align: 'right' },
];

type Sort = { key: ExpenseSortKey; order: 'ascend' | 'descend' } | null;

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

/** Expenses -> Add Expense (/app/expenses/add-expense): the entry form beside the expense list. */
function AddExpensePage() {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const permissions = useAuthStore((state) => state.user?.permissions);
  const canView = hasPermission(permissions, 'EXPENSE_VIEW');
  const canCreate = hasPermission(permissions, 'EXPENSE_CREATE');
  const canEdit = hasPermission(permissions, 'EXPENSE_EDIT');
  const canDelete = hasPermission(permissions, 'EXPENSE_DELETE');
  const canExport = hasPermission(permissions, 'EXPENSE_EXPORT');
  const canPrint = hasPermission(permissions, 'EXPENSE_PRINT');

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  const [sort, setSort] = useState<Sort>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [hiddenColumns, setHiddenColumns] = useState<string[]>(readHiddenColumns);
  const [exporting, setExporting] = useState<ExportKind | null>(null);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [removeExisting, setRemoveExisting] = useState(false);
  const [fileError, setFileError] = useState<string>();

  const listFilter: Omit<ExpenseFilter, 'page' | 'size'> = {
    q: debouncedSearch || undefined,
    sort: sort ? `${sort.key},${sort.order === 'ascend' ? 'asc' : 'desc'}` : undefined,
  };
  const filter: ExpenseFilter = { ...listFilter, page: page - 1, size: pageSize };

  const expensesQuery = useQuery({
    queryKey: [...EXPENSES_KEY, filter],
    queryFn: () => fetchExpenses(filter),
    enabled: canView,
    placeholderData: keepPreviousData,
  });
  const headsQuery = useQuery({ queryKey: EXPENSE_HEADS_KEY, queryFn: fetchExpenseHeads, enabled: canView });

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
    reset(editing ? fromExpense(editing) : emptyForm());
    resetDocument();
  }, [editing, reset]);

  const saveMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const saved = editing ? await updateExpense(editing.id, toInput(values)) : await createExpense(toInput(values));
      try {
        if (pendingFile) return { saved: await uploadExpenseAttachment(saved.id, pendingFile), problem: undefined };
        if (removeExisting && saved.attachment) return { saved: await removeExpenseAttachment(saved.id), problem: undefined };
      } catch (error) {
        return { saved, problem: serverMessage(error) ?? 'the document could not be saved' };
      }
      return { saved, problem: undefined };
    },
    onSuccess: ({ saved, problem }) => {
      if (problem) message.warning(`Expense "${saved.name}" saved, but ${problem}`);
      else message.success(editing ? `Expense "${saved.name}" updated` : `Expense "${saved.name}" saved`);
      void queryClient.invalidateQueries({ queryKey: EXPENSES_KEY });
      if (editing) setEditing(null);
      else {
        reset(emptyForm());
        resetDocument();
      }
    },
    onError: (error) => message.error(serverMessage(error) ?? 'Could not save the expense. Please try again.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (expense: Expense) => deleteExpense(expense.id).then(() => expense),
    onSuccess: (expense) => {
      message.success(`Expense "${expense.name}" deleted`);
      if (editing?.id === expense.id) setEditing(null);
      void queryClient.invalidateQueries({ queryKey: EXPENSES_KEY });
    },
    onError: (error) => message.error(serverMessage(error) ?? 'Could not delete the expense. Please try again.'),
  });

  const visibleDataColumns = useMemo(() => DATA_COLUMNS.filter((c) => !hiddenColumns.includes(c.key)), [hiddenColumns]);

  if (!canView) {
    return <Result status="403" title="Not available" subTitle="You don't have permission to view expenses." />;
  }

  const submit = handleSubmit((values) => saveMutation.mutate(values));
  const fieldError = (name: keyof FormValues) =>
    errors[name] ? { validateStatus: 'error' as const, help: errors[name]?.message } : {};
  const fid = (name: string) => `expense-${name}`;
  const showForm = canCreate || (editing !== null && canEdit);
  const shownFileName = pendingFile?.name ?? (!removeExisting ? editing?.attachment?.fileName : undefined);

  const pickFile = (file: File) => {
    const problem = uploadProblem(file);
    if (problem) setFileError(problem);
    else {
      setFileError(undefined);
      setPendingFile(file);
    }
    return false; // uploaded after the expense is saved
  };

  const handleExport = async (kind: ExportKind) => {
    setExporting(kind);
    try {
      const rows = await fetchAllExpenses(listFilter);
      const columns: ExportColumn<Expense>[] = visibleDataColumns.map((c) => ({ title: c.title, value: c.value }));
      const fileBase = `expenses-${dayjs().format('YYYY-MM-DD')}`;
      const title = 'Expense List';
      if (kind === 'copy') {
        await copyRows(rows, columns);
        message.success(`Copied ${rows.length} row${rows.length === 1 ? '' : 's'} to the clipboard`);
      } else if (kind === 'csv') downloadCsv(rows, columns, fileBase);
      else if (kind === 'excel') await downloadExcel(rows, columns, fileBase, title);
      else if (kind === 'pdf') await downloadPdf(rows, columns, fileBase, title);
      else printRows(rows, columns, title);
    } catch {
      message.error("Couldn't export the expenses. Please try again.");
    } finally {
      setExporting(null);
    }
  };

  const columns: ColumnsType<Expense> = [
    ...visibleDataColumns.map((c) => ({
      key: c.key,
      title: c.title,
      align: c.align,
      sorter: true,
      sortOrder: sort?.key === c.key ? sort.order : null,
      render: (_: unknown, record: Expense) =>
        c.key === 'description' && !record.description ? <Text>No Description</Text> : c.value(record),
    })),
    {
      key: 'action',
      title: 'Action',
      align: 'right',
      width: 130,
      render: (_: unknown, record: Expense) => (
        <Space size={token.marginXXS}>
          {record.attachment && (
            <Tooltip title={`Download ${record.attachment.fileName}`}>
              <Button
                type="primary"
                size="small"
                icon={<PaperClipOutlined />}
                aria-label={`Download document for ${record.name}`}
                href={expenseAttachmentUrl(record.id)}
              />
            </Tooltip>
          )}
          {canEdit && (
            <Tooltip title="Edit">
              <Button
                type="primary"
                size="small"
                icon={<EditOutlined />}
                aria-label={`Edit expense ${record.name}`}
                onClick={() => setEditing(record)}
              />
            </Tooltip>
          )}
          {canDelete && (
            <Popconfirm
              title={`Delete "${record.name}"?`}
              description="The expense and its document will be permanently deleted."
              okText="Delete"
              okButtonProps={{ danger: true }}
              onConfirm={() => deleteMutation.mutateAsync(record)}
            >
              <Tooltip title="Delete">
                <Button type="primary" size="small" icon={<DeleteOutlined />} aria-label={`Delete expense ${record.name}`} />
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
  const data = expensesQuery.data;

  return (
    <Row gutter={[token.marginLG, token.marginLG]} align="top">
      {showForm && (
        <Col xs={24} lg={9} xl={7}>
          <Card
            title={cardTitle(editing ? `Edit Expense` : 'Add Expense')}
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
            <Form layout="vertical" onFinish={submit} data-testid="expense-form">
              <Controller
                control={control}
                name="expenseHeadId"
                render={({ field }) => (
                  <Form.Item label="Expense Head" htmlFor={fid('expenseHeadId')} required {...fieldError('expenseHeadId')}>
                    <Select
                      id={fid('expenseHeadId')}
                      placeholder="Select"
                      showSearch
                      optionFilterProp="label"
                      loading={headsQuery.isLoading}
                      options={(headsQuery.data ?? []).map((h) => ({ value: h.id, label: h.name }))}
                      value={field.value || undefined}
                      onChange={(v) => field.onChange(v ?? '')}
                      onBlur={field.onBlur}
                    />
                  </Form.Item>
                )}
              />
              <Controller
                control={control}
                name="name"
                render={({ field }) => (
                  <Form.Item label="Name" htmlFor={fid('name')} required {...fieldError('name')}>
                    <Input {...field} id={fid('name')} autoComplete="off" />
                  </Form.Item>
                )}
              />
              <Controller
                control={control}
                name="invoiceNumber"
                render={({ field }) => (
                  <Form.Item label="Invoice Number" htmlFor={fid('invoiceNumber')} {...fieldError('invoiceNumber')}>
                    <Input {...field} id={fid('invoiceNumber')} autoComplete="off" />
                  </Form.Item>
                )}
              />
              <Controller
                control={control}
                name="expenseDate"
                render={({ field }) => (
                  <Form.Item label="Date" htmlFor={fid('expenseDate')} required {...fieldError('expenseDate')}>
                    <DatePicker
                      id={fid('expenseDate')}
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
              <Controller
                control={control}
                name="amount"
                render={({ field }) => (
                  <Form.Item label="Amount" htmlFor={fid('amount')} required {...fieldError('amount')}>
                    <Input {...field} id={fid('amount')} inputMode="decimal" autoComplete="off" />
                  </Form.Item>
                )}
              />
              <Form.Item
                label="Attach Document"
                validateStatus={fileError ? 'error' : undefined}
                help={fileError}
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
              <Controller
                control={control}
                name="description"
                render={({ field }) => (
                  <Form.Item label="Description" htmlFor={fid('description')} style={{ marginBottom: 0 }} {...fieldError('description')}>
                    <Input.TextArea {...field} id={fid('description')} rows={3} />
                  </Form.Item>
                )}
              />
              <button type="submit" hidden aria-hidden />
            </Form>
          </Card>
        </Col>
      )}

      <Col xs={24} lg={showForm ? 15 : 24} xl={showForm ? 17 : 24}>
        <Card title={cardTitle('Expense List')} styles={{ header: { paddingBlock: token.paddingSM } }}>
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
          {expensesQuery.isError ? (
            <Alert
              type="warning"
              showIcon
              message="Couldn't load expenses"
              description="There was a problem reaching the server."
              action={
                <Button size="small" onClick={() => void expensesQuery.refetch()}>
                  Try again
                </Button>
              }
            />
          ) : (
            <Table<Expense>
              rowKey="id"
              size="middle"
              columns={columns}
              dataSource={data?.content ?? []}
              loading={expensesQuery.isFetching}
              scroll={{ x: 'max-content' }}
              rowClassName={(record) => (record.id === editing?.id ? 'ant-table-row-selected' : '')}
              onChange={(_pagination, _filters, sorter) => {
                const s = (Array.isArray(sorter) ? sorter[0] : sorter) as SorterResult<Expense>;
                setSort(s?.order && s.columnKey ? { key: s.columnKey as ExpenseSortKey, order: s.order } : null);
                setPage(1);
              }}
              locale={{
                emptyText: (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={debouncedSearch ? 'No expenses match your search' : 'No expenses recorded yet'}
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
    </Row>
  );
}

export default AddExpensePage;
