import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { Alert, Button, Card, Result, Skeleton, Typography, theme } from 'antd';
import { ArrowLeftOutlined, ReloadOutlined } from '@ant-design/icons';
import { ChildNotFoundError, fetchChildAttendance, fetchMyChildren } from '../../api/portal';
import { useAuthStore } from '../../store/authStore';
import { hasRole, ROLE } from '../../lib/roles';
import { CHILD_ATTENDANCE_KEY, MY_CHILDREN_KEY } from './queryKeys';
import AttendanceHistoryList from './AttendanceHistoryList';

const { Title, Text } = Typography;

function ChildAttendancePage() {
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

  const { data, isPending, isError, error, refetch, isFetching } = useQuery({
    queryKey: [...CHILD_ATTENDANCE_KEY, studentId],
    queryFn: () => fetchChildAttendance(studentId),
    enabled: isParent && studentId !== '',
    retry: (failureCount, err) => !(err instanceof ChildNotFoundError) && failureCount < 1,
  });

  if (!isParent) {
    return (
      <Result status="403" title="Not available" subTitle="Only a parent account can view this page." />
    );
  }

  const notYours = isError && error instanceof ChildNotFoundError;

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
            {child ? `${child.fullName} — attendance` : 'Attendance'}
          </Title>
          <Text type="secondary">
            {child?.admissionNumber ? `Admission ${child.admissionNumber}` : 'Attendance history'}
          </Text>
        </div>
        {!notYours && (
          <Button
            icon={<ReloadOutlined />}
            onClick={() => void refetch()}
            loading={isFetching && !isPending}
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
          {isError ? (
            <Alert
              type="warning"
              showIcon
              message="Couldn't load attendance"
              description="There was a problem reaching the server."
              action={
                <Button size="small" onClick={() => void refetch()}>
                  Try again
                </Button>
              }
            />
          ) : isPending ? (
            <Skeleton active paragraph={{ rows: 6 }} />
          ) : (
            <AttendanceHistoryList entries={data} />
          )}
        </Card>
      )}
    </div>
  );
}

export default ChildAttendancePage;
