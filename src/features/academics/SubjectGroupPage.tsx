import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, Card, Checkbox, Col, Empty, Form, Input, Popconfirm, Result, Row, Select, Space, Table, Tooltip, Typography, theme } from 'antd';
import type { ColumnsType } from 'antd/es/table/interface';
import { CloseOutlined, EditOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { fetchClasses } from '../../api/classes';
import {
  createSubjectGroup,
  deleteSubjectGroup,
  fetchAcademicSubjects,
  fetchSubjectGroups,
  updateSubjectGroup,
  type SubjectGroup,
} from '../../api/academics';
import { useAuthStore } from '../../store/authStore';
import { hasPermission } from '../../lib/roles';
import { serverMessage } from '../../lib/apiErrors';
import { copyRows, downloadCsv, downloadExcel, downloadPdf, printRows, type ExportColumn, type ExportKind } from '../../lib/tableExport';
import DataTableToolbar from '../../components/DataTableToolbar';
import { CLASSES_QUERY_KEY } from '../classes/queryKeys';
import { defaultSection, namedSections } from '../classes/sectionLookup';
import { ACADEMIC_SUBJECTS_KEY, SUBJECT_GROUPS_KEY, TIMETABLE_KEY } from './queryKeys';

const { Title, Text } = Typography;

const DEFAULT_PAGE_SIZE = 50;

const schema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100, 'Keep this under 100 characters'),
  classId: z.string().min(1, 'Class is required'),
  sectionIds: z.array(z.string()),
  subjectIds: z.array(z.string()).min(1, 'Choose at least one subject'),
  description: z.string().max(500, 'Keep this under 500 characters'),
});

type FormValues = z.infer<typeof schema>;

const EMPTY: FormValues = { name: '', classId: '', sectionIds: [], subjectIds: [], description: '' };

const sectionsText = (g: SubjectGroup) => g.sections.filter((s) => !s.isDefault).map((s) => s.name).join(', ');
const subjectsText = (g: SubjectGroup) => g.subjects.map((s) => (s.code ? `${s.name} (${s.code})` : s.name)).join(', ');

const EXPORT_COLUMNS: ExportColumn<SubjectGroup>[] = [
  { title: 'Name', value: (g) => g.name },
  { title: 'Class (Sections)', value: (g) => `${g.className ?? ''}${sectionsText(g) ? ` (${sectionsText(g)})` : ''}` },
  { title: 'Subject', value: subjectsText },
];

/** Academics -> Subject Group (/app/academics/subject-group): the subjects a class's sections study together. */
function SubjectGroupPage() {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const canManage = hasPermission(useAuthStore((state) => state.user?.permissions), 'SUBJECT_MANAGE');

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [exporting, setExporting] = useState<ExportKind | null>(null);
  const [editing, setEditing] = useState<SubjectGroup | null>(null);

  const groupsQuery = useQuery({ queryKey: [...SUBJECT_GROUPS_KEY, 'all'], queryFn: () => fetchSubjectGroups(), enabled: canManage });
  const classesQuery = useQuery({ queryKey: CLASSES_QUERY_KEY, queryFn: fetchClasses, enabled: canManage });
  const subjectsQuery = useQuery({ queryKey: ACADEMIC_SUBJECTS_KEY, queryFn: fetchAcademicSubjects, enabled: canManage });

  const {
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: EMPTY, mode: 'onTouched' });
  const classId = watch('classId');
  const selectedClass = classesQuery.data?.find((c) => c.id === classId);
  const sections = useMemo(() => namedSections(selectedClass), [selectedClass]);
  const wholeClass = defaultSection(selectedClass);

  useEffect(() => {
    reset(
      editing
        ? {
            name: editing.name,
            classId: editing.classId ?? '',
            sectionIds: editing.sections.map((s) => s.id),
            subjectIds: editing.subjects.map((s) => s.id),
            description: editing.description ?? '',
          }
        : EMPTY,
    );
  }, [editing, reset]);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: SUBJECT_GROUPS_KEY });
    void queryClient.invalidateQueries({ queryKey: TIMETABLE_KEY });
  };

  const saveMutation = useMutation({
    mutationFn: (values: FormValues) => {
      // A class without sections is covered through its hidden whole-class section.
      const sectionIds = wholeClass ? [wholeClass.id] : values.sectionIds;
      const input = { name: values.name.trim(), classId: values.classId, sectionIds, subjectIds: values.subjectIds, description: values.description.trim() || null };
      return editing ? updateSubjectGroup(editing.id, input) : createSubjectGroup(input);
    },
    onSuccess: (saved) => {
      message.success(editing ? `Subject group "${saved.name}" updated` : `Subject group "${saved.name}" saved`);
      refresh();
      setEditing(null);
      reset(EMPTY);
    },
    onError: (error) => message.error(serverMessage(error) ?? 'Could not save the subject group. Please try again.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (group: SubjectGroup) => deleteSubjectGroup(group.id).then(() => group),
    onSuccess: (group) => {
      message.success(`Subject group "${group.name}" deleted`);
      if (editing?.id === group.id) setEditing(null);
      refresh();
    },
    onError: (error) => message.error(serverMessage(error) ?? 'Could not delete the subject group. Please try again.'),
  });

  // The list is short, so search runs in the browser over every group.
  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const all = groupsQuery.data ?? [];
    return term ? all.filter((g) => EXPORT_COLUMNS.some((c) => String(c.value(g) ?? '').toLowerCase().includes(term))) : all;
  }, [groupsQuery.data, search]);

  if (!canManage) {
    return <Result status="403" title="Not available" subTitle="You don't have permission to manage subject groups." />;
  }

  const handleExport = async (kind: ExportKind) => {
    setExporting(kind);
    try {
      const fileBase = `subject-groups-${dayjs().format('YYYY-MM-DD')}`;
      const title = 'Subject Group List';
      if (kind === 'copy') {
        await copyRows(rows, EXPORT_COLUMNS);
        message.success(`Copied ${rows.length} row${rows.length === 1 ? '' : 's'} to the clipboard`);
      } else if (kind === 'csv') downloadCsv(rows, EXPORT_COLUMNS, fileBase);
      else if (kind === 'excel') await downloadExcel(rows, EXPORT_COLUMNS, fileBase, title);
      else if (kind === 'pdf') await downloadPdf(rows, EXPORT_COLUMNS, fileBase, title);
      else printRows(rows, EXPORT_COLUMNS, title);
    } catch {
      message.error("Couldn't export the subject groups. Please try again.");
    } finally {
      setExporting(null);
    }
  };

  const columns: ColumnsType<SubjectGroup> = [
    { key: 'name', title: 'Name', sorter: (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }), render: (_v, g) => g.name },
    {
      key: 'class',
      title: 'Class (Sections)',
      render: (_v, g) => (
        <div>
          <div>{g.className}</div>
          {sectionsText(g) && <Text type="secondary">{sectionsText(g)}</Text>}
        </div>
      ),
    },
    { key: 'subjects', title: 'Subject', render: (_v, g) => subjectsText(g) },
    {
      key: 'action',
      title: 'Action',
      align: 'right',
      width: 100,
      render: (_v, g) => (
        <Space size={token.marginXXS}>
          <Tooltip title="Edit">
            <Button type="primary" size="small" icon={<EditOutlined />} aria-label={`Edit subject group ${g.name}`} onClick={() => setEditing(g)} />
          </Tooltip>
          <Popconfirm
            title={`Delete "${g.name}"?`}
            description="Subject groups that have timetable periods can't be deleted."
            okText="Delete"
            okButtonProps={{ danger: true }}
            onConfirm={() => deleteMutation.mutateAsync(g).catch(() => undefined)}
          >
            <Tooltip title="Delete">
              <Button type="primary" size="small" icon={<CloseOutlined />} aria-label={`Delete subject group ${g.name}`} />
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
  const err = (name: keyof FormValues) => ({ validateStatus: errors[name] ? ('error' as const) : undefined, help: errors[name]?.message as string | undefined });
  const save = handleSubmit((values) => {
    if (!wholeClass && values.sectionIds.length === 0) {
      message.error('Choose at least one section');
      return;
    }
    saveMutation.mutate(values);
  });

  return (
    <Row gutter={[token.marginLG, token.marginLG]} align="top">
      <Col xs={24} lg={10} xl={8}>
        <Card
          title={cardTitle(editing ? 'Edit Subject Group' : 'Add Subject Group')}
          actions={[
            <div key="save" style={{ display: 'flex', justifyContent: 'flex-end', gap: token.marginXS, paddingInline: token.paddingLG }}>
              {editing && <Button onClick={() => setEditing(null)}>Cancel</Button>}
              <Button type="primary" onClick={save} loading={saveMutation.isPending}>
                Save
              </Button>
            </div>,
          ]}
        >
          <Form layout="vertical" onFinish={save} data-testid="subject-group-form">
            <Controller
              control={control}
              name="name"
              render={({ field }) => (
                <Form.Item label="Name" htmlFor="group-name" required {...err('name')}>
                  <Input {...field} id="group-name" autoComplete="off" />
                </Form.Item>
              )}
            />
            <Controller
              control={control}
              name="classId"
              render={({ field }) => (
                <Form.Item label="Class" htmlFor="group-class" required {...err('classId')}>
                  <Select
                    id="group-class"
                    placeholder="Select"
                    loading={classesQuery.isLoading}
                    options={(classesQuery.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
                    value={field.value || undefined}
                    onChange={(value: string) => {
                      field.onChange(value);
                      setValue('sectionIds', []);
                    }}
                    onBlur={field.onBlur}
                  />
                </Form.Item>
              )}
            />
            <Controller
              control={control}
              name="sectionIds"
              render={({ field }) => (
                <Form.Item label="Sections" required={!wholeClass}>
                  {!classId ? (
                    <Text type="secondary">Choose a class first</Text>
                  ) : wholeClass ? (
                    <Text type="secondary">This class has no sections, so the group covers the whole class.</Text>
                  ) : (
                    <Checkbox.Group
                      aria-label="Sections"
                      value={field.value}
                      onChange={(v) => field.onChange(v as string[])}
                      options={sections.map((s) => ({ value: s.id, label: s.name }))}
                    />
                  )}
                </Form.Item>
              )}
            />
            <Controller
              control={control}
              name="subjectIds"
              render={({ field }) => (
                <Form.Item label="Subjects" required {...err('subjectIds')}>
                  <Checkbox.Group
                    aria-label="Subjects"
                    value={field.value}
                    onChange={(v) => field.onChange(v as string[])}
                    style={{ display: 'flex', flexDirection: 'column', gap: token.marginXXS }}
                    options={(subjectsQuery.data ?? []).map((s) => ({ value: s.id, label: s.code ? `${s.name} (${s.code})` : s.name }))}
                  />
                  {!subjectsQuery.isLoading && (subjectsQuery.data ?? []).length === 0 && <Text type="secondary">Add subjects on the Subjects page first.</Text>}
                </Form.Item>
              )}
            />
            <Controller
              control={control}
              name="description"
              render={({ field }) => (
                <Form.Item label="Description" htmlFor="group-description" style={{ marginBottom: 0 }} {...err('description')}>
                  <Input.TextArea {...field} id="group-description" rows={3} maxLength={500} />
                </Form.Item>
              )}
            />
            <button type="submit" hidden aria-hidden />
          </Form>
        </Card>
      </Col>

      <Col xs={24} lg={14} xl={16}>
        <Card title={cardTitle('Subject Group List')}>
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
          {groupsQuery.isError ? (
            <Alert
              type="warning"
              showIcon
              message="Couldn't load the subject groups"
              description="There was a problem reaching the server."
              action={
                <Button size="small" onClick={() => void groupsQuery.refetch()}>
                  Try again
                </Button>
              }
            />
          ) : (
            <Table<SubjectGroup>
              rowKey="id"
              size="middle"
              columns={columns}
              dataSource={rows}
              loading={groupsQuery.isFetching}
              scroll={{ x: 'max-content' }}
              rowClassName={(g) => (g.id === editing?.id ? 'ant-table-row-selected' : '')}
              locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={search.trim() ? 'No subject groups match your search' : 'No subject groups yet'} /> }}
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

export default SubjectGroupPage;
