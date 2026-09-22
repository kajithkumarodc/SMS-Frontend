import { useMemo, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, Card, Col, Empty, List, Row, Skeleton, Space, Tag, Typography, theme } from 'antd';
import {
  BankOutlined,
  IdcardOutlined,
  TeamOutlined,
  WalletOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { DashboardCounts } from '../../api/dashboard';
import { fetchAttendanceTrend, fetchFeeCollection } from '../../api/reports';
import { fetchRecentAuditLog, type AuditLogEntry } from '../../api/auditLog';
import { formatAmount, formatShortDate } from '../reports/format';

const { Text, Title } = Typography;

// Dashboard-local accent palette: neutral cards, color used only as an accent
// (icon tints, chart series, progress fill) -- no solid colored card backgrounds.
// ACCENT reuses the app's existing global primary (main.tsx colorPrimary) so the
// dashboard stays visually tied to the sidebar/buttons even though this file is
// the only place styled for it.
const ACCENT = '#8A63F2';
const NEUTRAL = '#CBD5E1';
const NEUTRAL_DARK = '#94A3B8';

/** Soft icon-tint pairs for the stat cards, one per card. */
const TINTS = {
  violet: { bg: '#EDE9FE', fg: '#7C3AED' },
  sky: { bg: '#DBEAFE', fg: '#2563EB' },
  slate: { bg: '#F1F5F9', fg: '#475569' },
} as const;

type Props = {
  counts: DashboardCounts;
};

function AdminDashboard({ counts }: Props) {
  const { token } = theme.useToken();

  const today = useMemo(() => dayjs(), []);
  const attendanceQuery = useQuery({
    queryKey: ['dashboard', 'attendance-week'],
    queryFn: () => fetchAttendanceTrend(today.subtract(6, 'day').format('YYYY-MM-DD'), today.format('YYYY-MM-DD')),
  });
  const feeQuery = useQuery({
    queryKey: ['dashboard', 'fee-collection'],
    queryFn: fetchFeeCollection,
  });
  const activityQuery = useQuery({
    queryKey: ['dashboard', 'recent-activity'],
    queryFn: () => fetchRecentAuditLog(6),
  });

  const genderData = [
    { name: 'Boys', value: counts.maleStudents, color: ACCENT },
    { name: 'Girls', value: counts.femaleStudents, color: NEUTRAL },
  ];
  const genderTotal = counts.maleStudents + counts.femaleStudents;

  const attendanceData = (attendanceQuery.data ?? []).map((point) => ({
    ...point,
    label: formatShortDate(point.date),
  }));

  return (
    <Space direction="vertical" size={token.marginLG} style={{ width: '100%' }}>
      <Row gutter={[token.margin, token.margin]}>
        <Col xs={24} sm={8}>
          <StatCard icon={<TeamOutlined aria-hidden />} label="Students" value={counts.students} tint={TINTS.violet} />
        </Col>
        <Col xs={24} sm={8}>
          <StatCard icon={<IdcardOutlined aria-hidden />} label="Staff" value={counts.staff} tint={TINTS.sky} />
        </Col>
        <Col xs={24} sm={8}>
          <StatCard icon={<BankOutlined aria-hidden />} label="Schools" value={counts.schools} tint={TINTS.slate} />
        </Col>
      </Row>

      <Row gutter={[token.margin, token.margin]}>
        <Col xs={24} lg={9}>
          <Card
            title="Students"
            style={{ height: '100%', boxShadow: token.boxShadowTertiary }}
            styles={{ body: { padding: token.paddingLG } }}
          >
            {genderTotal === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No students yet" />
            ) : (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={genderData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={2}
                      isAnimationActive={false}
                    >
                      {genderData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} stroke="none" />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number, name: string) => [value, name]} />
                  </PieChart>
                </ResponsiveContainer>
                <Row justify="center" style={{ marginTop: token.marginSM }} gutter={token.marginLG}>
                  <Col>
                    <LegendStat color={NEUTRAL} label="Girls" value={counts.femaleStudents} />
                  </Col>
                  <Col>
                    <LegendStat color={ACCENT} label="Boys" value={counts.maleStudents} />
                  </Col>
                </Row>
              </>
            )}
          </Card>
        </Col>

        <Col xs={24} lg={15}>
          <Card
            title="Fee collection"
            style={{ height: '100%', boxShadow: token.boxShadowTertiary }}
            styles={{ body: { padding: token.paddingLG } }}
          >
            {feeQuery.isError ? (
              <Alert type="warning" showIcon message="Couldn't load fee collection" />
            ) : feeQuery.isPending ? (
              <Skeleton active paragraph={{ rows: 3 }} />
            ) : (
              <FeeCollectionSummary
                totalInvoiced={feeQuery.data.totalInvoiced}
                totalCollected={feeQuery.data.totalCollected}
                outstanding={feeQuery.data.outstanding}
              />
            )}
          </Card>
        </Col>
      </Row>

      <Row gutter={[token.margin, token.margin]}>
        <Col xs={24} lg={15}>
          <Card
            title="Attendance this week"
            style={{ height: '100%', boxShadow: token.boxShadowTertiary }}
            styles={{ body: { padding: token.paddingLG } }}
          >
            {attendanceQuery.isError ? (
              <Alert type="warning" showIcon message="Couldn't load attendance" />
            ) : attendanceQuery.isPending ? (
              <Skeleton active paragraph={{ rows: 5 }} />
            ) : attendanceData.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No attendance marked this week" />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={attendanceData} margin={{ top: 8, right: 16, bottom: 0, left: -8 }}>
                  <CartesianGrid stroke={token.colorBorderSecondary} vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: token.colorTextSecondary, fontSize: token.fontSizeSM }}
                    tickLine={false}
                    axisLine={{ stroke: token.colorBorderSecondary }}
                  />
                  <YAxis
                    width={32}
                    tick={{ fill: token.colorTextSecondary, fontSize: token.fontSizeSM }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: token.colorBgElevated,
                      border: `1px solid ${token.colorBorderSecondary}`,
                      borderRadius: token.borderRadius,
                    }}
                  />
                  <Legend />
                  <Bar dataKey="present" name="Present" fill={ACCENT} radius={[6, 6, 0, 0]} isAnimationActive={false} />
                  <Bar dataKey="absent" name="Absent" fill={NEUTRAL} radius={[6, 6, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>
        </Col>

        <Col xs={24} lg={9}>
          <Card
            title="Recent activity"
            style={{ height: '100%', boxShadow: token.boxShadowTertiary }}
            styles={{ body: { padding: `${token.paddingSM}px ${token.paddingLG}px` } }}
          >
            {activityQuery.isError ? (
              <Alert type="warning" showIcon message="Couldn't load recent activity" />
            ) : activityQuery.isPending ? (
              <Skeleton active paragraph={{ rows: 4 }} />
            ) : (activityQuery.data ?? []).length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No activity yet" />
            ) : (
              <List
                size="small"
                dataSource={activityQuery.data}
                renderItem={(entry) => <ActivityRow entry={entry} />}
              />
            )}
          </Card>
        </Col>
      </Row>
    </Space>
  );
}

function StatCard({
  icon,
  label,
  value,
  tint,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  tint: { bg: string; fg: string };
}) {
  const { token } = theme.useToken();
  return (
    <Card style={{ boxShadow: token.boxShadowTertiary }} styles={{ body: { padding: token.paddingLG } }}>
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
            background: tint.bg,
            color: tint.fg,
            fontSize: token.fontSizeLG,
          }}
        >
          {icon}
        </span>
        <div>
          <Title level={2} style={{ margin: 0, color: token.colorText, lineHeight: 1.1 }}>
            {value.toLocaleString()}
          </Title>
          <Text type="secondary">{label}</Text>
        </div>
      </Space>
    </Card>
  );
}

function LegendStat({ color, label, value }: { color: string; label: string; value: number }) {
  const { token } = theme.useToken();
  return (
    <Space size={token.marginXXS} align="center">
      <span
        aria-hidden
        style={{ width: 10, height: 10, borderRadius: '50%', background: color, display: 'inline-block' }}
      />
      <Text type="secondary">{label}</Text>
      <Text strong>{value}</Text>
    </Space>
  );
}

function FeeCollectionSummary({
  totalInvoiced,
  totalCollected,
  outstanding,
}: {
  totalInvoiced: number;
  totalCollected: number;
  outstanding: number;
}) {
  const { token } = theme.useToken();
  const collectedPct = totalInvoiced > 0 ? Math.round((totalCollected / totalInvoiced) * 100) : 0;

  return (
    <Space direction="vertical" size={token.marginMD} style={{ width: '100%' }}>
      <Row gutter={token.marginLG}>
        <Col xs={12} sm={8}>
          <Text type="secondary">Invoiced</Text>
          <Title level={3} style={{ margin: 0 }}>
            {formatAmount(totalInvoiced)}
          </Title>
        </Col>
        <Col xs={12} sm={8}>
          <Text type="secondary">Collected</Text>
          <Title level={3} style={{ margin: 0, color: ACCENT }}>
            {formatAmount(totalCollected)}
          </Title>
        </Col>
        <Col xs={12} sm={8}>
          <Text type="secondary">Outstanding</Text>
          <Title level={3} style={{ margin: 0, color: NEUTRAL_DARK }}>
            {formatAmount(outstanding)}
          </Title>
        </Col>
      </Row>
      <div
        style={{
          display: 'flex',
          height: 10,
          borderRadius: token.borderRadius,
          overflow: 'hidden',
          background: token.colorFillSecondary,
        }}
        role="img"
        aria-label={`${collectedPct}% collected`}
      >
        <div style={{ flex: collectedPct, background: ACCENT }} />
        <div style={{ flex: 100 - collectedPct, background: NEUTRAL }} />
      </div>
      <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
        {collectedPct}% collected so far
      </Text>
    </Space>
  );
}

function humanizeAction(action: string): string {
  const lower = action.toLowerCase().replace(/_/g, ' ');
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function ActivityRow({ entry }: { entry: AuditLogEntry }) {
  const { token } = theme.useToken();
  return (
    <List.Item style={{ paddingInline: 0 }}>
      <List.Item.Meta
        title={<Text>{humanizeAction(entry.action)}</Text>}
        description={
          <Space size={token.marginXXS} wrap>
            <Tag style={{ marginInlineEnd: 0 }}>{entry.entityType}</Tag>
            <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
              {dayjs(entry.createdAt).format('D MMM, h:mm A')}
            </Text>
          </Space>
        }
      />
    </List.Item>
  );
}

export default AdminDashboard;
