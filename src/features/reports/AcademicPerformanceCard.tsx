import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Card, Empty, Select, Skeleton, Space, Typography, theme } from 'antd';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { fetchClasses, fetchSubjects } from '../../api/classes';
import { fetchAcademicPerformance } from '../../api/reports';
import { CLASSES_QUERY_KEY, SUBJECTS_QUERY_KEY } from '../classes/queryKeys';
import { ACADEMIC_PERFORMANCE_QUERY_KEY } from './queryKeys';

const { Text } = Typography;

/** Below this share of max marks a bar turns amber, well below turns red. */
const OK_RATIO = 0.6;
const AT_RISK_RATIO = 0.4;

function AcademicPerformanceCard() {
  const { token } = theme.useToken();
  const [classId, setClassId] = useState<string>();

  const classesQuery = useQuery({ queryKey: CLASSES_QUERY_KEY, queryFn: fetchClasses });
  const subjectsQuery = useQuery({ queryKey: SUBJECTS_QUERY_KEY, queryFn: fetchSubjects });

  const subjectName = useMemo(() => {
    const map = new Map((subjectsQuery.data ?? []).map((s) => [s.id, s.name]));
    return (id: string) => map.get(id) ?? 'Subject';
  }, [subjectsQuery.data]);

  const classOptions = useMemo(
    () => (classesQuery.data ?? []).map((c) => ({ value: c.id, label: c.name })),
    [classesQuery.data],
  );

  const query = useQuery({
    queryKey: [...ACADEMIC_PERFORMANCE_QUERY_KEY, classId],
    queryFn: () => fetchAcademicPerformance(classId!),
    enabled: Boolean(classId),
  });

  const data = useMemo(
    () =>
      (query.data ?? []).map((point) => ({
        ...point,
        subjectName: subjectName(point.subjectId),
        ratio: point.maxMarks > 0 ? point.averageMarks / point.maxMarks : 0,
      })),
    [query.data, subjectName],
  );

  const barColor = (ratio: number) => {
    if (ratio < AT_RISK_RATIO) return token.colorError;
    if (ratio < OK_RATIO) return token.colorWarning;
    return token.colorSuccess;
  };

  return (
    <Card
      title="Academic performance"
      style={{ marginBottom: token.marginLG, boxShadow: token.boxShadowTertiary }}
      styles={{ body: { padding: token.paddingLG } }}
      extra={
        <Select
          data-testid="report-class-select"
          style={{ minWidth: 220 }}
          placeholder="Select a class"
          value={classId}
          onChange={setClassId}
          options={classOptions}
          loading={classesQuery.isLoading}
          showSearch
          optionFilterProp="label"
        />
      }
    >
      {!classId ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Pick a class to see its exam averages" />
      ) : query.isError ? (
        <Alert
          type="warning"
          showIcon
          message="Couldn't load academic performance"
          action={
            <Button size="small" onClick={() => void query.refetch()}>
              Try again
            </Button>
          }
        />
      ) : query.isPending ? (
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : data.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No exams for this class yet" />
      ) : (
        <>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={data} margin={{ top: 16, right: 16, bottom: 0, left: -8 }}>
              <CartesianGrid stroke={token.colorBorderSecondary} vertical={false} />
              <XAxis
                dataKey="examName"
                tick={{ fill: token.colorTextSecondary, fontSize: token.fontSizeSM }}
                tickLine={false}
                axisLine={{ stroke: token.colorBorderSecondary }}
                interval={0}
              />
              <YAxis
                width={44}
                tick={{ fill: token.colorTextSecondary, fontSize: token.fontSizeSM }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                cursor={{ fill: token.colorFillTertiary }}
                contentStyle={{
                  background: token.colorBgElevated,
                  border: `1px solid ${token.colorBorderSecondary}`,
                  borderRadius: token.borderRadius,
                }}
                labelStyle={{ color: token.colorText }}
                formatter={(value, _name, entry) => [
                  `${value} / ${entry.payload.maxMarks}  ·  ${entry.payload.subjectName}  ·  ${entry.payload.studentsGraded} graded`,
                  'Average',
                ]}
              />
              <Bar
                dataKey="averageMarks"
                name="Average"
                radius={[4, 4, 0, 0]}
                maxBarSize={72}
                isAnimationActive={false}
              >
                <LabelList
                  dataKey="averageMarks"
                  position="top"
                  fill={token.colorTextSecondary}
                  fontSize={token.fontSizeSM}
                />
                {data.map((point) => (
                  <Cell key={point.examId} fill={barColor(point.ratio)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <Space size={token.marginXS} wrap>
            <LegendDot color={token.colorSuccess} label={`≥ ${Math.round(OK_RATIO * 100)}% of max`} />
            <LegendDot
              color={token.colorWarning}
              label={`${Math.round(AT_RISK_RATIO * 100)}–${Math.round(OK_RATIO * 100)}%`}
            />
            <LegendDot color={token.colorError} label={`< ${Math.round(AT_RISK_RATIO * 100)}%`} />
          </Space>
        </>
      )}
    </Card>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  const { token } = theme.useToken();
  return (
    <Space size={4} align="center">
      <span
        aria-hidden
        style={{ width: 10, height: 10, borderRadius: 2, background: color, display: 'inline-block' }}
      />
      <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
        {label}
      </Text>
    </Space>
  );
}

export default AcademicPerformanceCard;
