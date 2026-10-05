import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App, Button, Card, Col, DatePicker, Divider, Form, Input, InputNumber, Result, Row, Select, Typography, theme } from 'antd';
import dayjs from 'dayjs';
import { fetchInventoryCategories, fetchInventoryItems, issueInventoryItem } from '../../api/inventory';
import { fetchStaffDirectory, fetchStaffOptions, type StaffCard } from '../../api/staffMembers';
import { useAuthStore } from '../../store/authStore';
import { hasPermission } from '../../lib/roles';
import { API_DATE_FORMAT, DISPLAY_DATE_FORMAT, todayApiDate } from '../../lib/dates';
import { serverMessage } from '../../lib/apiErrors';
import { STAFF_DIRECTORY_KEY, STAFF_OPTIONS_KEY } from '../staff/directory/queryKeys';
import { INVENTORY_CATEGORIES_KEY, INVENTORY_ISSUES_KEY, INVENTORY_ITEMS_KEY } from './queryKeys';

const { Title } = Typography;

const schema = z
  .object({
    roleId: z.string().min(1, 'User Type is required'),
    issueToStaffId: z.string().min(1, 'Issue To is required'),
    issuedByStaffId: z.string().min(1, 'Issue By is required'),
    issueDate: z.string().min(1, 'Issue Date is required'),
    returnDate: z.string(),
    note: z.string().max(500, 'Keep this under 500 characters'),
    categoryId: z.string().min(1, 'Item Category is required'),
    itemId: z.string().min(1, 'Item is required'),
    quantity: z.number({ invalid_type_error: 'Quantity is required' }).int('Use a whole number').min(1, 'Quantity must be at least 1'),
  })
  .refine((v) => !v.returnDate || v.returnDate >= v.issueDate, { path: ['returnDate'], message: 'Return Date can\'t be before the Issue Date' });

type FormValues = z.infer<typeof schema>;

const staffLabel = (s: StaffCard) => `${s.fullName} (${s.staffId})`;

/** Inventory -> Issue Item -> Issue Item (/app/inventory/issue-item/create): issue an item to a staff member. */
function IssueItemFormPage() {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const permissions = useAuthStore((state) => state.user?.permissions);
  const canIssue = hasPermission(permissions, 'INVENTORY_ISSUE');
  const canViewStaff = hasPermission(permissions, 'STAFF_VIEW');

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
    defaultValues: {
      roleId: '',
      issueToStaffId: '',
      issuedByStaffId: '',
      issueDate: todayApiDate(),
      returnDate: '',
      note: '',
      categoryId: '',
      itemId: '',
      quantity: undefined as unknown as number,
    },
  });
  const roleId = watch('roleId');
  const categoryId = watch('categoryId');
  const itemId = watch('itemId');

  const optionsQuery = useQuery({ queryKey: STAFF_OPTIONS_KEY, queryFn: fetchStaffOptions, enabled: canIssue && canViewStaff });
  const issueToQuery = useQuery({
    queryKey: [...STAFF_DIRECTORY_KEY, { roleId }],
    queryFn: () => fetchStaffDirectory({ roleId }),
    enabled: canIssue && canViewStaff && roleId !== '',
  });
  const issuedByQuery = useQuery({
    queryKey: [...STAFF_DIRECTORY_KEY, {}],
    queryFn: () => fetchStaffDirectory({}),
    enabled: canIssue && canViewStaff,
  });
  const categoriesQuery = useQuery({ queryKey: INVENTORY_CATEGORIES_KEY, queryFn: fetchInventoryCategories, enabled: canIssue });
  const itemsQuery = useQuery({
    queryKey: [...INVENTORY_ITEMS_KEY, categoryId],
    queryFn: () => fetchInventoryItems(categoryId),
    enabled: canIssue && categoryId !== '',
  });

  // Changing a choice invalidates the ones that depend on it.
  useEffect(() => {
    setValue('issueToStaffId', '');
  }, [roleId, setValue]);
  useEffect(() => {
    setValue('itemId', '');
  }, [categoryId, setValue]);

  const selectedItem = itemsQuery.data?.find((i) => i.id === itemId);

  const issueMutation = useMutation({
    mutationFn: (values: FormValues) =>
      issueInventoryItem({
        issueToStaffId: values.issueToStaffId,
        issuedByStaffId: values.issuedByStaffId,
        issueDate: values.issueDate,
        returnDate: values.returnDate || null,
        note: values.note.trim() || null,
        itemId: values.itemId,
        quantity: values.quantity,
      }),
    onSuccess: (issue) => {
      message.success(`${issue.itemName ?? 'Item'} issued to ${issue.issueToName ?? 'staff member'}`);
      void queryClient.invalidateQueries({ queryKey: INVENTORY_ISSUES_KEY });
      void queryClient.invalidateQueries({ queryKey: INVENTORY_ITEMS_KEY });
      navigate('/app/inventory/issue-item');
    },
    onError: (error) => message.error(serverMessage(error) ?? 'Could not issue the item. Please try again.'),
  });

  if (!canIssue) {
    return <Result status="403" title="Not available" subTitle="You don't have permission to issue items." />;
  }

  const err = (name: keyof FormValues) => ({ validateStatus: errors[name] ? ('error' as const) : undefined, help: errors[name]?.message });

  return (
    <Card
      title={
        <Title level={4} style={{ margin: 0, fontWeight: 500 }}>
          Issue Item
        </Title>
      }
    >
      <Form layout="vertical" onFinish={handleSubmit((values) => issueMutation.mutate(values))} data-testid="issue-item-form">
        <Row gutter={token.marginLG}>
          <Col xs={24} md={8}>
            <Controller
              control={control}
              name="roleId"
              render={({ field }) => (
                <Form.Item label="User Type" htmlFor="issue-role" required {...err('roleId')}>
                  <Select
                    id="issue-role"
                    placeholder="Select"
                    showSearch
                    optionFilterProp="label"
                    loading={optionsQuery.isLoading}
                    options={(optionsQuery.data?.roles ?? []).map((r) => ({ value: r.id, label: r.name }))}
                    value={field.value || undefined}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                  />
                </Form.Item>
              )}
            />
          </Col>
          <Col xs={24} md={8}>
            <Controller
              control={control}
              name="issueToStaffId"
              render={({ field }) => (
                <Form.Item label="Issue To" htmlFor="issue-to" required {...err('issueToStaffId')}>
                  <Select
                    id="issue-to"
                    placeholder="Select"
                    showSearch
                    optionFilterProp="label"
                    disabled={!roleId}
                    loading={issueToQuery.isFetching}
                    options={(issueToQuery.data ?? []).map((s) => ({ value: s.id, label: staffLabel(s) }))}
                    value={field.value || undefined}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                  />
                </Form.Item>
              )}
            />
          </Col>
          <Col xs={24} md={8}>
            <Controller
              control={control}
              name="issuedByStaffId"
              render={({ field }) => (
                <Form.Item label="Issue By" htmlFor="issue-by" required {...err('issuedByStaffId')}>
                  <Select
                    id="issue-by"
                    placeholder="Select"
                    showSearch
                    optionFilterProp="label"
                    loading={issuedByQuery.isLoading}
                    options={(issuedByQuery.data ?? []).map((s) => ({ value: s.id, label: staffLabel(s) }))}
                    value={field.value || undefined}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                  />
                </Form.Item>
              )}
            />
          </Col>
          <Col xs={24} md={8}>
            <Controller
              control={control}
              name="issueDate"
              render={({ field }) => (
                <Form.Item label="Issue Date" htmlFor="issue-date" required {...err('issueDate')}>
                  <DatePicker
                    id="issue-date"
                    style={{ width: '100%' }}
                    format={DISPLAY_DATE_FORMAT}
                    allowClear={false}
                    value={field.value ? dayjs(field.value) : null}
                    onChange={(d) => field.onChange(d ? d.format(API_DATE_FORMAT) : '')}
                    onBlur={field.onBlur}
                  />
                </Form.Item>
              )}
            />
          </Col>
          <Col xs={24} md={8}>
            <Controller
              control={control}
              name="returnDate"
              render={({ field }) => (
                <Form.Item label="Return Date" htmlFor="issue-return-date" {...err('returnDate')}>
                  <DatePicker
                    id="issue-return-date"
                    style={{ width: '100%' }}
                    format={DISPLAY_DATE_FORMAT}
                    value={field.value ? dayjs(field.value) : null}
                    onChange={(d) => field.onChange(d ? d.format(API_DATE_FORMAT) : '')}
                    onBlur={field.onBlur}
                  />
                </Form.Item>
              )}
            />
          </Col>
          <Col xs={24} md={8}>
            <Controller
              control={control}
              name="note"
              render={({ field }) => (
                <Form.Item label="Note" htmlFor="issue-note" {...err('note')}>
                  <Input.TextArea {...field} id="issue-note" rows={2} maxLength={500} />
                </Form.Item>
              )}
            />
          </Col>
        </Row>

        <Divider />

        <Row gutter={token.marginLG}>
          <Col xs={24} md={8}>
            <Controller
              control={control}
              name="categoryId"
              render={({ field }) => (
                <Form.Item label="Item Category" htmlFor="issue-category" required {...err('categoryId')}>
                  <Select
                    id="issue-category"
                    placeholder="Select"
                    showSearch
                    optionFilterProp="label"
                    loading={categoriesQuery.isLoading}
                    options={(categoriesQuery.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
                    value={field.value || undefined}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                  />
                </Form.Item>
              )}
            />
          </Col>
          <Col xs={24} md={8}>
            <Controller
              control={control}
              name="itemId"
              render={({ field }) => (
                <Form.Item
                  label="Item"
                  htmlFor="issue-item"
                  required
                  {...err('itemId')}
                  extra={selectedItem ? `${selectedItem.stock} in stock` : undefined}
                >
                  <Select
                    id="issue-item"
                    placeholder="Select"
                    showSearch
                    optionFilterProp="label"
                    disabled={!categoryId}
                    loading={itemsQuery.isFetching}
                    options={(itemsQuery.data ?? []).map((i) => ({ value: i.id, label: i.name, disabled: i.stock === 0 }))}
                    value={field.value || undefined}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                  />
                </Form.Item>
              )}
            />
          </Col>
          <Col xs={24} md={8}>
            <Controller
              control={control}
              name="quantity"
              render={({ field }) => (
                <Form.Item label="Quantity" htmlFor="issue-quantity" required {...err('quantity')}>
                  <InputNumber
                    id="issue-quantity"
                    style={{ width: '100%' }}
                    min={1}
                    max={selectedItem?.stock}
                    precision={0}
                    value={field.value ?? null}
                    onChange={(v) => field.onChange(v ?? undefined)}
                    onBlur={field.onBlur}
                  />
                </Form.Item>
              )}
            />
          </Col>
        </Row>

        <Divider />
        <div style={{ textAlign: 'right' }}>
          <Button type="primary" htmlType="submit" loading={issueMutation.isPending}>
            Submit
          </Button>
        </div>
      </Form>
    </Card>
  );
}

export default IssueItemFormPage;
