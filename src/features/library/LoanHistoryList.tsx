import { Empty, List, Space, Tag, Typography, theme } from 'antd';
import type { LoanHistoryEntry } from '../../api/library';
import { formatDate, isOverdue } from './format';

const { Text } = Typography;

type Props = {
  loans: LoanHistoryEntry[];
  /** Empty-state copy — differs a little between the student's own page and a parent's child page. */
  emptyText?: string;
};

/**
 * Loan-history timeline, shared by the staff student-history modal, the student's
 * own "My library" page and a parent's per-child page.
 */
function LoanHistoryList({ loans, emptyText = 'No borrowing history yet' }: Props) {
  const { token } = theme.useToken();

  if (loans.length === 0) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyText} />;
  }

  return (
    <List
      dataSource={loans}
      rowKey={(loan) => loan.id}
      renderItem={(loan) => {
        const overdue = isOverdue(loan.dueDate, loan.returnedDate);
        return (
          <List.Item
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: token.marginSM,
              justifyContent: 'space-between',
              alignItems: 'flex-start',
            }}
          >
            <Space direction="vertical" size={0}>
              <Text strong>{loan.bookTitle}</Text>
              <Text type="secondary">{loan.bookAuthor}</Text>
              <Space size={token.marginXS} wrap style={{ marginTop: token.marginXXS }}>
                <Text type="secondary">Issued {formatDate(loan.issuedDate)}</Text>
                <Text type="secondary">·</Text>
                <Text type="secondary">Due {formatDate(loan.dueDate)}</Text>
              </Space>
            </Space>
            {loan.returnedDate ? (
              <Tag color="success" style={{ marginInlineEnd: 0 }}>
                Returned {formatDate(loan.returnedDate)}
              </Tag>
            ) : (
              <Tag color={overdue ? 'error' : 'processing'} style={{ marginInlineEnd: 0 }}>
                {overdue ? 'Overdue' : 'Not yet returned'}
              </Tag>
            )}
          </List.Item>
        );
      }}
    />
  );
}

export default LoanHistoryList;
