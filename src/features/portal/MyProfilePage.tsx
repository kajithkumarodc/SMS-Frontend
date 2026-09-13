import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  App,
  Button,
  Card,
  DatePicker,
  Descriptions,
  Empty,
  Form,
  Input,
  List,
  Result,
  Skeleton,
  Space,
  Table,
  Tag,
  Typography,
  theme,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import {
  createLeaveRequest,
  fetchOwnLeaveRequests,
  fetchOwnStaffProfile,
  NoLinkedStaffProfileError,
  type LeaveRequest,
} from '../../api/staff';
import { fetchOwnPayroll, type PayrollRecord } from '../../api/payroll';
import { useAuthStore } from '../../store/authStore';
import { hasAnyRole, ROLE } from '../../lib/roles';
import {
  LEAVE_REQUESTS_KEY,
  OWN_LEAVE_REQUESTS_KEY,
  OWN_PAYROLL_KEY,
  OWN_STAFF_PROFILE_KEY,
} from '../staff/queryKeys';
import { LEAVE_STATUS_TAG_COLOR, PAYROLL_STATUS_TAG_COLOR, STAFF_STATUS_TAG_COLOR, statusLabel } from '../staff/status';
import { formatAmount, formatDate, formatMonthYear } from '../staff/format';

const { Title, Text } = Typography;

const leaveSchema = z
  .object({
    leaveType: z.string().trim().min(1, 'Leave type is required').max(50, 'Keep this under 50 characters'),
    startDate: z.string().min(1, 'Pick a start date'),
    endDate: z.string().min(1, 'Pick an end date'),
    reason: z.string().trim().max(1000, 'Keep this under 1000 characters').optional(),
  })
  .refine((values) => !values.startDate || !values.endDate || values.endDate >= values.startDate, {
    message: 'End date must not be before the start date',
    path: ['endDate'],
  });

type LeaveFormValues = z.infer<typeof leaveSchema>;

const EMPTY_LEAVE: LeaveFormValues = { leaveType: '', startDate: '', endDate: '', reason: '' };

function RequestLeaveCard({ staffProfileId }: { staffProfileId: string }) {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const queryClient = useQueryClient();

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<LeaveFormValues>({
    resolver: zodResolver(leaveSchema),
    defaultValues: EMPTY_LEAVE,
    mode: 'onTouched',
  });

  const mutation = useMutation({
    mutationFn: (values: LeaveFormValues) =>
      createLeaveRequest(staffProfileId, {
        leaveType: values.leaveType.trim(),
        startDate: values.startDate,
        endDate: values.endDate,
        reason: values.reason?.trim() ? values.reason.trim() : null,
      }),
    onSuccess: () => {
      message.success('Leave request submitted');
      void queryClient.invalidateQueries({ queryKey: OWN_LEAVE_REQUESTS_KEY });
      void queryClient.invalidateQueries({ queryKey: LEAVE_REQUESTS_KEY });
      reset(EMPTY_LEAVE);
    },
    onError: () => {
      message.error('Could not submit the leave request. Please try again.');
    },
  });

  const submit = handleSubmit((values) => mutation.mutate(values));

  return (
    <Card title="Request leave" styles={{ body: { padding: token.paddingLG } }} style={{ boxShadow: token.boxShadowTertiary }}>
      <Form layout="vertical" requiredMark="optional" onFinish={submit}>
        <Controller
          control={control}
          name="leaveType"
          render={({ field }) => (
            <Form.Item
              label="Leave type"
              required
              validateStatus={errors.leaveType ? 'error' : undefined}
              help={errors.leaveType?.message}
            >
              <Input {...field} data-testid="leave-type-input" placeholder="e.g. Sick, Casual" autoComplete="off" />
            </Form.Item>
          )}
        />

        <Space size="middle" style={{ width: '100%' }} styles={{ item: { flex: 1 } }}>
          <Controller
            control={control}
            name="startDate"
            render={({ field }) => (
              <Form.Item
                label="Start date"
                required
                validateStatus={errors.startDate ? 'error' : undefined}
                help={errors.startDate?.message}
                style={{ flex: 1 }}
              >
                <DatePicker
                  style={{ width: '100%' }}
                  value={field.value ? dayjs(field.value) : null}
                  onChange={(d) => field.onChange(d ? d.format('YYYY-MM-DD') : '')}
                />
              </Form.Item>
            )}
          />

          <Controller
            control={control}
            name="endDate"
            render={({ field }) => (
              <Form.Item
                label="End date"
                required
                validateStatus={errors.endDate ? 'error' : undefined}
                help={errors.endDate?.message}
                style={{ flex: 1 }}
              >
                <DatePicker
                  style={{ width: '100%' }}
                  value={field.value ? dayjs(field.value) : null}
                  onChange={(d) => field.onChange(d ? d.format('YYYY-MM-DD') : '')}
                />
              </Form.Item>
            )}
          />
        </Space>

        <Controller
          control={control}
          name="reason"
          render={({ field }) => (
            <Form.Item label="Reason" help="Optional">
              <Input.TextArea {...field} rows={2} placeholder="e.g. Family event" />
            </Form.Item>
          )}
        />

        <Button type="primary" htmlType="submit" loading={mutation.isPending}>
          Submit leave request
        </Button>
      </Form>
    </Card>
  );
}

function LeaveHistoryCard() {
  const { token } = theme.useToken();
  const query = useQuery({ queryKey: OWN_LEAVE_REQUESTS_KEY, queryFn: fetchOwnLeaveRequests });
  const requests = query.data ?? [];

  return (
    <Card title="My leave requests" styles={{ body: { padding: token.paddingLG } }} style={{ boxShadow: token.boxShadowTertiary }}>
      {query.isError ? (
        <Alert type="warning" showIcon message="Couldn't load your leave requests" />
      ) : query.isPending ? (
        <Skeleton active paragraph={{ rows: 3 }} />
      ) : requests.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No leave requests yet" />
      ) : (
        <List
          size="small"
          dataSource={requests}
          rowKey={(request: LeaveRequest) => request.id}
          renderItem={(request) => (
            <List.Item>
              <List.Item.Meta
                title={
                  <Space>
                    <Text strong>{request.leaveType}</Text>
                    <Tag color={LEAVE_STATUS_TAG_COLOR[request.status]} style={{ marginInlineEnd: 0 }}>
                      {statusLabel(request.status)}
                    </Tag>
                  </Space>
                }
                description={
                  <>
                    {formatDate(request.startDate)} – {formatDate(request.endDate)}
                    {request.reason ? ` · ${request.reason}` : ''}
                  </>
                }
              />
            </List.Item>
          )}
        />
      )}
    </Card>
  );
}

function PayrollHistoryCard() {
  const { token } = theme.useToken();
  const query = useQuery({ queryKey: OWN_PAYROLL_KEY, queryFn: fetchOwnPayroll });
  const records = query.data ?? [];

  const columns: ColumnsType<PayrollRecord> = [
    {
      title: 'Month',
      key: 'month',
      render: (_value, record) => formatMonthYear(record.month, record.year),
    },
    {
      title: 'Base salary',
      dataIndex: 'baseSalary',
      key: 'baseSalary',
      align: 'right',
      render: (value: number) => formatAmount(value),
    },
    {
      title: 'Deductions',
      dataIndex: 'deductions',
      key: 'deductions',
      align: 'right',
      render: (value: number) => formatAmount(value),
    },
    {
      title: 'Net pay',
      dataIndex: 'netPay',
      key: 'netPay',
      align: 'right',
      render: (value: number) => <Text strong>{formatAmount(value)}</Text>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: PayrollRecord['status']) => (
        <Tag color={PAYROLL_STATUS_TAG_COLOR[status]} style={{ marginInlineEnd: 0 }}>
          {statusLabel(status)}
        </Tag>
      ),
    },
  ];

  return (
    <Card title="My payroll" styles={{ body: { padding: token.paddingLG } }} style={{ boxShadow: token.boxShadowTertiary }}>
      {query.isError ? (
        <Alert type="warning" showIcon message="Couldn't load your payroll history" />
      ) : query.isPending ? (
        <Skeleton active paragraph={{ rows: 3 }} />
      ) : (
        <Table<PayrollRecord>
          rowKey="id"
          columns={columns}
          dataSource={records}
          pagination={false}
          size="small"
          scroll={{ x: 'max-content' }}
          locale={{
            emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No payroll records yet" />,
          }}
        />
      )}
    </Card>
  );
}

function MyProfilePage() {
  const { token } = theme.useToken();
  const roles = useAuthStore((state) => state.user?.roles);
  const canView = hasAnyRole(roles, [ROLE.TEACHER, ROLE.SCHOOL_ADMIN]);

  const profileQuery = useQuery({
    queryKey: OWN_STAFF_PROFILE_KEY,
    queryFn: fetchOwnStaffProfile,
    enabled: canView,
    retry: (failureCount, err) => !(err instanceof NoLinkedStaffProfileError) && failureCount < 1,
  });

  if (!canView) {
    return <Result status="403" title="Not available" subTitle="Only staff accounts can view this page." />;
  }

  const notLinked = profileQuery.isError && profileQuery.error instanceof NoLinkedStaffProfileError;
  const profile = profileQuery.data;

  return (
    <div style={{ maxWidth: 760, width: '100%', margin: '0 auto' }}>
      <header style={{ marginBottom: token.marginLG }}>
        <Title level={2} style={{ margin: 0 }}>
          My profile
        </Title>
        <Text type="secondary">Your staff record, leave requests and payroll.</Text>
      </header>

      {notLinked ? (
        <Result
          status="info"
          title="No staff profile linked yet"
          subTitle="Your account isn't set up as staff yet. Please contact your school administrator."
        />
      ) : profileQuery.isError ? (
        <Alert
          type="warning"
          showIcon
          message="Couldn't load your staff profile"
          description="There was a problem reaching the server."
          action={
            <Button size="small" onClick={() => void profileQuery.refetch()}>
              Try again
            </Button>
          }
        />
      ) : profileQuery.isPending || !profile ? (
        <Skeleton active paragraph={{ rows: 4 }} />
      ) : (
        <Space direction="vertical" size={token.marginLG} style={{ width: '100%' }}>
          <Card styles={{ body: { padding: token.paddingLG } }} style={{ boxShadow: token.boxShadowTertiary }}>
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="Employee code">{profile.employeeCode}</Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={STAFF_STATUS_TAG_COLOR[profile.status]} style={{ marginInlineEnd: 0 }}>
                  {statusLabel(profile.status)}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Department">{profile.department || '—'}</Descriptions.Item>
              <Descriptions.Item label="Designation">{profile.designation || '—'}</Descriptions.Item>
              <Descriptions.Item label="Date of joining">{formatDate(profile.dateOfJoining)}</Descriptions.Item>
              <Descriptions.Item label="Salary">{formatAmount(profile.salaryAmount)}</Descriptions.Item>
            </Descriptions>
          </Card>

          <RequestLeaveCard staffProfileId={profile.id} />
          <LeaveHistoryCard />
          <PayrollHistoryCard />
        </Space>
      )}
    </div>
  );
}

export default MyProfilePage;
