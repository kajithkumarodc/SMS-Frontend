import { useMemo, useState } from 'react';
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  Alert,
  App,
  Avatar,
  Button,
  Card,
  Dropdown,
  Empty,
  Input,
  Select,
  Skeleton,
  Space,
  Table,
  Tag,
  Typography,
  theme,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { MenuProps } from 'antd';
import {
  ApartmentOutlined,
  BookOutlined,
  CarOutlined,
  EditOutlined,
  EyeOutlined,
  FileTextOutlined,
  FolderOutlined,
  HomeOutlined,
  MoreOutlined,
  PlusOutlined,
  PrinterOutlined,
  ReloadOutlined,
  UserOutlined,
} from '@ant-design/icons';
import {
  changeStudentStatus,
  fetchStudents,
  searchStudents,
  studentPhotoUrl,
  type Student,
  type StudentStatus,
} from '../../api/students';
import { fetchClasses } from '../../api/classes';
import { useAuthStore } from '../../store/authStore';
import { hasAnyRole, hasRole, ROLE } from '../../lib/roles';
import { CLASSES_QUERY_KEY } from '../classes/queryKeys';
import { buildSectionLookup } from '../classes/sectionLookup';
import { STUDENTS_QUERY_KEY } from './queryKeys';
import AddStudentModal from './AddStudentModal';
import EditStudentModal from './EditStudentModal';
import AssignSectionModal from './AssignSectionModal';
import StudentDocumentsModal from './StudentDocumentsModal';
import StudentProfileDrawer from './StudentProfileDrawer';
import StudentInvoicesModal from '../fees/StudentInvoicesModal';
import { StudentLibraryModal } from '../library';
import { AssignTransportRouteModal } from '../transport';
import { AllocateHostelRoomModal } from '../hostel';

const { Title, Text } = Typography;

const DEFAULT_PAGE_SIZE = 20;

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: 'success',
  INACTIVE: 'default',
  GRADUATED: 'blue',
  LEFT_SCHOOL: 'default',
  TRANSFERRED: 'gold',
};

const STATUS_OPTIONS: { value: StudentStatus; label: string }[] = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
  { value: 'GRADUATED', label: 'Graduated' },
  { value: 'LEFT_SCHOOL', label: 'Left school' },
  { value: 'TRANSFERRED', label: 'Transferred' },
];

function StudentsPage() {
  const { token } = theme.useToken();
  const { message, modal } = App.useApp();
  const queryClient = useQueryClient();
  const roles = useAuthStore((state) => state.user?.roles);
  const canManageStudents = hasRole(roles, ROLE.SCHOOL_ADMIN);
  const canViewLibrary = hasAnyRole(roles, [ROLE.SCHOOL_ADMIN, ROLE.TEACHER]);

  const [page, setPage] = useState(1); // 1-based for the Table; the API is 0-based
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<StudentStatus | undefined>();
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [assigning, setAssigning] = useState<Student | null>(null);
  const [viewingInvoices, setViewingInvoices] = useState<Student | null>(null);
  const [viewingLibrary, setViewingLibrary] = useState<Student | null>(null);
  const [assigningRoute, setAssigningRoute] = useState<Student | null>(null);
  const [allocatingRoom, setAllocatingRoom] = useState<Student | null>(null);
  const [viewingDocuments, setViewingDocuments] = useState<Student | null>(null);
  const [viewingProfile, setViewingProfile] = useState<Student | null>(null);

  const hasFilter = Boolean(q) || Boolean(statusFilter);
  const { data, isPending, isError, isFetching, refetch } = useQuery({
    queryKey: [...STUDENTS_QUERY_KEY, { page, pageSize, q, statusFilter }],
    queryFn: () =>
      hasFilter
        ? searchStudents({ page: page - 1, size: pageSize, q: q || undefined, status: statusFilter })
        : fetchStudents({ page: page - 1, size: pageSize }),
    placeholderData: keepPreviousData,
  });

  // Used to resolve a student's sectionId to a readable "Class · Section" label.
  const classesQuery = useQuery({ queryKey: CLASSES_QUERY_KEY, queryFn: fetchClasses });
  const sectionLookup = useMemo(
    () => buildSectionLookup(classesQuery.data),
    [classesQuery.data],
  );

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: StudentStatus; name: string }) =>
      changeStudentStatus(id, status),
    onSuccess: (_result, variables) => {
      message.success(
        variables.status === 'INACTIVE'
          ? `${variables.name} deactivated`
          : `${variables.name} reactivated`,
      );
      void queryClient.invalidateQueries({ queryKey: STUDENTS_QUERY_KEY });
    },
    onError: () => {
      message.error('Could not change the student status. Please try again.');
    },
  });

  const students = data?.content ?? [];
  const total = data?.page.totalElements ?? 0;

  const columns: ColumnsType<Student> = [
    {
      title: 'Photo',
      key: 'photo',
      width: 56,
      render: (_value, record) => (
        <Avatar src={record.photoUrl ? studentPhotoUrl(record.id) : undefined} icon={<UserOutlined />} />
      ),
    },
    {
      title: 'Full name',
      dataIndex: 'fullName',
      key: 'fullName',
      render: (value: string, record) => (
        <a onClick={() => setViewingProfile(record)}>
          <Text strong>{value}</Text>
        </a>
      ),
    },
    {
      title: 'Admission number',
      dataIndex: 'admissionNumber',
      key: 'admissionNumber',
    },
    {
      title: 'Roll number',
      dataIndex: 'rollNumber',
      key: 'rollNumber',
      render: (value: string | null) => value || <Text type="secondary">—</Text>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: string) => (
        <Tag color={STATUS_COLOR[status] ?? 'default'} style={{ marginInlineEnd: 0 }}>
          {status}
        </Tag>
      ),
    },
    {
      title: 'Section',
      dataIndex: 'sectionId',
      key: 'section',
      render: (sectionId: string | null) => {
        const info = sectionId ? sectionLookup.get(sectionId) : undefined;
        if (info) {
          return `${info.className} · ${info.sectionName}`;
        }
        return <Text type="secondary">Unassigned</Text>;
      },
    },
    {
      title: 'Parent / guardian',
      key: 'guardian',
      render: (_value, record) => (
        <Space direction="vertical" size={0}>
          <Text>{record.guardianName || <Text type="secondary">—</Text>}</Text>
          {record.guardianPhone && (
            <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
              {record.guardianPhone}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: 'Admission date',
      dataIndex: 'admissionDate',
      key: 'admissionDate',
      render: (value: string | null) => value || <Text type="secondary">—</Text>,
    },
  ];

  {
    columns.push({
      title: 'Actions',
      key: 'actions',
      width: canManageStudents ? 320 : 180,
      render: (_value, record) => {
        const pending = statusMutation.isPending && statusMutation.variables?.id === record.id;

        const viewButton = (
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => setViewingProfile(record)}
            style={{ paddingInline: 0 }}
          >
            View
          </Button>
        );
        const documentsButton = (
          <Button
            type="link"
            size="small"
            icon={<FolderOutlined />}
            onClick={() => setViewingDocuments(record)}
            style={{ paddingInline: 0 }}
          >
            Documents
          </Button>
        );
        const printButton = (
          <Button
            type="link"
            size="small"
            icon={<PrinterOutlined />}
            onClick={() => {
              setViewingProfile(record);
              window.setTimeout(() => window.print(), 300);
            }}
            style={{ paddingInline: 0 }}
          >
            Print
          </Button>
        );

        if (!canManageStudents) {
          return (
            <Space size="small" wrap>
              {viewButton}
              {canViewLibrary && (
                <Button
                  type="link"
                  size="small"
                  icon={<BookOutlined />}
                  onClick={() => setViewingLibrary(record)}
                  style={{ paddingInline: 0 }}
                >
                  Library
                </Button>
              )}
            </Space>
          );
        }

        const statusItems: MenuProps['items'] = STATUS_OPTIONS.filter((o) => o.value !== record.status).map(
          (o) => ({ key: o.value, label: o.label }),
        );

        const moreItems: MenuProps['items'] = [
          { key: 'assign-section', icon: <ApartmentOutlined />, label: 'Assign section' },
          { key: 'transport', icon: <CarOutlined />, label: 'Transport' },
          { key: 'hostel', icon: <HomeOutlined />, label: 'Hostel' },
          { key: 'invoices', icon: <FileTextOutlined />, label: 'Invoices' },
          { key: 'library', icon: <BookOutlined />, label: 'Library' },
        ];

        return (
          <Space size="small" wrap>
            {viewButton}
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => setEditing(record)}
              style={{ paddingInline: 0 }}
            >
              Edit
            </Button>
            {documentsButton}
            {printButton}
            <Dropdown
              menu={{
                items: moreItems,
                onClick: ({ key }) => {
                  if (key === 'assign-section') setAssigning(record);
                  if (key === 'transport') setAssigningRoute(record);
                  if (key === 'hostel') setAllocatingRoom(record);
                  if (key === 'invoices') setViewingInvoices(record);
                  if (key === 'library') setViewingLibrary(record);
                },
              }}
            >
              <Button type="link" size="small" icon={<MoreOutlined />} style={{ paddingInline: 0 }}>
                More
              </Button>
            </Dropdown>
            <Dropdown
              menu={{
                items: statusItems,
                onClick: ({ key }) =>
                  modal.confirm({
                    title: `Change status to "${STATUS_OPTIONS.find((o) => o.value === key)?.label}"?`,
                    content:
                      key === 'ACTIVE'
                        ? 'The student will be marked ACTIVE again.'
                        : 'The student stays in the records — no data is deleted.',
                    okText: 'Confirm',
                    onOk: () => statusMutation.mutate({ id: record.id, status: key as StudentStatus, name: record.fullName }),
                  }),
              }}
            >
              <Button type="link" size="small" loading={pending} style={{ paddingInline: 0 }}>
                Status
              </Button>
            </Dropdown>
          </Space>
        );
      },
    });
  }

  return (
    <div style={{ maxWidth: 1200, width: '100%', margin: '0 auto' }}>
      <header
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: token.marginSM,
          marginBottom: token.marginLG,
        }}
      >
        <div>
          <Title level={2} style={{ margin: 0 }}>
            Students
          </Title>
          <Text type="secondary">Everyone enrolled at your school.</Text>
        </div>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              void refetch();
            }}
            loading={isFetching && !isPending}
          >
            Refresh
          </Button>
          {canManageStudents && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddOpen(true)}>
              Add student
            </Button>
          )}
        </Space>
      </header>

      <Card size="small" style={{ marginBottom: token.marginMD }}>
        <Space wrap size="middle">
          <Input.Search
            placeholder="Search name, admission #, roll #, parent, phone"
            allowClear
            style={{ width: 280 }}
            onSearch={(value) => {
              setQ(value);
              setPage(1);
            }}
          />
          <Select
            placeholder="Status"
            allowClear
            style={{ width: 160 }}
            options={STATUS_OPTIONS}
            value={statusFilter}
            onChange={(value) => {
              setStatusFilter(value);
              setPage(1);
            }}
          />
        </Space>
      </Card>

      <Card
        styles={{ body: { padding: token.paddingLG } }}
        style={{ boxShadow: token.boxShadowTertiary }}
      >
        {isError ? (
          <Alert
            type="warning"
            showIcon
            message="Couldn't load students"
            description="There was a problem reaching the server."
            action={
              <Button size="small" onClick={() => void refetch()}>
                Try again
              </Button>
            }
          />
        ) : isPending ? (
          <Skeleton active paragraph={{ rows: 6 }} />
        ) : (
          <Table<Student>
            rowKey="id"
            columns={columns}
            dataSource={students}
            loading={isFetching}
            scroll={{ x: 'max-content' }}
            locale={{
              emptyText: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="No students yet — add your first student"
                />
              ),
            }}
            pagination={{
              current: page,
              pageSize,
              total,
              showSizeChanger: true,
              pageSizeOptions: [10, 20, 50, 100],
              showTotal: (count) => `${count} student${count === 1 ? '' : 's'}`,
              onChange: (nextPage, nextSize) => {
                setPage(nextSize === pageSize ? nextPage : 1);
                setPageSize(nextSize);
              },
            }}
          />
        )}
      </Card>

      {canManageStudents && (
        <>
          <AddStudentModal open={addOpen} onClose={() => setAddOpen(false)} />
          <EditStudentModal student={editing} onClose={() => setEditing(null)} />
          <AssignSectionModal student={assigning} onClose={() => setAssigning(null)} />
          <AssignTransportRouteModal student={assigningRoute} onClose={() => setAssigningRoute(null)} />
          <AllocateHostelRoomModal student={allocatingRoom} onClose={() => setAllocatingRoom(null)} />
          <StudentInvoicesModal
            student={viewingInvoices}
            onClose={() => setViewingInvoices(null)}
          />
        </>
      )}

      {canViewLibrary && (
        <StudentLibraryModal student={viewingLibrary} onClose={() => setViewingLibrary(null)} />
      )}

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
