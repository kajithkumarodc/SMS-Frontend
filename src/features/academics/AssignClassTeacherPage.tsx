import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, Card, Checkbox, Col, Empty, Form, Popconfirm, Result, Row, Select, Space, Table, Tooltip, Typography, theme } from 'antd';
import type { ColumnsType } from 'antd/es/table/interface';
import { CloseOutlined, EditOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { fetchClasses } from '../../api/classes';
import { fetchStaffDirectory } from '../../api/staffMembers';
import { assignClassTeachers, fetchClassTeachers, removeClassTeachers, type ClassTeacherRow } from '../../api/classTeachers';
import { useAuthStore } from '../../store/authStore';
import { hasRole, ROLE } from '../../lib/roles';
import { serverMessage } from '../../lib/apiErrors';
import { copyRows, downloadCsv, downloadExcel, downloadPdf, printRows, type ExportColumn, type ExportKind } from '../../lib/tableExport';
import DataTableToolbar from '../../components/DataTableToolbar';
import { CLASSES_QUERY_KEY } from '../classes/queryKeys';
import { defaultSection, namedSections } from '../classes/sectionLookup';
import { STAFF_DIRECTORY_KEY } from '../staff/directory/queryKeys';
import { CLASS_TEACHERS_KEY } from './queryKeys';

const { Title, Text } = Typography;

const DEFAULT_PAGE_SIZE = 50;

const teacherText = (r: ClassTeacherRow) => r.teachers.map((t) => `${t.name ?? ''}${t.staffId ? ` (${t.staffId})` : ''}`).join(', ');

const EXPORT_COLUMNS: ExportColumn<ClassTeacherRow>[] = [
  { title: 'Class', value: (r) => r.className ?? '' },
  { title: 'Section', value: (r) => r.sectionName },
  { title: 'Class Teacher', value: teacherText },
];

/** Academics -> Assign Class Teacher (/app/academics/assign-class-teacher): who is in charge of each section. */
function AssignClassTeacherPage() {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const isAdmin = hasRole(useAuthStore((state) => state.user?.roles), ROLE.SCHOOL_ADMIN);

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [exporting, setExporting] = useState<ExportKind | null>(null);
  const [classId, setClassId] = useState<string>();
  const [sectionId, setSectionId] = useState<string>();
  const [teacherIds, setTeacherIds] = useState<string[]>([]);
  const [errors, setErrors] = useState<{ classId?: string; sectionId?: string; teachers?: string }>({});

  const assignmentsQuery = useQuery({ queryKey: CLASS_TEACHERS_KEY, queryFn: fetchClassTeachers, enabled: isAdmin });
  const classesQuery = useQuery({ queryKey: CLASSES_QUERY_KEY, queryFn: fetchClasses, enabled: isAdmin });
  const staffQuery = useQuery({ queryKey: [...STAFF_DIRECTORY_KEY, {}], queryFn: () => fetchStaffDirectory({}), enabled: isAdmin });

  const selectedClass = classesQuery.data?.find((c) => c.id === classId);
  const sections = useMemo(() => namedSections(selectedClass), [selectedClass]);
  // A class without sections (e.g. LKG) gets its class teacher through its hidden whole-class section.
  const wholeClass = defaultSection(selectedClass);
  const targetSection = wholeClass ? wholeClass.id : sectionId;
  const teachers = (staffQuery.data ?? []).filter((s) => s.roleName?.toUpperCase() === 'TEACHER');
  const editing = Boolean(targetSection && assignmentsQuery.data?.some((a) => a.sectionId === targetSection));

  // Choosing a section that already has class teachers shows them ticked.
  useEffect(() => {
    if (!targetSection) {
      setTeacherIds([]);
      return;
    }
    const existing = assignmentsQuery.data?.find((a) => a.sectionId === targetSection);
    setTeacherIds(existing ? existing.teachers.map((t) => t.staffProfileId) : []);
  }, [targetSection, assignmentsQuery.data]);

  const refresh = () => void queryClient.invalidateQueries({ queryKey: CLASS_TEACHERS_KEY });

  const saveMutation = useMutation({
    mutationFn: () => assignClassTeachers(targetSection!, teacherIds),
    onSuccess: (saved) => {
      message.success(`Class teacher${saved.teachers.length === 1 ? '' : 's'} of ${saved.className}${saved.sectionName ? ` ${saved.sectionName}` : ''} saved`);
      refresh();
      setClassId(undefined);
      setSectionId(undefined);
      setTeacherIds([]);
    },
    onError: (error) => message.error(serverMessage(error) ?? 'Could not save the class teacher. Please try again.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (row: ClassTeacherRow) => removeClassTeachers(row.sectionId).then(() => row),
    onSuccess: (row) => {
      message.success(`Class teacher of ${row.className}${row.sectionName ? ` ${row.sectionName}` : ''} removed`);
      refresh();
    },
    onError: (error) => message.error(serverMessage(error) ?? 'Could not remove the class teacher. Please try again.'),
  });

  // The list is short, so search runs in the browser over every assignment.
  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const all = assignmentsQuery.data ?? [];
    return term ? all.filter((r) => EXPORT_COLUMNS.some((c) => String(c.value(r) ?? '').toLowerCase().includes(term))) : all;
  }, [assignmentsQuery.data, search]);

  if (!isAdmin) {
    return <Result status="403" title="Not available" subTitle="You don't have permission to assign class teachers." />;
  }

  const save = () => {
    const next = {
      classId: classId ? undefined : 'Class is required',
      sectionId: !wholeClass && !targetSection ? 'Section is required' : undefined,
      teachers: teacherIds.length === 0 ? 'Class Teacher is required' : undefined,
    };
    setErrors(next);
    if (next.classId || next.sectionId || next.teachers || !targetSection) return;
    saveMutation.mutate();
  };

  const handleExport = async (kind: ExportKind) => {
    setExporting(kind);
    try {
      const fileBase = `class-teachers-${dayjs().format('YYYY-MM-DD')}`;
      const title = 'Class Teacher List';
      if (kind === 'copy') {
        await copyRows(rows, EXPORT_COLUMNS);
        message.success(`Copied ${rows.length} row${rows.length === 1 ? '' : 's'} to the clipboard`);
      } else if (kind === 'csv') downloadCsv(rows, EXPORT_COLUMNS, fileBase);
      else if (kind === 'excel') await downloadExcel(rows, EXPORT_COLUMNS, fileBase, title);
      else if (kind === 'pdf') await downloadPdf(rows, EXPORT_COLUMNS, fileBase, title);
      else printRows(rows, EXPORT_COLUMNS, title);
    } catch {
      message.error("Couldn't export the class teachers. Please try again.");
    } finally {
      setExporting(null);
    }
  };

  const label = (r: ClassTeacherRow) => `${r.className}${r.sectionName ? ` ${r.sectionName}` : ''}`;
  const columns: ColumnsType<ClassTeacherRow> = [
    { key: 'class', title: 'Class', sorter: (a, b) => (a.className ?? '').localeCompare(b.className ?? '', undefined, { numeric: true }), render: (_v, r) => r.className },
    { key: 'section', title: 'Section', sorter: (a, b) => a.sectionName.localeCompare(b.sectionName), render: (_v, r) => r.sectionName },
    {
      key: 'teacher',
      title: 'Class Teacher',
      sorter: (a, b) => teacherText(a).localeCompare(teacherText(b)),
      render: (_v, r) => (
        <div>
          {r.teachers.map((t) => (
            <div key={t.staffProfileId}>
              {t.name}
              {t.staffId ? ` (${t.staffId})` : ''}
            </div>
          ))}
        </div>
      ),
    },
    {
      key: 'action',
      title: 'Action',
      align: 'right',
      width: 100,
      render: (_v, r) => (
        <Space size={token.marginXXS}>
          <Tooltip title="Edit">
            <Button
              type="primary"
              size="small"
              icon={<EditOutlined />}
              aria-label={`Edit class teacher of ${label(r)}`}
              onClick={() => {
                setClassId(r.classId);
                setSectionId(r.wholeClass ? undefined : r.sectionId);
                setErrors({});
              }}
            />
          </Tooltip>
          <Popconfirm
            title={`Remove the class teacher of ${label(r)}?`}
            okText="Remove"
            okButtonProps={{ danger: true }}
            onConfirm={() => deleteMutation.mutateAsync(r).catch(() => undefined)}
          >
            <Tooltip title="Delete">
              <Button type="primary" size="small" icon={<CloseOutlined />} aria-label={`Remove class teacher of ${label(r)}`} />
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
      <Col xs={24} lg={9} xl={8}>
        <Card
          title={cardTitle('Assign Class Teacher')}
          actions={[
            <div key="save" style={{ display: 'flex', justifyContent: 'flex-end', gap: token.marginXS, paddingInline: token.paddingLG }}>
              <Button type="primary" onClick={save} loading={saveMutation.isPending}>
                Save
              </Button>
            </div>,
          ]}
        >
          <Form layout="vertical" onFinish={save} data-testid="class-teacher-form">
            <Form.Item label="Class" htmlFor="ct-class" required validateStatus={errors.classId ? 'error' : undefined} help={errors.classId}>
              <Select
                id="ct-class"
                placeholder="Select"
                loading={classesQuery.isLoading}
                options={(classesQuery.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
                value={classId}
                onChange={(value: string) => {
                  setClassId(value);
                  setSectionId(undefined);
                  setErrors({});
                }}
              />
            </Form.Item>
            <Form.Item label="Section" htmlFor="ct-section" required={!wholeClass} validateStatus={errors.sectionId ? 'error' : undefined} help={errors.sectionId}>
              <Select
                id="ct-section"
                placeholder={wholeClass ? 'Whole class' : 'Select'}
                disabled={!classId || Boolean(wholeClass)}
                options={sections.map((s) => ({ value: s.id, label: s.name }))}
                value={sectionId}
                onChange={(value: string) => {
                  setSectionId(value);
                  setErrors((e) => ({ ...e, sectionId: undefined }));
                }}
              />
            </Form.Item>
            <Form.Item
              label="Class Teacher"
              required
              style={{ marginBottom: 0 }}
              validateStatus={errors.teachers ? 'error' : undefined}
              help={errors.teachers ?? (editing ? 'This section already has a class teacher; saving replaces it.' : undefined)}
            >
              {teachers.length === 0 && !staffQuery.isLoading ? (
                <Text type="secondary">There are no teachers yet. Add staff with the Teacher role first.</Text>
              ) : (
                <Checkbox.Group
                  aria-label="Class Teacher"
                  value={teacherIds}
                  onChange={(v) => {
                    setTeacherIds(v as string[]);
                    setErrors((e) => ({ ...e, teachers: undefined }));
                  }}
                  style={{ display: 'flex', flexDirection: 'column', gap: token.marginXS }}
                  options={teachers.map((s) => ({ value: s.id, label: `${s.fullName} (${s.staffId})` }))}
                />
              )}
            </Form.Item>
            <button type="submit" hidden aria-hidden />
          </Form>
        </Card>
      </Col>

      <Col xs={24} lg={15} xl={16}>
        <Card title={cardTitle('Class Teacher List')}>
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
          {assignmentsQuery.isError ? (
            <Alert
              type="warning"
              showIcon
              message="Couldn't load the class teachers"
              description="There was a problem reaching the server."
              action={
                <Button size="small" onClick={() => void assignmentsQuery.refetch()}>
                  Try again
                </Button>
              }
            />
          ) : (
            <Table<ClassTeacherRow>
              rowKey="sectionId"
              size="middle"
              columns={columns}
              dataSource={rows}
              loading={assignmentsQuery.isFetching}
              locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={search.trim() ? 'No class teachers match your search' : 'No class teachers assigned yet'} /> }}
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

export default AssignClassTeacherPage;
