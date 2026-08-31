import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Card, Result, Skeleton, Typography, theme } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { fetchMyAttendance, NoLinkedStudentError } from '../../api/portal';
import { useAuthStore } from '../../store/authStore';
import { hasRole, ROLE } from '../../lib/roles';
import { MY_ATTENDANCE_KEY } from './queryKeys';
import AttendanceHistoryList from './AttendanceHistoryList';

const { Title, Text } = Typography;

function MyAttendancePage() {
  const { token } = theme.useToken();
  const roles = useAuthStore((state) => state.user?.roles);
  const isStudent = hasRole(roles, ROLE.STUDENT);

  const { data, isPending, isError, error, refetch, isFetching } = useQuery({
    queryKey: MY_ATTENDANCE_KEY,
    queryFn: fetchMyAttendance,
    enabled: isStudent,
    retry: (failureCount, err) => !(err instanceof NoLinkedStudentError) && failureCount < 1,
  });

  if (!isStudent) {
    return (
      <Result status="403" title="Not available" subTitle="Only a student account can view this page." />
    );
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
            My attendance
          </Title>
          <Text type="secondary">Your full attendance history.</Text>
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
        <Card
          styles={{ body: { padding: token.paddingLG } }}
          style={{ boxShadow: token.boxShadowTertiary }}
        >
          {isError ? (
            <Alert
              type="warning"
              showIcon
              message="Couldn't load your attendance"
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

export default MyAttendancePage;
