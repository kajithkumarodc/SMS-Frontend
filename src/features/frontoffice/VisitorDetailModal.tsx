import { useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, Descriptions, Modal, Typography, theme } from 'antd';
import { CloseOutlined, DownloadOutlined, EditOutlined } from '@ant-design/icons';
import { fetchVisitor, meetingWithLabel, visitorAttachmentUrl, type Visitor } from '../../api/visitors';
import { formatDisplayDate, formatDisplayTime } from '../../lib/dates';
import { VISITOR_KEY } from './queryKeys';

const { Text } = Typography;

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type Props = {
  /** The visitor to show, or null when closed. Refetched so it reflects the latest edit. */
  visitor: Visitor | null;
  onClose: () => void;
  onEdit?: (visitor: Visitor) => void;
};

/** Full details of one Visitor Book entry, including its attached document. */
function VisitorDetailModal({ visitor: initial, onClose, onEdit }: Props) {
  const { token } = theme.useToken();
  const open = initial !== null;
  const visitorQuery = useQuery({
    queryKey: [...VISITOR_KEY, initial?.id],
    queryFn: () => fetchVisitor(initial!.id),
    enabled: open,
    initialData: initial ?? undefined,
  });
  // Keep the last visitor while the modal animates closed -- unmounting mid-close leaves its overlay behind.
  const lastVisitor = useRef<Visitor | null>(null);
  if (open) lastVisitor.current = visitorQuery.data ?? initial;
  const visitor = open ? visitorQuery.data ?? initial : lastVisitor.current;
  if (!visitor) return null;

  const dash = (value: string | number | null | undefined) =>
    value === null || value === undefined || value === '' ? <Text type="secondary">—</Text> : value;

  return (
    <Modal
      title={
        <span style={{ color: token.colorWhite, fontSize: token.fontSizeLG, fontWeight: 500 }}>Visitor Details</span>
      }
      open={open}
      onCancel={onClose}
      width={640}
      destroyOnHidden
      closeIcon={<CloseOutlined style={{ color: token.colorWhite, fontSize: 16 }} />}
      styles={{
        content: { padding: 0, overflow: 'hidden' },
        header: { background: token.colorPrimary, padding: `${token.paddingSM}px ${token.paddingLG}px`, margin: 0 },
        body: { padding: token.paddingLG },
        footer: { padding: `0 ${token.paddingLG}px ${token.paddingLG}px`, margin: 0 },
      }}
      footer={
        onEdit && (
          <Button icon={<EditOutlined />} onClick={() => onEdit(visitor)}>
            Edit
          </Button>
        )
      }
    >
      <Descriptions size="small" column={1} bordered data-testid="visitor-details">
        <Descriptions.Item label="Purpose">{dash(visitor.purposeName)}</Descriptions.Item>
        <Descriptions.Item label="Meeting With">{meetingWithLabel(visitor)}</Descriptions.Item>
        <Descriptions.Item label="Visitor Name">{visitor.visitorName}</Descriptions.Item>
        <Descriptions.Item label="Phone">{dash(visitor.phone)}</Descriptions.Item>
        <Descriptions.Item label="ID Card">{dash(visitor.idCard)}</Descriptions.Item>
        <Descriptions.Item label="Number Of Person">{dash(visitor.numberOfPersons)}</Descriptions.Item>
        <Descriptions.Item label="Date">{formatDisplayDate(visitor.visitDate)}</Descriptions.Item>
        <Descriptions.Item label="In Time">{dash(formatDisplayTime(visitor.inTime))}</Descriptions.Item>
        <Descriptions.Item label="Out Time">{dash(formatDisplayTime(visitor.outTime))}</Descriptions.Item>
        <Descriptions.Item label="Note">{dash(visitor.note)}</Descriptions.Item>
        <Descriptions.Item label="Document">
          {visitor.attachment ? (
            <Button
              type="link"
              icon={<DownloadOutlined />}
              href={visitorAttachmentUrl(visitor.id)}
              target="_blank"
              rel="noreferrer"
              style={{ paddingInline: 0, height: 'auto', whiteSpace: 'normal', textAlign: 'left' }}
            >
              {visitor.attachment.fileName} ({formatSize(visitor.attachment.sizeBytes)})
            </Button>
          ) : (
            <Text type="secondary">None attached</Text>
          )}
        </Descriptions.Item>
      </Descriptions>
    </Modal>
  );
}

export default VisitorDetailModal;
