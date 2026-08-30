import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, Card, Col, Result, Row, Space, Statistic, Tag, Typography, theme } from 'antd';
import { BankOutlined, ReloadOutlined, TeamOutlined } from '@ant-design/icons';
import { fetchDashboardSummary } from '../../api/dashboard';
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
              {data.note ??
                'Your role-specific dashboard is being prepared. Check back soon.'}
            </Paragraph>
          </Space>
        </Card>
      )}
    </div>
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
