import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, Empty, Skeleton, Space, Table, Tag, Typography, theme } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { fetchFeeDiscounts, type FeeDiscount } from '../../api/fees';
import { formatAmount, formatDate } from './format';
import AddFeeDiscountModal from './AddFeeDiscountModal';

const { Text } = Typography;

function FeeDiscountsTab() {
  const { token } = theme.useToken();
  const [addOpen, setAddOpen] = useState(false);
  const query = useQuery({ queryKey: ['fee-discounts'], queryFn: fetchFeeDiscounts });

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          marginBottom: token.marginLG,
          gap: token.marginSM,
        }}
      >
        <Text type="secondary">Reusable discount rules — apply one to a specific invoice during assignment or collection.</Text>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddOpen(true)}>
          Add discount
        </Button>
      </div>

      {query.isPending ? (
        <Skeleton active paragraph={{ rows: 4 }} />
      ) : (
        <Table<FeeDiscount>
          rowKey="id"
          size="small"
          dataSource={query.data ?? []}
          pagination={false}
          columns={[
            { title: 'Name', dataIndex: 'name', key: 'name' },
            {
              title: 'Value',
              key: 'value',
              render: (_v, d) => (d.discountType === 'PERCENTAGE' ? `${d.value}%` : formatAmount(d.value)),
            },
            {
              title: 'Validity',
              key: 'validity',
              render: (_v, d) =>
                d.validFrom || d.validTo
                  ? `${d.validFrom ? formatDate(d.validFrom) : 'Any'} - ${d.validTo ? formatDate(d.validTo) : 'Any'}`
                  : 'Always',
            },
            {
              title: 'Status',
              dataIndex: 'status',
              key: 'status',
              width: 110,
              render: (status: string) => <Tag color={status === 'ACTIVE' ? 'success' : 'default'}>{status}</Tag>,
            },
          ]}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No discounts configured yet" /> }}
        />
      )}

      <AddFeeDiscountModal open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}

export default FeeDiscountsTab;
