import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Card,
  Empty,
  Skeleton,
  Space,
  Table,
  Tag,
  Typography,
  theme,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { fetchStudents, type Student } from '../../api/students';
import { useAuthStore } from '../../store/authStore';
import { hasRole, ROLE } from '../../lib/roles';
import { STUDENTS_QUERY_KEY } from './queryKeys';
import AddStudentModal from './AddStudentModal';

const { Title, Text } = Typography;

const DEFAULT_PAGE_SIZE = 20;

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: 'success',
  INACTIVE: 'default',
};

function StudentsPage() {
  const { token } = theme.useToken();
  const roles = useAuthStore((state) => state.user?.roles);
  const canAddStudent = hasRole(roles, ROLE.SCHOOL_ADMIN);

  const [page, setPage] = useState(1); // 1-based for the Table; the API is 0-based
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [addOpen, setAddOpen] = useState(false);

  const { data, isPending, isError, isFetching, refetch } = useQuery({
    queryKey: [...STUDENTS_QUERY_KEY, { page, pageSize }],
    queryFn: () => fetchStudents({ page: page - 1, size: pageSize }),
    placeholderData: keepPreviousData,
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
      title: 'Guardian name',
      dataIndex: 'guardianName',
      key: 'guardianName',
      render: (value: string | null) => value || <Text type="secondary">—</Text>,
    },
  ];

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
          {canAddStudent && (
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

      {canAddStudent && <AddStudentModal open={addOpen} onClose={() => setAddOpen(false)} />}
    </div>
  );
}

export default StudentsPage;
