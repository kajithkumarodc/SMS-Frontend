import { useQuery } from '@tanstack/react-query';
import { Alert, Empty, List, Modal, Skeleton, Typography } from 'antd';
import { fetchRouteStudents, type TransportRoute } from '../../api/transport';
import { ROUTE_STUDENTS_KEY } from './queryKeys';

const { Text } = Typography;

type Props = {
  /** The route whose students to show, or null when the modal is closed. */
  route: TransportRoute | null;
  onClose: () => void;
};

function RouteStudentsModal({ route, onClose }: Props) {
  const open = route !== null;

  const studentsQuery = useQuery({
    queryKey: [...ROUTE_STUDENTS_KEY, route?.id],
    queryFn: () => fetchRouteStudents(route!.id),
    enabled: open,
  });

  const students = studentsQuery.data ?? [];

  return (
    <Modal
      title={route ? `${route.name} — students` : 'Route students'}
      open={open}
      onCancel={onClose}
      footer={null}
      width={560}
      destroyOnClose
    >
      {studentsQuery.isError ? (
        <Alert type="warning" showIcon message="Couldn't load this route's students" />
      ) : studentsQuery.isPending ? (
        <Skeleton active paragraph={{ rows: 3 }} />
      ) : students.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No students assigned to this route yet" />
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

export default RouteStudentsModal;
