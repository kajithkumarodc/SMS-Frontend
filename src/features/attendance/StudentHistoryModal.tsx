import { useQuery } from '@tanstack/react-query';
import { Alert, Empty, List, Modal, Skeleton, Tag, Typography } from 'antd';
import { fetchStudentAttendanceHistory } from '../../api/attendance';
import { STUDENT_HISTORY_KEY } from './queryKeys';
import { ATTENDANCE_TAG_COLOR, attendanceLabel } from './status';

const { Text } = Typography;

type Props = {
  /** Student whose history to show; `null` keeps the modal closed. */
  student: { id: string; fullName: string } | null;
  onClose: () => void;
};

function StudentHistoryModal({ student, onClose }: Props) {
  const { data, isPending, isError } = useQuery({
    queryKey: [...STUDENT_HISTORY_KEY, student?.id],
    queryFn: () => fetchStudentAttendanceHistory(student!.id),
    enabled: student !== null,
  });

  return (
    <Modal
      title={student ? `${student.fullName} — attendance history` : 'Attendance history'}
      open={student !== null}
      onCancel={onClose}
      footer={null}
      destroyOnClose
    >
      {isError ? (
        <Alert type="warning" showIcon message="Couldn't load the history" />
      ) : isPending ? (
        <Skeleton active paragraph={{ rows: 5 }} />
      ) : data.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No attendance recorded yet" />
      ) : (
        <List
          size="small"
          dataSource={data}
          style={{ maxHeight: 360, overflowY: 'auto' }}
          renderItem={(record) => (
            <List.Item>
              <Text>{record.date}</Text>
              <Tag color={ATTENDANCE_TAG_COLOR[record.status]} style={{ marginInlineEnd: 0 }}>
                {attendanceLabel(record.status)}
              </Tag>
            </List.Item>
          )}
        />
      )}
    </Modal>
  );
}

export default StudentHistoryModal;
