import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Card,
  DatePicker,
  Empty,
  Input,
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
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import {
  fetchAssignableStaff,
  fetchEnquiries,
  fetchEnquirySources,
  type Enquiry,
  type EnquiryStatus,
} from '../../api/enquiries';
import { fetchClasses } from '../../api/classes';
import { useAuthStore } from '../../store/authStore';
import { hasPermission } from '../../lib/roles';
import { ASSIGNABLE_STAFF_KEY, ENQUIRIES_KEY, ENQUIRY_SOURCES_KEY } from './queryKeys';
import { CLASSES_QUERY_KEY } from '../classes/queryKeys';
import { ENQUIRY_STATUS_COLOR, ENQUIRY_STATUS_OPTIONS, enquiryStatusLabel } from './status';
import AddEnquiryModal from './AddEnquiryModal';
import EditEnquiryModal from './EditEnquiryModal';
import EnquiryDetailModal from './EnquiryDetailModal';

const { Title, Text } = Typography;
const DEFAULT_PAGE_SIZE = 20;

function EnquiriesPage() {
  const { token } = theme.useToken();
  const permissions = useAuthStore((state) => state.user?.permissions);
  const canView = hasPermission(permissions, 'ENQUIRY_VIEW');
  const canCreate = hasPermission(permissions, 'ENQUIRY_CREATE');
  const canEdit = hasPermission(permissions, 'ENQUIRY_EDIT');
  const canFollowUp = hasPermission(permissions, 'ENQUIRY_FOLLOWUP');
  const canConvert = hasPermission(permissions, 'ENQUIRY_CONVERT');
  const canArchive = hasPermission(permissions, 'ENQUIRY_DELETE');

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<EnquiryStatus | undefined>();
  const [assignedStaffUserId, setAssignedStaffUserId] = useState<string | undefined>();
  const [dateRange, setDateRange] = useState<[string, string] | undefined>();

  // Source/class are deep-linkable from the Front Office dashboard's breakdown rows
  // (e.g. `?sourceId=...`), so they live in the URL rather than local-only state.
  const [searchParams, setSearchParams] = useSearchParams();
  const sourceId = searchParams.get('sourceId') ?? undefined;
  const classId = searchParams.get('classId') ?? undefined;

  const setSourceId = (value: string | undefined) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set('sourceId', value);
      else next.delete('sourceId');
      return next;
    });
  };
  const setClassId = (value: string | undefined) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set('classId', value);
      else next.delete('classId');
      return next;
    });
  };

  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Enquiry | null>(null);
  const [viewing, setViewing] = useState<Enquiry | null>(null);

  const filter = {
    q: q || undefined,
    status,
    sourceId,
    classId,
    assignedStaffUserId,
    from: dateRange?.[0],
    to: dateRange?.[1],
    page: page - 1,
    size: pageSize,
  };

  const enquiriesQuery = useQuery({
    queryKey: [...ENQUIRIES_KEY, filter],
    queryFn: () => fetchEnquiries(filter),
    enabled: canView,
    placeholderData: keepPreviousData,
  });
  const sourcesQuery = useQuery({ queryKey: ENQUIRY_SOURCES_KEY, queryFn: fetchEnquirySources, enabled: canView });
  const staffQuery = useQuery({ queryKey: ASSIGNABLE_STAFF_KEY, queryFn: fetchAssignableStaff, enabled: canView });
  const classesQuery = useQuery({ queryKey: CLASSES_QUERY_KEY, queryFn: fetchClasses, enabled: canView });

  if (!canView) {
    return <Result status="403" title="Not available" subTitle="You don't have permission to view enquiries." />;
  }

  const enquiries = enquiriesQuery.data?.content ?? [];
  const total = enquiriesQuery.data?.page.totalElements ?? 0;

  const columns: ColumnsType<Enquiry> = [
    {
      title: 'Enquiry #',
      dataIndex: 'enquiryNumber',
      key: 'enquiryNumber',
      render: (value: string, record) => (
        <a onClick={() => setViewing(record)}>
          <Text strong>{value}</Text>
        </a>
      ),
    },
    {
      title: 'Applicant',
      key: 'applicant',
      render: (_value, record) => (
        <Space direction="vertical" size={0}>
          <Text>{record.applicantName}</Text>
          {record.guardianName && (
            <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
              {record.guardianName}
            </Text>
          )}
        </Space>
      ),
    },
    { title: 'Phone', dataIndex: 'phone', key: 'phone', render: (v: string | null) => v || <Text type="secondary">—</Text> },
    {
      title: 'Class',
      dataIndex: 'className',
      key: 'className',
      render: (v: string | null) => v || <Text type="secondary">Not specified</Text>,
    },
    {
      title: 'Source',
      dataIndex: 'sourceName',
      key: 'sourceName',
      render: (v: string | null) => v || <Text type="secondary">Not specified</Text>,
    },
    {
      title: 'Assigned to',
      dataIndex: 'assignedStaffName',
      key: 'assignedStaffName',
      render: (v: string | null) => v || <Text type="secondary">Unassigned</Text>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (value: EnquiryStatus) => <Tag color={ENQUIRY_STATUS_COLOR[value]}>{enquiryStatusLabel(value)}</Tag>,
    },
    { title: 'Enquiry date', dataIndex: 'enquiryDate', key: 'enquiryDate', width: 120 },
    {
      title: 'Actions',
      key: 'actions',
      width: 140,
      render: (_value, record) => (
        <Space size="small" wrap>
          <Button type="link" size="small" style={{ paddingInline: 0 }} onClick={() => setViewing(record)}>
            View
          </Button>
          {canEdit && !record.archived && (
            <Button type="link" size="small" style={{ paddingInline: 0 }} onClick={() => setEditing(record)}>
              Edit
            </Button>
          )}
        </Space>
      ),
    },
  ];

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
            Admission Enquiries
          </Title>
          <Text type="secondary">Leads and applicants, from first contact through to admission.</Text>
        </div>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => void enquiriesQuery.refetch()}
            loading={enquiriesQuery.isFetching && !enquiriesQuery.isPending}
          >
            Refresh
          </Button>
          {canCreate && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddOpen(true)}>
              New enquiry
            </Button>
          )}
        </Space>
      </header>

      <Card size="small" style={{ marginBottom: token.marginMD }}>
        <Space wrap size="middle">
          <Input.Search
            placeholder="Search name, phone, enquiry #"
            allowClear
            style={{ width: 240 }}
            onSearch={(value) => {
              setQ(value);
              setPage(1);
            }}
          />
          <Select
            placeholder="Status"
            allowClear
            style={{ width: 140 }}
            options={ENQUIRY_STATUS_OPTIONS}
            value={status}
            onChange={(v) => {
              setStatus(v);
              setPage(1);
            }}
          />
          <Select
            placeholder="Source"
            allowClear
            style={{ width: 160 }}
            loading={sourcesQuery.isLoading}
            options={(sourcesQuery.data ?? []).map((s) => ({ value: s.id, label: s.name }))}
            value={sourceId}
            onChange={(v) => {
              setSourceId(v);
              setPage(1);
            }}
          />
          <Select
            placeholder="Class"
            allowClear
            style={{ width: 160 }}
            loading={classesQuery.isLoading}
            options={(classesQuery.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
            value={classId}
            onChange={(v) => {
              setClassId(v);
              setPage(1);
            }}
          />
          <Select
            placeholder="Assigned staff"
            allowClear
            showSearch
            optionFilterProp="label"
            style={{ width: 200 }}
            loading={staffQuery.isLoading}
            options={(staffQuery.data ?? []).map((s) => ({ value: s.id, label: s.fullName }))}
            value={assignedStaffUserId}
            onChange={(v) => {
              setAssignedStaffUserId(v);
              setPage(1);
            }}
          />
          <DatePicker.RangePicker
            onChange={(dates) => {
              setDateRange(
                dates && dates[0] && dates[1]
                  ? [dates[0].format('YYYY-MM-DD'), dates[1].format('YYYY-MM-DD')]
                  : undefined,
              );
              setPage(1);
            }}
          />
        </Space>
      </Card>

      <Card styles={{ body: { padding: token.paddingLG } }} style={{ boxShadow: token.boxShadowTertiary }}>
        {enquiriesQuery.isError ? (
          <Alert
            type="warning"
            showIcon
            message="Couldn't load enquiries"
            description="There was a problem reaching the server."
            action={
              <Button size="small" onClick={() => void enquiriesQuery.refetch()}>
                Try again
              </Button>
            }
          />
        ) : enquiriesQuery.isPending ? (
          <Skeleton active paragraph={{ rows: 6 }} />
        ) : (
          <Table<Enquiry>
            rowKey="id"
            columns={columns}
            dataSource={enquiries}
            loading={enquiriesQuery.isFetching}
            scroll={{ x: 'max-content' }}
            locale={{
              emptyText: (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No enquiries yet — add your first one" />
              ),
            }}
            pagination={{
              current: page,
              pageSize,
              total,
              showSizeChanger: true,
              pageSizeOptions: [10, 20, 50, 100],
              showTotal: (count) => `${count} enquir${count === 1 ? 'y' : 'ies'}`,
              onChange: (nextPage, nextSize) => {
                setPage(nextSize === pageSize ? nextPage : 1);
                setPageSize(nextSize);
              },
            }}
          />
        )}
      </Card>

      {canCreate && <AddEnquiryModal open={addOpen} onClose={() => setAddOpen(false)} />}
      {canEdit && <EditEnquiryModal enquiry={editing} onClose={() => setEditing(null)} />}
      <EnquiryDetailModal
        enquiry={viewing}
        onClose={() => setViewing(null)}
        onEdit={(enquiry) => {
          setViewing(null);
          setEditing(enquiry);
        }}
        canEdit={canEdit}
        canFollowUp={canFollowUp}
        canConvert={canConvert}
        canArchive={canArchive}
      />
    </div>
  );
}

export default EnquiriesPage;
