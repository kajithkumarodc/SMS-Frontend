import { useQuery } from '@tanstack/react-query';
import { Alert, Empty, List, Modal, Skeleton, Typography } from 'antd';
import { fetchRoomStudents, type HostelRoom } from '../../api/hostel';
import { ROOM_STUDENTS_KEY } from './queryKeys';

const { Text } = Typography;

type Props = {
  /** The room whose students to show, or null when the modal is closed. */
  room: HostelRoom | null;
  onClose: () => void;
};

function RoomStudentsModal({ room, onClose }: Props) {
  const open = room !== null;

  const studentsQuery = useQuery({
    queryKey: [...ROOM_STUDENTS_KEY, room?.id],
    queryFn: () => fetchRoomStudents(room!.blockId, room!.id),
    enabled: open,
  });

  const students = studentsQuery.data ?? [];

  return (
    <Modal
      title={room ? `Room ${room.roomNumber} — students` : 'Room students'}
      open={open}
      onCancel={onClose}
      footer={null}
      width={520}
      destroyOnClose
    >
      {studentsQuery.isError ? (
        <Alert type="warning" showIcon message="Couldn't load this room's students" />
      ) : studentsQuery.isPending ? (
        <Skeleton active paragraph={{ rows: 3 }} />
      ) : students.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No students allocated to this room yet" />
      ) : (
        <List
          dataSource={students}
          rowKey={(student) => student.id}
          renderItem={(student) => (
            <List.Item>
              <List.Item.Meta
                title={<Text strong>{student.fullName}</Text>}
                description={`Admission ${student.admissionNumber}`}
              />
            </List.Item>
          )}
        />
      )}
    </Modal>
  );
}

export default RoomStudentsModal;
