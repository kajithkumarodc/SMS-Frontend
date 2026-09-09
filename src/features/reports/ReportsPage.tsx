import { Result, Typography, theme } from 'antd';
import { useAuthStore } from '../../store/authStore';
import { hasRole, ROLE } from '../../lib/roles';
import AttendanceTrendCard from './AttendanceTrendCard';
import AcademicPerformanceCard from './AcademicPerformanceCard';
import FeeCollectionCard from './FeeCollectionCard';

const { Title, Text } = Typography;

function ReportsPage() {
  const { token } = theme.useToken();
  const roles = useAuthStore((state) => state.user?.roles);
  const canView = hasRole(roles, ROLE.SCHOOL_ADMIN);

  if (!canView) {
    return (
      <Result
        status="403"
        title="Not available"
        subTitle="Only a school administrator can view school-wide reports."
      />
    );
  }

  return (
    <div style={{ maxWidth: 960, width: '100%', margin: '0 auto' }}>
      <header style={{ marginBottom: token.marginLG }}>
        <Title level={2} style={{ margin: 0 }}>
          Reports
        </Title>
        <Text type="secondary">Attendance, academic performance and fee collection across your school.</Text>
      </header>

      <AttendanceTrendCard />
      <AcademicPerformanceCard />
      <FeeCollectionCard />
    </div>
  );
}

export default ReportsPage;
