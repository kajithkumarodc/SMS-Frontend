import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Form, Modal, Select } from 'antd';
import {
  allocateStudentRoom,
  fetchBlocks,
  fetchRooms,
  RoomFullError,
  type HostelRoom,
} from '../../api/hostel';
import type { Student } from '../../api/students';
import { STUDENTS_QUERY_KEY } from '../students/queryKeys';
import { BLOCK_ROOMS_KEY, HOSTEL_BLOCKS_KEY, ROOM_STUDENTS_KEY } from './queryKeys';

const NONE = '__none__';

type Props = {
  /** The student to allocate; `null` keeps the modal closed. */
  student: Student | null;
  onClose: () => void;
};

/**
 * Allocate / deallocate a student's hostel room — same shape as the Transport
 * route assignment. The dropdown is grouped by block; a full room is shown
 * disabled with "Full" (unless it's the room the student is already in).
 */
function AllocateHostelRoomModal({ student, onClose }: Props) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const open = student !== null;
  const [roomId, setRoomId] = useState<string>(NONE);

  const blocksQuery = useQuery({
    queryKey: HOSTEL_BLOCKS_KEY,
    queryFn: fetchBlocks,
    enabled: open,
    staleTime: 60 * 1000,
  });

  const blocks = blocksQuery.data ?? [];

  const roomQueries = useQueries({
    queries: blocks.map((block) => ({
      queryKey: [...BLOCK_ROOMS_KEY, block.id],
      queryFn: () => fetchRooms(block.id),
      enabled: open,
      staleTime: 30 * 1000,
    })),
  });

  const roomsLoading = blocksQuery.isLoading || roomQueries.some((q) => q.isLoading);

  useEffect(() => {
    setRoomId(student?.hostelRoomId ?? NONE);
  }, [student]);

  const options = useMemo(() => {
    const currentRoomId = student?.hostelRoomId ?? null;
    const groups = blocks.map((block, i) => {
      const rooms: HostelRoom[] = roomQueries[i]?.data ?? [];
      return {
        label: block.name,
        options: rooms.map((room) => {
          const full = room.occupied >= room.capacity && room.id !== currentRoomId;
          return {
            value: room.id,
            label: `${room.roomNumber} (${room.occupied}/${room.capacity})${full ? ' — Full' : ''}`,
            disabled: full,
          };
        }),
      };
    });
    return [{ label: 'Not allocated', options: [{ value: NONE, label: 'None (day scholar)' }] }, ...groups];
  }, [blocks, roomQueries, student?.hostelRoomId]);

  const noRooms =
    blocksQuery.isSuccess && blocks.every((_, i) => (roomQueries[i]?.data ?? []).length === 0);

  const mutation = useMutation({
    mutationFn: () => {
      if (!student) return Promise.reject(new Error('No student'));
      return allocateStudentRoom(student.id, roomId === NONE ? null : roomId);
    },
    onSuccess: () => {
      message.success(
        roomId === NONE
          ? `${student?.fullName ?? 'Student'} removed from the hostel`
          : `${student?.fullName ?? 'Student'} allocated a room`,
      );
      void queryClient.invalidateQueries({ queryKey: STUDENTS_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: HOSTEL_BLOCKS_KEY });
      void queryClient.invalidateQueries({ queryKey: BLOCK_ROOMS_KEY });
      void queryClient.invalidateQueries({ queryKey: ROOM_STUDENTS_KEY });
      onClose();
    },
    onError: (error) => {
      message.error(
        error instanceof RoomFullError
          ? 'That room filled up. Pick another room.'
          : 'Could not update the hostel room. Please try again.',
      );
    },
  });

  return (
    <Modal
      title={student ? `${student.fullName} — hostel room` : 'Hostel room'}
      open={open}
      onCancel={onClose}
      onOk={() => mutation.mutate()}
      okText="Save"
      confirmLoading={mutation.isPending}
      okButtonProps={{ disabled: roomsLoading }}
      destroyOnClose
      maskClosable={!mutation.isPending}
    >
      {blocksQuery.isSuccess && blocks.length === 0 && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="No blocks yet"
          description="Add a hostel block and room on the Hostel page first. You can still choose “None” here."
        />
      )}
      {blocksQuery.isSuccess && blocks.length > 0 && noRooms && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="No rooms yet"
          description="Add rooms to a block on the Hostel page first."
        />
      )}
      <Form layout="vertical">
        <Form.Item label="Room">
          <Select
            data-testid="student-hostel-room-select"
            value={roomId}
            onChange={setRoomId}
            loading={roomsLoading}
            options={options}
            showSearch
            optionFilterProp="label"
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}

export default AllocateHostelRoomModal;
