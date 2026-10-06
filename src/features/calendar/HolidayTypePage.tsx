import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, Card, Col, Empty, Form, Input, Popconfirm, Result, Row, Space, Table, Tooltip, Typography, theme } from 'antd';
import type { ColumnsType } from 'antd/es/table/interface';
import { CloseOutlined, EditOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { createHolidayType, deleteHolidayType, fetchHolidayTypes, updateHolidayType, type HolidayType } from '../../api/calendar';
import { useAuthStore } from '../../store/authStore';
import { hasPermission } from '../../lib/roles';
import { serverMessage } from '../../lib/apiErrors';
import { copyRows, downloadCsv, downloadExcel, downloadPdf, printRows, type ExportColumn, type ExportKind } from '../../lib/tableExport';
import DataTableToolbar from '../../components/DataTableToolbar';
import { CALENDAR_EVENTS_KEY, HOLIDAY_TYPES_KEY } from './queryKeys';

const { Title, Text } = Typography;

const DEFAULT_PAGE_SIZE = 50;

const schema = z.object({ name: z.string().trim().min(1, 'Holiday Type is required').max(100, 'Keep this under 100 characters') });

type FormValues = z.infer<typeof schema>;

const EXPORT_COLUMNS: ExportColumn<HolidayType>[] = [{ title: 'Holiday Type', value: (t) => t.name }];

/** Annual Calendar -> Holiday Type (/app/calendar/holiday-type): the types a calendar entry can be filed under. */
function HolidayTypePage() {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const canManage = hasPermission(useAuthStore((state) => state.user?.permissions), 'CALENDAR_MANAGE');

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [exporting, setExporting] = useState<ExportKind | null>(null);
  const [editing, setEditing] = useState<HolidayType | null>(null);

  const typesQuery = useQuery({ queryKey: HOLIDAY_TYPES_KEY, queryFn: fetchHolidayTypes, enabled: canManage });

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
    void queryClient.invalidateQueries({ queryKey: HOLIDAY_TYPES_KEY });
    // Calendar entries show the type name.
    void queryClient.invalidateQueries({ queryKey: CALENDAR_EVENTS_KEY });
  };

  const saveMutation = useMutation({
    mutationFn: (values: FormValues) => (editing ? updateHolidayType(editing.id, values.name.trim()) : createHolidayType(values.name.trim())),
    onSuccess: (saved) => {
      message.success(editing ? `Holiday Type "${saved.name}" updated` : `Holiday Type "${saved.name}" saved`);
      refresh();
      setEditing(null);
      reset({ name: '' });
    },
    onError: (error) => message.error(serverMessage(error) ?? 'Could not save the holiday type. Please try again.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (type: HolidayType) => deleteHolidayType(type.id).then(() => type),
    onSuccess: (type) => {
      message.success(`Holiday Type "${type.name}" deleted`);
      if (editing?.id === type.id) setEditing(null);
      refresh();
    },
    onError: (error) => message.error(serverMessage(error) ?? 'Could not delete the holiday type. Please try again.'),
  });

  // The list is short, so search runs in the browser over every type.
  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const all = typesQuery.data ?? [];
    return term ? all.filter((t) => t.name.toLowerCase().includes(term)) : all;
  }, [typesQuery.data, search]);

  if (!canManage) {
    return <Result status="403" title="Not available" subTitle="You don't have permission to manage holiday types." />;
  }

  const handleExport = async (kind: ExportKind) => {
    setExporting(kind);
    try {
      const fileBase = `holiday-types-${dayjs().format('YYYY-MM-DD')}`;
      const title = 'Holiday Type List';
      if (kind === 'copy') {
        await copyRows(rows, EXPORT_COLUMNS);
        message.success(`Copied ${rows.length} row${rows.length === 1 ? '' : 's'} to the clipboard`);
      } else if (kind === 'csv') downloadCsv(rows, EXPORT_COLUMNS, fileBase);
      else if (kind === 'excel') await downloadExcel(rows, EXPORT_COLUMNS, fileBase, title);
      else if (kind === 'pdf') await downloadPdf(rows, EXPORT_COLUMNS, fileBase, title);
      else printRows(rows, EXPORT_COLUMNS, title);
    } catch {
      message.error("Couldn't export the holiday types. Please try again.");
    } finally {
      setExporting(null);
    }
  };

  const columns: ColumnsType<HolidayType> = [
    { key: 'name', title: 'Holiday Type', sorter: (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }), render: (_v, t) => t.name },
    {
      key: 'action',
      title: 'Action',
      align: 'right',
      width: 100,
      render: (_v, t) => (
        <Space size={token.marginXXS}>
          <Tooltip title="Edit">
            <Button type="primary" size="small" icon={<EditOutlined />} aria-label={`Edit holiday type ${t.name}`} onClick={() => setEditing(t)} />
          </Tooltip>
          <Popconfirm
            title={`Delete "${t.name}"?`}
            description="Types that have calendar entries can't be deleted."
            okText="Delete"
            okButtonProps={{ danger: true }}
            onConfirm={() => deleteMutation.mutateAsync(t).catch(() => undefined)}
          >
            <Tooltip title="Delete">
              <Button type="primary" size="small" icon={<CloseOutlined />} aria-label={`Delete holiday type ${t.name}`} />
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
          title={cardTitle(editing ? 'Edit Holiday Type' : 'Add Holiday Type')}
          actions={[
            <div key="save" style={{ display: 'flex', justifyContent: 'flex-end', gap: token.marginXS, paddingInline: token.paddingLG }}>
              {editing && <Button onClick={() => setEditing(null)}>Cancel</Button>}
              <Button type="primary" onClick={save} loading={saveMutation.isPending}>
                Save
              </Button>
            </div>,
          ]}
        >
          <Form layout="vertical" onFinish={save} data-testid="holiday-type-form">
            <Controller
              control={control}
              name="name"
              render={({ field }) => (
                <Form.Item
                  label="Holiday Type"
                  htmlFor="holiday-type-name"
                  required
                  style={{ marginBottom: 0 }}
                  validateStatus={errors.name ? 'error' : undefined}
                  help={errors.name?.message}
                >
                  <Input {...field} id="holiday-type-name" autoComplete="off" />
                </Form.Item>
              )}
            />
            <button type="submit" hidden aria-hidden />
          </Form>
        </Card>
      </Col>

      <Col xs={24} lg={15} xl={17}>
        <Card title={cardTitle('Holiday Type List')}>
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
          {typesQuery.isError ? (
            <Alert
              type="warning"
              showIcon
              message="Couldn't load the holiday types"
              description="There was a problem reaching the server."
              action={
                <Button size="small" onClick={() => void typesQuery.refetch()}>
                  Try again
                </Button>
              }
            />
          ) : (
            <Table<HolidayType>
              rowKey="id"
              size="middle"
              columns={columns}
              dataSource={rows}
              loading={typesQuery.isFetching}
              rowClassName={(t) => (t.id === editing?.id ? 'ant-table-row-selected' : '')}
              locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={search.trim() ? 'No holiday types match your search' : 'No holiday types yet'} /> }}
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

export default HolidayTypePage;
