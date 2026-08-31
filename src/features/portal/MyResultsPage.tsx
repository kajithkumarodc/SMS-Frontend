import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Card, Result, Skeleton, Typography, theme } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { fetchMyExamResults, NoLinkedStudentError } from '../../api/portal';
import { fetchSubjects } from '../../api/classes';
import { SUBJECTS_QUERY_KEY } from '../classes/queryKeys';
import { useAuthStore } from '../../store/authStore';
import { hasRole, ROLE } from '../../lib/roles';
import { MY_RESULTS_KEY } from './queryKeys';
import ExamResultsList from './ExamResultsList';

const { Title, Text } = Typography;

function MyResultsPage() {
  const { token } = theme.useToken();
  const roles = useAuthStore((state) => state.user?.roles);
  const isStudent = hasRole(roles, ROLE.STUDENT);

  const resultsQuery = useQuery({
    queryKey: MY_RESULTS_KEY,
    queryFn: fetchMyExamResults,
    enabled: isStudent,
    retry: (failureCount, err) => !(err instanceof NoLinkedStudentError) && failureCount < 1,
  });

  const subjectsQuery = useQuery({
    queryKey: SUBJECTS_QUERY_KEY,
    queryFn: fetchSubjects,
    enabled: isStudent,
  });
  const subjectName = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of subjectsQuery.data ?? []) map.set(s.id, s.name);
    return (id: string) => map.get(id) ?? 'Subject';
  }, [subjectsQuery.data]);

  if (!isStudent) {
    return <Result status="403" title="Not available" subTitle="Only a student account can view this page." />;
  }

  const notLinked = resultsQuery.isError && resultsQuery.error instanceof NoLinkedStudentError;
  const loading = resultsQuery.isPending;
  const error = resultsQuery.isError && !notLinked;

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
            My results
          </Title>
          <Text type="secondary">Your marks across all exams.</Text>
        </div>
        {!notLinked && (
          <Button
            icon={<ReloadOutlined />}
            onClick={() => void resultsQuery.refetch()}
            loading={resultsQuery.isFetching && !resultsQuery.isPending}
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
        <Card
          styles={{ body: { padding: token.paddingLG } }}
          style={{ boxShadow: token.boxShadowTertiary }}
        >
          {error ? (
            <Alert
              type="warning"
              showIcon
              message="Couldn't load your results"
              description="There was a problem reaching the server."
              action={
                <Button size="small" onClick={() => void resultsQuery.refetch()}>
                  Try again
                </Button>
              }
            />
          ) : loading ? (
            <Skeleton active paragraph={{ rows: 6 }} />
          ) : (
            <ExamResultsList results={resultsQuery.data ?? []} subjectName={subjectName} />
          )}
        </Card>
      )}
    </div>
  );
}

export default MyResultsPage;
