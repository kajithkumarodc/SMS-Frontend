import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, Empty, Skeleton, Space, Table, Tag, Typography, theme } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, ReloadOutlined, SwapOutlined } from '@ant-design/icons';
import { fetchAcademicYears, setCurrentAcademicYear, type AcademicYear } from '../../api/academicYears';
import { ACADEMIC_YEARS_KEY } from './queryKeys';
import AddAcademicYearModal from './AddAcademicYearModal';

const { Text } = Typography;

function AcademicYearsTab() {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [addOpen, setAddOpen] = useState(false);

  const yearsQuery = useQuery({ queryKey: ACADEMIC_YEARS_KEY, queryFn: fetchAcademicYears });
  const years = yearsQuery.data ?? [];

  const setCurrentMutation = useMutation({
    mutationFn: setCurrentAcademicYear,
    onSuccess: (year) => {
      message.success(`"${year.name}" is now the current academic year`);
      void queryClient.invalidateQueries({ queryKey: ACADEMIC_YEARS_KEY });
    },
    onError: () => {
      message.error('Could not set the current academic year. Please try again.');
    },
  });

  const columns: ColumnsType<AcademicYear> = [
    { title: 'Name', dataIndex: 'name', key: 'name', render: (v: string) => <Text strong>{v}</Text> },
    { title: 'Start date', dataIndex: 'startDate', key: 'startDate' },
    { title: 'End date', dataIndex: 'endDate', key: 'endDate' },
    {
      title: 'Status',
      key: 'current',
      width: 140,
      render: (_v, record) =>
        record.current ? (
          <Tag color="success">Current</Tag>
        ) : (
          <Button size="small" loading={setCurrentMutation.isPending} onClick={() => setCurrentMutation.mutate(record.id)}>
            Set as current
          </Button>
        ),
    },
  ];

  return (
    <div>
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
        <Text type="secondary">Academic sessions, and moving students between sections at year-end.</Text>
        <Space>
          <Button icon={<SwapOutlined />} onClick={() => navigate('/app/promotion')}>
            Promote students
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => void yearsQuery.refetch()}
            loading={yearsQuery.isFetching && !yearsQuery.isPending}
          >
            Refresh
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddOpen(true)}>
            Add academic year
          </Button>
        </Space>
      </header>

      {yearsQuery.isError ? (
        <Alert
          type="warning"
          showIcon
          message="Couldn't load academic years"
          description="There was a problem reaching the server."
          action={
            <Button size="small" onClick={() => void yearsQuery.refetch()}>
              Try again
            </Button>
          }
        />
      ) : yearsQuery.isPending ? (
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : (
        <Table<AcademicYear>
          rowKey="id"
          columns={columns}
          dataSource={years}
          pagination={false}
          locale={{
            emptyText: (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No academic years yet — add your first one" />
            ),
          }}
        />
      )}

      <AddAcademicYearModal open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}

export default AcademicYearsTab;
