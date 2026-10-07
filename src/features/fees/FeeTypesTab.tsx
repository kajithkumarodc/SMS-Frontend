import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App, Button, Empty, Input, Popconfirm, Skeleton, Space, Table, Tag, Tooltip, Typography, theme } from 'antd';
import { CheckOutlined, CloseOutlined, EditOutlined, PlusOutlined, StopOutlined, UndoOutlined } from '@ant-design/icons';
import { createFeeType, fetchFeeTypes, updateFeeType, type FeeType } from '../../api/fees';
import { serverMessage } from '../../lib/apiErrors';

const { Text } = Typography;
export const FEE_TYPES_ALL_KEY = ['fee-types', 'all'] as const;

/**
 * Fees Type: the kinds of fee a school charges (Tuition Fee, Uniform, Transport, ...). Each school names its own;
 * a type is renamed or set inactive, never deleted, so fee groups that already use it keep showing it.
 */
function FeeTypesTab() {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);

  const query = useQuery({ queryKey: FEE_TYPES_ALL_KEY, queryFn: () => fetchFeeTypes(true) });
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['fee-types'] });
  const onError = (error: unknown) => message.error(serverMessage(error) ?? 'Could not save the fee type. Please try again.');

  const createMutation = useMutation({
    mutationFn: () => createFeeType(name.trim()),
    onSuccess: (created) => {
      message.success(`Fee type "${created.name}" added`);
      setName('');
      refresh();
    },
    onError,
  });
  const updateMutation = useMutation({
    mutationFn: (input: { id: string; name: string; active?: boolean }) =>
      updateFeeType(input.id, { name: input.name, active: input.active }),
    onSuccess: (saved, input) => {
      message.success(
        input.active === false ? `"${saved.name}" set inactive` : input.active ? `"${saved.name}" active again` : `Renamed to "${saved.name}"`,
      );
      setEditing(null);
      refresh();
    },
    onError,
  });

  const saveRename = () => {
    if (editing && editing.name.trim()) updateMutation.mutate({ id: editing.id, name: editing.name.trim() });
  };

  return (
    <div>
      <Text type="secondary" style={{ display: 'block', marginBottom: token.marginSM }}>
        The kinds of fee your school charges (Tuition Fee, Uniform, Transport, ...). They are the rows of every fee group
        in Fees Master. Rename them to match your school; set one inactive to stop offering it.
      </Text>
      <Space.Compact style={{ marginBottom: token.marginLG, maxWidth: 420, width: '100%' }}>
        <Input
          aria-label="New fee type name"
          placeholder="e.g. Sports Fee"
          value={name}
          maxLength={100}
          onChange={(e) => setName(e.target.value)}
          onPressEnter={() => name.trim() && createMutation.mutate()}
        />
        <Button type="primary" icon={<PlusOutlined />} loading={createMutation.isPending} disabled={!name.trim()} onClick={() => createMutation.mutate()}>
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
            { title: '#', key: 'n', width: 50, render: (_v, _r, i) => i + 1 },
            {
              title: 'Name',
              key: 'name',
              render: (_v, t) =>
                editing?.id === t.id ? (
                  <Input
                    aria-label="Fee type name"
                    autoFocus
                    value={editing.name}
                    maxLength={100}
                    onChange={(e) => setEditing({ id: t.id, name: e.target.value })}
                    onPressEnter={saveRename}
                    style={{ maxWidth: 320 }}
                  />
                ) : (
                  t.name
                ),
            },
            {
              title: 'Status',
              key: 'active',
              width: 110,
              render: (_v, t) => <Tag color={t.active ? 'success' : 'default'}>{t.active ? 'Active' : 'Inactive'}</Tag>,
            },
            {
              title: 'Action',
              key: 'action',
              width: 130,
              align: 'right',
              render: (_v, t) =>
                editing?.id === t.id ? (
                  <Space size={token.marginXXS}>
                    <Tooltip title="Save">
                      <Button size="small" type="primary" icon={<CheckOutlined />} aria-label="Save name" loading={updateMutation.isPending} onClick={saveRename} />
                    </Tooltip>
                    <Tooltip title="Cancel">
                      <Button size="small" icon={<CloseOutlined />} aria-label="Cancel" onClick={() => setEditing(null)} />
                    </Tooltip>
                  </Space>
                ) : (
                  <Space size={token.marginXXS}>
                    <Tooltip title="Rename">
                      <Button size="small" icon={<EditOutlined />} aria-label={`Rename ${t.name}`} onClick={() => setEditing({ id: t.id, name: t.name })} />
                    </Tooltip>
                    {t.active ? (
                      <Popconfirm
                        title={`Set "${t.name}" inactive?`}
                        description="It won't be offered for new fee lines. Existing fee groups keep it."
                        okText="Set inactive"
                        onConfirm={() => updateMutation.mutateAsync({ id: t.id, name: t.name, active: false }).catch(() => undefined)}
                      >
                        <Tooltip title="Set inactive">
                          <Button size="small" danger icon={<StopOutlined />} aria-label={`Set ${t.name} inactive`} />
                        </Tooltip>
                      </Popconfirm>
                    ) : (
                      <Tooltip title="Set active again">
                        <Button
                          size="small"
                          icon={<UndoOutlined />}
                          aria-label={`Activate ${t.name}`}
                          onClick={() => updateMutation.mutate({ id: t.id, name: t.name, active: true })}
                        />
                      </Tooltip>
                    )}
                  </Space>
                ),
            },
          ]}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No fee types yet" /> }}
        />
      )}
    </div>
  );
}

export default FeeTypesTab;
