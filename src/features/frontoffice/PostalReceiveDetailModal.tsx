import { useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, Descriptions, List, Modal, Typography, theme } from 'antd';
import { CloseOutlined, DownloadOutlined, PaperClipOutlined } from '@ant-design/icons';
import { receiveDocumentUrl, fetchReceive, type PostalReceive } from '../../api/postalReceives';
import { formatDisplayDate } from '../../lib/dates';
import { formatFileSize } from '../../lib/files';
import { POSTAL_RECEIVE_KEY } from './queryKeys';

const { Text } = Typography;

type Props = {
  /** The receive to show, or null when closed. Refetched so documents are current. */
  receive: PostalReceive | null;
  onClose: () => void;
};

/** Full details of one Postal Receive, with download links for its documents. */
function PostalReceiveDetailModal({ receive: initial, onClose }: Props) {
  const { token } = theme.useToken();
  const open = initial !== null;
  const query = useQuery({
    queryKey: [...POSTAL_RECEIVE_KEY, initial?.id],
    queryFn: () => fetchReceive(initial!.id),
    enabled: open,
    initialData: initial ?? undefined,
  });
  // Keep the last receive while the modal animates closed -- unmounting mid-close leaves its overlay behind.
  const last = useRef<PostalReceive | null>(null);
  if (open) last.current = query.data ?? initial;
  const receive = open ? query.data ?? initial : last.current;
  if (!receive) return null;
  const dash = (value: string | null) => (value ? value : <Text type="secondary">—</Text>);

  return (
    <Modal
      title={<span style={{ color: token.colorWhite, fontSize: token.fontSizeLG, fontWeight: 500 }}>Postal Receive Details</span>}
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
      <Descriptions size="small" column={1} bordered data-testid="receive-details">
        <Descriptions.Item label="Reference No">
          <Text strong>{receive.referenceNo}</Text>
        </Descriptions.Item>
        <Descriptions.Item label="From Title">{receive.fromTitle}</Descriptions.Item>
        <Descriptions.Item label="To Title">{dash(receive.toTitle)}</Descriptions.Item>
        <Descriptions.Item label="Address">{dash(receive.address)}</Descriptions.Item>
        <Descriptions.Item label="Note">{dash(receive.note)}</Descriptions.Item>
        <Descriptions.Item label="Date">{formatDisplayDate(receive.receiveDate)}</Descriptions.Item>
        <Descriptions.Item label="Documents">
          {receive.documents.length === 0 ? (
            <Text type="secondary">None attached</Text>
          ) : (
            <List
              size="small"
              split={false}
              dataSource={receive.documents}
              renderItem={(doc) => (
                <List.Item style={{ paddingInline: 0 }}>
                  <Button
                    type="link"
                    icon={<DownloadOutlined />}
                    href={receiveDocumentUrl(receive.id, doc.id)}
                    target="_blank"
                    rel="noreferrer"
                    style={{ paddingInline: 0, height: 'auto', whiteSpace: 'normal', textAlign: 'left' }}
                  >
                    <PaperClipOutlined /> {doc.fileName} ({formatFileSize(doc.sizeBytes)})
                  </Button>
                </List.Item>
              )}
            />
          )}
        </Descriptions.Item>
      </Descriptions>
    </Modal>
  );
}

export default PostalReceiveDetailModal;
