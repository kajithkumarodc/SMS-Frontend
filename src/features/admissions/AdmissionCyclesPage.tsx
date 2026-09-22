import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  App,
  Button,
  Card,
  DatePicker,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Result,
  Select,
  Skeleton,
  Space,
  Table,
  Tag,
  Typography,
  theme,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  closeAdmissionCycle,
  createAdmissionCycle,
  fetchAdmissionCycles,
  openAdmissionCycle,
  type AdmissionCycle,
} from '../../api/admissions';
import { fetchAcademicYears } from '../../api/academicYears';
import { fetchSchools } from '../../api/students';
import { useAuthStore } from '../../store/authStore';
import { hasPermission } from '../../lib/roles';
import { ADMISSION_CYCLES_KEY } from './queryKeys';

const { Title, Text } = Typography;

const STATUS_COLOR: Record<string, string> = { DRAFT: 'default', OPEN: 'green', CLOSED: 'red' };

const schema = z
  .object({
    schoolId: z.string().min(1, 'Select a school'),
    academicYearId: z.string().min(1, 'Select an academic year'),
    name: z.string().trim().min(1, 'Name is required').max(150),
    description: z.string().trim().max(1000).optional(),
    openDate: z.string().min(1, 'Open date is required'),
    closeDate: z.string().min(1, 'Close date is required'),
  })
  .refine((v) => !v.openDate || !v.closeDate || dayjs(v.closeDate).isAfter(dayjs(v.openDate)), {
    message: 'Close date must be after open date',
    path: ['closeDate'],
  });

type FormValues = z.infer<typeof schema>;

const EMPTY: FormValues = { schoolId: '', academicYearId: '', name: '', description: '', openDate: '', closeDate: '' };

function CreateCycleModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const schoolsQuery = useQuery({ queryKey: ['schools'], queryFn: fetchSchools, enabled: open });
  const yearsQuery = useQuery({ queryKey: ['academic-years'], queryFn: fetchAcademicYears, enabled: open });

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: EMPTY, mode: 'onTouched' });

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      createAdmissionCycle({
        schoolId: values.schoolId,
        academicYearId: values.academicYearId,
        name: values.name.trim(),
        description: values.description?.trim() || null,
        openDate: values.openDate,
        closeDate: values.closeDate,
      }),
    onSuccess: () => {
      message.success('Admission cycle created');
      void queryClient.invalidateQueries({ queryKey: ADMISSION_CYCLES_KEY });
      reset(EMPTY);
      onClose();
    },
    onError: () => message.error('Could not create the admission cycle. Please try again.'),
  });

  const submit = handleSubmit((values) => mutation.mutate(values));

  return (
    <Modal
      title="New admission cycle"
      open={open}
      onCancel={onClose}
      onOk={submit}
      okText="Create"
      confirmLoading={mutation.isPending}
      destroyOnHidden
      maskClosable={!mutation.isPending}
    >
      <Form layout="vertical" requiredMark="optional" onFinish={submit}>
        <Controller
          control={control}
          name="schoolId"
          render={({ field }) => (
            <Form.Item label="School" required validateStatus={errors.schoolId ? 'error' : undefined} help={errors.schoolId?.message}>
              <Select
                {...field}
                placeholder="Select a school"
                loading={schoolsQuery.isLoading}
                options={(schoolsQuery.data ?? []).map((s) => ({ value: s.id, label: s.name }))}
              />
            </Form.Item>
          )}
        />
        <Controller
          control={control}
          name="academicYearId"
          render={({ field }) => (
            <Form.Item
              label="Academic year"
              required
              validateStatus={errors.academicYearId ? 'error' : undefined}
              help={errors.academicYearId?.message}
            >
              <Select
                {...field}
                placeholder="Select an academic year"
                loading={yearsQuery.isLoading}
                options={(yearsQuery.data ?? []).map((y) => ({ value: y.id, label: y.name }))}
              />
            </Form.Item>
          )}
        />
        <Controller
          control={control}
          name="name"
          render={({ field }) => (
            <Form.Item label="Cycle name" required validateStatus={errors.name ? 'error' : undefined} help={errors.name?.message}>
              <Input {...field} placeholder="e.g. 2026-27 Admissions" autoComplete="off" />
            </Form.Item>
          )}
        />
        <Space.Compact block>
          <Controller
            control={control}
            name="openDate"
            render={({ field }) => (
              <Form.Item
                label="Open date"
                required
                style={{ width: '50%' }}
                validateStatus={errors.openDate ? 'error' : undefined}
                help={errors.openDate?.message}
              >
                <DatePicker
                  style={{ width: '100%' }}
                  value={field.value ? dayjs(field.value) : null}
                  onChange={(d) => field.onChange(d ? d.format('YYYY-MM-DD') : '')}
                />
              </Form.Item>
            )}
          />
          <Controller
            control={control}
            name="closeDate"
            render={({ field }) => (
              <Form.Item
                label="Close date"
                required
                style={{ width: '50%' }}
                validateStatus={errors.closeDate ? 'error' : undefined}
                help={errors.closeDate?.message}
              >
                <DatePicker
                  style={{ width: '100%' }}
                  value={field.value ? dayjs(field.value) : null}
                  onChange={(d) => field.onChange(d ? d.format('YYYY-MM-DD') : '')}
                />
              </Form.Item>
            )}
          />
        </Space.Compact>
        <Controller
          control={control}
          name="description"
          render={({ field }) => (
            <Form.Item label="Description" help="Optional">
              <Input.TextArea {...field} rows={2} />
            </Form.Item>
          )}
        />
      </Form>
    </Modal>
  );
}

function AdmissionCyclesPage() {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const permissions = useAuthStore((state) => state.user?.permissions);
  const canView = hasPermission(permissions, 'ADMISSION_CYCLE_VIEW');
  const canCreate = hasPermission(permissions, 'ADMISSION_CYCLE_CREATE');
  const canOpen = hasPermission(permissions, 'ADMISSION_CYCLE_OPEN');
  const canClose = hasPermission(permissions, 'ADMISSION_CYCLE_CLOSE');

  const [createOpen, setCreateOpen] = useState(false);

  const cyclesQuery = useQuery({ queryKey: ADMISSION_CYCLES_KEY, queryFn: fetchAdmissionCycles, enabled: canView });

  const openMutation = useMutation({
    mutationFn: openAdmissionCycle,
    onSuccess: () => {
      message.success('Cycle opened for public applications');
      void queryClient.invalidateQueries({ queryKey: ADMISSION_CYCLES_KEY });
    },
    onError: () => message.error('Could not open this cycle -- another cycle may already be open for this school.'),
  });
  const closeMutation = useMutation({
    mutationFn: closeAdmissionCycle,
    onSuccess: () => {
      message.success('Cycle closed');
      void queryClient.invalidateQueries({ queryKey: ADMISSION_CYCLES_KEY });
    },
    onError: () => message.error('Could not close this cycle.'),
  });

  if (!canView) {
    return <Result status="403" title="Not available" subTitle="You don't have permission to view admission cycles." />;
  }

  const columns: ColumnsType<AdmissionCycle> = [
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { title: 'Academic year', dataIndex: 'academicYearName', key: 'academicYearName' },
    { title: 'Open date', dataIndex: 'openDate', key: 'openDate' },
    { title: 'Close date', dataIndex: 'closeDate', key: 'closeDate' },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (v: string) => <Tag color={STATUS_COLOR[v]}>{v}</Tag>,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_v, record) => (
        <Space size="small">
          {record.status !== 'OPEN' && canOpen && (
            <Popconfirm
              title="Open this admission cycle?"
              description="Only one cycle can be open per school at a time."
              onConfirm={() => openMutation.mutate(record.id)}
            >
              <Button size="small" type="link" loading={openMutation.isPending}>
                Open
              </Button>
            </Popconfirm>
          )}
          {record.status === 'OPEN' && canClose && (
            <Popconfirm title="Close this admission cycle?" onConfirm={() => closeMutation.mutate(record.id)}>
              <Button size="small" type="link" danger loading={closeMutation.isPending}>
                Close
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ maxWidth: 1000, width: '100%', margin: '0 auto' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: token.marginLG }}>
        <div>
          <Title level={2} style={{ margin: 0 }}>
            Admission Cycles
          </Title>
          <Text type="secondary">Windows during which the public can submit online applications.</Text>
        </div>
        {canCreate && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
            New cycle
          </Button>
        )}
      </header>

      <Card styles={{ body: { padding: token.paddingLG } }} style={{ boxShadow: token.boxShadowTertiary }}>
        {cyclesQuery.isPending ? (
          <Skeleton active paragraph={{ rows: 5 }} />
        ) : (
          <Table<AdmissionCycle>
            rowKey="id"
            columns={columns}
            dataSource={cyclesQuery.data ?? []}
            loading={cyclesQuery.isFetching}
            locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No admission cycles yet" /> }}
            pagination={false}
          />
        )}
      </Card>

      {canCreate && <CreateCycleModal open={createOpen} onClose={() => setCreateOpen(false)} />}
    </div>
  );
}

export default AdmissionCyclesPage;
