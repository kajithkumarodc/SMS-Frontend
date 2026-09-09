import { Button, Popconfirm, Space, Typography, theme } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import { formatPostedAt } from './format';

const { Text, Paragraph } = Typography;

type Props = {
  title: string;
  body: string;
  createdAt: string;
  /** When set, a "Delete" action with a confirmation popup is shown. */
  onDelete?: () => void;
  deleting?: boolean;
};

/** One announcement — title, posted date, body. Shared by the dashboard card and the full list. */
function AnnouncementItem({ title, body, createdAt, onDelete, deleting }: Props) {
  const { token } = theme.useToken();

  return (
    <div style={{ display: 'flex', gap: token.marginSM, alignItems: 'flex-start' }}>
      <Space direction="vertical" size={token.marginXXS} style={{ flex: 1, minWidth: 0 }}>
        <Space size={token.marginSM} wrap style={{ rowGap: 0 }}>
          <Text strong>{title}</Text>
          <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
            {formatPostedAt(createdAt)}
          </Text>
        </Space>
        <Paragraph
          type="secondary"
          style={{ margin: 0, whiteSpace: 'pre-wrap' }}
        >
          {body}
        </Paragraph>
      </Space>

      {onDelete && (
        <Popconfirm
          title="Delete this announcement?"
          description="It will be removed for everyone in the school."
          okText="Delete"
          okButtonProps={{ danger: true }}
          cancelText="Cancel"
          onConfirm={onDelete}
        >
          <Button type="text" size="small" danger icon={<DeleteOutlined />} loading={deleting}>
            Delete
          </Button>
        </Popconfirm>
      )}
    </div>
  );
}

export default AnnouncementItem;
