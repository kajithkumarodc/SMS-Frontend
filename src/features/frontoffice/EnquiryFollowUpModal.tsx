import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  App,
  Button,
  Col,
  DatePicker,
  Descriptions,
  Divider,
  Empty,
  Form,
  Input,
  List,
  Modal,
  Row,
  Select,
  Skeleton,
  Space,
  Tag,
  Typography,
  theme,
} from 'antd';
import { CloseOutlined, EditOutlined, UserAddOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  changeEnquiryStatus,
  fetchEnquiry,
  fetchFollowUps,
  recordFollowUp,
  type Enquiry,
  type FollowUpType,
} from '../../api/enquiries';
import { API_DATE_FORMAT, DISPLAY_DATE_FORMAT, formatDisplayDate, todayApiDate } from '../../lib/dates';
import { ENQUIRIES_KEY, ENQUIRY_KEY, ENQUIRY_SUMMARY_KEY, FOLLOW_UPS_KEY } from './queryKeys';
import {
  ENQUIRY_STATUS_COLOR,
  ENQUIRY_STATUS_OPTIONS,
  FOLLOW_UP_TYPE_OPTIONS,
  enquiryStatusLabel,
} from './status';
import ConvertEnquiryModal from './ConvertEnquiryModal';

const { Text, Title } = Typography;

const schema = z
  .object({
    followUpDate: z.string().min(1, 'Follow up date is required'),
    nextFollowUpDate: z.string().min(1, 'Next follow up date is required'),
    followUpType: z.string().min(1, 'Select a type'),
    notes: z.string().trim().min(1, 'Add a short note on the response').max(2000),
  })
  .refine((v) => !v.nextFollowUpDate || !v.followUpDate || v.nextFollowUpDate >= v.followUpDate, {
    path: ['nextFollowUpDate'],
    message: "Can't be before the follow up date",
  });

type FormValues = z.infer<typeof schema>;

function emptyForm(): FormValues {
  return { followUpDate: todayApiDate(), nextFollowUpDate: '', followUpType: 'CALL', notes: '' };
}

type Props = {
  /** The enquiry to follow up, or null when closed. The modal refetches it so status/dates stay current. */
  enquiry: Enquiry | null;
  onClose: () => void;
  onEdit: (enquiry: Enquiry) => void;
  canFollowUp: boolean;
  canEdit: boolean;
  canConvert: boolean;
};

/** Opened from a row's call button: record a follow-up, see the history, change status, convert. */
function EnquiryFollowUpModal({ enquiry: initial, onClose, onEdit, canFollowUp, canEdit, canConvert }: Props) {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const open = initial !== null;
  const id = initial?.id;
  const [convertOpen, setConvertOpen] = useState(false);

  const enquiryQuery = useQuery({
    queryKey: [...ENQUIRY_KEY, id],
    queryFn: () => fetchEnquiry(id!),
    enabled: open,
    initialData: initial ?? undefined,
  });
  const followUpsQuery = useQuery({
    queryKey: [...FOLLOW_UPS_KEY, id],
    queryFn: () => fetchFollowUps(id!),
    enabled: open,
  });
  const enquiry = enquiryQuery.data ?? initial;

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: emptyForm(), mode: 'onTouched' });

  useEffect(() => {
    if (open) reset(emptyForm());
  }, [open, id, reset]);

  const refreshEnquiry = () => {
    void queryClient.invalidateQueries({ queryKey: ENQUIRIES_KEY });
    void queryClient.invalidateQueries({ queryKey: ENQUIRY_SUMMARY_KEY });
    void queryClient.invalidateQueries({ queryKey: [...ENQUIRY_KEY, id] });
  };

  const followUpMutation = useMutation({
    mutationFn: (values: FormValues) =>
      recordFollowUp(id!, {
        followUpDate: values.followUpDate,
        followUpType: values.followUpType as FollowUpType,
        notes: values.notes.trim(),
        nextFollowUpDate: values.nextFollowUpDate,
      }),
    onSuccess: () => {
      message.success('Follow up saved');
      void queryClient.invalidateQueries({ queryKey: [...FOLLOW_UPS_KEY, id] });
      refreshEnquiry();
      reset(emptyForm());
    },
    onError: () => message.error('Could not save the follow up. Please try again.'),
  });

  const statusMutation = useMutation({
    mutationFn: (status: Enquiry['status']) => changeEnquiryStatus(id!, status),
    onSuccess: (saved) => {
      message.success(`Status changed to ${enquiryStatusLabel(saved.status)}`);
      refreshEnquiry();
    },
    onError: () => message.error('Could not change the status. Please try again.'),
  });

  if (!enquiry) return null;

  const submit = handleSubmit((values) => followUpMutation.mutate(values));
  const fieldError = (name: keyof FormValues) =>
    errors[name] ? { validateStatus: 'error' as const, help: errors[name]?.message } : {};
  const fid = (name: keyof FormValues) => `follow-up-${name}`;
  const dash = (value: string | number | null | undefined) =>
    value === null || value === undefined || value === '' ? <Text type="secondary">—</Text> : value;

  const dateField = (name: 'followUpDate' | 'nextFollowUpDate', label: string, required: boolean) => (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <Form.Item label={label} htmlFor={fid(name)} required={required} {...fieldError(name)}>
          <DatePicker
            id={fid(name)}
            style={{ width: '100%' }}
            format={DISPLAY_DATE_FORMAT}
            allowClear={!required}
            value={field.value ? dayjs(field.value) : null}
            onChange={(d) => field.onChange(d ? d.format(API_DATE_FORMAT) : '')}
            onBlur={field.onBlur}
          />
        </Form.Item>
      )}
    />
  );

  return (
    <>
      <Modal
        title={
          <span style={{ color: token.colorWhite, fontSize: token.fontSizeLG, fontWeight: 500 }}>
            Follow Up Admission Enquiry
          </span>
        }
        open={open}
        onCancel={onClose}
        width={1000}
        destroyOnHidden
        footer={null}
        closeIcon={<CloseOutlined style={{ color: token.colorWhite, fontSize: 16 }} />}
        styles={{
          content: { padding: 0, overflow: 'hidden' },
          header: { background: token.colorPrimary, padding: `${token.paddingSM}px ${token.paddingLG}px`, margin: 0 },
          body: { padding: token.paddingLG },
        }}
      >
        <Row gutter={[token.marginLG, token.marginLG]}>
          <Col xs={24} md={12}>
            {canFollowUp && !enquiry.archived && (
              <Form layout="vertical" onFinish={submit} data-testid="follow-up-form">
                <Row gutter={token.marginSM}>
                  <Col xs={24} sm={12}>{dateField('followUpDate', 'Follow Up Date', true)}</Col>
                  <Col xs={24} sm={12}>{dateField('nextFollowUpDate', 'Next Follow Up Date', true)}</Col>
                </Row>
                <Controller
                  control={control}
                  name="followUpType"
                  render={({ field }) => (
                    <Form.Item label="Type" htmlFor={fid('followUpType')} required {...fieldError('followUpType')}>
                      <Select {...field} id={fid('followUpType')} options={FOLLOW_UP_TYPE_OPTIONS} />
                    </Form.Item>
                  )}
                />
                <Controller
                  control={control}
                  name="notes"
                  render={({ field }) => (
                    <Form.Item label="Response" htmlFor={fid('notes')} required {...fieldError('notes')}>
                      <Input.TextArea {...field} id={fid('notes')} rows={3} placeholder="What did the family say?" />
                    </Form.Item>
                  )}
                />
                <Button type="primary" htmlType="submit" loading={followUpMutation.isPending}>
                  Save
                </Button>
              </Form>
            )}

            <Divider orientation="left" orientationMargin={0} style={{ marginTop: canFollowUp ? undefined : 0 }}>
              Follow Up History
            </Divider>
            {followUpsQuery.isPending ? (
              <Skeleton active paragraph={{ rows: 3 }} />
            ) : (followUpsQuery.data ?? []).length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No follow ups yet" />
            ) : (
              <List
                size="small"
                dataSource={followUpsQuery.data}
                style={{ maxHeight: 320, overflowY: 'auto' }}
                renderItem={(item) => (
                  <List.Item>
                    <Space direction="vertical" size={0} style={{ width: '100%' }}>
                      <Space wrap size="small">
                        <Text strong>{formatDisplayDate(item.followUpDate)}</Text>
                        <Tag>{FOLLOW_UP_TYPE_OPTIONS.find((o) => o.value === item.followUpType)?.label ?? item.followUpType}</Tag>
                        {item.staffName && <Text type="secondary">by {item.staffName}</Text>}
                      </Space>
                      {item.notes && <Text>{item.notes}</Text>}
                      {item.nextFollowUpDate && (
                        <Text type="secondary">Next follow up: {formatDisplayDate(item.nextFollowUpDate)}</Text>
                      )}
                    </Space>
                  </List.Item>
                )}
              />
            )}
          </Col>

          <Col xs={24} md={12}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: token.marginSM }}>
              <Title level={5} style={{ margin: 0 }}>
                {enquiry.applicantName}
              </Title>
              <Tag color={ENQUIRY_STATUS_COLOR[enquiry.status]}>{enquiryStatusLabel(enquiry.status)}</Tag>
            </div>
            <Text type="secondary">{enquiry.enquiryNumber}</Text>

            <Descriptions size="small" column={1} bordered style={{ marginTop: token.marginSM }}>
              <Descriptions.Item label="Phone">{dash(enquiry.phone)}</Descriptions.Item>
              <Descriptions.Item label="Email">{dash(enquiry.email)}</Descriptions.Item>
              <Descriptions.Item label="Address">{dash(enquiry.address)}</Descriptions.Item>
              <Descriptions.Item label="Enquiry Date">{formatDisplayDate(enquiry.enquiryDate)}</Descriptions.Item>
              <Descriptions.Item label="Last Follow Up">{dash(formatDisplayDate(enquiry.lastFollowUpDate))}</Descriptions.Item>
              <Descriptions.Item label="Next Follow Up">{dash(formatDisplayDate(enquiry.followUpDate))}</Descriptions.Item>
              <Descriptions.Item label="Class">{dash(enquiry.className)}</Descriptions.Item>
              <Descriptions.Item label="Source">{dash(enquiry.sourceName)}</Descriptions.Item>
              <Descriptions.Item label="Reference">{dash(enquiry.referenceName)}</Descriptions.Item>
              <Descriptions.Item label="Assigned">{dash(enquiry.assignedStaffName)}</Descriptions.Item>
              <Descriptions.Item label="Number Of Child">{dash(enquiry.numberOfChildren)}</Descriptions.Item>
              <Descriptions.Item label="Description">{dash(enquiry.description)}</Descriptions.Item>
              <Descriptions.Item label="Note">{dash(enquiry.remarks)}</Descriptions.Item>
            </Descriptions>

            {!enquiry.archived && (canEdit || canConvert) && (
              <Space wrap style={{ marginTop: token.marginMD }}>
                {canEdit && (
                  <Select
                    aria-label="Change status"
                    style={{ width: 150 }}
                    value={enquiry.status}
                    options={ENQUIRY_STATUS_OPTIONS}
                    loading={statusMutation.isPending}
                    onChange={(value) => statusMutation.mutate(value)}
                  />
                )}
                {canEdit && (
                  <Button icon={<EditOutlined />} onClick={() => onEdit(enquiry)}>
                    Edit
                  </Button>
                )}
                {canConvert && !enquiry.convertedStudentId && (
                  <Button icon={<UserAddOutlined />} onClick={() => setConvertOpen(true)}>
                    Convert to student
                  </Button>
                )}
                {enquiry.convertedStudentId && <Tag color="success">Converted to student</Tag>}
              </Space>
            )}
          </Col>
        </Row>
      </Modal>

      <ConvertEnquiryModal enquiry={convertOpen ? enquiry : null} onClose={() => setConvertOpen(false)} />
    </>
  );
}

export default EnquiryFollowUpModal;
