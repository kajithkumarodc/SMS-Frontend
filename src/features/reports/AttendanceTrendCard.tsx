import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Card, DatePicker, Empty, Skeleton, Space, Typography, theme } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { fetchAttendanceTrend } from '../../api/reports';
import { ATTENDANCE_TREND_QUERY_KEY } from './queryKeys';
import { formatShortDate } from './format';

const { Text } = Typography;
const { RangePicker } = DatePicker;
const ISO = 'YYYY-MM-DD';
const DEFAULT_DAYS = 30;

function AttendanceTrendCard() {
  const { token } = theme.useToken();

  const [range, setRange] = useState<[Dayjs, Dayjs]>(() => [
    dayjs().subtract(DEFAULT_DAYS - 1, 'day'),
    dayjs(),
  ]);
  const from = range[0].format(ISO);
  const to = range[1].format(ISO);

  const query = useQuery({
    queryKey: [...ATTENDANCE_TREND_QUERY_KEY, { from, to }],
    queryFn: () => fetchAttendanceTrend(from, to),
  });

  const data = useMemo(
    () =>
      (query.data ?? []).map((point) => ({
        ...point,
        label: formatShortDate(point.date),
      })),
    [query.data],
  );

  return (
    <Card
      title="Attendance trend"
      style={{ marginBottom: token.marginLG, boxShadow: token.boxShadowTertiary }}
      styles={{ body: { padding: token.paddingLG } }}
      extra={
        <RangePicker
          value={range}
          allowClear={false}
          disabledDate={(current) => current && current.isAfter(dayjs(), 'day')}
          onChange={(next) => {
            if (next && next[0] && next[1]) setRange([next[0], next[1]]);
          }}
        />
      }
    >
      {query.isError ? (
        <Alert
          type="warning"
          showIcon
          message="Couldn't load the attendance trend"
          action={
            <Button size="small" onClick={() => void query.refetch()}>
              Try again
            </Button>
          }
        />
      ) : query.isPending ? (
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : data.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="No attendance data for this range"
        />
      ) : (
        <>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: -8 }}>
              <CartesianGrid stroke={token.colorBorderSecondary} vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: token.colorTextSecondary, fontSize: token.fontSizeSM }}
                tickLine={false}
                axisLine={{ stroke: token.colorBorderSecondary }}
              />
              <YAxis
                domain={[0, 100]}
                width={44}
                tickFormatter={(value: number) => `${value}%`}
                tick={{ fill: token.colorTextSecondary, fontSize: token.fontSizeSM }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: token.colorBgElevated,
                  border: `1px solid ${token.colorBorderSecondary}`,
                  borderRadius: token.borderRadius,
                }}
                labelStyle={{ color: token.colorText }}
                formatter={(value) => [`${value}%`, 'Attendance']}
              />
              <Line
                type="monotone"
                dataKey="attendancePercentage"
                name="Attendance"
                stroke={token.colorPrimary}
                strokeWidth={2}
                dot={{ r: 3, fill: token.colorPrimary }}
                activeDot={{ r: 5 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
          <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
            Daily attendance — a student marked present or late counts as attended.
          </Text>
        </>
      )}
    </Card>
  );
}

export default AttendanceTrendCard;
