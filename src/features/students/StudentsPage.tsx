import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  App,
  Avatar,
  Button,
  Card,
  Col,
  Dropdown,
  Empty,
  Form,
  Input,
  List,
  Result,
  Row,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
  theme,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { MenuProps } from 'antd';
import {
  ApartmentOutlined,
  BookOutlined,
  CarOutlined,
  DollarOutlined,
  EditOutlined,
  FolderOutlined,
  HomeOutlined,
  IdcardOutlined,
  MoreOutlined,
  PhoneOutlined,
  PlusOutlined,
  PrinterOutlined,
  SearchOutlined,
  UnorderedListOutlined,
  UserOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  changeStudentStatus,
  fetchAllStudents,
  fetchStudent,
  lookupIdentifications,
  studentPhotoUrl,
  type Student,
  type StudentStatus,
} from '../../api/students';
import { fetchClasses } from '../../api/classes';
import { useAuthStore } from '../../store/authStore';
import { hasAnyRole, hasRole, ROLE } from '../../lib/roles';
import { formatDisplayDate } from '../../lib/dates';
import { serverMessage } from '../../lib/apiErrors';
import { downloadCsv, downloadExcel, downloadPdf, printRows, type ExportColumn, type ExportKind } from '../../lib/tableExport';
import DataTableToolbar from '../../components/DataTableToolbar';
import { CLASSES_QUERY_KEY } from '../classes/queryKeys';
import { buildSectionLookup, defaultSection, namedSections, type SectionInfo } from '../classes/sectionLookup';
import { STUDENTS_QUERY_KEY } from './queryKeys';
import EditStudentModal from './EditStudentModal';
import AssignSectionModal from './AssignSectionModal';
import StudentDocumentsModal from './StudentDocumentsModal';
import StudentProfileDrawer from './StudentProfileDrawer';
import StudentInvoicesModal from '../fees/StudentInvoicesModal';
import { StudentLibraryModal } from '../library';
import { AssignTransportRouteModal } from '../transport';
import { AllocateHostelRoomModal } from '../hostel';

const { Title, Text } = Typography;

const DEFAULT_PAGE_SIZE = 50;
const DETAILS_LIST_KEY = [...STUDENTS_QUERY_KEY, 'details-list'] as const;

const STATUS_OPTIONS: { value: StudentStatus; label: string }[] = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
  { value: 'GRADUATED', label: 'Graduated' },
  { value: 'LEFT_SCHOOL', label: 'Left school' },
  { value: 'TRANSFERRED', label: 'Transferred' },
];

/** What the last Search asked for -- kept in the URL so Back and links return to the same list. */
type Criteria = { mode: 'class'; classId: string; sectionId?: string } | { mode: 'keyword'; q: string };

function titleCase(value: string | null | undefined): string {
  if (!value) return '';
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

/** Smart School's "Class 1(A)"; a class without sections shows just its name. */
function classLabel(info: SectionInfo | undefined): string {
  if (!info) return '';
  return info.isDefault ? info.className : `${info.className}(${info.sectionName})`;
}

function mobileNumber(s: Student): string {
  return s.guardianPhone || s.fatherMobile || s.motherMobile || '';
}

function currentAddress(s: Student): string {
  return [s.addressLine1, s.addressLine2, s.city, s.state, s.pincode, s.currentCountry].filter(Boolean).join(', ');
}

function StudentsPage() {
  const { token } = theme.useToken();
  const { message, modal } = App.useApp();
  const queryClient = useQueryClient();
  const roles = useAuthStore((state) => state.user?.roles);
  const canManageStudents = hasRole(roles, ROLE.SCHOOL_ADMIN);
  const canViewLibrary = hasAnyRole(roles, [ROLE.SCHOOL_ADMIN, ROLE.TEACHER]);
  const canView = hasAnyRole(roles, [ROLE.SCHOOL_ADMIN, ROLE.TEACHER]);

  const navigate = useNavigate();
  const [editing, setEditing] = useState<Student | null>(null);
  const [assigning, setAssigning] = useState<Student | null>(null);
  const [viewingInvoices, setViewingInvoices] = useState<Student | null>(null);
  const [viewingLibrary, setViewingLibrary] = useState<Student | null>(null);
  const [assigningRoute, setAssigningRoute] = useState<Student | null>(null);
  const [allocatingRoom, setAllocatingRoom] = useState<Student | null>(null);
  const [viewingDocuments, setViewingDocuments] = useState<Student | null>(null);
  const [viewingProfile, setViewingProfile] = useState<Student | null>(null);

  const [searchParams, setSearchParams] = useSearchParams();

  // `?profile=<studentId>` (e.g. from Bulk Delete's name links) opens that student's profile.
  const profileId = searchParams.get('profile');
  const linkedProfileQuery = useQuery({
    queryKey: [...STUDENTS_QUERY_KEY, 'profile', profileId],
    queryFn: () => fetchStudent(profileId as string),
    enabled: Boolean(profileId),
  });
  useEffect(() => {
    if (!profileId || !linkedProfileQuery.isFetched) return;
    if (linkedProfileQuery.data) setViewingProfile(linkedProfileQuery.data);
    setSearchParams(
      (params) => {
        params.delete('profile');
        return params;
      },
      { replace: true },
    );
  }, [profileId, linkedProfileQuery.isFetched, linkedProfileQuery.data, setSearchParams]);

  // Applied criteria live in the URL (?classId=&sectionId= or ?q=).
  const criteria: Criteria | null = useMemo(() => {
    const q = searchParams.get('q');
    if (q) return { mode: 'keyword', q };
    const classId = searchParams.get('classId');
    if (classId) return { mode: 'class', classId, sectionId: searchParams.get('sectionId') ?? undefined };
    return null;
  }, [searchParams]);

  const [draftClassId, setDraftClassId] = useState<string | undefined>(
    criteria?.mode === 'class' ? criteria.classId : undefined,
  );
  const [draftSectionId, setDraftSectionId] = useState<string | undefined>(
    criteria?.mode === 'class' ? criteria.sectionId : undefined,
  );
  const [draftKeyword, setDraftKeyword] = useState(criteria?.mode === 'keyword' ? criteria.q : '');
  const [classError, setClassError] = useState(false);
  const [keywordError, setKeywordError] = useState(false);

  const [view, setView] = useState<'list' | 'details'>('list');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [exporting, setExporting] = useState<ExportKind | null>(null);

  const classesQuery = useQuery({ queryKey: CLASSES_QUERY_KEY, queryFn: fetchClasses, enabled: canView });
  const sectionLookup = useMemo(() => buildSectionLookup(classesQuery.data), [classesQuery.data]);
  const draftClass = classesQuery.data?.find((c) => c.id === draftClassId);
  const draftWholeClass = defaultSection(draftClass);
  const sectionOptions = namedSections(draftClass).map((s) => ({ value: s.id, label: s.name }));

  const studentsQuery = useQuery({
    queryKey: [...DETAILS_LIST_KEY, criteria],
    queryFn: () =>
      criteria!.mode === 'keyword'
        ? fetchAllStudents({ q: criteria!.q })
        : fetchAllStudents({ classId: criteria!.classId, sectionId: criteria!.sectionId }),
    enabled: canView && criteria !== null,
  });

  const rows = useMemo(() => {
    const all = [...(studentsQuery.data ?? [])].sort(
      (a, b) =>
        classLabel(sectionLookup.get(a.sectionId ?? '')).localeCompare(
          classLabel(sectionLookup.get(b.sectionId ?? '')),
          undefined,
          { numeric: true },
        ) || a.fullName.localeCompare(b.fullName),
    );
    const needle = search.trim().toLowerCase();
    if (!needle) return all;
    return all.filter((s) =>
      [
        s.admissionNumber,
        s.fullName,
        s.rollNumber,
        classLabel(sectionLookup.get(s.sectionId ?? '')),
        s.fatherName,
        formatDisplayDate(s.dateOfBirth),
        titleCase(s.gender),
        s.category,
        mobileNumber(s),
      ].some((v) => (v ?? '').toLowerCase().includes(needle)),
    );
  }, [studentsQuery.data, search, sectionLookup]);

  // Local identification numbers for the Details View, looked up in one call.
  const studentIds = useMemo(() => (studentsQuery.data ?? []).map((s) => s.id), [studentsQuery.data]);
  const identificationsQuery = useQuery({
    queryKey: [...DETAILS_LIST_KEY, 'identifications', studentIds],
    queryFn: () => lookupIdentifications(studentIds),
    enabled: canView && view === 'details' && studentIds.length > 0,
  });
  const localIdByStudent = useMemo(() => {
    const map = new Map<string, string>();
    for (const entry of identificationsQuery.data ?? []) {
      if (entry.idType === 'LOCAL_ID' && !map.has(entry.studentId)) map.set(entry.studentId, entry.idValue);
    }
    return map;
  }, [identificationsQuery.data]);

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: StudentStatus; name: string }) =>
      changeStudentStatus(id, status),
    onSuccess: (_result, variables) => {
      message.success(
        `${variables.name} is now ${STATUS_OPTIONS.find((o) => o.value === variables.status)?.label ?? variables.status}`,
      );
      void queryClient.invalidateQueries({ queryKey: STUDENTS_QUERY_KEY });
    },
    onError: (error) => message.error(serverMessage(error) ?? 'Could not change the student status. Please try again.'),
  });

  if (!canView) {
    return <Result status="403" title="Not available" subTitle="You don't have permission to view student details." />;
  }

  const applyCriteria = (next: Criteria) => {
    setSearch('');
    setPage(1);
    setSearchParams(
      next.mode === 'keyword'
        ? { q: next.q }
        : next.sectionId
          ? { classId: next.classId, sectionId: next.sectionId }
          : { classId: next.classId },
    );
  };

  const searchByClass = () => {
    setKeywordError(false);
    if (!draftClassId) {
      setClassError(true);
      return;
    }
    setClassError(false);
    applyCriteria({ mode: 'class', classId: draftClassId, sectionId: draftWholeClass ? undefined : draftSectionId });
  };

  const searchByKeyword = () => {
    setClassError(false);
    const q = draftKeyword.trim();
    if (!q) {
      setKeywordError(true);
      return;
    }
    setKeywordError(false);
    applyCriteria({ mode: 'keyword', q });
  };

  const printProfile = (student: Student) => {
    setViewingProfile(student);
    window.setTimeout(() => window.print(), 300);
  };

  const confirmStatus = (student: Student, status: StudentStatus) =>
    modal.confirm({
      title: `Change ${student.fullName}'s status to "${STATUS_OPTIONS.find((o) => o.value === status)?.label}"?`,
      content:
        status === 'ACTIVE' ? 'The student will be marked active again.' : 'The student stays in the records -- no data is deleted.',
      okText: 'Confirm',
      onOk: () => statusMutation.mutate({ id: student.id, status, name: student.fullName }),
    });

  const actionButton = (title: string, icon: React.ReactNode, onClick: () => void, student: Student) => (
    <Tooltip title={title}>
      <Button type="primary" size="small" icon={icon} aria-label={`${title}: ${student.fullName}`} onClick={onClick} />
    </Tooltip>
  );

  const renderActions = (student: Student) => {
    const moreItems: MenuProps['items'] = [
      { key: 'documents', icon: <FolderOutlined />, label: 'Documents' },
      ...(canViewLibrary ? [{ key: 'library', icon: <BookOutlined />, label: 'Library' }] : []),
      ...(canManageStudents
        ? [
            { key: 'assign-section', icon: <ApartmentOutlined />, label: 'Assign section' },
            { key: 'transport', icon: <CarOutlined />, label: 'Transport' },
            { key: 'hostel', icon: <HomeOutlined />, label: 'Hostel' },
            {
              key: 'status',
              icon: <IdcardOutlined />,
              label: 'Change status',
              children: STATUS_OPTIONS.filter((o) => o.value !== student.status).map((o) => ({
                key: `status:${o.value}`,
                label: o.label,
              })),
            },
          ]
        : []),
    ];
    return (
      <Space size={token.marginXXS} wrap={false}>
        {actionButton('View', <UnorderedListOutlined />, () => setViewingProfile(student), student)}
        {canManageStudents && actionButton('Edit', <EditOutlined />, () => setEditing(student), student)}
        {canManageStudents && actionButton('Fees', <DollarOutlined />, () => setViewingInvoices(student), student)}
        {actionButton('Print', <PrinterOutlined />, () => printProfile(student), student)}
        <Dropdown
          trigger={['click']}
          menu={{
            items: moreItems,
            onClick: ({ key }) => {
              if (key === 'documents') setViewingDocuments(student);
              if (key === 'library') setViewingLibrary(student);
              if (key === 'assign-section') setAssigning(student);
              if (key === 'transport') setAssigningRoute(student);
              if (key === 'hostel') setAllocatingRoom(student);
              if (key.startsWith('status:')) confirmStatus(student, key.slice('status:'.length) as StudentStatus);
            },
          }}
        >
          <Tooltip title="More">
            <Button
              size="small"
              icon={<MoreOutlined />}
              aria-label={`More actions: ${student.fullName}`}
              loading={statusMutation.isPending && statusMutation.variables?.id === student.id}
            />
          </Tooltip>
        </Dropdown>
      </Space>
    );
  };

  const nameLink = (student: Student) => (
    <Space size={token.marginXXS} wrap>
      <a onClick={() => setViewingProfile(student)}>{student.fullName}</a>
      {student.status !== 'ACTIVE' && (
        <Tag style={{ marginInlineEnd: 0 }}>{STATUS_OPTIONS.find((o) => o.value === student.status)?.label}</Tag>
      )}
    </Space>
  );

  const compareText = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });
  const DATA_COLUMNS: { key: string; title: string; value: (s: Student) => string; align?: 'right' }[] = [
    { key: 'admissionNumber', title: 'Admission No', value: (s) => s.admissionNumber },
    { key: 'fullName', title: 'Student Name', value: (s) => s.fullName },
    { key: 'rollNumber', title: 'Roll No.', value: (s) => s.rollNumber ?? '', align: 'right' },
    { key: 'class', title: 'Class', value: (s) => classLabel(sectionLookup.get(s.sectionId ?? '')) },
    { key: 'fatherName', title: 'Father Name', value: (s) => s.fatherName ?? '' },
    { key: 'dateOfBirth', title: 'Date Of Birth', value: (s) => formatDisplayDate(s.dateOfBirth) },
    { key: 'gender', title: 'Gender', value: (s) => titleCase(s.gender) },
    { key: 'category', title: 'Category', value: (s) => s.category ?? '' },
    { key: 'mobile', title: 'Mobile Number', value: mobileNumber, align: 'right' },
  ];

  const columns: ColumnsType<Student> = [
    ...DATA_COLUMNS.map((c) => ({
      key: c.key,
      title: c.title,
      align: c.align,
      sorter:
        c.key === 'dateOfBirth'
          ? (a: Student, b: Student) => (a.dateOfBirth ?? '').localeCompare(b.dateOfBirth ?? '')
          : (a: Student, b: Student) => compareText(c.value(a), c.value(b)),
      render: (_: unknown, record: Student) => (c.key === 'fullName' ? nameLink(record) : c.value(record)),
    })),
    { key: 'action', title: 'Action', align: 'right', render: (_: unknown, record: Student) => renderActions(record) },
  ];

  const handleExport = async (kind: ExportKind) => {
    setExporting(kind);
    try {
      const exportColumns: ExportColumn<Student>[] = DATA_COLUMNS.map((c) => ({ title: c.title, value: c.value }));
      const fileBase = `student-details-${dayjs().format('YYYY-MM-DD')}`;
      const title = 'Student List';
      if (kind === 'csv') downloadCsv(rows, exportColumns, fileBase);
      else if (kind === 'excel') await downloadExcel(rows, exportColumns, fileBase, title);
      else if (kind === 'pdf') await downloadPdf(rows, exportColumns, fileBase, title);
      else printRows(rows, exportColumns, title);
    } catch {
      message.error("Couldn't export the students. Please try again.");
    } finally {
      setExporting(null);
    }
  };

  const detailLine = (label: string, value: React.ReactNode) => (
    <div>
      <Text strong>{label}: </Text>
      <Text>{value}</Text>
    </div>
  );

  const detailsCard = (student: Student) => {
    const info = sectionLookup.get(student.sectionId ?? '');
    return (
      <Card size="small" style={{ width: '100%' }} styles={{ body: { padding: token.paddingMD } }}>
        <Row gutter={[token.marginLG, token.marginSM]} align="top" wrap>
          <Col flex="none">
            <Avatar
              shape="square"
              size={112}
              src={student.photoUrl ? studentPhotoUrl(student.id) : undefined}
              icon={<UserOutlined />}
              alt={`Photo of ${student.fullName}`}
            />
          </Col>
          <Col flex="1 1 260px">
            <Title level={4} style={{ margin: 0, fontWeight: 500 }}>
              {nameLink(student)}
            </Title>
            {detailLine('Class', classLabel(info) || 'Not assigned')}
            {detailLine('Admission No', student.admissionNumber)}
            {detailLine('Date Of Birth', formatDisplayDate(student.dateOfBirth))}
            {detailLine('Gender', titleCase(student.gender))}
          </Col>
          <Col flex="1 1 300px">
            {detailLine('Local Identification Number', localIdByStudent.get(student.id) ?? '')}
            {detailLine('Guardian Name', student.guardianName ?? '')}
            {detailLine(
              'Guardian Phone',
              student.guardianPhone ? (
                <>
                  <PhoneOutlined /> {student.guardianPhone}
                </>
              ) : (
                ''
              ),
            )}
            {detailLine('Current Address', currentAddress(student))}
          </Col>
        </Row>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: token.marginSM }}>
          {renderActions(student)}
        </div>
      </Card>
    );
  };

  const hasResults = criteria !== null;
  const cardTitle = (text: string) => (
    <Title level={4} style={{ margin: 0, fontWeight: 500, whiteSpace: 'normal' }}>
      {text}
    </Title>
  );
  const pagination = {
    current: page,
    pageSize,
    onChange: setPage,
    showSizeChanger: false,
    showTotal: (total: number, [from, to]: [number, number]) => `Records: ${from} to ${to} of ${total}`,
  };
  const emptyText = (
    <Empty
      image={Empty.PRESENTED_IMAGE_SIMPLE}
      description={search.trim() ? 'No students match your search' : 'No students found'}
    />
  );

  return (
    <div>
      <Card
        title={cardTitle('Select Criteria')}
        extra={
          canManageStudents && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/app/student-information/student-admission')}>
              Add Student
            </Button>
          )
        }
        style={{ marginBottom: token.marginLG }}
      >
        <Row gutter={token.marginLG}>
          <Col xs={24} lg={12}>
            <Form layout="vertical" onFinish={searchByClass} requiredMark>
              <Row gutter={token.marginMD}>
                <Col xs={24} sm={12}>
                  <Form.Item
                    label="Class"
                    htmlFor="student-details-class"
                    required
                    validateStatus={classError ? 'error' : undefined}
                    help={classError ? 'Class is required' : undefined}
                  >
                    <Select
                      id="student-details-class"
                      placeholder="Select"
                      showSearch
                      optionFilterProp="label"
                      loading={classesQuery.isLoading}
                      options={(classesQuery.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
                      value={draftClassId}
                      onChange={(v) => {
                        setDraftClassId(v);
                        setDraftSectionId(undefined);
                        setClassError(false);
                      }}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item label="Section" htmlFor="student-details-section">
                    <Select
                      id="student-details-section"
                      placeholder={
                        !draftClassId ? 'Select a class first' : draftWholeClass ? 'Whole class (no sections)' : 'All sections'
                      }
                      allowClear
                      disabled={!draftClassId || Boolean(draftWholeClass)}
                      options={sectionOptions}
                      value={draftSectionId}
                      onChange={(v) => setDraftSectionId(v)}
                    />
                  </Form.Item>
                </Col>
              </Row>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button type="primary" htmlType="submit" icon={<SearchOutlined />} data-testid="student-details-class-search">
                  Search
                </Button>
              </div>
            </Form>
          </Col>
          <Col xs={24} lg={12}>
            <Form layout="vertical" onFinish={searchByKeyword}>
              <Form.Item
                label="Search By Keyword"
                htmlFor="student-details-keyword"
                validateStatus={keywordError ? 'error' : undefined}
                help={keywordError ? 'Type something to search for' : undefined}
              >
                <Input
                  id="student-details-keyword"
                  placeholder="Search By Student Name, Roll Number, Enroll Number, National Id, Local Id Etc."
                  value={draftKeyword}
                  onChange={(e) => {
                    setDraftKeyword(e.target.value);
                    setKeywordError(false);
                  }}
                  allowClear
                />
              </Form.Item>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button type="primary" htmlType="submit" icon={<SearchOutlined />} data-testid="student-details-keyword-search">
                  Search
                </Button>
              </div>
            </Form>
          </Col>
        </Row>
      </Card>

      {hasResults && (
        <Card styles={{ body: { paddingTop: 0 } }}>
          <Tabs
            activeKey={view}
            onChange={(key) => setView(key as 'list' | 'details')}
            items={[
              { key: 'list', label: 'List View', icon: <UnorderedListOutlined /> },
              { key: 'details', label: 'Details View', icon: <IdcardOutlined /> },
            ]}
          />
          {studentsQuery.isError ? (
            <Alert
              type="error"
              showIcon
              message={serverMessage(studentsQuery.error) ?? "Couldn't load the students."}
              action={<Button onClick={() => void studentsQuery.refetch()}>Retry</Button>}
            />
          ) : view === 'list' ? (
            <>
              <DataTableToolbar
                search={search}
                onSearchChange={(v) => {
                  setSearch(v);
                  setPage(1);
                }}
                searchLabel="Search students in this list"
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
                exportKinds={['excel', 'csv', 'pdf', 'print']}
                showColumnToggle={false}
              />
              <Table<Student>
                rowKey="id"
                size="middle"
                columns={columns}
                dataSource={rows}
                loading={studentsQuery.isFetching}
                scroll={{ x: 'max-content' }}
                pagination={pagination}
                locale={{ emptyText }}
              />
            </>
          ) : (
            <List<Student>
              loading={studentsQuery.isFetching}
              dataSource={rows}
              pagination={rows.length > pageSize ? { ...pagination, align: 'end' } : false}
              locale={{ emptyText }}
              renderItem={(student) => (
                <List.Item key={student.id} style={{ paddingInline: 0, borderBlockEnd: 'none' }}>
                  {detailsCard(student)}
                </List.Item>
              )}
            />
          )}
        </Card>
      )}

      {!hasResults && (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="Select a class (and section), or type a keyword, then press Search."
        />
      )}

      {canManageStudents && (
        <>
          <EditStudentModal student={editing} onClose={() => setEditing(null)} />
          <AssignSectionModal student={assigning} onClose={() => setAssigning(null)} />
          <AssignTransportRouteModal student={assigningRoute} onClose={() => setAssigningRoute(null)} />
          <AllocateHostelRoomModal student={allocatingRoom} onClose={() => setAllocatingRoom(null)} />
          <StudentInvoicesModal student={viewingInvoices} onClose={() => setViewingInvoices(null)} />
        </>
      )}

      {canViewLibrary && <StudentLibraryModal student={viewingLibrary} onClose={() => setViewingLibrary(null)} />}

      <StudentDocumentsModal
        student={viewingDocuments}
        onClose={() => setViewingDocuments(null)}
        canUpload={canManageStudents}
        canDelete={canManageStudents}
      />

      <StudentProfileDrawer
        student={viewingProfile}
        onClose={() => setViewingProfile(null)}
        canEdit={canManageStudents}
        onEdit={(student) => {
          setViewingProfile(null);
          setEditing(student);
        }}
        onOpenDocuments={(student) => {
          setViewingProfile(null);
          setViewingDocuments(student);
        }}
        onOpenInvoices={(student) => {
          setViewingProfile(null);
          setViewingInvoices(student);
        }}
        onOpenLibrary={(student) => {
          setViewingProfile(null);
          setViewingLibrary(student);
        }}
        onOpenTransport={(student) => {
          setViewingProfile(null);
          setAssigningRoute(student);
        }}
        onOpenHostel={(student) => {
          setViewingProfile(null);
          setAllocatingRoom(student);
        }}
      />
    </div>
  );
}

export default StudentsPage;
