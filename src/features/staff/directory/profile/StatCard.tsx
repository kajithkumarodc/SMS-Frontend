import { Card, Typography, theme } from 'antd';

const { Text } = Typography;

/** A grey tile with a label, a value and an icon, as at the top of the profile's Payroll/Leaves/Attendance tabs. */
function StatCard({ label, value, icon, hint }: { label: string; value?: React.ReactNode; icon: React.ReactNode; hint?: React.ReactNode }) {
  const { token } = theme.useToken();
  return (
    <Card size="small" style={{ background: token.colorFillTertiary, height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: token.marginSM }}>
        <div>
          <Text strong>{label}</Text>
          {value !== undefined && <div style={{ fontSize: token.fontSizeHeading4, marginTop: token.marginXS }}>{value}</div>}
          {hint && <div style={{ fontSize: token.fontSizeSM, marginTop: token.marginXXS }}>{hint}</div>}
        </div>
        <div style={{ fontSize: 32, color: token.colorTextSecondary }}>{icon}</div>
      </div>
    </Card>
  );
}

export default StatCard;
