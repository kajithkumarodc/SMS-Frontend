import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { App, Form, Input, InputNumber, Modal } from 'antd';
import { addRoom, DuplicateRoomNumberError, type AddRoomInput } from '../../api/hostel';
import { BLOCK_ROOMS_KEY, HOSTEL_BLOCKS_KEY } from './queryKeys';

const schema = z.object({
  roomNumber: z
    .string()
    .trim()
    .min(1, 'A room number is required')
    .max(30, 'Keep this under 30 characters'),
  capacity: z
    .number({ invalid_type_error: 'Enter a capacity' })
    .int('Whole beds only')
    .min(1, 'At least one bed'),
});

type FormValues = z.infer<typeof schema>;

const EMPTY: FormValues = { roomNumber: '', capacity: 2 };

type Props = {
  /** The block to add the room to, or null when the modal is closed. */
  blockId: string | null;
  onClose: () => void;
};

function AddRoomModal({ blockId, onClose }: Props) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const open = blockId !== null;

  const {
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: EMPTY,
    mode: 'onTouched',
  });

  useEffect(() => {
    if (open) reset(EMPTY);
  }, [open, reset]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const payload: AddRoomInput = { roomNumber: values.roomNumber.trim(), capacity: values.capacity };
      return addRoom(blockId!, payload);
    },
    onSuccess: (room) => {
      message.success(`Room ${room.roomNumber} added`);
      void queryClient.invalidateQueries({ queryKey: [...BLOCK_ROOMS_KEY, blockId] });
      void queryClient.invalidateQueries({ queryKey: HOSTEL_BLOCKS_KEY });
      onClose();
    },
    onError: (error) => {
      if (error instanceof DuplicateRoomNumberError) {
        setError('roomNumber', { type: 'server', message: error.message });
        return;
      }
      message.error('Could not add the room. Please try again.');
    },
  });

  const submit = handleSubmit((values) => mutation.mutate(values));

  return (
    <Modal
      title="Add room"
      open={open}
      onCancel={onClose}
      onOk={submit}
      okText="Add room"
      confirmLoading={mutation.isPending}
      destroyOnClose
      maskClosable={!mutation.isPending}
    >
      <Form layout="vertical" requiredMark="optional" onFinish={submit}>
        <Controller
          control={control}
          name="roomNumber"
          render={({ field }) => (
            <Form.Item
              label="Room number"
              required
              validateStatus={errors.roomNumber ? 'error' : undefined}
              help={errors.roomNumber?.message}
            >
              <Input {...field} data-testid="room-number-input" placeholder="e.g. A-101" autoComplete="off" />
            </Form.Item>
          )}
        />

        <Controller
          control={control}
          name="capacity"
          render={({ field }) => (
            <Form.Item
              label="Capacity (beds)"
              required
              validateStatus={errors.capacity ? 'error' : undefined}
              help={errors.capacity?.message}
            >
              <InputNumber
                data-testid="room-capacity-input"
                style={{ width: '100%' }}
                min={1}
                step={1}
                precision={0}
                value={field.value || undefined}
                onChange={(v) => field.onChange(v ?? undefined)}
              />
            </Form.Item>
          )}
        />
      </Form>
    </Modal>
  );
}

export default AddRoomModal;
