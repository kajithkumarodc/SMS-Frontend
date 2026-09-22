import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Empty, Skeleton, Table, Typography, theme } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ReloadOutlined } from '@ant-design/icons';
import { fetchPromotionHistory, type PromotionHistoryEntry } from '../../api/academicYears';
import { fetchClasses } from '../../api/classes';
import { buildSectionLookup } from '../classes/sectionLookup';

const { Text } = Typography;
const PAGE_SIZE = 20;

function PromotionHistoryTable() {
  const { token } = theme.useToken();
  const [page, setPage] = useState(0);

  const historyQuery = useQuery({
    queryKey: ['promotion-history', page],
    queryFn: () => fetchPromotionHistory(page, PAGE_SIZE),
  });
  const classesQuery = useQuery({ queryKey: ['classes'], queryFn: fetchClasses });
  const sectionLookup = useMemo(() => buildSectionLookup(classesQuery.data), [classesQuery.data]);

  const sectionLabel = (sectionId: string | null): string => {
    if (!sectionId) return '—';
    const info = sectionLookup.get(sectionId);
    return info ? `${info.className} · ${info.sectionName}` : 'Unknown section';
  };

  const rows = historyQuery.data?.content ?? [];

  const columns: ColumnsType<PromotionHistoryEntry> = [
    { title: 'Student', dataIndex: 'studentName', key: 'studentName', render: (v) => v ?? 'Unknown' },
    { title: 'From', key: 'from', render: (_v, r) => sectionLabel(r.previousSectionId) },
    { title: 'To', key: 'to', render: (_v, r) => sectionLabel(r.newSectionId) },
    {
      title: 'Promoted on',
      dataIndex: 'promotionDate',
      key: 'promotionDate',
      render: (v: string) => new Date(v).toLocaleString(),
    },
  ];

  if (historyQuery.isError) {
    return (
      <Alert
        type="warning"
        showIcon
        message="Couldn't load promotion history"
        description="There was a problem reaching the server."
        action={
          <Button size="small" onClick={() => void historyQuery.refetch()}>
            Try again
          </Button>
        }
      />
    );
  }

  if (historyQuery.isPending) {
    return <Skeleton active paragraph={{ rows: 6 }} />;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: token.marginSM }}>
        <Text type="secondary">Every student promotion, most recent first.</Text>
        <Button
          size="small"
          icon={<ReloadOutlined />}
          onClick={() => void historyQuery.refetch()}
          loading={historyQuery.isFetching && !historyQuery.isPending}
        >
          Refresh
        </Button>
      </div>
      <Table<PromotionHistoryEntry>
        rowKey={(r) => `${r.studentId}-${r.promotionDate}`}
        size="small"
        dataSource={rows}
        columns={columns}
        pagination={{
          current: page + 1,
          pageSize: PAGE_SIZE,
          total: historyQuery.data?.page.totalElements ?? 0,
          onChange: (p) => setPage(p - 1),
        }}
        locale={{
          emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No promotions recorded yet" />,
        }}
      />
    </div>
  );
}

export default PromotionHistoryTable;
