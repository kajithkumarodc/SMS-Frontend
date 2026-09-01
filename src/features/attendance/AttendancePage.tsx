import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Card,
  DatePicker,
  Empty,
  List,
  Result,
  Select,
  Skeleton,
  Space,
  Typography,
  theme,
} from 'antd';
import dayjs from 'dayjs';
import { fetchClasses } from '../../api/classes';
import { fetchSectionAttendance, fetchSectionRoster, type AttendanceStatus } from '../../api/attendance';
import { useAuthStore } from '../../store/authStore';
import { hasAnyRole, ROLE } from '../../lib/roles';
import { CLASSES_QUERY_KEY } from '../classes/queryKeys';
import { buildSectionSelectOptions } from '../classes/sectionLookup';
import { SECTION_ATTENDANCE_KEY, SECTION_ROSTER_KEY, STUDENT_HISTORY_KEY } from './queryKeys';
import RosterRow from './RosterRow';
import StudentHistoryModal from './StudentHistoryModal';

const { Title, Text } = Typography;
const DATE_FORMAT = 'YYYY-MM-DD';

function SummaryItem({ count, label, color }: { count: number; label: string; color: string }) {
  const { token } = theme.useToken();
  return (
    <Space size={8} align="center" data-testid={`attendance-summary-${label.toLowerCase().replace(/\s+/g, '-')}`}>
      <span
        aria-hidden
        style={{ width: 10, height: 10, borderRadius: '50%', background: color, display: 'inline-block' }}
      />
      <Text strong style={{ fontSize: token.fontSizeHeading4 }}>
        {count}
      </Text>
      <Text type="secondary">{label}</Text>
    </Space>
  );
}

function AttendancePage() {
  const { token } = theme.useToken();
  const queryClient = useQueryClient();
  const roles = useAuthStore((state) => state.user?.roles);
  const canMark = hasAnyRole(roles, [ROLE.SCHOOL_ADMIN, ROLE.TEACHER]);

  const [params, setParams] = useSearchParams();
  const sectionId = params.get('sectionId') ?? '';
  const date = params.get('date') ?? dayjs().format(DATE_FORMAT);

  const [history, setHistory] = useState<{ id: string; fullName: string } | null>(null);

  const setParam = (key: string, value: string) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set(key, value);
        return next;
      },
      { replace: true },
    );
  };

  const classesQuery = useQuery({ queryKey: CLASSES_QUERY_KEY, queryFn: fetchClasses, enabled: canMark });
  const sectionOptions = useMemo(
    () => buildSectionSelectOptions(classesQuery.data),
    [classesQuery.data],
  );

  const rosterQuery = useQuery({
    queryKey: [...SECTION_ROSTER_KEY, sectionId],
    queryFn: () => fetchSectionRoster(sectionId),
    enabled: canMark && sectionId !== '',
  });

  const attendanceQuery = useQuery({
    queryKey: [...SECTION_ATTENDANCE_KEY, sectionId, date],
    queryFn: () => fetchSectionAttendance(sectionId, date),
    enabled: canMark && sectionId !== '',
  });

  const markedByStudent = useMemo(() => {
    const map = new Map<string, AttendanceStatus>();
    for (const record of attendanceQuery.data ?? []) {
      map.set(record.studentId, record.status);
    }
    return map;
  }, [attendanceQuery.data]);

  const roster = rosterQuery.data ?? [];
  const counts = { PRESENT: 0, ABSENT: 0, LATE: 0 };
  for (const student of roster) {
    const status = markedByStudent.get(student.id);
    if (status) counts[status] += 1;
  }
  const notMarked = roster.length - counts.PRESENT - counts.ABSENT - counts.LATE;

  const handleMarked = () => {
    void queryClient.invalidateQueries({ queryKey: [...SECTION_ATTENDANCE_KEY, sectionId, date] });
    void queryClient.invalidateQueries({ queryKey: STUDENT_HISTORY_KEY });
  };

  if (!canMark) {
    return (
      <Result status="403" title="Not available" subTitle="Only teachers and school administrators can mark attendance." />
    );
  }

  const rosterLoading = sectionId !== '' && (rosterQuery.isPending || attendanceQuery.isPending);
  const rosterError = rosterQuery.isError || attendanceQuery.isError;

  return (
    <div style={{ maxWidth: 900, width: '100%', margin: '0 auto' }}>
      <header style={{ marginBottom: token.marginLG }}>
        <Title level={2} style={{ margin: 0 }}>
          Attendance
        </Title>
        <Text type="secondary">Mark a section&rsquo;s attendance for a day.</Text>
      </header>

      <Card style={{ marginBottom: token.marginLG, boxShadow: token.boxShadowTertiary }}>
        <Space size={token.margin} wrap>
          <div>
            <Text type="secondary" style={{ display: 'block', marginBottom: token.marginXXS }}>
              Section
            </Text>
            <Select
              data-testid="attendance-section-select"
              style={{ minWidth: 240 }}
              placeholder="Select a section"
              value={sectionId || undefined}
              onChange={(value) => setParam('sectionId', value)}
              options={sectionOptions}
              loading={classesQuery.isLoading}
              showSearch
              optionFilterProp="label"
            />
          </div>
          <div>
            <Text type="secondary" style={{ display: 'block', marginBottom: token.marginXXS }}>
              Date
            </Text>
            <DatePicker
              value={dayjs(date)}
              allowClear={false}
              onChange={(value) => setParam('date', (value ?? dayjs()).format(DATE_FORMAT))}
              disabledDate={(current) => current.isAfter(dayjs(), 'day')}
            />
          </div>
        </Space>
      </Card>

      {classesQuery.isSuccess && sectionOptions.length === 0 && (
        <Alert
          type="info"
          showIcon
          message="No sections to mark yet"
          description={
            <>
              Create a class and section on the <Link to="/app/classes">Classes</Link> page first.
            </>
          }
        />
      )}

      {sectionId === '' && sectionOptions.length > 0 && (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="Select a section and date to begin marking."
        />
      )}

      {sectionId !== '' && (
        <Card styles={{ body: { padding: token.paddingLG } }} style={{ boxShadow: token.boxShadowTertiary }}>
          {rosterError ? (
            <Alert type="warning" showIcon message="Couldn't load the roster" />
          ) : rosterLoading ? (
            <Skeleton active paragraph={{ rows: 6 }} />
          ) : roster.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <>
                  No students assigned to this section yet —{' '}
                  <Link to="/app/students">assign students from the Students page</Link>.
                </>
              }
            />
          ) : (
            <>
              <Space
                size={token.marginLG}
                wrap
                style={{
                  marginBottom: token.marginLG,
                  paddingBottom: token.marginMD,
                  borderBottom: `1px solid ${token.colorBorderSecondary}`,
                }}
              >
                <SummaryItem count={counts.PRESENT} label="Present" color={token.colorSuccess} />
                <SummaryItem count={counts.ABSENT} label="Absent" color={token.colorError} />
                <SummaryItem count={counts.LATE} label="Late" color={token.colorWarning} />
                <SummaryItem count={notMarked} label="Not Marked" color={token.colorTextQuaternary} />
              </Space>

              <List
                dataSource={roster}
                rowKey="id"
                renderItem={(student) => (
                  <List.Item>
                    <RosterRow
                      student={student}
                      date={date}
                      markedStatus={markedByStudent.get(student.id)}
                      onMarked={handleMarked}
                      onOpenHistory={() => setHistory({ id: student.id, fullName: student.fullName })}
                    />
                  </List.Item>
                )}
              />
            </>
          )}
        </Card>
      )}

      <StudentHistoryModal student={history} onClose={() => setHistory(null)} />
    </div>
  );
}

export default AttendancePage;
