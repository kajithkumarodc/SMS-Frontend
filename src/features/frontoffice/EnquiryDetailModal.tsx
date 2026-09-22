import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App, Button, Descriptions, Empty, List, Modal, Select, Skeleton, Space, Tag, Typography, theme } from 'antd';
import { changeEnquiryStatus, fetchFollowUps, setEnquiryArchived, type Enquiry } from '../../api/enquiries';
import { ENQUIRIES_KEY, ENQUIRY_KEY, ENQUIRY_SUMMARY_KEY, FOLLOW_UPS_KEY } from './queryKeys';
import { ENQUIRY_STATUS_COLOR, ENQUIRY_STATUS_OPTIONS, enquiryStatusLabel } from './status';
import RecordFollowUpModal from './RecordFollowUpModal';
import ConvertEnquiryModal from './ConvertEnquiryModal';

const { Text, Title } = Typography;

type Props = {
  /** The enquiry being viewed, or null when the modal is closed. */
  enquiry: Enquiry | null;
  onClose: () => void;
  onEdit: (enquiry: Enquiry) => void;
  canEdit: boolean;
  canFollowUp: boolean;
  canConvert: boolean;
  canArchive: boolean;
};

function EnquiryDetailModal({ enquiry, onClose, onEdit, canEdit, canFollowUp, canConvert, canArchive }: Props) {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const open = enquiry !== null;
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);

  const followUpsQuery = useQuery({
    queryKey: enquiry ? [...FOLLOW_UPS_KEY, enquiry.id] : FOLLOW_UPS_KEY,
    queryFn: () => fetchFollowUps(enquiry!.id),
    enabled: open,
  });

  const statusMutation = useMutation({
    mutationFn: (status: Enquiry['status']) => {
      if (!enquiry) return Promise.reject(new Error('No enquiry'));
      return changeEnquiryStatus(enquiry.id, status);
    },
    onSuccess: () => {
      message.success('Status updated');
      void queryClient.invalidateQueries({ queryKey: ENQUIRIES_KEY });
      void queryClient.invalidateQueries({ queryKey: ENQUIRY_SUMMARY_KEY });
      if (enquiry) void queryClient.invalidateQueries({ queryKey: [...ENQUIRY_KEY, enquiry.id] });
    },
    onError: () => message.error('Could not change the status. Please try again.'),
  });

  const archiveMutation = useMutation({
    mutationFn: (archived: boolean) => {
      if (!enquiry) return Promise.reject(new Error('No enquiry'));
      return setEnquiryArchived(enquiry.id, archived);
    },
    onSuccess: (saved) => {
      message.success(saved.archived ? 'Enquiry archived' : 'Enquiry restored');
      void queryClient.invalidateQueries({ queryKey: ENQUIRIES_KEY });
      void queryClient.invalidateQueries({ queryKey: ENQUIRY_SUMMARY_KEY });
      onClose();
    },
    onError: () => message.error('Could not update the enquiry. Please try again.'),
  });

  if (!enquiry) {
    return null;
  }

  return (
    <>
      <Modal
        title={
          <Space>
            <span>{enquiry.enquiryNumber}</span>
            <Tag color={ENQUIRY_STATUS_COLOR[enquiry.status]}>{enquiryStatusLabel(enquiry.status)}</Tag>
            {enquiry.archived && <Tag>Archived</Tag>}
          </Space>
        }
        open={open}
        onCancel={onClose}
        width={640}
        footer={
          <Space wrap>
            {canEdit && !enquiry.archived && <Button onClick={() => onEdit(enquiry)}>Edit</Button>}
            {canFollowUp && !enquiry.archived && (
              <Button onClick={() => setFollowUpOpen(true)}>Record follow-up</Button>
            )}
            {canConvert && !enquiry.convertedStudentId && !enquiry.archived && (
              <Button type="primary" onClick={() => setConvertOpen(true)}>
                Convert to student
              </Button>
            )}
            {canArchive && (
              <Button
                danger={!enquiry.archived}
                loading={archiveMutation.isPending}
                onClick={() => archiveMutation.mutate(!enquiry.archived)}
              >
                {enquiry.archived ? 'Restore' : 'Archive'}
              </Button>
            )}
            <Button onClick={onClose}>Close</Button>
          </Space>
        }
      >
        <Descriptions size="small" column={2} bordered style={{ marginBottom: token.marginLG }}>
          <Descriptions.Item label="Applicant" span={2}>
            {enquiry.applicantName}
          </Descriptions.Item>
          <Descriptions.Item label="Guardian">{enquiry.guardianName || <Text type="secondary">—</Text>}</Descriptions.Item>
          <Descriptions.Item label="Phone">{enquiry.phone || <Text type="secondary">—</Text>}</Descriptions.Item>
          <Descriptions.Item label="Email" span={2}>
            {enquiry.email || <Text type="secondary">—</Text>}
          </Descriptions.Item>
          <Descriptions.Item label="Source">{enquiry.sourceName || <Text type="secondary">—</Text>}</Descriptions.Item>
          <Descriptions.Item label="Assigned to">
            {enquiry.assignedStaffName || <Text type="secondary">Unassigned</Text>}
          </Descriptions.Item>
          <Descriptions.Item label="Enquiry date">{enquiry.enquiryDate}</Descriptions.Item>
          <Descriptions.Item label="Next follow-up">{enquiry.followUpDate || <Text type="secondary">—</Text>}</Descriptions.Item>
          <Descriptions.Item label="Remarks" span={2}>
            {enquiry.remarks || <Text type="secondary">—</Text>}
          </Descriptions.Item>
        </Descriptions>

        {canEdit && !enquiry.archived && (
          <Space align="center" style={{ marginBottom: token.marginLG }}>
            <Text type="secondary">Status:</Text>
            <Select
              size="small"
              style={{ width: 160 }}
              value={enquiry.status}
              options={ENQUIRY_STATUS_OPTIONS}
              loading={statusMutation.isPending}
              onChange={(value) => statusMutation.mutate(value)}
            />
          </Space>
        )}

        <Title level={5}>Follow-up history</Title>
        {followUpsQuery.isPending ? (
          <Skeleton active paragraph={{ rows: 2 }} />
        ) : (followUpsQuery.data ?? []).length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No follow-ups recorded yet" />
        ) : (
          <List
            size="small"
            dataSource={followUpsQuery.data}
            renderItem={(item) => (
              <List.Item>
                <Space direction="vertical" size={0} style={{ width: '100%' }}>
                  <Space>
                    <Text strong>{item.followUpDate}</Text>
                    <Tag>{item.followUpType}</Tag>
                    {item.staffName && <Text type="secondary">by {item.staffName}</Text>}
                  </Space>
                  {item.notes && <Text>{item.notes}</Text>}
                  {item.nextFollowUpDate && (
                    <Text type="secondary">Next follow-up: {item.nextFollowUpDate}</Text>
                  )}
                </Space>
              </List.Item>
            )}
          />
        )}
      </Modal>

      <RecordFollowUpModal enquiry={followUpOpen ? enquiry : null} onClose={() => setFollowUpOpen(false)} />
      <ConvertEnquiryModal enquiry={convertOpen ? enquiry : null} onClose={() => setConvertOpen(false)} />
    </>
  );
}

export default EnquiryDetailModal;
