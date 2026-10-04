import { useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Alert, App, Button, Card, Col, DatePicker, Empty, Form, Input, Result, Row, Select, Space, Table, Typography, theme } from 'antd';
import type { ColumnsType, SorterResult } from 'antd/es/table/interface';
import { SearchOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import {
  fetchAllExpenses,
  fetchExpenseTotal,
  fetchExpenses,
  type Expense,
  type ExpenseFilter,
  type ExpenseSortKey,
} from '../../api/expenses';
import { useAuthStore } from '../../store/authStore';
import { hasPermission } from '../../lib/roles';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { API_DATE_FORMAT, DISPLAY_DATE_FORMAT, formatDisplayDate } from '../../lib/dates';
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
import { EXPENSES_KEY, EXPENSE_TOTAL_KEY } from './queryKeys';

const { Title, Text } = Typography;

const DEFAULT_PAGE_SIZE = 50;
const HIDDEN_COLUMNS_STORAGE_KEY = 'sms.expenses.search.hiddenColumns';
const PERIOD = 'period';

/** The "Search Type" choices, in the order they are listed. Everything but Period resolves to a fixed date range. */
const SEARCH_TYPES: { value: string; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'this-week', label: 'This Week' },
  { value: 'last-week', label: 'Last Week' },
  { value: 'this-month', label: 'This Month' },
  { value: 'last-month', label: 'Last Month' },
  { value: 'last-3-months', label: 'Last 3 Months' },
  { value: 'last-6-months', label: 'Last 6 Months' },
  { value: 'last-12-months', label: 'Last 12 Months' },
  { value: 'this-year', label: 'This Year' },
  { value: 'last-year', label: 'Last Year' },
  { value: PERIOD, label: 'Period' },
];

/** Monday of the week containing `day`. */
function startOfWeek(day: Dayjs): Dayjs {
  return day.subtract((day.day() + 6) % 7, 'day').startOf('day');
}

/** Inclusive date range for a preset search type, relative to `today`. */
function presetRange(type: string, today: Dayjs): [Dayjs, Dayjs] | null {
  const day = today.startOf('day');
  switch (type) {
    case 'today':
      return [day, day];
    case 'this-week':
      return [startOfWeek(day), startOfWeek(day).add(6, 'day')];
    case 'last-week':
      return [startOfWeek(day).subtract(7, 'day'), startOfWeek(day).subtract(1, 'day')];
    case 'this-month':
      return [day.startOf('month'), day.endOf('month').startOf('day')];
    case 'last-month': {
      const last = day.subtract(1, 'month');
      return [last.startOf('month'), last.endOf('month').startOf('day')];
    }
    case 'last-3-months':
      return [day.subtract(3, 'month').add(1, 'day'), day];
    case 'last-6-months':
      return [day.subtract(6, 'month').add(1, 'day'), day];
    case 'last-12-months':
      return [day.subtract(12, 'month').add(1, 'day'), day];
    case 'this-year':
      return [day.startOf('year'), day.endOf('year').startOf('day')];
    case 'last-year': {
      const last = day.subtract(1, 'year');
      return [last.startOf('year'), last.endOf('year').startOf('day')];
    }
    default:
      return null;
  }
}

/** What the user last searched for; the list is empty until one of the two Search buttons is used. */
type Criteria = { kind: 'period'; from: string; to: string } | { kind: 'text'; q: string };

const DATA_COLUMNS: { key: ExpenseSortKey; title: string; value: (e: Expense) => string; align?: 'right' }[] = [
  { key: 'name', title: 'Name', value: (e) => e.name },
  { key: 'invoiceNumber', title: 'Invoice Number', value: (e) => e.invoiceNumber ?? '' },
  { key: 'expenseHeadName', title: 'Expense Head', value: (e) => e.expenseHeadName ?? '' },
  { key: 'expenseDate', title: 'Date', value: (e) => formatDisplayDate(e.expenseDate) },
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

/** Expenses -> Search Expense (/app/expenses/search-expense): find expenses by period or by text. */
function SearchExpensePage() {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const permissions = useAuthStore((state) => state.user?.permissions);
  const canView = hasPermission(permissions, 'EXPENSE_VIEW');
  const canExport = hasPermission(permissions, 'EXPENSE_EXPORT');
  const canPrint = hasPermission(permissions, 'EXPENSE_PRINT');

  const [searchType, setSearchType] = useState<string>();
  const [customRange, setCustomRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [searchText, setSearchText] = useState('');
  const [typeError, setTypeError] = useState<string>();
  const [textError, setTextError] = useState<string>();
  const [criteria, setCriteria] = useState<Criteria | null>(null);

  const [tableSearch, setTableSearch] = useState('');
  const debouncedTableSearch = useDebouncedValue(tableSearch.trim(), 300);
  const [sort, setSort] = useState<Sort>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [hiddenColumns, setHiddenColumns] = useState<string[]>(readHiddenColumns);
  const [exporting, setExporting] = useState<ExportKind | null>(null);

  const criteriaFilter: Omit<ExpenseFilter, 'sort' | 'page' | 'size'> = {
    ...(criteria?.kind === 'period' ? { from: criteria.from, to: criteria.to } : {}),
    ...(criteria?.kind === 'text' ? { q: criteria.q } : {}),
    filter: debouncedTableSearch || undefined,
  };
  const listFilter: Omit<ExpenseFilter, 'page' | 'size'> = {
    ...criteriaFilter,
    sort: sort ? `${sort.key},${sort.order === 'ascend' ? 'asc' : 'desc'}` : undefined,
  };
  const filter: ExpenseFilter = { ...listFilter, page: page - 1, size: pageSize };

  const expensesQuery = useQuery({
    queryKey: [...EXPENSES_KEY, 'search', filter],
    queryFn: () => fetchExpenses(filter),
    enabled: canView && criteria !== null,
    placeholderData: keepPreviousData,
  });
  const totalQuery = useQuery({
    queryKey: [...EXPENSE_TOTAL_KEY, criteriaFilter],
    queryFn: () => fetchExpenseTotal(criteriaFilter),
    enabled: canView && criteria !== null,
    placeholderData: keepPreviousData,
  });

  const visibleDataColumns = useMemo(() => DATA_COLUMNS.filter((c) => !hiddenColumns.includes(c.key)), [hiddenColumns]);

  if (!canView) {
    return <Result status="403" title="Not available" subTitle="You don't have permission to view expenses." />;
  }

  const startSearch = (next: Criteria) => {
    setCriteria(next);
    setTableSearch('');
    setSort(null);
    setPage(1);
  };

  const searchByType = () => {
    if (!searchType) {
      setTypeError('Search type is required');
      return;
    }
    let range: [Dayjs, Dayjs] | null;
    if (searchType === PERIOD) {
      const [from, to] = customRange ?? [null, null];
      if (!from || !to) {
        setTypeError('Choose the start and end dates');
        return;
      }
      range = [from, to];
    } else {
      range = presetRange(searchType, dayjs());
    }
    if (!range) return;
    setTypeError(undefined);
    startSearch({ kind: 'period', from: range[0].format(API_DATE_FORMAT), to: range[1].format(API_DATE_FORMAT) });
  };

  const searchByText = () => {
    const q = searchText.trim();
    if (!q) {
      setTextError('Search is required');
      return;
    }
    setTextError(undefined);
    startSearch({ kind: 'text', q });
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

  const columns: ColumnsType<Expense> = visibleDataColumns.map((c) => ({
    key: c.key,
    title: c.title,
    align: c.align,
    sorter: true,
    sortOrder: sort?.key === c.key ? sort.order : null,
    render: (_: unknown, record: Expense) => c.value(record),
  }));

  const cardTitle = (text: string) => (
    <Title level={4} style={{ margin: 0, fontWeight: 500, whiteSpace: 'normal' }}>
      {text}
    </Title>
  );
  const searchButton = (onClick: () => void, label: string) => (
    <Button type="primary" icon={<SearchOutlined />} onClick={onClick} aria-label={label}>
      Search
    </Button>
  );

  const data = expensesQuery.data;
  const total = totalQuery.data ?? 0;

  return (
    <Space direction="vertical" size={token.marginLG} style={{ display: 'flex' }}>
      <Card title={cardTitle('Select Criteria')} styles={{ header: { paddingBlock: token.paddingSM } }}>
        <Row gutter={[token.marginLG, token.marginLG]}>
          <Col xs={24} md={12}>
            <Form layout="vertical" onFinish={searchByType}>
              <Form.Item
                label="Search Type"
                htmlFor="expense-search-type"
                required
                validateStatus={typeError ? 'error' : undefined}
                help={typeError}
              >
                <Select
                  id="expense-search-type"
                  placeholder="Select"
                  options={SEARCH_TYPES}
                  value={searchType}
                  onChange={(value: string) => {
                    setSearchType(value);
                    setTypeError(undefined);
                  }}
                />
              </Form.Item>
              {searchType === PERIOD && (
                <Form.Item label="Period" required>
                  <DatePicker.RangePicker
                    style={{ width: '100%' }}
                    format={DISPLAY_DATE_FORMAT}
                    value={customRange}
                    onChange={(range) => {
                      setCustomRange(range);
                      setTypeError(undefined);
                    }}
                  />
                </Form.Item>
              )}
              <div style={{ textAlign: 'right' }}>{searchButton(searchByType, 'Search by period')}</div>
            </Form>
          </Col>
          <Col xs={24} md={12}>
            <Form layout="vertical" onFinish={searchByText}>
              <Form.Item
                label="Search"
                htmlFor="expense-search-text"
                required
                validateStatus={textError ? 'error' : undefined}
                help={textError}
              >
                <Input
                  id="expense-search-text"
                  placeholder="Search by Expense"
                  autoComplete="off"
                  value={searchText}
                  onChange={(e) => {
                    setSearchText(e.target.value);
                    setTextError(undefined);
                  }}
                />
              </Form.Item>
              <div style={{ textAlign: 'right' }}>{searchButton(searchByText, 'Search by text')}</div>
            </Form>
          </Col>
        </Row>
      </Card>

      <Card title={cardTitle('Expense List')} styles={{ header: { paddingBlock: token.paddingSM } }}>
        {criteria?.kind === 'period' && (
          <Text type="secondary" style={{ display: 'block', marginBottom: token.marginSM }}>
            Showing {formatDisplayDate(criteria.from)} to {formatDisplayDate(criteria.to)}
          </Text>
        )}
        {criteria?.kind === 'text' && (
          <Text type="secondary" style={{ display: 'block', marginBottom: token.marginSM }}>
            Showing expenses matching &ldquo;{criteria.q}&rdquo;
          </Text>
        )}
        <DataTableToolbar
          search={tableSearch}
          onSearchChange={(value) => {
            setTableSearch(value);
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
          canExport={canExport && criteria !== null}
          canPrint={canPrint && criteria !== null}
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
            dataSource={criteria ? data?.content ?? [] : []}
            loading={criteria !== null && expensesQuery.isFetching}
            scroll={{ x: 'max-content' }}
            onChange={(_pagination, _filters, sorter) => {
              const s = (Array.isArray(sorter) ? sorter[0] : sorter) as SorterResult<Expense>;
              setSort(s?.order && s.columnKey ? { key: s.columnKey as ExpenseSortKey, order: s.order } : null);
              setPage(1);
            }}
            locale={{
              emptyText: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={
                    criteria === null
                      ? 'Choose a search type or enter a search, then press Search.'
                      : 'No expenses match your search. Try different criteria.'
                  }
                />
              ),
            }}
            summary={() =>
              criteria !== null && (data?.content.length ?? 0) > 0 ? (
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0} colSpan={Math.max(columns.length, 1)} align="right">
                    <Text strong>Grand Total : {formatAmount(total)}</Text>
                  </Table.Summary.Cell>
                </Table.Summary.Row>
              ) : null
            }
            pagination={{
              current: page,
              pageSize,
              total: criteria ? data?.page.totalElements ?? 0 : 0,
              showSizeChanger: false,
              showTotal: (count, [start, end]) =>
                count === 0 ? '' : <Text type="secondary">Showing {start} to {end} of {count} entries</Text>,
              onChange: (nextPage) => setPage(nextPage),
            }}
          />
        )}
      </Card>
    </Space>
  );
}

export default SearchExpensePage;
