import { useEffect, useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App, Form, Input, InputNumber, Modal, Select } from 'antd';
import {
  addVehicle,
  DuplicateRegistrationNumberError,
  fetchRoutes,
  type AddVehicleInput,
} from '../../api/transport';
import { TRANSPORT_ROUTES_KEY, TRANSPORT_VEHICLES_KEY } from './queryKeys';

const NONE = '__none__';

const schema = z.object({
  registrationNumber: z
    .string()
    .trim()
    .min(1, 'A registration number is required')
    .max(30, 'Keep this under 30 characters'),
  driverName: z.string().trim().min(1, "The driver's name is required").max(200, 'Keep this under 200 characters'),
  driverContact: z.string().trim().max(50, 'Keep this under 50 characters').optional(),
  capacity: z
    .number({ invalid_type_error: 'Enter a capacity' })
    .int('Whole seats only')
    .min(1, 'At least one seat'),
  routeId: z.string(), // NONE or a route id
});

type FormValues = z.infer<typeof schema>;

const EMPTY: FormValues = {
  registrationNumber: '',
  driverName: '',
  driverContact: '',
  capacity: 40,
  routeId: NONE,
};

type Props = {
  open: boolean;
  onClose: () => void;
  /** Preselect this route in the form (e.g. when adding from a route's detail). */
  defaultRouteId?: string | null;
};

function AddVehicleModal({ open, onClose, defaultRouteId }: Props) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();

  const routesQuery = useQuery({
    queryKey: TRANSPORT_ROUTES_KEY,
    queryFn: fetchRoutes,
    enabled: open,
    staleTime: 60 * 1000,
  });

  const routeOptions = useMemo(
    () => [
      { value: NONE, label: 'Unassigned' },
      ...(routesQuery.data ?? []).map((r) => ({ value: r.id, label: r.name })),
    ],
    [routesQuery.data],
  );

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
    if (open) reset({ ...EMPTY, routeId: defaultRouteId ?? NONE });
  }, [open, defaultRouteId, reset]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const payload: AddVehicleInput = {
        registrationNumber: values.registrationNumber.trim(),
        driverName: values.driverName.trim(),
        driverContact: values.driverContact?.trim() ? values.driverContact.trim() : null,
        capacity: values.capacity,
        routeId: values.routeId === NONE ? null : values.routeId,
      };
      return addVehicle(payload);
    },
    onSuccess: (vehicle) => {
      message.success(`Vehicle ${vehicle.registrationNumber} added`);
      void queryClient.invalidateQueries({ queryKey: TRANSPORT_VEHICLES_KEY });
      onClose();
    },
    onError: (error) => {
      if (error instanceof DuplicateRegistrationNumberError) {
        setError('registrationNumber', { type: 'server', message: error.message });
        return;
      }
      message.error('Could not add the vehicle. Please try again.');
    },
  });

  const submit = handleSubmit((values) => mutation.mutate(values));

  return (
    <Modal
      title="Add vehicle"
      open={open}
      onCancel={onClose}
      onOk={submit}
      okText="Add vehicle"
      confirmLoading={mutation.isPending}
      destroyOnClose
      maskClosable={!mutation.isPending}
    >
      <Form layout="vertical" requiredMark="optional" onFinish={submit}>
        <Controller
          control={control}
          name="registrationNumber"
          render={({ field }) => (
            <Form.Item
              label="Registration number"
              required
              validateStatus={errors.registrationNumber ? 'error' : undefined}
              help={errors.registrationNumber?.message}
            >
              <Input
                {...field}
                data-testid="vehicle-registration-input"
                placeholder="e.g. KA01AB1234"
                autoComplete="off"
              />
            </Form.Item>
          )}
        />

        <Controller
          control={control}
          name="driverName"
          render={({ field }) => (
            <Form.Item
              label="Driver name"
              required
              validateStatus={errors.driverName ? 'error' : undefined}
              help={errors.driverName?.message}
            >
              <Input {...field} data-testid="vehicle-driver-input" placeholder="e.g. Ravi Kumar" autoComplete="off" />
            </Form.Item>
          )}
        />

        <Controller
          control={control}
          name="driverContact"
          render={({ field }) => (
            <Form.Item
              label="Driver contact"
              validateStatus={errors.driverContact ? 'error' : undefined}
              help={errors.driverContact?.message ?? 'Optional'}
            >
              <Input
                {...field}
                value={field.value ?? ''}
                data-testid="vehicle-contact-input"
                placeholder="Phone or radio call sign"
                autoComplete="off"
              />
            </Form.Item>
          )}
        />

        <Controller
          control={control}
          name="capacity"
          render={({ field }) => (
            <Form.Item
              label="Capacity"
              required
              validateStatus={errors.capacity ? 'error' : undefined}
              help={errors.capacity?.message}
            >
              <InputNumber
                data-testid="vehicle-capacity-input"
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

        <Controller
          control={control}
          name="routeId"
          render={({ field }) => (
            <Form.Item label="Route" help="Optional — assign the vehicle to a route now or later">
              <Select
                {...field}
                data-testid="vehicle-route-select"
                loading={routesQuery.isLoading}
                options={routeOptions}
                showSearch
                optionFilterProp="label"
              />
            </Form.Item>
          )}
        />
      </Form>
    </Modal>
  );
}

export default AddVehicleModal;
