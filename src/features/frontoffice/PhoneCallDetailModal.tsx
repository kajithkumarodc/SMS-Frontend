import { useRef } from 'react';
import { Descriptions, Modal, Typography, theme } from 'antd';
import { CloseOutlined } from '@ant-design/icons';
import { CALL_TYPE_LABEL, type PhoneCall } from '../../api/phoneCalls';
import { formatDisplayDate } from '../../lib/dates';

const { Text } = Typography;

type Props = {
  /** The call to show, or null when closed. */
  call: PhoneCall | null;
  onClose: () => void;
};

/** Full details of one Phone Call Log entry. */
function PhoneCallDetailModal({ call: current, onClose }: Props) {
  const { token } = theme.useToken();
  // Keep showing the last call while the modal animates closed -- unmounting it mid-close leaves
  // its overlay behind, blocking clicks on the page.
  const lastCall = useRef<PhoneCall | null>(null);
  if (current) lastCall.current = current;
  const call = current ?? lastCall.current;
  if (!call) return null;
  const dash = (value: string | null) => (value ? value : <Text type="secondary">—</Text>);

  return (
    <Modal
      title={<span style={{ color: token.colorWhite, fontSize: token.fontSizeLG, fontWeight: 500 }}>Phone Call Details</span>}
      open={current !== null}
      onCancel={onClose}
      footer={null}
      width={560}
      destroyOnHidden
      closeIcon={<CloseOutlined style={{ color: token.colorWhite, fontSize: 16 }} />}
      styles={{
        content: { padding: 0, overflow: 'hidden' },
        header: { background: token.colorPrimary, padding: `${token.paddingSM}px ${token.paddingLG}px`, margin: 0 },
        body: { padding: token.paddingLG },
      }}
    >
      <Descriptions size="small" column={1} bordered data-testid="phone-call-details">
        <Descriptions.Item label="Name">{dash(call.name)}</Descriptions.Item>
        <Descriptions.Item label="Phone">{call.phone}</Descriptions.Item>
        <Descriptions.Item label="Date">{formatDisplayDate(call.callDate)}</Descriptions.Item>
        <Descriptions.Item label="Description">{dash(call.description)}</Descriptions.Item>
        <Descriptions.Item label="Next Follow Up Date">{dash(formatDisplayDate(call.nextFollowUpDate))}</Descriptions.Item>
        <Descriptions.Item label="Call Duration">{dash(call.callDuration)}</Descriptions.Item>
        <Descriptions.Item label="Note">{dash(call.note)}</Descriptions.Item>
        <Descriptions.Item label="Call Type">{CALL_TYPE_LABEL[call.callType]}</Descriptions.Item>
      </Descriptions>
    </Modal>
  );
}

export default PhoneCallDetailModal;
