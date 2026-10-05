import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, Col, Row, Select, Spin, Typography, theme } from 'antd';
import { CheckSquareOutlined } from '@ant-design/icons';
import { fetchStaffAttendance, type StaffAttendanceCode } from '../../../../api/staffMembers';
import { MONTH_NAMES } from '../../../payroll/format';
import StatCard from './StatCard';

const { Text } = Typography;

type Tone = 'success' | 'warning' | 'danger' | undefined;

const CODE: Record<StaffAttendanceCode, { letter: string; tone: Tone }> = {
  PRESENT: { letter: 'P', tone: 'success' },
  LATE: { letter: 'L', tone: 'warning' },
  ABSENT: { letter: 'A', tone: 'danger' },
  HALF_DAY: { letter: 'F', tone: 'warning' },
  HOLIDAY: { letter: 'H', tone: undefined },
  HALF_DAY_SECOND_HALF: { letter: 'SH', tone: 'warning' },
};

/** Staff profile > Attendance: the year's totals and a day-by-month grid of the marks. */
function AttendanceTab({ staffId }: { staffId: string }) {
  const { token } = theme.useToken();
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const query = useQuery({ queryKey: ['staff-members', 'attendance', staffId, year], queryFn: () => fetchStaffAttendance(staffId, year) });

  if (query.isError) {
    return <Alert type="error" showIcon message="Could not load the attendance of this staff member." />;
  }
  const data = query.data;
  const cell: React.CSSProperties = { padding: '6px 8px', textAlign: 'center', borderBottom: `1px solid ${token.colorBorderSecondary}` };
  const totals: [string, number][] = data
    ? [
        ['Total Present', data.present],
        ['Total Late', data.late],
        ['Total Absent', data.absent],
        ['Total Half Day', data.halfDay],
        ['Total Holiday', data.holiday],
        ['Half Day (Second Half)', data.halfDaySecondHalf],
      ]
    : [];

  return (
    <div data-testid="staff-attendance">
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        {totals.map(([label, value]) => (
          <Col key={label} xs={24} sm={12} xl={6}>
            <StatCard label={label} value={value} icon={<CheckSquareOutlined />} />
          </Col>
        ))}
      </Row>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <label>
          Year{' '}
          <Select value={year} onChange={setYear} style={{ width: 100 }} options={Array.from({ length: 6 }, (_, i) => thisYear - i).map((y) => ({ value: y, label: y }))} />
        </label>
        <Text strong>
          Present: <Text type="success">P</Text> Late: <Text type="warning">L</Text> Absent: <Text type="danger">A</Text> Half Day: <Text type="warning">F</Text> Holiday: H Half Day
          (Second Half): <Text type="warning">SH</Text>
        </Text>
      </div>
      {!data ? (
        <Spin />
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
            <thead>
              <tr>
                <th style={{ ...cell, background: token.colorFillTertiary }}>Date | Month</th>
                {MONTH_NAMES.map((m) => (
                  <th key={m} style={{ ...cell, background: token.colorFillTertiary }}>
                    {m}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 31 }, (_, d) => d + 1).map((day) => (
                <tr key={day}>
                  <td style={cell}>{String(day).padStart(2, '0')}</td>
                  {MONTH_NAMES.map((m, i) => {
                    const code = data.days[`${i + 1}-${day}`];
                    const info = code ? CODE[code] : null;
                    return (
                      <td key={m} style={cell}>
                        {info && (
                          <Text strong type={info.tone}>
                            {info.letter}
                          </Text>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default AttendanceTab;
