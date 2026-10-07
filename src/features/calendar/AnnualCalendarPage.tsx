import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, Card, Col, DatePicker, Empty, Form, Input, Modal, Popconfirm, Radio, Result, Row, Select, Space, Switch, Table, Tooltip, Typography, theme } from 'antd';
import type { ColumnsType } from 'antd/es/table/interface';
import { DeleteOutlined, EditOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  createCalendarEvent,
  deleteCalendarEvent,
  fetchCalendarEvents,
  fetchHolidayTypes,
  updateCalendarEvent,
  type CalendarEvent,
} from '../../api/calendar';
import { useAuthStore } from '../../store/authStore';
import { hasPermission } from '../../lib/roles';
import { API_DATE_FORMAT, DISPLAY_DATE_FORMAT, formatDisplayDate } from '../../lib/dates';
import { serverMessage } from '../../lib/apiErrors';
import { copyRows, downloadCsv, downloadExcel, downloadPdf, printRows, type ExportColumn, type ExportKind } from '../../lib/tableExport';
import DataTableToolbar from '../../components/DataTableToolbar';
import { CALENDAR_EVENTS_KEY, HOLIDAY_TYPES_KEY } from './queryKeys';

const { Title, Text } = Typography;

const DEFAULT_PAGE_SIZE = 50;

const schema = z
  .object({
    typeId: z.string().min(1, 'Type is required'),
    fromDate: z.string().min(1, 'From Date is required'),
    toDate: z.string().min(1, 'To Date is required'),
    description: z.string().trim().min(1, 'Description is required').max(1000, 'Keep this under 1000 characters'),
    frontSite: z.boolean(),
  })
  .refine((v) => !v.fromDate || !v.toDate || v.toDate >= v.fromDate, { path: ['toDate'], message: "To Date can't be before From Date" });

type FormValues = z.infer<typeof schema>;

const EMPTY: FormValues = { typeId: '', fromDate: '', toDate: '', description: '', frontSite: false };

const dateRange = (e: CalendarEvent) => `${formatDisplayDate(e.fromDate)} To ${formatDisplayDate(e.toDate)}`;
const creator = (e: CalendarEvent) => (e.createdByName ? `${e.createdByName}${e.createdByCode ? ` (${e.createdByCode})` : ''}` : '');

const EXPORT_COLUMNS: ExportColumn<CalendarEvent>[] = [
  { title: 'Date', value: dateRange },
  { title: 'Type', value: (e) => e.typeName ?? '' },
  { title: 'Description', value: (e) => e.description },
  { title: 'Created By', value: creator },
  { title: 'Front Site', value: (e) => (e.frontSite ? 'Yes' : 'No') },
];

/** Annual Calendar -> Annual Calendar (/app/calendar/annual-calendar): holidays, vacations, activities and events. */
function AnnualCalendarPage() {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const permissions = useAuthStore((state) => state.user?.permissions);
  const canView = hasPermission(permissions, 'CALENDAR_VIEW');
  const canManage = hasPermission(permissions, 'CALENDAR_MANAGE');

  const [typeFilter, setTypeFilter] = useState<string>();
  /** The type last searched; empty shows every entry. */
  const [searchedType, setSearchedType] = useState<string>();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [exporting, setExporting] = useState<ExportKind | null>(null);
  /** `null` = closed, `'new'` = adding, otherwise the entry being edited. */
  const [modal, setModal] = useState<null | 'new' | CalendarEvent>(null);

  const typesQuery = useQuery({ queryKey: HOLIDAY_TYPES_KEY, queryFn: fetchHolidayTypes, enabled: canView });
  const eventsQuery = useQuery({
    queryKey: [...CALENDAR_EVENTS_KEY, searchedType ?? 'all'],
    queryFn: () => fetchCalendarEvents(searchedType),
    enabled: canView,
  });

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: EMPTY, mode: 'onTouched' });

  const editing = modal !== null && modal !== 'new' ? modal : null;
  useEffect(() => {
    if (modal === null) return;
    reset(
      editing
        ? { typeId: editing.typeId, fromDate: editing.fromDate, toDate: editing.toDate, description: editing.description, frontSite: editing.frontSite }
        : EMPTY,
    );
  }, [modal, editing, reset]);

  const saveMutation = useMutation({
    mutationFn: (values: FormValues) => {
      const input = { ...values, description: values.description.trim() };
      return editing ? updateCalendarEvent(editing.id, input) : createCalendarEvent(input);
    },
    onSuccess: () => {
      message.success(editing ? 'Calendar entry updated' : 'Calendar entry saved');
      void queryClient.invalidateQueries({ queryKey: CALENDAR_EVENTS_KEY });
      setModal(null);
    },
    onError: (error) => message.error(serverMessage(error) ?? 'Could not save the calendar entry. Please try again.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (entry: CalendarEvent) => deleteCalendarEvent(entry.id),
    onSuccess: () => {
      message.success('Calendar entry deleted');
      void queryClient.invalidateQueries({ queryKey: CALENDAR_EVENTS_KEY });
    },
    onError: (error) => message.error(serverMessage(error) ?? 'Could not delete the calendar entry. Please try again.'),
  });

  // Search runs in the browser over the loaded entries.
  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const all = eventsQuery.data ?? [];
    return term ? all.filter((e) => EXPORT_COLUMNS.some((c) => String(c.value(e) ?? '').toLowerCase().includes(term))) : all;
  }, [eventsQuery.data, search]);

  if (!canView) {
    return <Result status="403" title="Not available" subTitle="You don't have permission to view the annual calendar." />;
  }

  const handleExport = async (kind: ExportKind) => {
    setExporting(kind);
    try {
      const fileBase = `annual-calendar-${dayjs().format('YYYY-MM-DD')}`;
      const title = 'Calendar List';
      if (kind === 'copy') {
        await copyRows(rows, EXPORT_COLUMNS);
        message.success(`Copied ${rows.length} row${rows.length === 1 ? '' : 's'} to the clipboard`);
      } else if (kind === 'csv') downloadCsv(rows, EXPORT_COLUMNS, fileBase);
      else if (kind === 'excel') await downloadExcel(rows, EXPORT_COLUMNS, fileBase, title);
      else if (kind === 'pdf') await downloadPdf(rows, EXPORT_COLUMNS, fileBase, title);
      else printRows(rows, EXPORT_COLUMNS, title);
    } catch {
      message.error("Couldn't export the calendar. Please try again.");
    } finally {
      setExporting(null);
    }
  };

  const columns: ColumnsType<CalendarEvent> = [
    { key: 'date', title: 'Date', sorter: (a, b) => a.fromDate.localeCompare(b.fromDate), render: (_v, e) => dateRange(e) },
    { key: 'type', title: 'Type', sorter: (a, b) => (a.typeName ?? '').localeCompare(b.typeName ?? ''), render: (_v, e) => e.typeName },
    { key: 'description', title: 'Description', sorter: (a, b) => a.description.localeCompare(b.description), render: (_v, e) => e.description },
    { key: 'createdBy', title: 'Created By', sorter: (a, b) => creator(a).localeCompare(creator(b)), render: (_v, e) => creator(e) },
    { key: 'frontSite', title: 'Front Site', sorter: (a, b) => Number(a.frontSite) - Number(b.frontSite), render: (_v, e) => (e.frontSite ? 'Yes' : 'No') },
    ...(canManage
      ? [
          {
            key: 'action',
            title: 'Action',
            align: 'right' as const,
            width: 100,
            render: (_v: unknown, e: CalendarEvent) => (
              <Space size={token.marginXXS}>
                <Tooltip title="Edit">
                  <Button type="primary" size="small" icon={<EditOutlined />} aria-label={`Edit ${e.description}`} onClick={() => setModal(e)} />
                </Tooltip>
                <Popconfirm
                  title="Delete this calendar entry?"
                  okText="Delete"
                  okButtonProps={{ danger: true }}
                  onConfirm={() => deleteMutation.mutateAsync(e).catch(() => undefined)}
                >
                  <Tooltip title="Delete">
                    <Button type="primary" size="small" icon={<DeleteOutlined />} aria-label={`Delete ${e.description}`} />
                  </Tooltip>
                </Popconfirm>
              </Space>
            ),
          },
        ]
      : []),
  ];

  const err = (name: keyof FormValues) => ({ validateStatus: errors[name] ? ('error' as const) : undefined, help: errors[name]?.message });
  const save = handleSubmit((values) => saveMutation.mutate(values));

  return (
    <div>
      <Card
        title={
          <Title level={4} style={{ margin: 0, fontWeight: 500 }}>
            Annual Calendar
          </Title>
        }
        extra={
          canManage && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setModal('new')}>
              Add
            </Button>
          )
        }
      >
        <Form layout="vertical" onFinish={() => setSearchedType(typeFilter)}>
          <Row gutter={token.marginMD} align="bottom">
            <Col xs={24} md={12}>
              <Form.Item label="Type" htmlFor="calendar-type" style={{ marginBottom: 0 }}>
                <Select
                  id="calendar-type"
                  placeholder="Select"
                  allowClear
                  loading={typesQuery.isLoading}
                  options={(typesQuery.data ?? []).map((t) => ({ value: t.id, label: t.name }))}
                  value={typeFilter}
                  onChange={(value?: string) => {
                    setTypeFilter(value);
                    if (value === undefined) setSearchedType(undefined);
                  }}
                />
              </Form.Item>
            </Col>
            <Col>
              <Button type="primary" htmlType="submit" icon={<SearchOutlined />} aria-label="Search calendar">
                Search
              </Button>
            </Col>
          </Row>
        </Form>
      </Card>

      <Card
        title={
          <Title level={4} style={{ margin: 0, fontWeight: 500 }}>
            Calendar List
          </Title>
        }
        style={{ marginTop: token.marginLG }}
      >
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
        {eventsQuery.isError ? (
          <Alert
            type="warning"
            showIcon
            message="Couldn't load the calendar"
            description="There was a problem reaching the server."
            action={
              <Button size="small" onClick={() => void eventsQuery.refetch()}>
                Try again
              </Button>
            }
          />
        ) : (
          <Table<CalendarEvent>
            rowKey="id"
            size="middle"
            columns={columns}
            dataSource={rows}
            loading={eventsQuery.isFetching}
            scroll={{ x: 'max-content' }}
            locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={search.trim() ? 'No entries match your search' : 'No calendar entries yet'} /> }}
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

      <Modal
        open={modal !== null}
        title={editing ? 'Edit Holiday' : 'Add Holiday'}
        onCancel={() => setModal(null)}
        footer={
          <Button type="primary" onClick={save} loading={saveMutation.isPending}>
            Save
          </Button>
        }
        width={640}
        destroyOnHidden
      >
        <Form layout="vertical" onFinish={save} data-testid="calendar-form">
          <Controller
            control={control}
            name="typeId"
            render={({ field }) => (
              <Form.Item label="Type" required {...err('typeId')}>
                <Radio.Group
                  aria-label="Type"
                  value={field.value || undefined}
                  onChange={(e) => field.onChange(e.target.value)}
                  optionType="button"
                  style={{ display: 'flex', flexWrap: 'wrap', gap: token.marginXS }}
                  options={(typesQuery.data ?? []).map((t) => ({ value: t.id, label: t.name }))}
                />
              </Form.Item>
            )}
          />
          <Row gutter={token.marginMD}>
            <Col xs={24} sm={12}>
              <Controller
                control={control}
                name="fromDate"
                render={({ field }) => (
                  <Form.Item label="From Date" htmlFor="calendar-from" required {...err('fromDate')}>
                    <DatePicker
                      id="calendar-from"
                      style={{ width: '100%' }}
                      format={DISPLAY_DATE_FORMAT}
                      value={field.value ? dayjs(field.value) : null}
                      onChange={(d) => field.onChange(d ? d.format(API_DATE_FORMAT) : '')}
                      onBlur={field.onBlur}
                    />
                  </Form.Item>
                )}
              />
            </Col>
            <Col xs={24} sm={12}>
              <Controller
                control={control}
                name="toDate"
                render={({ field }) => (
                  <Form.Item label="To Date" htmlFor="calendar-to" required {...err('toDate')}>
                    <DatePicker
                      id="calendar-to"
                      style={{ width: '100%' }}
                      format={DISPLAY_DATE_FORMAT}
                      value={field.value ? dayjs(field.value) : null}
                      onChange={(d) => field.onChange(d ? d.format(API_DATE_FORMAT) : '')}
                      onBlur={field.onBlur}
                    />
                  </Form.Item>
                )}
              />
            </Col>
          </Row>
          <Controller
            control={control}
            name="description"
            render={({ field }) => (
              <Form.Item label="Description" htmlFor="calendar-description" required {...err('description')}>
                <Input.TextArea {...field} id="calendar-description" rows={4} maxLength={1000} />
              </Form.Item>
            )}
          />
          <Controller
            control={control}
            name="frontSite"
            render={({ field }) => (
              <Form.Item label="Front Site" style={{ marginBottom: 0 }}>
                <Switch aria-label="Front Site" checked={field.value} onChange={field.onChange} />
              </Form.Item>
            )}
          />
          <button type="submit" hidden aria-hidden />
        </Form>
      </Modal>
    </div>
  );
}

export default AnnualCalendarPage;
