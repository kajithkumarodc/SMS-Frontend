import { useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, Descriptions, List, Modal, Typography, theme } from 'antd';
import { CloseOutlined, DownloadOutlined, PaperClipOutlined } from '@ant-design/icons';
import { dispatchDocumentUrl, fetchDispatch, type PostalDispatch } from '../../api/postalDispatches';
import { formatDisplayDate } from '../../lib/dates';
import { formatFileSize } from '../../lib/files';
import { POSTAL_DISPATCH_KEY } from './queryKeys';

const { Text } = Typography;

type Props = {
  /** The dispatch to show, or null when closed. Refetched so documents are current. */
  dispatch: PostalDispatch | null;
  onClose: () => void;
};

/** Full details of one Postal Dispatch, with download links for its documents. */
function PostalDispatchDetailModal({ dispatch: initial, onClose }: Props) {
  const { token } = theme.useToken();
  const open = initial !== null;
  const query = useQuery({
    queryKey: [...POSTAL_DISPATCH_KEY, initial?.id],
    queryFn: () => fetchDispatch(initial!.id),
    enabled: open,
    initialData: initial ?? undefined,
  });
  // Keep the last dispatch while the modal animates closed -- unmounting mid-close leaves its overlay behind.
  const last = useRef<PostalDispatch | null>(null);
  if (open) last.current = query.data ?? initial;
  const dispatch = open ? query.data ?? initial : last.current;
  if (!dispatch) return null;
  const dash = (value: string | null) => (value ? value : <Text type="secondary">—</Text>);

  return (
    <Modal
      title={<span style={{ color: token.colorWhite, fontSize: token.fontSizeLG, fontWeight: 500 }}>Postal Dispatch Details</span>}
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
      <Descriptions size="small" column={1} bordered data-testid="dispatch-details">
        <Descriptions.Item label="Reference No">
          <Text strong>{dispatch.referenceNo}</Text>
        </Descriptions.Item>
        <Descriptions.Item label="To Title">{dispatch.toTitle}</Descriptions.Item>
        <Descriptions.Item label="From Title">{dash(dispatch.fromTitle)}</Descriptions.Item>
        <Descriptions.Item label="Address">{dash(dispatch.address)}</Descriptions.Item>
        <Descriptions.Item label="Note">{dash(dispatch.note)}</Descriptions.Item>
        <Descriptions.Item label="Date">{formatDisplayDate(dispatch.dispatchDate)}</Descriptions.Item>
        <Descriptions.Item label="Documents">
          {dispatch.documents.length === 0 ? (
            <Text type="secondary">None attached</Text>
          ) : (
            <List
              size="small"
              split={false}
              dataSource={dispatch.documents}
              renderItem={(doc) => (
                <List.Item style={{ paddingInline: 0 }}>
                  <Button
                    type="link"
                    icon={<DownloadOutlined />}
                    href={dispatchDocumentUrl(dispatch.id, doc.id)}
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

export default PostalDispatchDetailModal;
