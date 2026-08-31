import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Card, Result, Skeleton, Typography, theme } from 'antd';
import { ArrowLeftOutlined, ReloadOutlined } from '@ant-design/icons';
import { ChildNotFoundError, fetchChildExamResults, fetchMyChildren } from '../../api/portal';
import { fetchSubjects } from '../../api/classes';
import { SUBJECTS_QUERY_KEY } from '../classes/queryKeys';
import { useAuthStore } from '../../store/authStore';
import { hasRole, ROLE } from '../../lib/roles';
import { CHILD_RESULTS_KEY, MY_CHILDREN_KEY } from './queryKeys';
import ExamResultsList from './ExamResultsList';

const { Title, Text } = Typography;

function ChildResultsPage() {
  const { token } = theme.useToken();
  const { studentId = '' } = useParams();
  const roles = useAuthStore((state) => state.user?.roles);
  const isParent = hasRole(roles, ROLE.PARENT);

  const childrenQuery = useQuery({
    queryKey: MY_CHILDREN_KEY,
    queryFn: fetchMyChildren,
    enabled: isParent,
  });
  const child = childrenQuery.data?.find((c) => c.id === studentId);

  // The endpoint itself enforces ownership (404 -> ChildNotFoundError); the children
  // list is only used for the child's name and a friendly "not yours" screen.
  const resultsQuery = useQuery({
    queryKey: [...CHILD_RESULTS_KEY, studentId],
    queryFn: () => fetchChildExamResults(studentId),
    enabled: isParent && studentId !== '',
    retry: (failureCount, err) => !(err instanceof ChildNotFoundError) && failureCount < 1,
  });

  const subjectsQuery = useQuery({
    queryKey: SUBJECTS_QUERY_KEY,
    queryFn: fetchSubjects,
    enabled: isParent,
  });
  const subjectName = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of subjectsQuery.data ?? []) map.set(s.id, s.name);
    return (id: string) => map.get(id) ?? 'Subject';
  }, [subjectsQuery.data]);

  if (!isParent) {
    return <Result status="403" title="Not available" subTitle="Only a parent account can view this page." />;
  }

  const notYours =
    (resultsQuery.isError && resultsQuery.error instanceof ChildNotFoundError) ||
    (childrenQuery.isSuccess && !child);

  return (
    <div style={{ maxWidth: 720, width: '100%', margin: '0 auto' }}>
      <Link to="/app/dashboard" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <ArrowLeftOutlined /> Back to dashboard
      </Link>

      <header
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: token.marginSM,
          margin: `${token.marginSM}px 0 ${token.marginLG}px`,
        }}
      >
        <div>
          <Title level={2} style={{ margin: 0 }}>
            {child ? `${child.fullName} — results` : 'Results'}
          </Title>
          <Text type="secondary">
            {child?.admissionNumber ? `Admission ${child.admissionNumber}` : 'Exam results'}
          </Text>
        </div>
        {!notYours && (
          <Button
            icon={<ReloadOutlined />}
            onClick={() => void resultsQuery.refetch()}
            loading={resultsQuery.isFetching && !resultsQuery.isPending}
          >
            Refresh
          </Button>
        )}
      </header>

      {notYours ? (
        <Result
          status="404"
          title="Student not found"
          subTitle="This student isn't linked to your account."
          extra={
            <Link to="/app/dashboard">
              <Button type="primary">Back to dashboard</Button>
            </Link>
          }
        />
      ) : (
        <Card
          styles={{ body: { padding: token.paddingLG } }}
          style={{ boxShadow: token.boxShadowTertiary }}
        >
          {resultsQuery.isError || childrenQuery.isError ? (
            <Alert
              type="warning"
              showIcon
              message="Couldn't load results"
              description="There was a problem reaching the server."
              action={
                <Button size="small" onClick={() => void resultsQuery.refetch()}>
                  Try again
                </Button>
              }
            />
          ) : childrenQuery.isPending || resultsQuery.isPending ? (
            <Skeleton active paragraph={{ rows: 6 }} />
          ) : (
            <ExamResultsList results={resultsQuery.data ?? []} subjectName={subjectName} />
          )}
        </Card>
      )}
    </div>
  );
}

export default ChildResultsPage;
