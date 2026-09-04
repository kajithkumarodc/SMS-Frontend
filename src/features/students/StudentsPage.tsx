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
  Button,
  Card,
  Empty,
  Popconfirm,
  Skeleton,
  Space,
  Table,
  Tag,
  Typography,
  theme,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  ApartmentOutlined,
  EditOutlined,
  FileTextOutlined,
  PlusOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import {
  changeStudentStatus,
  fetchStudents,
  type Student,
  type StudentStatus,
} from '../../api/students';
import { fetchClasses } from '../../api/classes';
import { useAuthStore } from '../../store/authStore';
import { hasRole, ROLE } from '../../lib/roles';
import { CLASSES_QUERY_KEY } from '../classes/queryKeys';
import { buildSectionLookup } from '../classes/sectionLookup';
import { STUDENTS_QUERY_KEY } from './queryKeys';
import AddStudentModal from './AddStudentModal';
import EditStudentModal from './EditStudentModal';
import AssignSectionModal from './AssignSectionModal';
import StudentInvoicesModal from '../fees/StudentInvoicesModal';

const { Title, Text } = Typography;

const DEFAULT_PAGE_SIZE = 20;

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: 'success',
  INACTIVE: 'default',
};

function StudentsPage() {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const roles = useAuthStore((state) => state.user?.roles);
  const canManageStudents = hasRole(roles, ROLE.SCHOOL_ADMIN);

  const [page, setPage] = useState(1); // 1-based for the Table; the API is 0-based
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [assigning, setAssigning] = useState<Student | null>(null);
  const [viewingInvoices, setViewingInvoices] = useState<Student | null>(null);

  const { data, isPending, isError, isFetching, refetch } = useQuery({
    queryKey: [...STUDENTS_QUERY_KEY, { page, pageSize }],
    queryFn: () => fetchStudents({ page: page - 1, size: pageSize }),
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
      title: 'Full name',
      dataIndex: 'fullName',
      key: 'fullName',
      render: (value: string) => <Text strong>{value}</Text>,
    },
    {
      title: 'Admission number',
      dataIndex: 'admissionNumber',
      key: 'admissionNumber',
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
      title: 'Guardian name',
      dataIndex: 'guardianName',
      key: 'guardianName',
      render: (value: string | null) => value || <Text type="secondary">—</Text>,
    },
  ];

  if (canManageStudents) {
    columns.push({
      title: 'Actions',
      key: 'actions',
      width: 380,
      render: (_value, record) => {
        const deactivating = record.status === 'ACTIVE';
        const nextStatus: StudentStatus = deactivating ? 'INACTIVE' : 'ACTIVE';
        const pending =
          statusMutation.isPending && statusMutation.variables?.id === record.id;

        return (
          <Space size="small" wrap>
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => setEditing(record)}
              style={{ paddingInline: 0 }}
            >
              Edit
            </Button>
            <Button
              type="link"
              size="small"
              icon={<ApartmentOutlined />}
              onClick={() => setAssigning(record)}
              style={{ paddingInline: 0 }}
            >
              Assign section
            </Button>
            <Button
              type="link"
              size="small"
              icon={<FileTextOutlined />}
              onClick={() => setViewingInvoices(record)}
              style={{ paddingInline: 0 }}
            >
              Invoices
            </Button>
            <Popconfirm
              title={deactivating ? 'Deactivate this student?' : 'Reactivate this student?'}
              description={
                deactivating
                  ? 'They stay in the records with an INACTIVE status.'
                  : 'They will be marked ACTIVE again.'
              }
              okText={deactivating ? 'Deactivate' : 'Reactivate'}
              cancelText="Cancel"
              okButtonProps={{ danger: deactivating }}
              onConfirm={() =>
                statusMutation.mutate({
                  id: record.id,
                  status: nextStatus,
                  name: record.fullName,
                })
              }
            >
              <Button type="link" size="small" danger={deactivating} loading={pending} style={{ paddingInline: 0 }}>
                {deactivating ? 'Deactivate' : 'Reactivate'}
              </Button>
            </Popconfirm>
          </Space>
        );
      },
    });
  }

  return (
    <div style={{ maxWidth: 1040, width: '100%', margin: '0 auto' }}>
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
          <StudentInvoicesModal
            student={viewingInvoices}
            onClose={() => setViewingInvoices(null)}
          />
        </>
      )}
    </div>
  );
}

export default StudentsPage;
