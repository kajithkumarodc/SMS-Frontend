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
  createDepartment,
  deleteDepartment,
  fetchDepartments,
  updateDepartment,
  type DepartmentRow,
} from '../../../api/departments';
import { useAuthStore } from '../../../store/authStore';
import { hasPermission } from '../../../lib/roles';
import { serverMessage } from '../../../lib/apiErrors';
import {
  copyRows,
  downloadCsv,
  downloadExcel,
  downloadPdf,
  printRows,
  type ExportColumn,
  type ExportKind,
} from '../../../lib/tableExport';
import DataTableToolbar from '../../../components/DataTableToolbar';
import { STAFF_DIRECTORY_KEY, STAFF_MEMBER_KEY, STAFF_OPTIONS_KEY } from '../directory/queryKeys';
import { DEPARTMENTS_KEY } from './queryKeys';

const { Title, Text } = Typography;

const DEFAULT_PAGE_SIZE = 50;

const schema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100, 'Keep this under 100 characters'),
});

type FormValues = z.infer<typeof schema>;

/** Human Resource -> Department (/app/human-resource/department): the departments a request can be filed under. */
function DepartmentPage() {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const canManage = hasPermission(useAuthStore((state) => state.user?.permissions), 'DEPARTMENT_MANAGE');

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [exporting, setExporting] = useState<ExportKind | null>(null);
  const [editing, setEditing] = useState<DepartmentRow | null>(null);

  const departmentsQuery = useQuery({ queryKey: DEPARTMENTS_KEY, queryFn: fetchDepartments, enabled: canManage });

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
    void queryClient.invalidateQueries({ queryKey: DEPARTMENTS_KEY });
    // The staff forms offer these, and staff cards and profiles show the department name.
    void queryClient.invalidateQueries({ queryKey: STAFF_OPTIONS_KEY });
  };

  const saveMutation = useMutation({
    mutationFn: (values: FormValues) => (editing ? updateDepartment(editing.id, values.name.trim()) : createDepartment(values.name.trim())),
    onSuccess: (saved) => {
      message.success(editing ? `Department "${saved.name}" updated` : `Department "${saved.name}" saved`);
      if (editing) {
        void queryClient.invalidateQueries({ queryKey: STAFF_DIRECTORY_KEY.slice(0, 1) });
        void queryClient.invalidateQueries({ queryKey: STAFF_MEMBER_KEY });
      }
      refresh();
      setEditing(null);
      reset({ name: '' });
    },
    onError: (error) => message.error(serverMessage(error) ?? 'Could not save the department. Please try again.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (type: DepartmentRow) => deleteDepartment(type.id).then(() => type),
    onSuccess: (type) => {
      message.success(`Department "${type.name}" deleted`);
      if (editing?.id === type.id) setEditing(null);
      refresh();
    },
    onError: (error) => message.error(serverMessage(error) ?? 'Could not delete the department. Please try again.'),
  });

  // The list is short, so search runs in the browser over every type.
  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const all = departmentsQuery.data ?? [];
    return term ? all.filter((t) => t.name.toLowerCase().includes(term)) : all;
  }, [departmentsQuery.data, search]);

  if (!canManage) {
    return <Result status="403" title="Not available" subTitle="You don't have permission to manage departments." />;
  }

  const handleExport = async (kind: ExportKind) => {
    setExporting(kind);
    try {
      const columns: ExportColumn<DepartmentRow>[] = [{ title: 'Name', value: (t) => t.name }];
      const fileBase = `departments-${dayjs().format('YYYY-MM-DD')}`;
      const title = 'Department List';
      if (kind === 'copy') {
        await copyRows(rows, columns);
        message.success(`Copied ${rows.length} row${rows.length === 1 ? '' : 's'} to the clipboard`);
      } else if (kind === 'csv') downloadCsv(rows, columns, fileBase);
      else if (kind === 'excel') await downloadExcel(rows, columns, fileBase, title);
      else if (kind === 'pdf') await downloadPdf(rows, columns, fileBase, title);
      else printRows(rows, columns, title);
    } catch {
      message.error("Couldn't export the departments. Please try again.");
    } finally {
      setExporting(null);
    }
  };

  const columns: ColumnsType<DepartmentRow> = [
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
            <Button type="primary" size="small" icon={<EditOutlined />} aria-label={`Edit department ${t.name}`} onClick={() => setEditing(t)} />
          </Tooltip>
          <Popconfirm
            title={`Delete "${t.name}"?`}
            description="Departments that staff belong to can't be deleted."
            okText="Delete"
            okButtonProps={{ danger: true }}
            onConfirm={() => deleteMutation.mutateAsync(t).catch(() => undefined)}
          >
            <Tooltip title="Delete">
              <Button type="primary" size="small" icon={<CloseOutlined />} aria-label={`Delete department ${t.name}`} />
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
          title={cardTitle(editing ? 'Edit Department' : 'Add Department')}
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
          <Form layout="vertical" onFinish={handleSubmit((values) => saveMutation.mutate(values))} data-testid="department-form">
            <Controller
              control={control}
              name="name"
              render={({ field }) => (
                <Form.Item
                  label="Name"
                  htmlFor="department-name"
                  required
                  style={{ marginBottom: 0 }}
                  validateStatus={errors.name ? 'error' : undefined}
                  help={errors.name?.message}
                >
                  <Input {...field} id="department-name" autoComplete="off" />
                </Form.Item>
              )}
            />
            <button type="submit" hidden aria-hidden />
          </Form>
        </Card>
      </Col>

      <Col xs={24} lg={15} xl={17}>
        <Card title={cardTitle('Department List')} styles={{ header: { paddingBlock: token.paddingSM } }}>
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
          {departmentsQuery.isError ? (
            <Alert
              type="warning"
              showIcon
              message="Couldn't load the departments"
              description="There was a problem reaching the server."
              action={
                <Button size="small" onClick={() => void departmentsQuery.refetch()}>
                  Try again
                </Button>
              }
            />
          ) : (
            <Table<DepartmentRow>
              rowKey="id"
              size="middle"
              columns={columns}
              dataSource={rows}
              loading={departmentsQuery.isFetching}
              rowClassName={(t) => (t.id === editing?.id ? 'ant-table-row-selected' : '')}
              locale={{
                emptyText: (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={search.trim() ? 'No departments match your search' : 'No departments yet'} />
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

export default DepartmentPage;
