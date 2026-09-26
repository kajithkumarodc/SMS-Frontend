import { useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, Descriptions, Modal, Typography, theme } from 'antd';
import { CloseOutlined, DownloadOutlined } from '@ant-design/icons';
import { complaintAttachmentUrl, fetchComplaint, type Complaint } from '../../api/complaints';
import { formatDisplayDate } from '../../lib/dates';
import { formatFileSize } from '../../lib/files';
import { COMPLAINT_KEY } from './queryKeys';

const { Text } = Typography;

type Props = {
  /** The complaint to show, or null when closed. Refetched so it reflects the latest edit. */
  complaint: Complaint | null;
  onClose: () => void;
};

/** Full details of one complaint, with its document's download link. */
function ComplaintDetailModal({ complaint: initial, onClose }: Props) {
  const { token } = theme.useToken();
  const open = initial !== null;
  const query = useQuery({
    queryKey: [...COMPLAINT_KEY, initial?.id],
    queryFn: () => fetchComplaint(initial!.id),
    enabled: open,
    initialData: initial ?? undefined,
  });
  // Keep the last complaint while the modal animates closed -- unmounting mid-close leaves its overlay behind.
  const last = useRef<Complaint | null>(null);
  if (open) last.current = query.data ?? initial;
  const complaint = open ? query.data ?? initial : last.current;
  if (!complaint) return null;
  const dash = (value: string | null) => (value ? value : <Text type="secondary">—</Text>);

  return (
    <Modal
      title={<span style={{ color: token.colorWhite, fontSize: token.fontSizeLG, fontWeight: 500 }}>Complaint Details</span>}
      open={open}
      onCancel={onClose}
      footer={null}
      width={600}
      destroyOnHidden
      closeIcon={<CloseOutlined style={{ color: token.colorWhite, fontSize: 16 }} />}
      styles={{
        content: { padding: 0, overflow: 'hidden' },
        header: { background: token.colorPrimary, padding: `${token.paddingSM}px ${token.paddingLG}px`, margin: 0 },
        body: { padding: token.paddingLG },
      }}
    >
      <Descriptions size="small" column={1} bordered data-testid="complaint-details">
        <Descriptions.Item label="Complain #">
          <Text strong>{complaint.complaintNo}</Text>
        </Descriptions.Item>
        <Descriptions.Item label="Complaint Type">{dash(complaint.complaintTypeName)}</Descriptions.Item>
        <Descriptions.Item label="Source">{dash(complaint.sourceName)}</Descriptions.Item>
        <Descriptions.Item label="Complain By">{complaint.complainBy}</Descriptions.Item>
        <Descriptions.Item label="Phone">{dash(complaint.phone)}</Descriptions.Item>
        <Descriptions.Item label="Date">{formatDisplayDate(complaint.complaintDate)}</Descriptions.Item>
        <Descriptions.Item label="Description">{dash(complaint.description)}</Descriptions.Item>
        <Descriptions.Item label="Action Taken">{dash(complaint.actionTaken)}</Descriptions.Item>
        <Descriptions.Item label="Assigned">{dash(complaint.assigned)}</Descriptions.Item>
        <Descriptions.Item label="Note">{dash(complaint.note)}</Descriptions.Item>
        <Descriptions.Item label="Document">
          {complaint.attachment ? (
            <Button
              type="link"
              icon={<DownloadOutlined />}
              href={complaintAttachmentUrl(complaint.id)}
              target="_blank"
              rel="noreferrer"
              style={{ paddingInline: 0, height: 'auto', whiteSpace: 'normal', textAlign: 'left' }}
            >
              {complaint.attachment.fileName} ({formatFileSize(complaint.attachment.sizeBytes)})
            </Button>
          ) : (
            <Text type="secondary">None attached</Text>
          )}
        </Descriptions.Item>
      </Descriptions>
    </Modal>
  );
}

export default ComplaintDetailModal;
