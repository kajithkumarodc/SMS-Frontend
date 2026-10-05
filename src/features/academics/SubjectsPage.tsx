import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, Card, Col, Empty, Form, Input, Popconfirm, Radio, Result, Row, Space, Table, Tooltip, Typography, theme } from 'antd';
import type { ColumnsType } from 'antd/es/table/interface';
import { CloseOutlined, EditOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  createAcademicSubject,
  deleteAcademicSubject,
  fetchAcademicSubjects,
  updateAcademicSubject,
  type AcademicSubject,
} from '../../api/academics';
import { useAuthStore } from '../../store/authStore';
import { hasPermission } from '../../lib/roles';
import { serverMessage } from '../../lib/apiErrors';
import { copyRows, downloadCsv, downloadExcel, downloadPdf, printRows, type ExportColumn, type ExportKind } from '../../lib/tableExport';
import DataTableToolbar from '../../components/DataTableToolbar';
import { ACADEMIC_SUBJECTS_KEY, SUBJECT_GROUPS_KEY, TIMETABLE_KEY } from './queryKeys';

const { Title, Text } = Typography;

const DEFAULT_PAGE_SIZE = 50;

const schema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100, 'Keep this under 100 characters'),
  type: z.enum(['THEORY', 'PRACTICAL']),
  code: z.string().trim().max(30, 'Keep this under 30 characters'),
});

type FormValues = z.infer<typeof schema>;

const EMPTY: FormValues = { name: '', type: 'THEORY', code: '' };
const typeLabel = (type: AcademicSubject['type']) => (type === 'PRACTICAL' ? 'Practical' : 'Theory');

const EXPORT_COLUMNS: ExportColumn<AcademicSubject>[] = [
  { title: 'Subject', value: (s) => s.name },
  { title: 'Subject Code', value: (s) => s.code ?? '' },
  { title: 'Subject Type', value: (s) => typeLabel(s.type) },
];

/** Academics -> Subjects (/app/academics/subjects): the subjects of the school, with code and type. */
function SubjectsPage() {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const canManage = hasPermission(useAuthStore((state) => state.user?.permissions), 'SUBJECT_MANAGE');

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [exporting, setExporting] = useState<ExportKind | null>(null);
  const [editing, setEditing] = useState<AcademicSubject | null>(null);

  const subjectsQuery = useQuery({ queryKey: ACADEMIC_SUBJECTS_KEY, queryFn: fetchAcademicSubjects, enabled: canManage });

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: EMPTY, mode: 'onTouched' });

  useEffect(() => {
    reset(editing ? { name: editing.name, type: editing.type, code: editing.code ?? '' } : EMPTY);
  }, [editing, reset]);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ACADEMIC_SUBJECTS_KEY });
    // Subject groups and timetables show the subject name and code.
    void queryClient.invalidateQueries({ queryKey: SUBJECT_GROUPS_KEY });
    void queryClient.invalidateQueries({ queryKey: TIMETABLE_KEY });
  };

  const saveMutation = useMutation({
    mutationFn: (values: FormValues) => {
      const input = { name: values.name.trim(), code: values.code.trim() || null, type: values.type };
      return editing ? updateAcademicSubject(editing.id, input) : createAcademicSubject(input);
    },
    onSuccess: (saved) => {
      message.success(editing ? `Subject "${saved.name}" updated` : `Subject "${saved.name}" saved`);
      refresh();
      setEditing(null);
      reset(EMPTY);
    },
    onError: (error) => message.error(serverMessage(error) ?? 'Could not save the subject. Please try again.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (subject: AcademicSubject) => deleteAcademicSubject(subject.id).then(() => subject),
    onSuccess: (subject) => {
      message.success(`Subject "${subject.name}" deleted`);
      if (editing?.id === subject.id) setEditing(null);
      refresh();
    },
    onError: (error) => message.error(serverMessage(error) ?? 'Could not delete the subject. Please try again.'),
  });

  // The list is short, so search runs in the browser over every subject.
  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const all = subjectsQuery.data ?? [];
    return term ? all.filter((s) => EXPORT_COLUMNS.some((c) => String(c.value(s) ?? '').toLowerCase().includes(term))) : all;
  }, [subjectsQuery.data, search]);

  if (!canManage) {
    return <Result status="403" title="Not available" subTitle="You don't have permission to manage subjects." />;
  }

  const handleExport = async (kind: ExportKind) => {
    setExporting(kind);
    try {
      const fileBase = `subjects-${dayjs().format('YYYY-MM-DD')}`;
      const title = 'Subject List';
      if (kind === 'copy') {
        await copyRows(rows, EXPORT_COLUMNS);
        message.success(`Copied ${rows.length} row${rows.length === 1 ? '' : 's'} to the clipboard`);
      } else if (kind === 'csv') downloadCsv(rows, EXPORT_COLUMNS, fileBase);
      else if (kind === 'excel') await downloadExcel(rows, EXPORT_COLUMNS, fileBase, title);
      else if (kind === 'pdf') await downloadPdf(rows, EXPORT_COLUMNS, fileBase, title);
      else printRows(rows, EXPORT_COLUMNS, title);
    } catch {
      message.error("Couldn't export the subjects. Please try again.");
    } finally {
      setExporting(null);
    }
  };

  const columns: ColumnsType<AcademicSubject> = [
    { key: 'name', title: 'Subject', sorter: (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }), render: (_v, s) => s.name },
    { key: 'code', title: 'Subject Code', align: 'right', sorter: (a, b) => (a.code ?? '').localeCompare(b.code ?? '', undefined, { numeric: true }), render: (_v, s) => s.code ?? '' },
    { key: 'type', title: 'Subject Type', sorter: (a, b) => a.type.localeCompare(b.type), render: (_v, s) => typeLabel(s.type) },
    {
      key: 'action',
      title: 'Action',
      align: 'right',
      width: 100,
      render: (_v, s) => (
        <Space size={token.marginXXS}>
          <Tooltip title="Edit">
            <Button type="primary" size="small" icon={<EditOutlined />} aria-label={`Edit subject ${s.name}`} onClick={() => setEditing(s)} />
          </Tooltip>
          <Popconfirm
            title={`Delete "${s.name}"?`}
            description="Subjects used by a class, subject group or timetable can't be deleted."
            okText="Delete"
            okButtonProps={{ danger: true }}
            onConfirm={() => deleteMutation.mutateAsync(s).catch(() => undefined)}
          >
            <Tooltip title="Delete">
              <Button type="primary" size="small" icon={<CloseOutlined />} aria-label={`Delete subject ${s.name}`} />
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

  return (
    <Row gutter={[token.marginLG, token.marginLG]} align="top">
      <Col xs={24} lg={9} xl={7}>
        <Card
          title={cardTitle(editing ? 'Edit Subject' : 'Add Subject')}
          actions={[
            <div key="save" style={{ display: 'flex', justifyContent: 'flex-end', gap: token.marginXS, paddingInline: token.paddingLG }}>
              {editing && <Button onClick={() => setEditing(null)}>Cancel</Button>}
              <Button type="primary" onClick={save} loading={saveMutation.isPending}>
                Save
              </Button>
            </div>,
          ]}
        >
          <Form layout="vertical" onFinish={save} data-testid="subject-form">
            <Controller
              control={control}
              name="name"
              render={({ field }) => (
                <Form.Item label="Subject Name" htmlFor="subject-name" required {...err('name')}>
                  <Input {...field} id="subject-name" autoComplete="off" />
                </Form.Item>
              )}
            />
            <Controller
              control={control}
              name="type"
              render={({ field }) => (
                <Form.Item {...err('type')}>
                  <Radio.Group value={field.value} onChange={field.onChange} aria-label="Subject type">
                    <Radio value="THEORY">Theory</Radio>
                    <Radio value="PRACTICAL">Practical</Radio>
                  </Radio.Group>
                </Form.Item>
              )}
            />
            <Controller
              control={control}
              name="code"
              render={({ field }) => (
                <Form.Item label="Subject Code" htmlFor="subject-code" style={{ marginBottom: 0 }} {...err('code')}>
                  <Input {...field} id="subject-code" autoComplete="off" />
                </Form.Item>
              )}
            />
            <button type="submit" hidden aria-hidden />
          </Form>
        </Card>
      </Col>

      <Col xs={24} lg={15} xl={17}>
        <Card title={cardTitle('Subject List')}>
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
          {subjectsQuery.isError ? (
            <Alert
              type="warning"
              showIcon
              message="Couldn't load the subjects"
              description="There was a problem reaching the server."
              action={
                <Button size="small" onClick={() => void subjectsQuery.refetch()}>
                  Try again
                </Button>
              }
            />
          ) : (
            <Table<AcademicSubject>
              rowKey="id"
              size="middle"
              columns={columns}
              dataSource={rows}
              loading={subjectsQuery.isFetching}
              rowClassName={(s) => (s.id === editing?.id ? 'ant-table-row-selected' : '')}
              locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={search.trim() ? 'No subjects match your search' : 'No subjects yet'} /> }}
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

export default SubjectsPage;
