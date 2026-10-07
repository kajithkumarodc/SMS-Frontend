import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, Card, Checkbox, Col, Empty, Form, Input, Popconfirm, Result, Row, Space, Table, Tooltip, Typography, theme } from 'antd';
import type { ColumnsType } from 'antd/es/table/interface';
import { CloseOutlined, EditOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { fetchClasses, type SchoolClass } from '../../api/classes';
import { createClassWithSections, deleteClassById, fetchSectionNames, updateClassWithSections } from '../../api/classSetup';
import { useAuthStore } from '../../store/authStore';
import { hasRole, ROLE } from '../../lib/roles';
import { serverMessage } from '../../lib/apiErrors';
import { copyRows, downloadCsv, downloadExcel, downloadPdf, printRows, type ExportColumn, type ExportKind } from '../../lib/tableExport';
import DataTableToolbar from '../../components/DataTableToolbar';
import { CLASSES_QUERY_KEY } from '../classes/queryKeys';
import { namedSections } from '../classes/sectionLookup';
import { SECTION_NAMES_KEY, SUBJECT_GROUPS_KEY, TIMETABLE_KEY } from './queryKeys';

const { Title, Text } = Typography;

const DEFAULT_PAGE_SIZE = 50;

const schema = z.object({
  name: z.string().trim().min(1, 'Class is required').max(100, 'Keep this under 100 characters'),
  sectionNames: z.array(z.string()),
});

type FormValues = z.infer<typeof schema>;

const EMPTY: FormValues = { name: '', sectionNames: [] };

const sectionsOf = (c: SchoolClass) => namedSections(c).map((s) => s.name);

const EXPORT_COLUMNS: ExportColumn<SchoolClass>[] = [
  { title: 'Class', value: (c) => c.name },
  { title: 'Sections', value: (c) => sectionsOf(c).join(', ') },
];

/** Academics -> Class (/app/classes): classes and the sections they pick from the Sections list. */
function ClassPage() {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isAdmin = hasRole(useAuthStore((state) => state.user?.roles), ROLE.SCHOOL_ADMIN);

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [exporting, setExporting] = useState<ExportKind | null>(null);
  const [editing, setEditing] = useState<SchoolClass | null>(null);

  const classesQuery = useQuery({ queryKey: CLASSES_QUERY_KEY, queryFn: fetchClasses, enabled: isAdmin });
  const namesQuery = useQuery({ queryKey: SECTION_NAMES_KEY, queryFn: fetchSectionNames, enabled: isAdmin });

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: EMPTY, mode: 'onTouched' });

  useEffect(() => {
    reset(editing ? { name: editing.name, sectionNames: sectionsOf(editing) } : EMPTY);
  }, [editing, reset]);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: CLASSES_QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: SUBJECT_GROUPS_KEY });
    void queryClient.invalidateQueries({ queryKey: TIMETABLE_KEY });
  };

  const saveMutation = useMutation({
    mutationFn: (values: FormValues) => {
      const input = { name: values.name.trim(), sectionNames: values.sectionNames };
      return editing ? updateClassWithSections(editing.id, input) : createClassWithSections(input);
    },
    onSuccess: (saved) => {
      message.success(editing ? `Class "${saved.name}" updated` : `Class "${saved.name}" saved`);
      refresh();
      setEditing(null);
      reset(EMPTY);
    },
    onError: (error) => message.error(serverMessage(error) ?? 'Could not save the class. Please try again.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (schoolClass: SchoolClass) => deleteClassById(schoolClass.id).then(() => schoolClass),
    onSuccess: (schoolClass) => {
      message.success(`Class "${schoolClass.name}" deleted`);
      if (editing?.id === schoolClass.id) setEditing(null);
      refresh();
    },
    onError: (error) => message.error(serverMessage(error) ?? 'Could not delete the class. Please try again.'),
  });

  // The list is short, so search runs in the browser over every class.
  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const all = classesQuery.data ?? [];
    return term ? all.filter((c) => EXPORT_COLUMNS.some((col) => String(col.value(c) ?? '').toLowerCase().includes(term))) : all;
  }, [classesQuery.data, search]);

  if (!isAdmin) {
    return <Result status="403" title="Not available" subTitle="You don't have permission to manage classes." />;
  }

  const handleExport = async (kind: ExportKind) => {
    setExporting(kind);
    try {
      const fileBase = `classes-${dayjs().format('YYYY-MM-DD')}`;
      const title = 'Class List';
      if (kind === 'copy') {
        await copyRows(rows, EXPORT_COLUMNS);
        message.success(`Copied ${rows.length} row${rows.length === 1 ? '' : 's'} to the clipboard`);
      } else if (kind === 'csv') downloadCsv(rows, EXPORT_COLUMNS, fileBase);
      else if (kind === 'excel') await downloadExcel(rows, EXPORT_COLUMNS, fileBase, title);
      else if (kind === 'pdf') await downloadPdf(rows, EXPORT_COLUMNS, fileBase, title);
      else printRows(rows, EXPORT_COLUMNS, title);
    } catch {
      message.error("Couldn't export the classes. Please try again.");
    } finally {
      setExporting(null);
    }
  };

  const columns: ColumnsType<SchoolClass> = [
    { key: 'name', title: 'Class', render: (_v, c) => c.name },
    {
      key: 'sections',
      title: 'Sections',
      render: (_v, c) => (
        <div>
          {sectionsOf(c).map((name) => (
            <div key={name}>{name}</div>
          ))}
        </div>
      ),
    },
    {
      key: 'action',
      title: 'Action',
      align: 'right',
      width: 100,
      render: (_v, c) => (
        <Space size={token.marginXXS}>
          <Tooltip title="Edit">
            <Button type="primary" size="small" icon={<EditOutlined />} aria-label={`Edit class ${c.name}`} onClick={() => setEditing(c)} />
          </Tooltip>
          <Popconfirm
            title={`Delete "${c.name}"?`}
            description="Classes that have students, subjects or a timetable can't be deleted."
            okText="Delete"
            okButtonProps={{ danger: true }}
            onConfirm={() => deleteMutation.mutateAsync(c).catch(() => undefined)}
          >
            <Tooltip title="Delete">
              <Button type="primary" size="small" icon={<CloseOutlined />} aria-label={`Delete class ${c.name}`} />
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
  const save = handleSubmit((values) => {
    if (!editing && values.sectionNames.length === 0) {
      message.error('Choose at least one section');
      return;
    }
    saveMutation.mutate(values);
  });

  return (
    <Row gutter={[token.marginLG, token.marginLG]} align="top">
      <Col xs={24} lg={9} xl={7}>
        <Card
          title={cardTitle(editing ? 'Edit Class' : 'Add Class')}
          actions={[
            <div key="save" style={{ display: 'flex', justifyContent: 'flex-end', gap: token.marginXS, paddingInline: token.paddingLG }}>
              {editing && <Button onClick={() => setEditing(null)}>Cancel</Button>}
              <Button type="primary" onClick={save} loading={saveMutation.isPending}>
                Save
              </Button>
            </div>,
          ]}
        >
          <Form layout="vertical" onFinish={save} data-testid="class-form">
            <Controller
              control={control}
              name="name"
              render={({ field }) => (
                <Form.Item label="Class" htmlFor="class-name" required validateStatus={errors.name ? 'error' : undefined} help={errors.name?.message}>
                  <Input {...field} id="class-name" autoComplete="off" />
                </Form.Item>
              )}
            />
            <Controller
              control={control}
              name="sectionNames"
              render={({ field }) => (
                <Form.Item label="Sections" required={!editing} style={{ marginBottom: 0 }}>
                  {(namesQuery.data ?? []).length === 0 && !namesQuery.isLoading ? (
                    <Text type="secondary">Add sections on the Sections page first.</Text>
                  ) : (
                    <Checkbox.Group
                      aria-label="Sections"
                      value={field.value}
                      onChange={(v) => field.onChange(v as string[])}
                      style={{ display: 'flex', flexDirection: 'column', gap: token.marginXS }}
                      options={(namesQuery.data ?? []).map((s) => ({ value: s.name, label: s.name }))}
                    />
                  )}
                </Form.Item>
              )}
            />
            <button type="submit" hidden aria-hidden />
          </Form>
        </Card>
      </Col>

      <Col xs={24} lg={15} xl={17}>
        <Card
          title={cardTitle('Class List')}
          extra={
            <Button type="link" onClick={() => navigate('/app/classes/manage')}>
              Class subjects &amp; teachers
            </Button>
          }
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
          {classesQuery.isError ? (
            <Alert
              type="warning"
              showIcon
              message="Couldn't load the classes"
              description="There was a problem reaching the server."
              action={
                <Button size="small" onClick={() => void classesQuery.refetch()}>
                  Try again
                </Button>
              }
            />
          ) : (
            <Table<SchoolClass>
              rowKey="id"
              size="middle"
              columns={columns}
              dataSource={rows}
              loading={classesQuery.isFetching}
              rowClassName={(c) => (c.id === editing?.id ? 'ant-table-row-selected' : '')}
              locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={search.trim() ? 'No classes match your search' : 'No classes yet'} /> }}
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

export default ClassPage;
