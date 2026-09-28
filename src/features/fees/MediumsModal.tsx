import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App, Button, Input, List, Modal, Popconfirm, Space, Tag, Tooltip, Typography } from 'antd';
import { CheckOutlined, CloseOutlined, DeleteOutlined, EditOutlined, PlusOutlined, UndoOutlined } from '@ant-design/icons';
import { createMedium, deleteMedium, fetchMediums, updateMedium, type Medium } from '../../api/mediums';
import { serverMessage } from '../../lib/apiErrors';

export const MEDIUMS_QUERY_KEY = ['mediums'] as const;

type Props = { open: boolean; onClose: () => void };

/** Add, rename, deactivate or delete mediums of instruction (English Medium, Tamil Medium, ...). */
function MediumsModal({ open, onClose }: Props) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const mediumsQuery = useQuery({ queryKey: MEDIUMS_QUERY_KEY, queryFn: fetchMediums, enabled: open });
  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);

  const refresh = () => void queryClient.invalidateQueries({ queryKey: MEDIUMS_QUERY_KEY });
  const onError = (error: unknown) => message.error(serverMessage(error) ?? 'Could not save the medium. Please try again.');

  const createMutation = useMutation({
    mutationFn: (name: string) => createMedium(name),
    onSuccess: (m) => {
      message.success(`${m.name} added`);
      setNewName('');
      refresh();
    },
    onError,
  });
  const updateMutation = useMutation({
    mutationFn: (input: { id: string; name: string; active?: boolean }) =>
      updateMedium(input.id, { name: input.name, active: input.active }),
    onSuccess: () => {
      setEditing(null);
      refresh();
    },
    onError,
  });
  const deleteMutation = useMutation({
    mutationFn: (m: Medium) => deleteMedium(m.id).then((result) => ({ m, result })),
    onSuccess: ({ m, result }) => {
      message.success(result ? `${m.name} is in use, so it was set inactive instead` : `${m.name} deleted`);
      refresh();
    },
    onError,
  });

  const add = () => {
    const name = newName.trim();
    if (name) createMutation.mutate(name);
  };

  return (
    <Modal title="Mediums" open={open} onCancel={onClose} footer={null} destroyOnHidden>
      <Typography.Paragraph type="secondary">
        The medium of instruction a student studies in. Fees can be set separately for each medium.
      </Typography.Paragraph>
      <Space.Compact style={{ width: '100%', marginBottom: 16 }}>
        <Input
          aria-label="New medium name"
          placeholder="e.g. Hindi Medium"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onPressEnter={add}
          maxLength={100}
        />
        <Button type="primary" icon={<PlusOutlined />} onClick={add} loading={createMutation.isPending}>
          Add
        </Button>
      </Space.Compact>
      <List<Medium>
        bordered
        loading={mediumsQuery.isLoading}
        dataSource={mediumsQuery.data ?? []}
        locale={{ emptyText: 'No mediums yet' }}
        renderItem={(m) => (
          <List.Item
            actions={
              editing?.id === m.id
                ? [
                    <Tooltip title="Save" key="save">
                      <Button
                        type="text"
                        icon={<CheckOutlined />}
                        aria-label={`Save ${m.name}`}
                        loading={updateMutation.isPending}
                        onClick={() => editing.name.trim() && updateMutation.mutate({ id: m.id, name: editing.name.trim() })}
                      />
                    </Tooltip>,
                    <Tooltip title="Cancel" key="cancel">
                      <Button type="text" icon={<CloseOutlined />} aria-label="Cancel" onClick={() => setEditing(null)} />
                    </Tooltip>,
                  ]
                : [
                    <Tooltip title="Rename" key="edit">
                      <Button type="text" icon={<EditOutlined />} aria-label={`Rename ${m.name}`} onClick={() => setEditing({ id: m.id, name: m.name })} />
                    </Tooltip>,
                    !m.active ? (
                      <Tooltip title="Set active again" key="activate">
                        <Button
                          type="text"
                          icon={<UndoOutlined />}
                          aria-label={`Activate ${m.name}`}
                          onClick={() => updateMutation.mutate({ id: m.id, name: m.name, active: true })}
                        />
                      </Tooltip>
                    ) : (
                      <Popconfirm
                        key="delete"
                        title={`Delete ${m.name}?`}
                        description="If students or fees use it, it is set inactive instead."
                        okText="Delete"
                        okButtonProps={{ danger: true }}
                        onConfirm={() => deleteMutation.mutateAsync(m).catch(() => undefined)}
                      >
                        <Tooltip title="Delete">
                          <Button type="text" danger icon={<DeleteOutlined />} aria-label={`Delete ${m.name}`} />
                        </Tooltip>
                      </Popconfirm>
                    ),
                  ]
            }
          >
            {editing?.id === m.id ? (
              <Input
                aria-label="Medium name"
                value={editing.name}
                autoFocus
                maxLength={100}
                onChange={(e) => setEditing({ id: m.id, name: e.target.value })}
                onPressEnter={() => editing.name.trim() && updateMutation.mutate({ id: m.id, name: editing.name.trim() })}
              />
            ) : (
              <Space>
                {m.name}
                {!m.active && <Tag>Inactive</Tag>}
              </Space>
            )}
          </List.Item>
        )}
      />
    </Modal>
  );
}

export default MediumsModal;
