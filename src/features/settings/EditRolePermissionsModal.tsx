import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App, Modal, Transfer } from 'antd';
import { fetchPermissions, updateRolePermissions, type AppRole } from '../../api/roles';
import { PERMISSIONS_KEY, ROLES_KEY } from './queryKeys';

type Props = {
  /** The role whose permissions are being edited, or null when the modal is closed. */
  role: AppRole | null;
  onClose: () => void;
};

function EditRolePermissionsModal({ role, onClose }: Props) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const open = role !== null;

  const permissionsQuery = useQuery({
    queryKey: PERMISSIONS_KEY,
    queryFn: fetchPermissions,
    enabled: open,
    staleTime: 30 * 1000,
  });
  const permissions = permissionsQuery.data ?? [];

  const [targetKeys, setTargetKeys] = useState<string[]>([]);

  useEffect(() => {
    if (role) setTargetKeys(role.permissionNames.length ? permissions.filter((p) => role.permissionNames.includes(p.name)).map((p) => p.id) : []);
  }, [role, permissions]);

  const mutation = useMutation({
    mutationFn: () => {
      if (!role) return Promise.reject(new Error('No role'));
      return updateRolePermissions(role.id, targetKeys);
    },
    onSuccess: () => {
      message.success(`Permissions updated for ${role?.name}`);
      void queryClient.invalidateQueries({ queryKey: ROLES_KEY });
      onClose();
    },
    onError: () => {
      message.error('Could not update permissions. Please try again.');
    },
  });

  return (
    <Modal
      title={role ? `Permissions — ${role.name}` : 'Permissions'}
      open={open}
      onCancel={onClose}
      onOk={() => mutation.mutate()}
      okText="Save permissions"
      confirmLoading={mutation.isPending}
      width={720}
      destroyOnClose
      maskClosable={!mutation.isPending}
    >
      <Transfer
        dataSource={permissions.map((p) => ({ key: p.id, title: p.name }))}
        titles={['Available', 'Granted']}
        targetKeys={targetKeys}
        onChange={(keys) => setTargetKeys(keys as string[])}
        render={(item) => item.title}
        listStyle={{ width: 300, height: 400 }}
        showSearch
        filterOption={(input, item) => item.title.toLowerCase().includes(input.toLowerCase())}
      />
    </Modal>
  );
}

export default EditRolePermissionsModal;
