import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Card, Result, Skeleton, Typography, theme } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { fetchMyLibrary } from '../../api/library';
import { NoLinkedStudentError } from '../../api/portal';
import { useAuthStore } from '../../store/authStore';
import { hasRole, ROLE } from '../../lib/roles';
import { MY_LIBRARY_KEY } from '../library/queryKeys';
import LoanHistoryList from '../library/LoanHistoryList';

const { Title, Text } = Typography;

function MyLibraryPage() {
  const { token } = theme.useToken();
  const roles = useAuthStore((state) => state.user?.roles);
  const isStudent = hasRole(roles, ROLE.STUDENT);

  const { data, isPending, isError, error, refetch, isFetching } = useQuery({
    queryKey: MY_LIBRARY_KEY,
    queryFn: fetchMyLibrary,
    enabled: isStudent,
    retry: (failureCount, err) => !(err instanceof NoLinkedStudentError) && failureCount < 1,
  });

  if (!isStudent) {
    return <Result status="403" title="Not available" subTitle="Only a student account can view this page." />;
  }

  const notLinked = isError && error instanceof NoLinkedStudentError;

  return (
    <div style={{ maxWidth: 720, width: '100%', margin: '0 auto' }}>
      <header
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: token.marginSM,
          marginBottom: token.marginLG,
        }}
      >
        <div>
          <Title level={2} style={{ margin: 0 }}>
            My library
          </Title>
          <Text type="secondary">Books you&rsquo;ve borrowed, past and present.</Text>
        </div>
        {!notLinked && (
          <Button
            icon={<ReloadOutlined />}
            onClick={() => void refetch()}
            loading={isFetching && !isPending}
          >
            Refresh
          </Button>
        )}
      </header>

      {notLinked ? (
        <Result
          status="info"
          title="No student record linked yet"
          subTitle="Your account isn't connected to a student record. Please contact your school administrator."
        />
      ) : (
        <Card styles={{ body: { padding: token.paddingLG } }} style={{ boxShadow: token.boxShadowTertiary }}>
          {isError ? (
            <Alert
              type="warning"
              showIcon
              message="Couldn't load your library history"
              description="There was a problem reaching the server."
              action={
                <Button size="small" onClick={() => void refetch()}>
                  Try again
                </Button>
              }
            />
          ) : isPending ? (
            <Skeleton active paragraph={{ rows: 5 }} />
          ) : (
            <LoanHistoryList loans={data ?? []} emptyText="You haven't borrowed any books yet" />
          )}
        </Card>
      )}
    </div>
  );
}

export default MyLibraryPage;
