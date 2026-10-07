import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, Card, Col, Empty, Form, Input, Popconfirm, Result, Row, Space, Table, Tooltip, Typography, theme } from 'antd';
import type { ColumnsType } from 'antd/es/table/interface';
import { CloseOutlined, EditOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { createSectionName, deleteSectionName, fetchSectionNames, updateSectionName, type SectionName } from '../../api/classSetup';
import { useAuthStore } from '../../store/authStore';
import { hasRole, ROLE } from '../../lib/roles';
import { serverMessage } from '../../lib/apiErrors';
import { copyRows, downloadCsv, downloadExcel, downloadPdf, printRows, type ExportColumn, type ExportKind } from '../../lib/tableExport';
import DataTableToolbar from '../../components/DataTableToolbar';
import { CLASSES_QUERY_KEY } from '../classes/queryKeys';
import { SECTION_NAMES_KEY } from './queryKeys';

const { Title, Text } = Typography;

const DEFAULT_PAGE_SIZE = 50;

const schema = z.object({ name: z.string().trim().min(1, 'Section Name is required').max(100, 'Keep this under 100 characters') });

type FormValues = z.infer<typeof schema>;

const EXPORT_COLUMNS: ExportColumn<SectionName>[] = [{ title: 'Section', value: (s) => s.name }];

/** Academics -> Sections (/app/academics/sections): the list of section names a class can pick from. */
function SectionsPage() {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const isAdmin = hasRole(useAuthStore((state) => state.user?.roles), ROLE.SCHOOL_ADMIN);

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [exporting, setExporting] = useState<ExportKind | null>(null);
  const [editing, setEditing] = useState<SectionName | null>(null);

  const namesQuery = useQuery({ queryKey: SECTION_NAMES_KEY, queryFn: fetchSectionNames, enabled: isAdmin });

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
    void queryClient.invalidateQueries({ queryKey: SECTION_NAMES_KEY });
    // A rename shows up on every class that has the section.
    void queryClient.invalidateQueries({ queryKey: CLASSES_QUERY_KEY });
  };

  const saveMutation = useMutation({
    mutationFn: (values: FormValues) => (editing ? updateSectionName(editing.id, values.name.trim()) : createSectionName(values.name.trim())),
    onSuccess: (saved) => {
      message.success(editing ? `Section "${saved.name}" updated` : `Section "${saved.name}" saved`);
      refresh();
      setEditing(null);
      reset({ name: '' });
    },
    onError: (error) => message.error(serverMessage(error) ?? 'Could not save the section. Please try again.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (section: SectionName) => deleteSectionName(section.id).then(() => section),
    onSuccess: (section) => {
      message.success(`Section "${section.name}" deleted`);
      if (editing?.id === section.id) setEditing(null);
      refresh();
    },
    onError: (error) => message.error(serverMessage(error) ?? 'Could not delete the section. Please try again.'),
  });

  // The list is short, so search runs in the browser over every section.
  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const all = namesQuery.data ?? [];
    return term ? all.filter((s) => s.name.toLowerCase().includes(term)) : all;
  }, [namesQuery.data, search]);

  if (!isAdmin) {
    return <Result status="403" title="Not available" subTitle="You don't have permission to manage sections." />;
  }

  const handleExport = async (kind: ExportKind) => {
    setExporting(kind);
    try {
      const fileBase = `sections-${dayjs().format('YYYY-MM-DD')}`;
      const title = 'Section List';
      if (kind === 'copy') {
        await copyRows(rows, EXPORT_COLUMNS);
        message.success(`Copied ${rows.length} row${rows.length === 1 ? '' : 's'} to the clipboard`);
      } else if (kind === 'csv') downloadCsv(rows, EXPORT_COLUMNS, fileBase);
      else if (kind === 'excel') await downloadExcel(rows, EXPORT_COLUMNS, fileBase, title);
      else if (kind === 'pdf') await downloadPdf(rows, EXPORT_COLUMNS, fileBase, title);
      else printRows(rows, EXPORT_COLUMNS, title);
    } catch {
      message.error("Couldn't export the sections. Please try again.");
    } finally {
      setExporting(null);
    }
  };

  const columns: ColumnsType<SectionName> = [
    {
      key: 'name',
      title: 'Section',
      sorter: (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }),
      render: (_v, s) => s.name,
    },
    {
      key: 'action',
      title: 'Action',
      align: 'right',
      width: 100,
      render: (_v, s) => (
        <Space size={token.marginXXS}>
          <Tooltip title="Edit">
            <Button type="primary" size="small" icon={<EditOutlined />} aria-label={`Edit section ${s.name}`} onClick={() => setEditing(s)} />
          </Tooltip>
          <Popconfirm
            title={`Delete section "${s.name}"?`}
            description="Sections that a class uses can't be deleted."
            okText="Delete"
            okButtonProps={{ danger: true }}
            onConfirm={() => deleteMutation.mutateAsync(s).catch(() => undefined)}
          >
            <Tooltip title="Delete">
              <Button type="primary" size="small" icon={<CloseOutlined />} aria-label={`Delete section ${s.name}`} />
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
          title={cardTitle(editing ? 'Edit Section' : 'Add Section')}
          actions={[
            <div key="save" style={{ display: 'flex', justifyContent: 'flex-end', gap: token.marginXS, paddingInline: token.paddingLG }}>
              {editing && <Button onClick={() => setEditing(null)}>Cancel</Button>}
              <Button type="primary" onClick={save} loading={saveMutation.isPending}>
                Save
              </Button>
            </div>,
          ]}
        >
          <Form layout="vertical" onFinish={save} data-testid="section-form">
            <Controller
              control={control}
              name="name"
              render={({ field }) => (
                <Form.Item
                  label="Section Name"
                  htmlFor="section-name"
                  required
                  style={{ marginBottom: 0 }}
                  validateStatus={errors.name ? 'error' : undefined}
                  help={errors.name?.message}
                >
                  <Input {...field} id="section-name" autoComplete="off" />
                </Form.Item>
              )}
            />
            <button type="submit" hidden aria-hidden />
          </Form>
        </Card>
      </Col>

      <Col xs={24} lg={15} xl={17}>
        <Card title={cardTitle('Section List')}>
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
          {namesQuery.isError ? (
            <Alert
              type="warning"
              showIcon
              message="Couldn't load the sections"
              description="There was a problem reaching the server."
              action={
                <Button size="small" onClick={() => void namesQuery.refetch()}>
                  Try again
                </Button>
              }
            />
          ) : (
            <Table<SectionName>
              rowKey="id"
              size="middle"
              columns={columns}
              dataSource={rows}
              loading={namesQuery.isFetching}
              rowClassName={(s) => (s.id === editing?.id ? 'ant-table-row-selected' : '')}
              locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={search.trim() ? 'No sections match your search' : 'No sections yet'} /> }}
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

export default SectionsPage;
