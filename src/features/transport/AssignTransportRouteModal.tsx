import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Form, Modal, Select } from 'antd';
import { assignStudentRoute, fetchRoutes } from '../../api/transport';
import type { Student } from '../../api/students';
import { STUDENTS_QUERY_KEY } from '../students/queryKeys';
import { TRANSPORT_ROUTES_KEY, ROUTE_STUDENTS_KEY } from './queryKeys';

const NONE = '__none__';

type Props = {
  /** The student to assign; `null` keeps the modal closed. */
  student: Student | null;
  onClose: () => void;
};

/**
 * Assign / unassign a student's transport route — same shape as "Assign section".
 * Picking "None" unassigns (sends `routeId: null`).
 */
function AssignTransportRouteModal({ student, onClose }: Props) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [routeId, setRouteId] = useState<string>(NONE);

  const routesQuery = useQuery({
    queryKey: TRANSPORT_ROUTES_KEY,
    queryFn: fetchRoutes,
    enabled: student !== null,
    staleTime: 60 * 1000,
  });

  useEffect(() => {
    setRouteId(student?.transportRouteId ?? NONE);
  }, [student]);

  const options = [
    { value: NONE, label: 'None (not on a route)' },
    ...(routesQuery.data ?? []).map((r) => ({ value: r.id, label: r.name })),
  ];
  const noRoutes = routesQuery.isSuccess && (routesQuery.data ?? []).length === 0;

  const mutation = useMutation({
    mutationFn: () => {
      if (!student) return Promise.reject(new Error('No student'));
      return assignStudentRoute(student.id, routeId === NONE ? null : routeId);
    },
    onSuccess: () => {
      message.success(
        routeId === NONE
          ? `${student?.fullName ?? 'Student'} removed from transport`
          : `${student?.fullName ?? 'Student'} assigned to the route`,
      );
      void queryClient.invalidateQueries({ queryKey: STUDENTS_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: ROUTE_STUDENTS_KEY });
      onClose();
    },
    onError: () => {
      message.error('Could not update the transport route. Please try again.');
    },
  });

  return (
    <Modal
      title={student ? `${student.fullName} — transport route` : 'Transport route'}
      open={student !== null}
      onCancel={onClose}
      onOk={() => mutation.mutate()}
      okText="Save"
      confirmLoading={mutation.isPending}
      okButtonProps={{ disabled: routesQuery.isLoading }}
      destroyOnClose
      maskClosable={!mutation.isPending}
    >
      {noRoutes && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="No routes yet"
          description="Add a transport route on the Transport page first. You can still choose “None” here."
        />
      )}
      <Form layout="vertical">
        <Form.Item label="Route">
          <Select
            data-testid="student-transport-route-select"
            value={routeId}
            onChange={setRouteId}
            loading={routesQuery.isLoading}
            options={options}
            showSearch
            optionFilterProp="label"
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}

export default AssignTransportRouteModal;
