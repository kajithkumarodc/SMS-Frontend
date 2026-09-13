import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  App,
  Button,
  Card,
  Empty,
  Popconfirm,
  Result,
  Select,
  Skeleton,
  Space,
  Table,
  Tag,
  Typography,
  theme,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ReloadOutlined } from '@ant-design/icons';
import {
  decideLeaveRequest,
  fetchLeaveRequests,
  fetchStaffProfiles,
  type LeaveRequest,
  type LeaveRequestStatus,
} from '../../api/staff';
import { useAuthStore } from '../../store/authStore';
import { hasRole, ROLE } from '../../lib/roles';
import { LEAVE_REQUESTS_KEY, STAFF_PROFILES_KEY } from './queryKeys';
import { LEAVE_STATUS_TAG_COLOR, statusLabel } from './status';
import { formatDate } from './format';

const { Title, Text } = Typography;

const ALL = '__all__';

function LeaveRequestsPage() {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const roles = useAuthStore((state) => state.user?.roles);
  const canView = hasRole(roles, ROLE.SCHOOL_ADMIN);

  const [statusFilter, setStatusFilter] = useState<string>('PENDING');

  const filter = statusFilter === ALL ? {} : { status: statusFilter as LeaveRequestStatus };

  const requestsQuery = useQuery({
    queryKey: [...LEAVE_REQUESTS_KEY, filter],
    queryFn: () => fetchLeaveRequests(filter),
    enabled: canView,
  });

  // Leave requests only carry the staff member's user id -- resolve names via the staff directory.
  const staffQuery = useQuery({
    queryKey: STAFF_PROFILES_KEY,
    queryFn: fetchStaffProfiles,
    enabled: canView,
    staleTime: 30 * 1000,
  });

  const staffByUserId = useMemo(() => {
    const map = new Map<string, { fullName: string; employeeCode: string }>();
    for (const s of staffQuery.data ?? []) map.set(s.userId, s);
    return map;
  }, [staffQuery.data]);

  const decideMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'APPROVED' | 'REJECTED' }) =>
      decideLeaveRequest(id, status),
    onSuccess: (_result, variables) => {
      message.success(variables.status === 'APPROVED' ? 'Leave request approved' : 'Leave request rejected');
      void queryClient.invalidateQueries({ queryKey: LEAVE_REQUESTS_KEY });
    },
    onError: () => {
      message.error('Could not update the leave request. Please try again.');
    },
  });

  if (!canView) {
    return <Result status="403" title="Not available" subTitle="Only school admins can manage leave requests." />;
  }

  const requests = requestsQuery.data ?? [];

  const columns: ColumnsType<LeaveRequest> = [
    {
      title: 'Staff member',
      key: 'staff',
      render: (_value, record) => {
        const staff = staffByUserId.get(record.staffUserId);
        return staff ? (
          <Space direction="vertical" size={0}>
            <Text strong>{staff.fullName}</Text>
            <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
              {staff.employeeCode}
            </Text>
          </Space>
        ) : (
          <Text type="secondary">Unknown</Text>
        );
      },
    },
    {
      title: 'Type',
      dataIndex: 'leaveType',
      key: 'leaveType',
    },
    {
      title: 'Dates',
      key: 'dates',
      render: (_value, record) => `${formatDate(record.startDate)} – ${formatDate(record.endDate)}`,
    },
    {
      title: 'Reason',
      dataIndex: 'reason',
      key: 'reason',
      render: (value: string | null) => value || <Text type="secondary">—</Text>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (status: LeaveRequestStatus) => (
        <Tag color={LEAVE_STATUS_TAG_COLOR[status]} style={{ marginInlineEnd: 0 }}>
          {statusLabel(status)}
        </Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 180,
      render: (_value, record) =>
        record.status === 'PENDING' ? (
          <Space size="small" wrap>
            <Popconfirm
              title="Approve this leave request?"
              okText="Approve"
              onConfirm={() => decideMutation.mutate({ id: record.id, status: 'APPROVED' })}
            >
              <Button type="link" size="small" style={{ paddingInline: 0 }}>
                Approve
              </Button>
            </Popconfirm>
            <Popconfirm
              title="Reject this leave request?"
              okText="Reject"
              okButtonProps={{ danger: true }}
              onConfirm={() => decideMutation.mutate({ id: record.id, status: 'REJECTED' })}
            >
              <Button type="link" size="small" danger style={{ paddingInline: 0 }}>
                Reject
              </Button>
            </Popconfirm>
          </Space>
        ) : (
          <Text type="secondary">—</Text>
        ),
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
            Leave requests
          </Title>
          <Text type="secondary">Review and decide staff leave requests.</Text>
        </div>
        <Space wrap>
          <Select
            data-testid="leave-status-filter"
            value={statusFilter}
            onChange={setStatusFilter}
            style={{ width: 160 }}
            options={[
              { value: 'PENDING', label: 'Pending' },
              { value: 'APPROVED', label: 'Approved' },
              { value: 'REJECTED', label: 'Rejected' },
              { value: ALL, label: 'All' },
            ]}
          />
          <Button
            icon={<ReloadOutlined />}
            onClick={() => void requestsQuery.refetch()}
            loading={requestsQuery.isFetching && !requestsQuery.isPending}
          >
            Refresh
          </Button>
        </Space>
      </header>

      <Card
        styles={{ body: { padding: token.paddingLG } }}
        style={{ boxShadow: token.boxShadowTertiary }}
      >
        {requestsQuery.isError ? (
          <Alert
            type="warning"
            showIcon
            message="Couldn't load leave requests"
            description="There was a problem reaching the server."
            action={
              <Button size="small" onClick={() => void requestsQuery.refetch()}>
                Try again
              </Button>
            }
          />
        ) : requestsQuery.isPending ? (
          <Skeleton active paragraph={{ rows: 6 }} />
        ) : (
          <Table<LeaveRequest>
            rowKey="id"
            columns={columns}
            dataSource={requests}
            loading={decideMutation.isPending}
            pagination={false}
            scroll={{ x: 'max-content' }}
            locale={{
              emptyText: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={
                    statusFilter === 'PENDING' ? 'No pending leave requests' : 'No leave requests for this filter'
                  }
                />
              ),
            }}
          />
        )}
      </Card>
    </div>
  );
}

export default LeaveRequestsPage;
