import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App, DatePicker, Form, Input, InputNumber, Modal, Select } from 'antd';
import dayjs from 'dayjs';
import { createFeeDiscount, fetchFeeStructures, type CreateFeeDiscountInput } from '../../api/fees';

const schema = z.object({
  name: z.string().trim().min(1, 'A name is required').max(150),
  discountType: z.enum(['FIXED', 'PERCENTAGE']),
  value: z.number({ invalid_type_error: 'Enter a value' }).positive('Must be greater than 0'),
  feeStructureId: z.string().optional(),
  validFrom: z.string().optional(),
  validTo: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const EMPTY: FormValues = { name: '', discountType: 'FIXED', value: 0, feeStructureId: undefined, validFrom: undefined, validTo: undefined };

type Props = {
  open: boolean;
  onClose: () => void;
};

function AddFeeDiscountModal({ open, onClose }: Props) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();

  const structuresQuery = useQuery({ queryKey: ['fee-structures'], queryFn: () => fetchFeeStructures(), enabled: open });
  const structureOptions = (structuresQuery.data ?? []).map((s) => ({ value: s.id, label: `${s.name} (${s.academicYear})` }));

  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: EMPTY, mode: 'onTouched' });

  useEffect(() => {
    if (open) reset(EMPTY);
  }, [open, reset]);

  const discountType = watch('discountType');

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const payload: CreateFeeDiscountInput = {
        name: values.name.trim(),
        discountType: values.discountType,
        value: values.value,
        feeStructureId: values.feeStructureId || undefined,
        validFrom: values.validFrom || undefined,
        validTo: values.validTo || undefined,
      };
      return createFeeDiscount(payload);
    },
    onSuccess: (created) => {
      message.success(`Discount "${created.name}" added`);
      void queryClient.invalidateQueries({ queryKey: ['fee-discounts'] });
      onClose();
    },
    onError: () => message.error('Could not add the discount. Please try again.'),
  });

  const submit = handleSubmit((values) => mutation.mutate(values));

  return (
    <Modal
      title="Add discount"
      open={open}
      onCancel={onClose}
      onOk={submit}
      okText="Add discount"
      confirmLoading={mutation.isPending}
      destroyOnClose
      maskClosable={!mutation.isPending}
    >
      <Form layout="vertical" requiredMark="optional" onFinish={submit}>
        <Controller
          control={control}
          name="name"
          render={({ field }) => (
            <Form.Item label="Name" required validateStatus={errors.name ? 'error' : undefined} help={errors.name?.message}>
              <Input {...field} placeholder="e.g. Sibling Discount" autoComplete="off" />
            </Form.Item>
          )}
        />

        <div style={{ display: 'flex', gap: 16 }}>
          <Controller
            control={control}
            name="discountType"
            render={({ field }) => (
              <Form.Item label="Type" style={{ flex: 1 }}>
                <Select
                  {...field}
                  options={[
                    { value: 'FIXED', label: 'Fixed amount' },
                    { value: 'PERCENTAGE', label: 'Percentage' },
                  ]}
                />
              </Form.Item>
            )}
          />
          <Controller
            control={control}
            name="value"
            render={({ field }) => (
              <Form.Item
                label={discountType === 'PERCENTAGE' ? 'Percentage (%)' : 'Amount'}
                style={{ flex: 1 }}
                validateStatus={errors.value ? 'error' : undefined}
                help={errors.value?.message}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  max={discountType === 'PERCENTAGE' ? 100 : undefined}
                  precision={2}
                  value={field.value || undefined}
                  onChange={(v) => field.onChange(v ?? undefined)}
                />
              </Form.Item>
            )}
          />
        </div>

        <Controller
          control={control}
          name="feeStructureId"
          render={({ field }) => (
            <Form.Item label="Applicable fee structure (optional — leave blank to allow on any invoice)">
              <Select
                {...field}
                allowClear
                placeholder="Any fee structure"
                loading={structuresQuery.isPending}
                options={structureOptions}
                showSearch
                optionFilterProp="label"
              />
            </Form.Item>
          )}
        />

        <div style={{ display: 'flex', gap: 16 }}>
          <Controller
            control={control}
            name="validFrom"
            render={({ field }) => (
              <Form.Item label="Valid from (optional)" style={{ flex: 1 }}>
                <DatePicker
                  style={{ width: '100%' }}
                  value={field.value ? dayjs(field.value) : null}
                  onChange={(d) => field.onChange(d ? d.format('YYYY-MM-DD') : undefined)}
                />
              </Form.Item>
            )}
          />
          <Controller
            control={control}
            name="validTo"
            render={({ field }) => (
              <Form.Item label="Valid to (optional)" style={{ flex: 1 }}>
                <DatePicker
                  style={{ width: '100%' }}
                  value={field.value ? dayjs(field.value) : null}
                  onChange={(d) => field.onChange(d ? d.format('YYYY-MM-DD') : undefined)}
                />
              </Form.Item>
            )}
          />
        </div>
      </Form>
    </Modal>
  );
}

export default AddFeeDiscountModal;
