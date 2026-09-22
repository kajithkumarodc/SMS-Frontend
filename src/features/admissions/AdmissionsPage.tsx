import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Alert, Button, Card, DatePicker, Empty, Input, Result, Select, Skeleton, Space, Table, Tag, Typography, theme } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ReloadOutlined } from '@ant-design/icons';
import { fetchAdmissionApplications, type AdmissionApplicationStatus, type AdmissionApplicationSummary } from '../../api/admissions';
import { useAuthStore } from '../../store/authStore';
import { hasPermission } from '../../lib/roles';
import { ADMISSION_APPLICATIONS_KEY } from './queryKeys';
import AdmissionDetailDrawer from './AdmissionDetailDrawer';

const { Title, Text } = Typography;
const DEFAULT_PAGE_SIZE = 20;

const STATUS_COLOR: Record<AdmissionApplicationStatus, string> = {
  SUBMITTED: 'blue',
  UNDER_REVIEW: 'gold',
  WAITLISTED: 'purple',
  APPROVED: 'green',
  REJECTED: 'red',
};

const STATUS_OPTIONS = (Object.keys(STATUS_COLOR) as AdmissionApplicationStatus[]).map((s) => ({ value: s, label: s }));

function AdmissionsPage() {
  const { token } = theme.useToken();
  const permissions = useAuthStore((state) => state.user?.permissions);
  const canView = hasPermission(permissions, 'ADMISSION_APPLICATION_VIEW');
  const canReview = hasPermission(permissions, 'ADMISSION_APPLICATION_REVIEW');
  const canApprove = hasPermission(permissions, 'ADMISSION_APPLICATION_APPROVE');
  const canReject = hasPermission(permissions, 'ADMISSION_APPLICATION_REJECT');
  const canWaitlist = hasPermission(permissions, 'ADMISSION_APPLICATION_WAITLIST');
  const canEditDocuments = hasPermission(permissions, 'ADMISSION_APPLICATION_EDIT');

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<AdmissionApplicationStatus | undefined>();
  const [dateRange, setDateRange] = useState<[string, string] | undefined>();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filter = {
    q: q || undefined,
    status,
    from: dateRange?.[0],
    to: dateRange?.[1],
    page: page - 1,
    size: pageSize,
  };

  const applicationsQuery = useQuery({
    queryKey: [...ADMISSION_APPLICATIONS_KEY, filter],
    queryFn: () => fetchAdmissionApplications(filter),
    enabled: canView,
    placeholderData: keepPreviousData,
  });

  if (!canView) {
    return <Result status="403" title="Not available" subTitle="You don't have permission to view admission applications." />;
  }

  const applications = applicationsQuery.data?.content ?? [];
  const total = applicationsQuery.data?.page.totalElements ?? 0;

  const columns: ColumnsType<AdmissionApplicationSummary> = [
    {
      title: 'Reference',
      dataIndex: 'applicationNumber',
      key: 'applicationNumber',
      render: (value: string, record) => (
        <a onClick={() => setSelectedId(record.id)}>
          <Text strong>{value}</Text>
        </a>
      ),
    },
    { title: 'Applicant', dataIndex: 'applicantName', key: 'applicantName' },
    { title: 'Applying for', dataIndex: 'applyingClassName', key: 'applyingClassName', render: (v: string | null) => v || <Text type="secondary">—</Text> },
    { title: 'Guardian', dataIndex: 'guardianName', key: 'guardianName', render: (v: string | null) => v || <Text type="secondary">—</Text> },
    { title: 'Phone', dataIndex: 'guardianPhone', key: 'guardianPhone', render: (v: string | null) => v || <Text type="secondary">—</Text> },
    { title: 'Cycle', dataIndex: 'admissionCycleName', key: 'admissionCycleName' },
    {
      title: 'Submitted',
      dataIndex: 'submittedAt',
      key: 'submittedAt',
      render: (v: string) => new Date(v).toLocaleDateString(),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (value: AdmissionApplicationStatus) => <Tag color={STATUS_COLOR[value]}>{value}</Tag>,
    },
    { title: 'Reviewer', dataIndex: 'reviewedByName', key: 'reviewedByName', render: (v: string | null) => v || <Text type="secondary">—</Text> },
  ];

  return (
    <div style={{ maxWidth: 1300, width: '100%', margin: '0 auto' }}>
      <header
        style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: token.marginSM, marginBottom: token.marginLG }}
      >
        <div>
          <Title level={2} style={{ margin: 0 }}>
            Online Admissions
          </Title>
          <Text type="secondary">Review, decide and convert applications submitted through the public admissions form.</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={() => void applicationsQuery.refetch()} loading={applicationsQuery.isFetching && !applicationsQuery.isPending}>
          Refresh
        </Button>
      </header>

      <Card size="small" style={{ marginBottom: token.marginMD }}>
        <Space wrap size="middle">
          <Input.Search
            placeholder="Search name, reference, guardian"
            allowClear
            style={{ width: 260 }}
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
            value={status}
            onChange={(v) => {
              setStatus(v);
              setPage(1);
            }}
          />
          <DatePicker.RangePicker
            onChange={(dates) => {
              setDateRange(dates && dates[0] && dates[1] ? [dates[0].format('YYYY-MM-DD'), dates[1].format('YYYY-MM-DD')] : undefined);
              setPage(1);
            }}
          />
        </Space>
      </Card>

      <Card styles={{ body: { padding: token.paddingLG } }} style={{ boxShadow: token.boxShadowTertiary }}>
        {applicationsQuery.isError ? (
          <Alert
            type="warning"
            showIcon
            message="Couldn't load applications"
            description="There was a problem reaching the server."
            action={
              <Button size="small" onClick={() => void applicationsQuery.refetch()}>
                Try again
              </Button>
            }
          />
        ) : applicationsQuery.isPending ? (
          <Skeleton active paragraph={{ rows: 6 }} />
        ) : (
          <Table<AdmissionApplicationSummary>
            rowKey="id"
            columns={columns}
            dataSource={applications}
            loading={applicationsQuery.isFetching}
            scroll={{ x: 'max-content' }}
            locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No applications yet" /> }}
            pagination={{
              current: page,
              pageSize,
              total,
              showSizeChanger: true,
              pageSizeOptions: [10, 20, 50, 100],
              showTotal: (count) => `${count} application${count === 1 ? '' : 's'}`,
              onChange: (nextPage, nextSize) => {
                setPage(nextSize === pageSize ? nextPage : 1);
                setPageSize(nextSize);
              },
            }}
          />
        )}
      </Card>

      <AdmissionDetailDrawer
        applicationId={selectedId}
        onClose={() => setSelectedId(null)}
        permissions={{ canReview, canApprove, canReject, canWaitlist, canEditDocuments }}
      />
    </div>
  );
}

export default AdmissionsPage;
