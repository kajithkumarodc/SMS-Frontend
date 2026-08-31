import { useMemo, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Button,
  Card,
  Col,
  Result,
  Row,
  Space,
  Statistic,
  Tag,
  Typography,
  theme,
} from 'antd';
import { BankOutlined, ReloadOutlined, RightOutlined, TeamOutlined } from '@ant-design/icons';
import {
  fetchDashboardSummary,
  type DashboardAttendanceSummary,
  type DashboardStudentInfo,
} from '../../api/dashboard';
import { fetchClasses } from '../../api/classes';
import { CLASSES_QUERY_KEY } from '../classes/queryKeys';
import { buildSectionLookup } from '../classes/sectionLookup';
import { useAuthStore } from '../../store/authStore';

const { Title, Text, Paragraph } = Typography;

const TODAY = new Intl.DateTimeFormat(undefined, { dateStyle: 'full' }).format(new Date());

function formatRole(role: string): string {
  return role
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function DashboardPage() {
  const user = useAuthStore((state) => state.user);
  const { token } = theme.useToken();

  const { data, isPending, isError, refetch, isFetching } = useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: fetchDashboardSummary,
  });

  const isPortal = Boolean(data && (data.student || data.children));

  const classesQuery = useQuery({
    queryKey: CLASSES_QUERY_KEY,
    queryFn: fetchClasses,
    enabled: isPortal,
  });
  const sectionLookup = useMemo(
    () => buildSectionLookup(classesQuery.data),
    [classesQuery.data],
  );
  const sectionLabel = (sectionId: string | null): string => {
    if (!sectionId) return 'Not assigned to a section';
    const info = sectionLookup.get(sectionId);
    return info ? `${info.className} · ${info.sectionName}` : 'Assigned';
  };

  const greetingName = user?.name?.trim() || 'there';
  const roles = user?.roles ?? [];

  return (
    <div style={{ maxWidth: 1040, width: '100%', margin: '0 auto' }}>
      <header style={{ marginBottom: token.marginXL }}>
        <Text
          type="secondary"
          style={{ textTransform: 'uppercase', letterSpacing: 1, fontSize: token.fontSizeSM }}
        >
          {TODAY}
        </Text>
        <Title level={2} style={{ margin: `${token.marginXXS}px 0 0` }}>
          Welcome back, {greetingName}
        </Title>
        {roles.length > 0 && (
          <Space size={[token.marginXXS, token.marginXXS]} wrap style={{ marginTop: token.marginSM }}>
            {roles.map((role) => (
              <Tag key={role} color="processing" style={{ marginInlineEnd: 0 }}>
                {formatRole(role)}
              </Tag>
            ))}
          </Space>
        )}
      </header>

      {isPending && <LoadingState />}

      {isError && (
        <Result
          status="warning"
          title="Couldn't load your dashboard"
          subTitle="There was a problem reaching the server. Please try again in a moment."
          extra={
            <Button
              type="primary"
              icon={<ReloadOutlined />}
              loading={isFetching}
              onClick={() => {
                void refetch();
              }}
            >
              Try again
            </Button>
          }
        />
      )}

      {data && data.student && (
        <StudentDashboard
          student={data.student}
          attendance={data.attendance}
          sectionLabel={sectionLabel(data.student.sectionId)}
        />
      )}

      {data && data.children != null && (
        data.children.length === 0 ? (
          <Card style={{ boxShadow: token.boxShadowTertiary }}>
            <Space direction="vertical" size={token.marginSM} style={{ maxWidth: 620 }}>
              <Title level={4} style={{ margin: 0 }}>
                No students linked yet
              </Title>
              <Paragraph type="secondary" style={{ margin: 0 }}>
                No students are linked to your account yet — contact your school administrator.
              </Paragraph>
            </Space>
          </Card>
        ) : (
          <ChildrenList students={data.children} sectionLabel={sectionLabel} />
        )
      )}

      {data && !data.placeholder && data.counts && (
        <Row gutter={[token.margin, token.margin]}>
          <Col xs={24} sm={12} lg={8}>
            <StatCard icon={<BankOutlined aria-hidden />} label="Schools" value={data.counts.schools} />
          </Col>
          <Col xs={24} sm={12} lg={8}>
            <StatCard icon={<TeamOutlined aria-hidden />} label="Users" value={data.counts.users} />
          </Col>
        </Row>
      )}

      {data && data.placeholder && (
        <Card style={{ boxShadow: token.boxShadowTertiary }}>
          <Space direction="vertical" size={token.marginSM} style={{ maxWidth: 620 }}>
            <Title level={4} style={{ margin: 0 }}>
              You&rsquo;re all set, {greetingName}
            </Title>
            <Paragraph type="secondary" style={{ margin: 0 }}>
              {data.note ?? 'Your role-specific dashboard is being prepared. Check back soon.'}
            </Paragraph>
          </Space>
        </Card>
      )}
    </div>
  );
}

function StudentDashboard({
  student,
  attendance,
  sectionLabel,
}: {
  student: DashboardStudentInfo;
  attendance: DashboardAttendanceSummary | null;
  sectionLabel: string;
}) {
  const { token } = theme.useToken();
  const tally = attendance ?? { present: 0, absent: 0, late: 0, total: 0 };

  return (
    <Space direction="vertical" size={token.margin} style={{ width: '100%' }}>
      <Card style={{ boxShadow: token.boxShadowTertiary }}>
        <Space direction="vertical" size={token.marginXS}>
          <Title level={3} style={{ margin: 0 }}>
            {student.fullName}
          </Title>
          <Space size={token.marginSM} wrap>
            <Text type="secondary">Admission {student.admissionNumber}</Text>
            <Text type="secondary">·</Text>
            <Text type="secondary">{sectionLabel}</Text>
            <Tag color={student.status === 'ACTIVE' ? 'success' : 'default'} style={{ marginInlineEnd: 0 }}>
              {student.status}
            </Tag>
          </Space>
        </Space>
      </Card>

      <Card
        style={{ boxShadow: token.boxShadowTertiary }}
        title="Attendance"
        extra={
          <Link to="/app/my-attendance">
            View full history <RightOutlined />
          </Link>
        }
      >
        <ProportionBar tally={tally} />
        <Row gutter={[token.margin, token.margin]} style={{ marginTop: token.marginMD }}>
          <Col xs={12} sm={6}>
            <AttendanceStat label="Present" value={tally.present} color={token.colorSuccess} />
          </Col>
          <Col xs={12} sm={6}>
            <AttendanceStat label="Absent" value={tally.absent} color={token.colorError} />
          </Col>
          <Col xs={12} sm={6}>
            <AttendanceStat label="Late" value={tally.late} color={token.colorWarning} />
          </Col>
          <Col xs={12} sm={6}>
            <AttendanceStat label="Total marked" value={tally.total} color={token.colorTextTertiary} />
          </Col>
        </Row>
      </Card>
    </Space>
  );
}

function ProportionBar({ tally }: { tally: DashboardAttendanceSummary }) {
  const { token } = theme.useToken();

  if (tally.total === 0) {
    return (
      <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
        No attendance recorded yet.
      </Text>
    );
  }

  const segments = [
    { value: tally.present, color: token.colorSuccess },
    { value: tally.late, color: token.colorWarning },
    { value: tally.absent, color: token.colorError },
  ].filter((s) => s.value > 0);

  return (
    <div
      role="img"
      aria-label={`${tally.present} present, ${tally.late} late, ${tally.absent} absent`}
      style={{
        display: 'flex',
        height: 10,
        borderRadius: token.borderRadius,
        overflow: 'hidden',
        background: token.colorFillSecondary,
      }}
    >
      {segments.map((s, i) => (
        <div key={i} style={{ flex: s.value, background: s.color }} />
      ))}
    </div>
  );
}

function AttendanceStat({ label, value, color }: { label: string; value: number; color: string }) {
  const { token } = theme.useToken();
  return (
    <Space size={token.marginXS} align="center">
      <span
        aria-hidden
        style={{ width: 10, height: 10, borderRadius: '50%', background: color, display: 'inline-block' }}
      />
      <Statistic
        title={label}
        value={value}
        valueStyle={{ fontSize: token.fontSizeHeading3, fontWeight: token.fontWeightStrong, color: token.colorText }}
      />
    </Space>
  );
}

function ChildrenList({
  students,
  sectionLabel,
}: {
  students: DashboardStudentInfo[];
  sectionLabel: (sectionId: string | null) => string;
}) {
  const { token } = theme.useToken();
  return (
    <Space direction="vertical" size={token.marginXS} style={{ width: '100%' }}>
      <Title level={4} style={{ margin: 0 }}>
        My children
      </Title>
      <Row gutter={[token.margin, token.margin]}>
        {students.map((child) => (
          <Col key={child.id} xs={24} sm={12}>
            <Card
              style={{ height: '100%', boxShadow: token.boxShadowTertiary }}
              actions={[
                <Link key="view" to={`/app/children/${child.id}/attendance`}>
                  View attendance <RightOutlined />
                </Link>,
              ]}
            >
              <Space direction="vertical" size={token.marginXXS}>
                <Title level={5} style={{ margin: 0 }}>
                  {child.fullName}
                </Title>
                <Text type="secondary">{sectionLabel(child.sectionId)}</Text>
                <Tag
                  color={child.status === 'ACTIVE' ? 'success' : 'default'}
                  style={{ marginInlineEnd: 0, marginTop: token.marginXXS }}
                >
                  {child.status}
                </Tag>
              </Space>
            </Card>
          </Col>
        ))}
      </Row>
    </Space>
  );
}

function StatCard({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  const { token } = theme.useToken();

  return (
    <Card style={{ height: '100%', boxShadow: token.boxShadowTertiary }}>
      <Space direction="vertical" size={token.marginSM} style={{ width: '100%' }}>
        <span
          aria-hidden
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: token.controlHeightLG,
            height: token.controlHeightLG,
            borderRadius: token.borderRadiusLG,
            background: token.colorPrimaryBg,
            color: token.colorPrimary,
            fontSize: token.fontSizeLG,
          }}
        >
          {icon}
        </span>
        <Statistic
          title={label}
          value={value}
          valueStyle={{
            fontSize: token.fontSizeHeading1,
            fontWeight: token.fontWeightStrong,
            lineHeight: 1.1,
            color: token.colorText,
          }}
        />
      </Space>
    </Card>
  );
}

function LoadingState() {
  const { token } = theme.useToken();

  return (
    <Row gutter={[token.margin, token.margin]}>
      {[0, 1, 2].map((key) => (
        <Col key={key} xs={24} sm={12} lg={8}>
          <Card loading style={{ height: '100%', minHeight: 148, boxShadow: token.boxShadowTertiary }} />
        </Col>
      ))}
    </Row>
  );
}

export default DashboardPage;
