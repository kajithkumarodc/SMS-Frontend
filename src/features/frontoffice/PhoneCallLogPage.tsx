import { useEffect, useState } from 'react';
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
  Radio,
  Result,
  Row,
  Space,
  Table,
  Tooltip,
  Typography,
  theme,
} from 'antd';
import type { ColumnsType, SorterResult } from 'antd/es/table/interface';
import { DeleteOutlined, EditOutlined, MenuOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  CALL_TYPE_LABEL,
  createPhoneCall,
  deletePhoneCall,
  fetchAllPhoneCalls,
  fetchPhoneCalls,
  updatePhoneCall,
  type CallType,
  type PhoneCall,
  type PhoneCallFilter,
  type PhoneCallInput,
  type PhoneCallSortKey,
} from '../../api/phoneCalls';
import { useAuthStore } from '../../store/authStore';
import { hasPermission } from '../../lib/roles';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { API_DATE_FORMAT, DISPLAY_DATE_FORMAT, formatDisplayDate, todayApiDate } from '../../lib/dates';
import { serverMessage } from '../../lib/apiErrors';
import { downloadCsv, downloadExcel, downloadPdf, printRows, type ExportColumn, type ExportKind } from '../../lib/tableExport';
import DataTableToolbar from '../../components/DataTableToolbar';
import { PHONE_CALLS_KEY } from './queryKeys';
import PhoneCallDetailModal from './PhoneCallDetailModal';

const { Title, Text } = Typography;

const DEFAULT_PAGE_SIZE = 50;
/** Same rule as the backend's `EnquiryDtos.PHONE_PATTERN`. */
const PHONE_PATTERN = /^\+?[0-9][0-9 ()-]{4,28}[0-9]$/;

const schema = z
  .object({
    name: z.string().trim().max(200, 'Keep this under 200 characters'),
    phone: z.string().trim().min(1, 'Phone is required').regex(PHONE_PATTERN, 'Enter a valid phone number'),
    callDate: z.string().min(1, 'Date is required'),
    description: z.string().max(2000, 'Keep this under 2000 characters'),
    nextFollowUpDate: z.string(),
    callDuration: z.string().trim().max(50, 'Keep this under 50 characters'),
    note: z.string().max(2000, 'Keep this under 2000 characters'),
    callType: z.string().min(1, 'Call type is required'),
  })
  .refine((v) => !v.nextFollowUpDate || !v.callDate || v.nextFollowUpDate >= v.callDate, {
    path: ['nextFollowUpDate'],
    message: "Can't be before the call date",
  });

type FormValues = z.infer<typeof schema>;

function emptyForm(): FormValues {
  return {
    name: '',
    phone: '',
    callDate: todayApiDate(),
    description: '',
    nextFollowUpDate: '',
    callDuration: '',
    note: '',
    callType: '',
  };
}

function fromCall(c: PhoneCall): FormValues {
  return {
    name: c.name ?? '',
    phone: c.phone,
    callDate: c.callDate,
    description: c.description ?? '',
    nextFollowUpDate: c.nextFollowUpDate ?? '',
    callDuration: c.callDuration ?? '',
    note: c.note ?? '',
    callType: c.callType,
  };
}

function toInput(v: FormValues): PhoneCallInput {
  const orNull = (s: string) => s.trim() || null;
  return {
    name: orNull(v.name),
    phone: v.phone.trim(),
    callDate: v.callDate,
    description: orNull(v.description),
    nextFollowUpDate: v.nextFollowUpDate || null,
    callDuration: orNull(v.callDuration),
    note: orNull(v.note),
    callType: v.callType as CallType,
  };
}

const DATA_COLUMNS: { key: PhoneCallSortKey; title: string; value: (c: PhoneCall) => string; align?: 'right' }[] = [
  { key: 'name', title: 'Name', value: (c) => c.name ?? '' },
  { key: 'phone', title: 'Phone', value: (c) => c.phone, align: 'right' },
  { key: 'callDate', title: 'Date', value: (c) => formatDisplayDate(c.callDate) },
  { key: 'nextFollowUpDate', title: 'Next Follow Up Date', value: (c) => formatDisplayDate(c.nextFollowUpDate) },
  { key: 'callType', title: 'Call Type', value: (c) => CALL_TYPE_LABEL[c.callType] },
];

type Sort = { key: PhoneCallSortKey; order: 'ascend' | 'descend' } | null;

function PhoneCallLogPage() {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const permissions = useAuthStore((state) => state.user?.permissions);
  const canView = hasPermission(permissions, 'PHONE_CALL_VIEW');
  const canCreate = hasPermission(permissions, 'PHONE_CALL_CREATE');
  const canEdit = hasPermission(permissions, 'PHONE_CALL_EDIT');
  const canDelete = hasPermission(permissions, 'PHONE_CALL_DELETE');
  const canExport = hasPermission(permissions, 'PHONE_CALL_EXPORT');
  const canPrint = hasPermission(permissions, 'PHONE_CALL_PRINT');

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  const [sort, setSort] = useState<Sort>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [exporting, setExporting] = useState<ExportKind | null>(null);
  const [editing, setEditing] = useState<PhoneCall | null>(null);
  const [viewing, setViewing] = useState<PhoneCall | null>(null);

  const listFilter: Omit<PhoneCallFilter, 'page' | 'size'> = {
    q: debouncedSearch || undefined,
    sort: sort ? `${sort.key},${sort.order === 'ascend' ? 'asc' : 'desc'}` : undefined,
  };
  const filter: PhoneCallFilter = { ...listFilter, page: page - 1, size: pageSize };

  const callsQuery = useQuery({
    queryKey: [...PHONE_CALLS_KEY, filter],
    queryFn: () => fetchPhoneCalls(filter),
    enabled: canView,
    placeholderData: keepPreviousData,
  });

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: emptyForm(), mode: 'onTouched' });

  useEffect(() => {
    reset(editing ? fromCall(editing) : emptyForm());
  }, [editing, reset]);

  const saveMutation = useMutation({
    mutationFn: (values: FormValues) =>
      editing ? updatePhoneCall(editing.id, toInput(values)) : createPhoneCall(toInput(values)),
    onSuccess: () => {
      message.success(editing ? 'Phone call updated' : 'Phone call saved');
      void queryClient.invalidateQueries({ queryKey: PHONE_CALLS_KEY });
      setEditing(null);
      reset(emptyForm());
    },
    onError: (error) => message.error(serverMessage(error) ?? 'Could not save the phone call. Please try again.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (call: PhoneCall) => deletePhoneCall(call.id).then(() => call),
    onSuccess: (call) => {
      message.success('Phone call deleted');
      if (editing?.id === call.id) setEditing(null);
      void queryClient.invalidateQueries({ queryKey: PHONE_CALLS_KEY });
    },
    onError: (error) => message.error(serverMessage(error) ?? 'Could not delete the phone call. Please try again.'),
  });

  if (!canView) {
    return <Result status="403" title="Not available" subTitle="You don't have permission to view the Phone Call Log." />;
  }

  const submit = handleSubmit((values) => saveMutation.mutate(values));
  const fieldError = (name: keyof FormValues) =>
    errors[name] ? { validateStatus: 'error' as const, help: errors[name]?.message } : {};
  const fid = (name: keyof FormValues) => `phone-call-${name}`;
  const showForm = canCreate || (editing !== null && canEdit);

  const handleExport = async (kind: ExportKind) => {
    setExporting(kind);
    try {
      const rows = await fetchAllPhoneCalls(listFilter);
      const columns: ExportColumn<PhoneCall>[] = DATA_COLUMNS.map((c) => ({ title: c.title, value: c.value }));
      const fileBase = `phone-call-log-${dayjs().format('YYYY-MM-DD')}`;
      const title = 'Phone Call Log List';
      if (kind === 'csv') downloadCsv(rows, columns, fileBase);
      else if (kind === 'excel') await downloadExcel(rows, columns, fileBase, title);
      else if (kind === 'pdf') await downloadPdf(rows, columns, fileBase, title);
      else if (kind === 'print') printRows(rows, columns, title);
    } catch {
      message.error("Couldn't export the phone calls. Please try again.");
    } finally {
      setExporting(null);
    }
  };

  const columns: ColumnsType<PhoneCall> = [
    ...DATA_COLUMNS.map((c) => ({
      key: c.key,
      title: c.title,
      sorter: true,
      sortOrder: sort?.key === c.key ? sort.order : null,
      align: c.align,
      render: (_: unknown, record: PhoneCall) => c.value(record),
    })),
    {
      key: 'action',
      title: 'Action',
      align: 'right',
      width: 110,
      render: (_: unknown, record: PhoneCall) => (
        <Space size={token.marginXXS}>
          <Tooltip title="View">
            <Button
              type="primary"
              size="small"
              icon={<MenuOutlined />}
              aria-label={`View call with ${record.name ?? record.phone}`}
              onClick={() => setViewing(record)}
            />
          </Tooltip>
          {canEdit && (
            <Tooltip title="Edit">
              <Button
                type="primary"
                size="small"
                icon={<EditOutlined />}
                aria-label={`Edit call with ${record.name ?? record.phone}`}
                onClick={() => setEditing(record)}
              />
            </Tooltip>
          )}
          {canDelete && (
            <Popconfirm
              title="Delete this phone call?"
              description="It will be permanently removed from the log."
              okText="Delete"
              okButtonProps={{ danger: true }}
              onConfirm={() => deleteMutation.mutateAsync(record)}
            >
              <Tooltip title="Delete">
                <Button
                  type="primary"
                  size="small"
                  icon={<DeleteOutlined />}
                  aria-label={`Delete call with ${record.name ?? record.phone}`}
                />
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
  const data = callsQuery.data;

  const dateField = (name: 'callDate' | 'nextFollowUpDate', label: string, required: boolean) => (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <Form.Item label={label} htmlFor={fid(name)} required={required} {...fieldError(name)}>
          <DatePicker
            id={fid(name)}
            style={{ width: '100%' }}
            format={DISPLAY_DATE_FORMAT}
            allowClear={!required}
            value={field.value ? dayjs(field.value) : null}
            onChange={(d) => field.onChange(d ? d.format(API_DATE_FORMAT) : '')}
            onBlur={field.onBlur}
          />
        </Form.Item>
      )}
    />
  );

  const textArea = (name: 'description' | 'note', label: string) => (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <Form.Item label={label} htmlFor={fid(name)} {...fieldError(name)}>
          <Input.TextArea {...field} id={fid(name)} rows={3} />
        </Form.Item>
      )}
    />
  );

  return (
    <Row gutter={[token.marginLG, token.marginLG]} align="top">
      {showForm && (
        <Col xs={24} lg={9} xl={7}>
          <Card
            title={cardTitle(editing ? 'Edit Phone Call Log' : 'Add Phone Call Log')}
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
            <Form layout="vertical" onFinish={submit} data-testid="phone-call-form">
              <Controller
                control={control}
                name="name"
                render={({ field }) => (
                  <Form.Item label="Name" htmlFor={fid('name')} {...fieldError('name')}>
                    <Input {...field} id={fid('name')} autoComplete="off" />
                  </Form.Item>
                )}
              />
              <Controller
                control={control}
                name="phone"
                render={({ field }) => (
                  <Form.Item label="Phone" htmlFor={fid('phone')} required {...fieldError('phone')}>
                    <Input {...field} id={fid('phone')} autoComplete="off" inputMode="tel" />
                  </Form.Item>
                )}
              />
              {dateField('callDate', 'Date', true)}
              {textArea('description', 'Description')}
              {dateField('nextFollowUpDate', 'Next Follow Up Date', false)}
              <Controller
                control={control}
                name="callDuration"
                render={({ field }) => (
                  <Form.Item label="Call Duration" htmlFor={fid('callDuration')} {...fieldError('callDuration')}>
                    <Input {...field} id={fid('callDuration')} autoComplete="off" placeholder="e.g. 5 min" />
                  </Form.Item>
                )}
              />
              {textArea('note', 'Note')}
              <Controller
                control={control}
                name="callType"
                render={({ field }) => (
                  <Form.Item
                    label="Call Type"
                    required
                    layout="horizontal"
                    {...fieldError('callType')}
                    style={{ marginBottom: 0 }}
                  >
                    <Radio.Group
                      aria-label="Call Type"
                      style={{ display: 'inline-flex', flexWrap: 'nowrap', whiteSpace: 'nowrap' }}
                      value={field.value || undefined}
                      onChange={(e) => field.onChange(e.target.value)}
                      options={[
                        { value: 'INCOMING', label: 'Incoming' },
                        { value: 'OUTGOING', label: 'Outgoing' },
                      ]}
                    />
                  </Form.Item>
                )}
              />
              <button type="submit" hidden aria-hidden />
            </Form>
          </Card>
        </Col>
      )}

      <Col xs={24} lg={showForm ? 15 : 24} xl={showForm ? 17 : 24}>
        <Card title={cardTitle('Phone Call Log List')} styles={{ header: { paddingBlock: token.paddingSM } }}>
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
            columns={[]}
            hiddenColumns={[]}
            onHiddenColumnsChange={() => {}}
            showColumnToggle={false}
            exportKinds={['excel', 'csv', 'pdf', 'print']}
            onExport={(kind) => void handleExport(kind)}
            exporting={exporting}
            canExport={canExport}
            canPrint={canPrint}
          />
          {callsQuery.isError ? (
            <Alert
              type="warning"
              showIcon
              message="Couldn't load phone calls"
              description="There was a problem reaching the server."
              action={
                <Button size="small" onClick={() => void callsQuery.refetch()}>
                  Try again
                </Button>
              }
            />
          ) : (
            <Table<PhoneCall>
              rowKey="id"
              size="middle"
              columns={columns}
              dataSource={data?.content ?? []}
              loading={callsQuery.isFetching}
              scroll={{ x: 'max-content' }}
              rowClassName={(record) => (record.id === editing?.id ? 'ant-table-row-selected' : '')}
              onChange={(_pagination, _filters, sorter) => {
                const s = (Array.isArray(sorter) ? sorter[0] : sorter) as SorterResult<PhoneCall>;
                setSort(s?.order && s.columnKey ? { key: s.columnKey as PhoneCallSortKey, order: s.order } : null);
                setPage(1);
              }}
              locale={{
                emptyText: (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={debouncedSearch ? 'No calls match your search' : 'No phone calls logged yet'}
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

      <PhoneCallDetailModal call={viewing} onClose={() => setViewing(null)} />
    </Row>
  );
}

export default PhoneCallLogPage;
