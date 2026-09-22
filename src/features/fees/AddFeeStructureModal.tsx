import { useEffect, useState } from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, Collapse, DatePicker, Form, Input, InputNumber, Modal, Select, Space } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { fetchSchools } from '../../api/students';
import { fetchClasses } from '../../api/classes';
import { fetchCurrentAcademicYear } from '../../api/academicYears';
import { createFeeStructure, fetchFeeTypes, type CreateFeeStructureInput } from '../../api/fees';
import { FEE_STRUCTURES_QUERY_KEY } from './queryKeys';

/** A sensible default session label (e.g. "2026-2027") when no academic year is marked current — Indian schools typically run June-to-April. */
function defaultAcademicYear(): string {
  const now = dayjs();
  const startYear = now.month() >= 5 ? now.year() : now.year() - 1;
  return `${startYear}-${startYear + 1}`;
}

const FREQUENCIES = [
  { value: 'ONE_TIME', label: 'One-time' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'QUARTERLY', label: 'Quarterly' },
  { value: 'HALF_YEARLY', label: 'Half-yearly' },
  { value: 'ANNUAL', label: 'Annual' },
];

const CATEGORIES = ['APPLICATION', 'ADMISSION', 'TERM_1', 'TERM_2', 'TERM_3', 'TERM_4', 'OTHER'];

const itemSchema = z.object({
  category: z.string().min(1, 'Required'),
  label: z.string().optional(),
  feeTypeId: z.string().optional(),
  amount: z.number({ invalid_type_error: 'Enter an amount' }).positive('Must be greater than 0'),
});

const schema = z
  .object({
    schoolId: z.string().min(1, 'Select a school'),
    classId: z.string().optional(),
    academicYear: z.string().trim().min(1, 'e.g. 2026-2027'),
    name: z.string().trim().min(1, 'A name is required').max(150, 'Keep this under 150 characters'),
    amount: z.number().optional(),
    dueDate: z.string().min(1, 'Pick a due date'),
    frequency: z.string().min(1),
    lateFeeAmount: z.number().optional(),
    items: z.array(itemSchema),
  })
  .refine((v) => v.items.length > 0 || (v.amount ?? 0) > 0, {
    message: 'Enter a flat amount, or add at least one line item',
    path: ['amount'],
  });

type FormValues = z.infer<typeof schema>;

const EMPTY: FormValues = {
  schoolId: '',
  classId: undefined,
  academicYear: '',
  name: '',
  amount: undefined,
  dueDate: '',
  frequency: 'ONE_TIME',
  lateFeeAmount: undefined,
  items: [],
};

type Props = {
  open: boolean;
  onClose: () => void;
};

function AddFeeStructureModal({ open, onClose }: Props) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [itemsOpen, setItemsOpen] = useState(false);

  const schoolsQuery = useQuery({ queryKey: ['schools'], queryFn: fetchSchools, enabled: open, staleTime: 5 * 60 * 1000 });
  const classesQuery = useQuery({ queryKey: ['classes'], queryFn: fetchClasses, enabled: open, staleTime: 60 * 1000 });
  const feeTypesQuery = useQuery({ queryKey: ['fee-types'], queryFn: fetchFeeTypes, enabled: open, staleTime: 60 * 1000 });
  const currentYearQuery = useQuery({
    queryKey: ['academic-year-current'],
    queryFn: fetchCurrentAcademicYear,
    enabled: open,
    staleTime: 60 * 1000,
  });

  const schoolOptions = (schoolsQuery.data ?? []).map((school) => ({ value: school.id, label: school.name }));
  const classOptions = (classesQuery.data ?? []).map((cls) => ({ value: cls.id, label: cls.name }));
  const feeTypeOptions = (feeTypesQuery.data ?? []).map((t) => ({ value: t.id, label: t.name }));
  const noSchools = schoolsQuery.isSuccess && schoolOptions.length === 0;

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: EMPTY,
    mode: 'onTouched',
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });

  useEffect(() => {
    if (open) {
      // Pre-fill the session so the required field never blocks submission: whichever academic
      // year is marked "current" if that has already loaded, else a sensible computed default.
      reset({ ...EMPTY, academicYear: currentYearQuery.data?.name ?? defaultAcademicYear() });
      setItemsOpen(false);
    }
    // Deliberately only re-runs when the modal opens/closes, not on every currentYearQuery
    // refetch -- reset() replaces the whole form, which would clobber in-progress edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, reset]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const payload: CreateFeeStructureInput = {
        schoolId: values.schoolId,
        classId: values.classId || undefined,
        academicYear: values.academicYear.trim(),
        name: values.name.trim(),
        dueDate: values.dueDate,
        frequency: values.frequency as CreateFeeStructureInput['frequency'],
        lateFeeAmount: values.lateFeeAmount,
        items: values.items.length > 0 ? values.items : undefined,
        amount: values.items.length > 0 ? undefined : values.amount,
      };
      return createFeeStructure(payload);
    },
    onSuccess: (created) => {
      message.success(`Fee structure "${created.name}" added`);
      void queryClient.invalidateQueries({ queryKey: FEE_STRUCTURES_QUERY_KEY });
      onClose();
    },
    onError: () => {
      message.error('Could not add the fee structure. Please try again.');
    },
  });

  const submit = handleSubmit((values) => mutation.mutate(values));

  return (
    <Modal
      title="Add fee structure"
      open={open}
      onCancel={onClose}
      onOk={submit}
      okText="Add fee structure"
      confirmLoading={mutation.isPending}
      okButtonProps={{ disabled: schoolsQuery.isLoading || noSchools }}
      width={640}
      destroyOnClose
      maskClosable={!mutation.isPending}
    >
      {noSchools && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="No schools found for your account"
          description="A fee structure belongs to a school. Ask an administrator to set one up first."
        />
      )}

      <Form layout="vertical" requiredMark="optional" onFinish={submit}>
        <Space.Compact block style={{ marginBottom: 0 }}>
          <Controller
            control={control}
            name="schoolId"
            render={({ field }) => (
              <Form.Item
                label="School"
                required
                style={{ width: '100%' }}
                validateStatus={errors.schoolId ? 'error' : undefined}
                help={errors.schoolId?.message}
              >
                <Select
                  {...field}
                  data-testid="fee-school-select"
                  placeholder="Select a school"
                  loading={schoolsQuery.isLoading}
                  options={schoolOptions}
                  showSearch
                  optionFilterProp="label"
                />
              </Form.Item>
            )}
          />
        </Space.Compact>

        <div style={{ display: 'flex', gap: 16 }}>
          <Controller
            control={control}
            name="classId"
            render={({ field }) => (
              <Form.Item label="Class (optional — leave blank to apply to every class)" style={{ flex: 1 }}>
                <Select
                  {...field}
                  allowClear
                  placeholder="Every class"
                  loading={classesQuery.isLoading}
                  options={classOptions}
                  showSearch
                  optionFilterProp="label"
                />
              </Form.Item>
            )}
          />
          <Controller
            control={control}
            name="academicYear"
            render={({ field }) => (
              <Form.Item
                label="Academic session"
                required
                style={{ flex: 1 }}
                validateStatus={errors.academicYear ? 'error' : undefined}
                help={errors.academicYear?.message}
              >
                <Input {...field} placeholder="e.g. 2026-2027" autoComplete="off" />
              </Form.Item>
            )}
          />
        </div>

        <Controller
          control={control}
          name="name"
          render={({ field }) => (
            <Form.Item
              label="Name"
              required
              validateStatus={errors.name ? 'error' : undefined}
              help={errors.name?.message}
            >
              <Input {...field} data-testid="fee-name-input" placeholder="e.g. Term 1 Tuition" autoComplete="off" />
            </Form.Item>
          )}
        />

        <div style={{ display: 'flex', gap: 16 }}>
          <Controller
            control={control}
            name="amount"
            render={({ field }) => (
              <Form.Item
                label="Flat amount (ignored if line items are added below)"
                style={{ flex: 1 }}
                validateStatus={errors.amount ? 'error' : undefined}
                help={errors.amount?.message}
              >
                <InputNumber
                  data-testid="fee-amount-input"
                  style={{ width: '100%' }}
                  min={0}
                  step={100}
                  precision={2}
                  disabled={fields.length > 0}
                  value={field.value ?? undefined}
                  onChange={(v) => field.onChange(v ?? undefined)}
                />
              </Form.Item>
            )}
          />
          <Controller
            control={control}
            name="dueDate"
            render={({ field }) => (
              <Form.Item
                label="Due date"
                required
                style={{ flex: 1 }}
                validateStatus={errors.dueDate ? 'error' : undefined}
                help={errors.dueDate?.message}
              >
                <DatePicker
                  data-testid="fee-duedate-picker"
                  style={{ width: '100%' }}
                  value={field.value ? dayjs(field.value) : null}
                  onChange={(d) => field.onChange(d ? d.format('YYYY-MM-DD') : '')}
                />
              </Form.Item>
            )}
          />
        </div>

        <div style={{ display: 'flex', gap: 16 }}>
          <Controller
            control={control}
            name="frequency"
            render={({ field }) => (
              <Form.Item label="Frequency" style={{ flex: 1 }}>
                <Select {...field} options={FREQUENCIES} />
              </Form.Item>
            )}
          />
          <Controller
            control={control}
            name="lateFeeAmount"
            render={({ field }) => (
              <Form.Item label="Late fee (optional)" style={{ flex: 1 }}>
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  step={10}
                  precision={2}
                  placeholder="No late fee"
                  value={field.value ?? undefined}
                  onChange={(v) => field.onChange(v ?? undefined)}
                />
              </Form.Item>
            )}
          />
        </div>

        <Collapse
          activeKey={itemsOpen ? ['items'] : []}
          onChange={(keys) => setItemsOpen((keys as string[]).includes('items'))}
          items={[
            {
              key: 'items',
              label: `Line items (${fields.length}) — optional, breaks the total into named parts`,
              children: (
                <Space direction="vertical" style={{ width: '100%' }}>
                  {fields.map((item, index) => (
                    <div key={item.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                      <Controller
                        control={control}
                        name={`items.${index}.category`}
                        render={({ field }) => (
                          <Select {...field} style={{ width: 130 }} options={CATEGORIES.map((c) => ({ value: c, label: c }))} />
                        )}
                      />
                      <Controller
                        control={control}
                        name={`items.${index}.label`}
                        render={({ field }) => <Input {...field} placeholder="Label (optional)" style={{ width: 150 }} />}
                      />
                      <Controller
                        control={control}
                        name={`items.${index}.feeTypeId`}
                        render={({ field }) => (
                          <Select
                            {...field}
                            style={{ width: 150 }}
                            allowClear
                            placeholder="Fee type"
                            options={feeTypeOptions}
                          />
                        )}
                      />
                      <Controller
                        control={control}
                        name={`items.${index}.amount`}
                        render={({ field }) => (
                          <InputNumber
                            style={{ width: 120 }}
                            min={0}
                            precision={2}
                            placeholder="Amount"
                            value={field.value ?? undefined}
                            onChange={(v) => field.onChange(v ?? undefined)}
                          />
                        )}
                      />
                      <Button icon={<DeleteOutlined />} onClick={() => remove(index)} />
                    </div>
                  ))}
                  <Button
                    icon={<PlusOutlined />}
                    onClick={() => append({ category: 'OTHER', label: '', feeTypeId: undefined, amount: 0 })}
                  >
                    Add line item
                  </Button>
                </Space>
              ),
            },
          ]}
        />
      </Form>
    </Modal>
  );
}

export default AddFeeStructureModal;
