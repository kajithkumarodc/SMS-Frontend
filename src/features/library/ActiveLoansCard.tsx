import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  App,
  Button,
  Card,
  Empty,
  List,
  Popconfirm,
  Skeleton,
  Space,
  Tag,
  Typography,
  theme,
} from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { fetchActiveLoans, returnLoan, type ActiveLoan } from '../../api/library';
import { LIBRARY_ACTIVE_LOANS_KEY, LIBRARY_BOOKS_KEY, STUDENT_LOANS_KEY } from './queryKeys';
import { formatDate, isOverdue } from './format';

const { Title, Text } = Typography;

type Props = {
  /** Only a SCHOOL_ADMIN may return a book; a TEACHER sees the list read-only. */
  canReturn: boolean;
};

function ActiveLoansCard({ canReturn }: Props) {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: LIBRARY_ACTIVE_LOANS_KEY,
    queryFn: fetchActiveLoans,
  });

  const returnMutation = useMutation({
    mutationFn: (loan: ActiveLoan) => returnLoan(loan.id),
    onSuccess: (_result, loan) => {
      message.success(`"${loan.bookTitle}" returned`);
      void queryClient.invalidateQueries({ queryKey: LIBRARY_ACTIVE_LOANS_KEY });
      void queryClient.invalidateQueries({ queryKey: LIBRARY_BOOKS_KEY });
      void queryClient.invalidateQueries({ queryKey: [...STUDENT_LOANS_KEY, loan.studentId] });
    },
    onError: () => {
      message.error('Could not return the book. Please try again.');
    },
  });

  const loans = query.data ?? [];

  return (
    <Card
      title="Active loans"
      style={{ boxShadow: token.boxShadowTertiary }}
      styles={{ body: { padding: token.paddingLG } }}
      extra={
        <Button
          size="small"
          icon={<ReloadOutlined />}
          onClick={() => void query.refetch()}
          loading={query.isFetching && !query.isPending}
        >
          Refresh
        </Button>
      }
    >
      {query.isError ? (
        <Alert
          type="warning"
          showIcon
          message="Couldn't load active loans"
          action={
            <Button size="small" onClick={() => void query.refetch()}>
              Try again
            </Button>
          }
        />
      ) : query.isPending ? (
        <Skeleton active paragraph={{ rows: 3 }} />
      ) : loans.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No active loans" />
      ) : (
        <List
          dataSource={loans}
          rowKey={(loan) => loan.id}
          renderItem={(loan) => {
            const overdue = isOverdue(loan.dueDate, null);
            const returning =
              returnMutation.isPending && returnMutation.variables?.id === loan.id;
            return (
              <List.Item
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: token.marginSM,
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                }}
                actions={
                  canReturn
                    ? [
                        <Popconfirm
                          key="return"
                          title="Return this book?"
                          description="A copy goes back into the catalogue."
                          okText="Return"
                          cancelText="Cancel"
                          onConfirm={() => returnMutation.mutate(loan)}
                        >
                          <Button type="link" size="small" loading={returning} style={{ paddingInline: 0 }}>
                            Return
                          </Button>
                        </Popconfirm>,
                      ]
                    : undefined
                }
              >
                <Space direction="vertical" size={0}>
                  <Text strong>{loan.bookTitle}</Text>
                  <Text type="secondary">{loan.studentName}</Text>
                  <Space size={token.marginXS} wrap style={{ marginTop: token.marginXXS }}>
                    <Text type="secondary">Issued {formatDate(loan.issuedDate)}</Text>
                    <Text type="secondary">·</Text>
                    <Tag color={overdue ? 'error' : 'default'} style={{ marginInlineEnd: 0 }}>
                      {overdue ? `Overdue — due ${formatDate(loan.dueDate)}` : `Due ${formatDate(loan.dueDate)}`}
                    </Tag>
                  </Space>
                </Space>
              </List.Item>
            );
          }}
        />
      )}

      {!canReturn && loans.length > 0 && (
        <Title level={5} type="secondary" style={{ fontWeight: 'normal', marginTop: token.marginSM, marginBottom: 0 }}>
          Only a school administrator can return a book.
        </Title>
      )}
    </Card>
  );
}

export default ActiveLoansCard;
