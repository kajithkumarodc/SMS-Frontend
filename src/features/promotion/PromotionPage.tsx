import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  App,
  Button,
  Card,
  Empty,
  Input,
  Popconfirm,
  Result,
  Select,
  Skeleton,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
  theme,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ReloadOutlined, SwapOutlined } from '@ant-design/icons';
import { fetchClasses } from '../../api/classes';
import { fetchSectionRoster } from '../../api/attendance';
import type { Student } from '../../api/students';
import {
  fetchAcademicYears,
  promoteStudents,
  type PromoteStudentsResult,
} from '../../api/academicYears';
import { buildSectionSelectOptions } from '../classes/sectionLookup';
import { useAuthStore } from '../../store/authStore';
import { hasPermission } from '../../lib/roles';
import PromotionHistoryTable from './PromotionHistoryTable';

const { Title, Text } = Typography;

function PromotionPage() {
  const { token } = theme.useToken();
  const permissions = useAuthStore((state) => state.user?.permissions);
  const canPromote = hasPermission(permissions, 'STUDENT_PROMOTE');

  if (!canPromote) {
    return (
      <Result
        status="403"
        title="Not available"
        subTitle="You don't have permission to promote students."
      />
    );
  }

  return (
    <div style={{ maxWidth: 1040, width: '100%', margin: '0 auto' }}>
      <Title level={2} style={{ marginTop: 0 }}>
        Student Promotion
      </Title>
      <Text type="secondary">Move students from one class/section to the next academic session.</Text>
      <div style={{ marginTop: token.marginLG }}>
        <Tabs
          defaultActiveKey="promote"
          items={[
            { key: 'promote', label: 'Promote students', children: <PromoteTab /> },
            { key: 'history', label: 'Promotion history', children: <PromotionHistoryTable /> },
          ]}
        />
      </div>
    </div>
  );
}

function PromoteTab() {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const queryClient = useQueryClient();

  const [targetYearId, setTargetYearId] = useState<string | undefined>();
  const [fromSectionId, setFromSectionId] = useState<string | undefined>();
  const [toSectionId, setToSectionId] = useState<string | undefined>();
  const [search, setSearch] = useState('');
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [result, setResult] = useState<PromoteStudentsResult | null>(null);

  const yearsQuery = useQuery({ queryKey: ['academic-years'], queryFn: fetchAcademicYears });
  const years = yearsQuery.data ?? [];

  const classesQuery = useQuery({ queryKey: ['classes'], queryFn: fetchClasses });
  const sectionOptions = buildSectionSelectOptions(classesQuery.data);
  const toSectionOptions = useMemo(
    () =>
      sectionOptions.map((group) => ({
        ...group,
        options: group.options.filter((o) => o.value !== fromSectionId),
      })),
    [sectionOptions, fromSectionId],
  );

  const rosterQuery = useQuery({
    queryKey: ['section-roster', fromSectionId],
    queryFn: () => fetchSectionRoster(fromSectionId as string),
    enabled: Boolean(fromSectionId),
  });
  const roster = useMemo(() => {
    const all = rosterQuery.data ?? [];
    const active = all.filter((s) => s.status === 'ACTIVE');
    if (!search.trim()) return active;
    const q = search.trim().toLowerCase();
    return active.filter(
      (s) => s.fullName.toLowerCase().includes(q) || s.admissionNumber.toLowerCase().includes(q),
    );
  }, [rosterQuery.data, search]);

  const resetSelection = () => {
    setSelectedStudentIds([]);
    setResult(null);
  };

  const mutation = useMutation({
    mutationFn: () => {
      if (!fromSectionId || !toSectionId) return Promise.reject(new Error('Pick both sections'));
      return promoteStudents({
        fromSectionId,
        toSectionId,
        targetAcademicYearId: targetYearId,
        studentIds: selectedStudentIds,
      });
    },
    onSuccess: (outcome) => {
      setResult(outcome);
      setSelectedStudentIds([]);
      void queryClient.invalidateQueries({ queryKey: ['students'] });
      void queryClient.invalidateQueries({ queryKey: ['section-roster', fromSectionId] });
      if (outcome.promotedCount > 0) {
        message.success(`Promoted ${outcome.promotedCount} of ${outcome.requestedCount} student(s)`);
      } else {
        message.warning('No students were promoted — see the results below.');
      }
    },
    onError: () => {
      message.error('Could not promote students. Please try again.');
    },
  });

  const sameSectionChosen = Boolean(fromSectionId && toSectionId && fromSectionId === toSectionId);
  const canSubmit = Boolean(fromSectionId && toSectionId && !sameSectionChosen && selectedStudentIds.length > 0);

  const columns: ColumnsType<Student> = [
    { title: 'Admission #', dataIndex: 'admissionNumber', key: 'admissionNumber', width: 140 },
    { title: 'Roll #', dataIndex: 'rollNumber', key: 'rollNumber', width: 100, render: (v) => v ?? '—' },
    { title: 'Name', dataIndex: 'fullName', key: 'fullName' },
  ];

  return (
    <Space direction="vertical" size={token.marginLG} style={{ width: '100%' }}>
      <Card style={{ boxShadow: token.boxShadowTertiary }}>
        <Space direction="vertical" size={token.margin} style={{ width: '100%' }}>
          <div style={{ display: 'flex', gap: token.margin, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 220px' }}>
              <Text type="secondary">Target academic session</Text>
              <Select
                style={{ width: '100%', marginTop: 4 }}
                placeholder="Defaults to the current session"
                allowClear
                loading={yearsQuery.isPending}
                options={years.map((y) => ({ value: y.id, label: y.name + (y.current ? ' (current)' : '') }))}
                value={targetYearId}
                onChange={setTargetYearId}
              />
            </div>
            <div style={{ flex: '1 1 220px' }}>
              <Text type="secondary">From section</Text>
              <Select
                style={{ width: '100%', marginTop: 4 }}
                placeholder="Select source section"
                options={sectionOptions}
                value={fromSectionId}
                onChange={(v) => {
                  setFromSectionId(v);
                  resetSelection();
                }}
              />
            </div>
            <div style={{ flex: '1 1 220px' }}>
              <Text type="secondary">To section</Text>
              <Select
                style={{ width: '100%', marginTop: 4 }}
                placeholder="Select destination section"
                options={toSectionOptions}
                value={toSectionId}
                onChange={(v) => {
                  setToSectionId(v);
                  setResult(null);
                }}
              />
            </div>
          </div>

          {sameSectionChosen && (
            <Alert type="warning" showIcon message="Source and destination section must be different" />
          )}
        </Space>
      </Card>

      {fromSectionId && (
        <Card
          style={{ boxShadow: token.boxShadowTertiary }}
          title={`Students in this section (${roster.length})`}
          extra={
            <Space>
              <Input.Search
                placeholder="Search name or admission #"
                allowClear
                style={{ width: 220 }}
                onChange={(e) => setSearch(e.target.value)}
              />
              <Button
                icon={<ReloadOutlined />}
                onClick={() => void rosterQuery.refetch()}
                loading={rosterQuery.isFetching && !rosterQuery.isPending}
              >
                Refresh
              </Button>
            </Space>
          }
        >
          {rosterQuery.isPending ? (
            <Skeleton active paragraph={{ rows: 4 }} />
          ) : (
            <Table<Student>
              rowKey="id"
              size="small"
              dataSource={roster}
              pagination={roster.length > 10 ? { pageSize: 10 } : false}
              rowSelection={{
                selectedRowKeys: selectedStudentIds,
                onChange: (keys) => setSelectedStudentIds(keys as string[]),
              }}
              columns={columns}
              locale={{
                emptyText: (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={
                      (rosterQuery.data ?? []).length === 0
                        ? 'No students in this section'
                        : 'No active students match your search'
                    }
                  />
                ),
              }}
            />
          )}

          <div style={{ marginTop: token.margin, display: 'flex', justifyContent: 'flex-end' }}>
            <Popconfirm
              title="Promote selected students"
              description={`Move ${selectedStudentIds.length} student(s) to the destination section${
                targetYearId ? '' : ' for the current session'
              }?`}
              okText="Promote"
              disabled={!canSubmit}
              onConfirm={() => mutation.mutate()}
            >
              <Button type="primary" icon={<SwapOutlined />} disabled={!canSubmit} loading={mutation.isPending}>
                Promote {selectedStudentIds.length > 0 ? selectedStudentIds.length : ''} student
                {selectedStudentIds.length === 1 ? '' : 's'}
              </Button>
            </Popconfirm>
          </div>
        </Card>
      )}

      {result && <PromotionResultCard result={result} />}
    </Space>
  );
}

function PromotionResultCard({ result }: { result: PromoteStudentsResult }) {
  const { token } = theme.useToken();

  const columns: ColumnsType<PromoteStudentsResult['results'][number]> = [
    { title: 'Student', dataIndex: 'studentName', key: 'studentName', render: (v) => v ?? 'Unknown' },
    {
      title: 'Outcome',
      dataIndex: 'promoted',
      key: 'promoted',
      width: 140,
      render: (promoted: boolean) => (
        <Tag color={promoted ? 'success' : 'default'}>{promoted ? 'Promoted' : 'Skipped'}</Tag>
      ),
    },
    { title: 'Reason', dataIndex: 'reason', key: 'reason', render: (v) => v ?? '—' },
  ];

  return (
    <Card style={{ boxShadow: token.boxShadowTertiary }} title="Promotion results">
      <Alert
        type={result.promotedCount > 0 ? 'success' : 'warning'}
        showIcon
        style={{ marginBottom: token.margin }}
        message={`${result.promotedCount} of ${result.requestedCount} student(s) promoted`}
      />
      <Table
        rowKey="studentId"
        size="small"
        dataSource={result.results}
        columns={columns}
        pagination={false}
      />
    </Card>
  );
}

export default PromotionPage;
