import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App, Button, Empty, Input, Skeleton, Space, Table, Tag, Typography, theme } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { createFeeType, fetchFeeTypes, type FeeType } from '../../api/fees';

const { Text } = Typography;

function FeeTypesTab() {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');

  const query = useQuery({ queryKey: ['fee-types'], queryFn: fetchFeeTypes });

  const mutation = useMutation({
    mutationFn: () => createFeeType(name.trim()),
    onSuccess: (created) => {
      message.success(`Fee type "${created.name}" added`);
      setName('');
      void queryClient.invalidateQueries({ queryKey: ['fee-types'] });
    },
    onError: () => message.error('Could not add the fee type. It may already exist.'),
  });

  return (
    <div>
      <Text type="secondary" style={{ display: 'block', marginBottom: token.marginSM }}>
        Fee types (Tuition, Transport, ...) tag line items for reporting — configure the catalog here.
      </Text>
      <Space.Compact style={{ marginBottom: token.marginLG, maxWidth: 420 }}>
        <Input
          placeholder="e.g. Sports Fee"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onPressEnter={() => name.trim() && mutation.mutate()}
        />
        <Button type="primary" icon={<PlusOutlined />} loading={mutation.isPending} disabled={!name.trim()} onClick={() => mutation.mutate()}>
          Add
        </Button>
      </Space.Compact>

      {query.isPending ? (
        <Skeleton active paragraph={{ rows: 3 }} />
      ) : (
        <Table<FeeType>
          rowKey="id"
          size="small"
          dataSource={query.data ?? []}
          pagination={false}
          columns={[
            { title: 'Name', dataIndex: 'name', key: 'name' },
            {
              title: 'Status',
              dataIndex: 'active',
              key: 'active',
              width: 120,
              render: (active: boolean) => <Tag color={active ? 'success' : 'default'}>{active ? 'Active' : 'Inactive'}</Tag>,
            },
          ]}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No fee types yet" /> }}
        />
      )}
    </div>
  );
}

export default FeeTypesTab;
