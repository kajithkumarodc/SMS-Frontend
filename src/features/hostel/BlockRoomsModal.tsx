import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Empty, Modal, Skeleton, Space, Table, Tag, Typography, theme } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined } from '@ant-design/icons';
import { fetchRooms, type HostelBlock, type HostelRoom } from '../../api/hostel';
import { BLOCK_ROOMS_KEY } from './queryKeys';
import AddRoomModal from './AddRoomModal';
import RoomStudentsModal from './RoomStudentsModal';

const { Text } = Typography;

type Props = {
  /** The block whose rooms to show, or null when the modal is closed. */
  block: HostelBlock | null;
  /** Whether the caller may add rooms (SCHOOL_ADMIN). */
  canManage: boolean;
  onClose: () => void;
};

function BlockRoomsModal({ block, canManage, onClose }: Props) {
  const { token } = theme.useToken();
  const open = block !== null;

  const [addRoomOpen, setAddRoomOpen] = useState(false);
  const [viewingRoom, setViewingRoom] = useState<HostelRoom | null>(null);

  const roomsQuery = useQuery({
    queryKey: [...BLOCK_ROOMS_KEY, block?.id],
    queryFn: () => fetchRooms(block!.id),
    enabled: open,
  });

  const rooms = roomsQuery.data ?? [];

  const columns: ColumnsType<HostelRoom> = [
    {
      title: 'Room',
      dataIndex: 'roomNumber',
      key: 'roomNumber',
      render: (value: string) => <Text strong>{value}</Text>,
    },
    {
      title: 'Occupancy',
      key: 'occupancy',
      width: 130,
      render: (_value, record) => {
        const full = record.occupied >= record.capacity;
        return (
          <Tag color={full ? 'warning' : 'success'} style={{ marginInlineEnd: 0 }}>
            {record.occupied} / {record.capacity}
          </Tag>
        );
      },
    },
    {
      title: '',
      key: 'actions',
      width: 100,
      render: (_value, record) => (
        <Button type="link" size="small" style={{ paddingInline: 0 }} onClick={() => setViewingRoom(record)}>
          Students
        </Button>
      ),
    },
  ];

  return (
    <Modal
      title={block ? `${block.name} — rooms` : 'Rooms'}
      open={open}
      onCancel={onClose}
      footer={null}
      width={620}
      destroyOnClose
    >
      {canManage && (
        <Space style={{ marginBottom: token.marginSM, width: '100%', justifyContent: 'flex-end' }}>
          <Button size="small" type="primary" icon={<PlusOutlined />} onClick={() => setAddRoomOpen(true)}>
            Add room
          </Button>
        </Space>
      )}

      {roomsQuery.isError ? (
        <Alert
          type="warning"
          showIcon
          message="Couldn't load this block's rooms"
          action={
            <Button size="small" onClick={() => void roomsQuery.refetch()}>
              Try again
            </Button>
          }
        />
      ) : roomsQuery.isPending ? (
        <Skeleton active paragraph={{ rows: 4 }} />
      ) : (
        <Table<HostelRoom>
          rowKey="id"
          columns={columns}
          dataSource={rooms}
          pagination={false}
          size="small"
          scroll={{ x: 'max-content' }}
          locale={{
            emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No rooms in this block yet" />,
          }}
        />
      )}

      {canManage && <AddRoomModal blockId={addRoomOpen ? block?.id ?? null : null} onClose={() => setAddRoomOpen(false)} />}
      <RoomStudentsModal room={viewingRoom} onClose={() => setViewingRoom(null)} />
    </Modal>
  );
}

export default BlockRoomsModal;
