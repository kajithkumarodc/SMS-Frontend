import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, Card, Col, DatePicker, Empty, Form, Input, Radio, Result, Row, Select, Spin, Table, TimePicker, Typography, theme } from 'antd';
import type { ColumnsType } from 'antd/es/table/interface';
import { SaveOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { fetchClasses } from '../../api/classes';
import { fetchAttendanceRoster, saveSectionAttendance, type AttendanceStatus, type StudentAttendanceRow } from '../../api/attendance';
import { useAuthStore } from '../../store/authStore';
import { hasAnyRole, ROLE } from '../../lib/roles';
import { API_DATE_FORMAT, DISPLAY_DATE_FORMAT, formatDisplayDate, todayApiDate } from '../../lib/dates';
import { serverMessage } from '../../lib/apiErrors';
import { CLASSES_QUERY_KEY } from '../classes/queryKeys';
import { defaultSection, namedSections } from '../classes/sectionLookup';
import { ATTENDANCE_OPTIONS, attendanceLabel } from './status';
import { SECTION_ROSTER_KEY, STUDENT_HISTORY_KEY } from './queryKeys';

const { Title, Text } = Typography;

const TIME_FORMAT = 'HH:mm';
const DISPLAY_TIME = 'hh:mm A';

/** What has been entered for one student on the page and not necessarily saved yet. */
type Draft = { status: AttendanceStatus | null; entryTime: string; exitTime: string; note: string };

/** `09:30:00` from the server -> `09:30` for the picker. */
const toPickerTime = (value: string | null) => (value ? value.slice(0, 5) : '');

function draftOf(row: StudentAttendanceRow): Draft {
  return { status: row.status, entryTime: toPickerTime(row.entryTime), exitTime: toPickerTime(row.exitTime), note: row.note ?? '' };
}

/** Why a row's times are not acceptable, or undefined. */
function timeProblem(draft: Draft): string | undefined {
  return draft.entryTime && draft.exitTime && draft.exitTime <= draft.entryTime ? 'Exit time must be after the entry time' : undefined;
}

/** Attendance -> Student Attendance (/app/attendance/student-attendance): mark one section's students for a day. */
function StudentAttendancePage() {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const canMark = hasAnyRole(useAuthStore((state) => state.user?.roles), [ROLE.SCHOOL_ADMIN, ROLE.TEACHER]);

  const [classId, setClassId] = useState<string>();
  const [sectionId, setSectionId] = useState<string>();
  const [date, setDate] = useState(todayApiDate());
  const [errors, setErrors] = useState<{ classId?: string; sectionId?: string }>({});
  /** The section and day last searched; the student list shows once this is set. */
  const [searched, setSearched] = useState<{ sectionId: string; date: string; label: string } | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [bulkStatus, setBulkStatus] = useState<AttendanceStatus | null>(null);

  const classesQuery = useQuery({ queryKey: CLASSES_QUERY_KEY, queryFn: fetchClasses, enabled: canMark });
  const classes = classesQuery.data;
  const selectedClass = classes?.find((c) => c.id === classId);
  const sections = useMemo(() => namedSections(selectedClass), [selectedClass]);
  // A class without sections (e.g. LKG) is marked as a whole through its hidden default section.
  const wholeClass = defaultSection(selectedClass);

  const rosterQuery = useQuery({
    queryKey: [...SECTION_ROSTER_KEY, 'marks', searched?.sectionId, searched?.date],
    queryFn: () => fetchAttendanceRoster(searched!.sectionId, searched!.date),
    enabled: canMark && searched !== null,
    // Always start from what is saved, never from an earlier search.
    gcTime: 0,
  });
  const rows = useMemo(() => rosterQuery.data ?? [], [rosterQuery.data]);

  // Start the drafts from the saved marks whenever a fresh roster arrives.
  useEffect(() => {
    if (rosterQuery.data) {
      setDrafts(Object.fromEntries(rosterQuery.data.map((r) => [r.studentId, draftOf(r)])));
      setBulkStatus(null);
    }
  }, [rosterQuery.data, rosterQuery.dataUpdatedAt]);

  const saveMutation = useMutation({
    mutationFn: () => {
      const entries = rows
        .map((r) => ({ row: r, draft: drafts[r.studentId] }))
        .filter((x) => x.draft?.status)
        .map(({ row, draft }) => ({
          studentId: row.studentId,
          status: draft.status as AttendanceStatus,
          entryTime: draft.entryTime || null,
          exitTime: draft.exitTime || null,
          note: draft.note.trim() || null,
        }));
      return saveSectionAttendance(searched!.sectionId, searched!.date, entries);
    },
    onSuccess: (saved) => {
      message.success(`Attendance saved for ${saved} student${saved === 1 ? '' : 's'}`);
      void queryClient.invalidateQueries({ queryKey: SECTION_ROSTER_KEY });
      void queryClient.invalidateQueries({ queryKey: STUDENT_HISTORY_KEY });
    },
    onError: (error) => message.error(serverMessage(error) ?? 'Could not save the attendance. Please try again.'),
  });

  if (!canMark) {
    return <Result status="403" title="Not available" subTitle="You don't have permission to mark student attendance." />;
  }

  const search = () => {
    const targetSection = wholeClass ? wholeClass.id : sectionId;
    const next = {
      classId: classId ? undefined : 'Class is required',
      sectionId: !wholeClass && !targetSection ? 'Section is required' : undefined,
    };
    setErrors(next);
    if (next.classId || next.sectionId || !targetSection || !selectedClass) return;
    const sectionName = sections.find((s) => s.id === targetSection)?.name;
    setSearched({ sectionId: targetSection, date, label: sectionName ? `${selectedClass.name} · ${sectionName}` : selectedClass.name });
  };

  const update = (id: string, patch: Partial<Draft>) => setDrafts((d) => ({ ...d, [id]: { ...d[id], ...patch } }));

  const setAll = (status: AttendanceStatus) => {
    setBulkStatus(status);
    setDrafts((d) => Object.fromEntries(Object.entries(d).map(([id, draft]) => [id, { ...draft, status }])));
  };

  const save = () => {
    const marked = rows.filter((r) => drafts[r.studentId]?.status);
    if (marked.length === 0) {
      message.warning('Mark the attendance of at least one student first');
      return;
    }
    const bad = marked.find((r) => timeProblem(drafts[r.studentId]));
    if (bad) {
      message.error(`${bad.fullName}: exit time must be after the entry time`);
      return;
    }
    saveMutation.mutate();
  };

  const draftStatus = (r: StudentAttendanceRow) => drafts[r.studentId]?.status ?? null;
  const statusText = (r: StudentAttendanceRow) => {
    const status = draftStatus(r);
    return status ? attendanceLabel(status) : '';
  };

  const columns: ColumnsType<StudentAttendanceRow> = [
    { key: 'no', title: '#', width: 60, sorter: (a, b) => rows.indexOf(a) - rows.indexOf(b), render: (_v, r) => rows.indexOf(r) + 1 },
    {
      key: 'admissionNo',
      title: 'Admission No',
      sorter: (a, b) => a.admissionNumber.localeCompare(b.admissionNumber, undefined, { numeric: true }),
      render: (_v, r) => r.admissionNumber,
    },
    {
      key: 'rollNo',
      title: 'Roll Number',
      sorter: (a, b) => (a.rollNumber ?? '').localeCompare(b.rollNumber ?? '', undefined, { numeric: true }),
      render: (_v, r) => r.rollNumber ?? '',
    },
    { key: 'name', title: 'Name', sorter: (a, b) => a.fullName.localeCompare(b.fullName), render: (_v, r) => r.fullName },
    {
      key: 'attendance',
      title: 'Attendance',
      width: 150,
      sorter: (a, b) => statusText(a).localeCompare(statusText(b)),
      render: (_v, r) => (
        <Radio.Group
          value={draftStatus(r)}
          onChange={(e) => update(r.studentId, { status: e.target.value as AttendanceStatus })}
          aria-label={`Attendance of ${r.fullName}`}
          style={{ display: 'flex', flexDirection: 'column' }}
        >
          {ATTENDANCE_OPTIONS.map((s) => (
            <Radio key={s.value} value={s.value}>
              {s.label}
            </Radio>
          ))}
        </Radio.Group>
      ),
    },
    { key: 'date', title: 'Date', sorter: (a, b) => (a.date ?? '').localeCompare(b.date ?? ''), render: (_v, r) => formatDisplayDate(r.date) },
    { key: 'source', title: 'Source', sorter: (a, b) => a.source.localeCompare(b.source), render: (_v, r) => (r.date ? 'Manual' : 'N/A') },
    {
      key: 'entry',
      title: 'Entry Time',
      width: 160,
      sorter: (a, b) => (drafts[a.studentId]?.entryTime ?? '').localeCompare(drafts[b.studentId]?.entryTime ?? ''),
      render: (_v, r) => (
        <TimePicker
          format={DISPLAY_TIME}
          use12Hours
          needConfirm={false}
          style={{ width: '100%' }}
          aria-label={`Entry time of ${r.fullName}`}
          value={drafts[r.studentId]?.entryTime ? dayjs(drafts[r.studentId].entryTime, TIME_FORMAT) : null}
          onChange={(t) => update(r.studentId, { entryTime: t ? t.format(TIME_FORMAT) : '' })}
        />
      ),
    },
    {
      key: 'exit',
      title: 'Exit Time',
      width: 160,
      sorter: (a, b) => (drafts[a.studentId]?.exitTime ?? '').localeCompare(drafts[b.studentId]?.exitTime ?? ''),
      render: (_v, r) => {
        const draft = drafts[r.studentId];
        return (
          <TimePicker
            format={DISPLAY_TIME}
            use12Hours
            needConfirm={false}
            status={draft && timeProblem(draft) ? 'error' : undefined}
            style={{ width: '100%' }}
            aria-label={`Exit time of ${r.fullName}`}
            value={draft?.exitTime ? dayjs(draft.exitTime, TIME_FORMAT) : null}
            onChange={(t) => update(r.studentId, { exitTime: t ? t.format(TIME_FORMAT) : '' })}
          />
        );
      },
    },
    {
      key: 'note',
      title: 'Note',
      width: 200,
      sorter: (a, b) => (drafts[a.studentId]?.note ?? '').localeCompare(drafts[b.studentId]?.note ?? ''),
      render: (_v, r) => (
        <Input
          maxLength={500}
          aria-label={`Note for ${r.fullName}`}
          value={drafts[r.studentId]?.note ?? ''}
          onChange={(e) => update(r.studentId, { note: e.target.value })}
        />
      ),
    },
  ];

  return (
    <div>
      <Card title={<Title level={4} style={{ margin: 0, fontWeight: 500 }}>Select Criteria</Title>} style={{ marginBottom: token.marginLG }}>
        <Form layout="vertical" onFinish={search}>
          <Row gutter={token.marginLG}>
            <Col xs={24} md={8}>
              <Form.Item label="Class" htmlFor="student-attendance-class" required validateStatus={errors.classId ? 'error' : undefined} help={errors.classId}>
                <Select
                  id="student-attendance-class"
                  placeholder="Select"
                  loading={classesQuery.isLoading}
                  options={(classes ?? []).map((c) => ({ value: c.id, label: c.name }))}
                  value={classId}
                  onChange={(value: string) => {
                    setClassId(value);
                    setSectionId(undefined);
                    setErrors({});
                  }}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                label="Section"
                htmlFor="student-attendance-section"
                required={!wholeClass}
                validateStatus={errors.sectionId ? 'error' : undefined}
                help={errors.sectionId}
              >
                <Select
                  id="student-attendance-section"
                  placeholder={wholeClass ? 'Whole class' : 'Select'}
                  disabled={!classId || Boolean(wholeClass)}
                  options={sections.map((s) => ({ value: s.id, label: s.name }))}
                  value={sectionId}
                  onChange={(value: string) => {
                    setSectionId(value);
                    setErrors((e) => ({ ...e, sectionId: undefined }));
                  }}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item label="Attendance Date" htmlFor="student-attendance-date" required>
                <DatePicker
                  id="student-attendance-date"
                  style={{ width: '100%' }}
                  format={DISPLAY_DATE_FORMAT}
                  allowClear={false}
                  value={dayjs(date)}
                  disabledDate={(d) => d.isAfter(dayjs(), 'day')}
                  onChange={(d) => d && setDate(d.format(API_DATE_FORMAT))}
                />
              </Form.Item>
            </Col>
          </Row>
          <div style={{ textAlign: 'right' }}>
            <Button type="primary" htmlType="submit" icon={<SearchOutlined />} aria-label="Search students">
              Search
            </Button>
          </div>
        </Form>
      </Card>

      {searched && (
        <Card title={<Title level={4} style={{ margin: 0, fontWeight: 500 }}>Student List</Title>}>
          {rosterQuery.isError ? (
            <Alert
              type="warning"
              showIcon
              message="Couldn't load the student list"
              description="There was a problem reaching the server."
              action={
                <Button size="small" onClick={() => void rosterQuery.refetch()}>
                  Try again
                </Button>
              }
            />
          ) : rosterQuery.isLoading ? (
            <div style={{ textAlign: 'center', padding: token.paddingXL }}>
              <Spin />
            </div>
          ) : (
            <>
              <Text type="secondary" style={{ display: 'block', marginBottom: token.marginSM }}>
                {searched.label} &middot; {formatDisplayDate(searched.date)}
              </Text>
              {rows.length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: token.marginMD, flexWrap: 'wrap', marginBottom: token.marginMD }}>
                  <Radio.Group value={bulkStatus} onChange={(e) => setAll(e.target.value as AttendanceStatus)} aria-label="Set attendance for all students as">
                    <span style={{ marginInlineEnd: token.marginSM }}>Set attendance for all students as</span>
                    {ATTENDANCE_OPTIONS.map((s) => (
                      <Radio key={s.value} value={s.value}>
                        {s.label}
                      </Radio>
                    ))}
                  </Radio.Group>
                  <Button type="primary" icon={<SaveOutlined />} onClick={save} loading={saveMutation.isPending}>
                    Save Attendance
                  </Button>
                </div>
              )}
              <Table<StudentAttendanceRow>
                rowKey="studentId"
                size="middle"
                columns={columns}
                dataSource={rows}
                pagination={false}
                scroll={{ x: 'max-content' }}
                locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No active students in this class and section." /> }}
              />
            </>
          )}
        </Card>
      )}
    </div>
  );
}

export default StudentAttendancePage;
