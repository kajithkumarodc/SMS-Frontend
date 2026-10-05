import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, Card, Col, Form, Input, InputNumber, Result, Row, Select, Spin, Tabs, TimePicker, Typography, theme } from 'antd';
import { ArrowLeftOutlined, DeleteOutlined, PlusOutlined, SaveOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { fetchClasses } from '../../api/classes';
import { fetchStaffDirectory } from '../../api/staffMembers';
import { fetchSubjectGroups, fetchTimetable, saveTimetable, WEEK_DAYS, type PeriodInput, type SubjectGroup } from '../../api/academics';
import { useAuthStore } from '../../store/authStore';
import { hasPermission } from '../../lib/roles';
import { serverMessage } from '../../lib/apiErrors';
import { CLASSES_QUERY_KEY } from '../classes/queryKeys';
import { defaultSection, namedSections } from '../classes/sectionLookup';
import { STAFF_DIRECTORY_KEY } from '../staff/directory/queryKeys';
import { SUBJECT_GROUPS_KEY, TEACHER_TIMETABLE_KEY, TIMETABLE_KEY } from './queryKeys';

const { Title, Text } = Typography;

const TIME_FORMAT = 'HH:mm';
const DISPLAY_TIME = 'h:mm A';

/** One editable period row; times are `HH:mm` or empty. */
type Row = { key: string; subjectId?: string; from: string; to: string; staffId?: string; room: string };

let rowCounter = 0;
const newRow = (patch: Partial<Row> = {}): Row => ({ key: `r${(rowCounter += 1)}`, from: '', to: '', room: '', ...patch });
const asTime = (value: string): Dayjs | null => (value ? dayjs(`2000-01-01T${value}`) : null);
/** A row nobody has touched (the pre-filled subject rows): skipped when saving. */
const isBlank = (r: Row) => !r.from && !r.to && !r.staffId && !r.room;

/** Academics -> Class Timetable -> Add (/app/academics/class-timetable/create): build a section's week. */
function CreateTimetablePage() {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const permissions = useAuthStore((state) => state.user?.permissions);
  const canManage = hasPermission(permissions, 'TIMETABLE_MANAGE');
  const canViewStaff = hasPermission(permissions, 'STAFF_VIEW');

  const [classId, setClassId] = useState<string>();
  const [sectionId, setSectionId] = useState<string>();
  const [groupId, setGroupId] = useState<string>();
  const [errors, setErrors] = useState<{ classId?: string; sectionId?: string; groupId?: string }>({});
  const [searched, setSearched] = useState<{ sectionId: string; groupId: string; label: string } | null>(null);
  const [rows, setRows] = useState<Record<number, Row[]>>({});
  const [activeDay, setActiveDay] = useState('1');
  const [startTime, setStartTime] = useState<Dayjs | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [interval, setIntervalMinutes] = useState<number | null>(0);
  const [quickRoom, setQuickRoom] = useState('');
  const [quickErrors, setQuickErrors] = useState<{ start?: string; duration?: string; interval?: string }>({});

  const classesQuery = useQuery({ queryKey: CLASSES_QUERY_KEY, queryFn: fetchClasses, enabled: canManage });
  const classes = classesQuery.data;
  const selectedClass = classes?.find((c) => c.id === classId);
  const sections = useMemo(() => namedSections(selectedClass), [selectedClass]);
  const wholeClass = defaultSection(selectedClass);
  const targetSection = wholeClass ? wholeClass.id : sectionId;

  const groupsQuery = useQuery({
    queryKey: [...SUBJECT_GROUPS_KEY, targetSection],
    queryFn: () => fetchSubjectGroups(targetSection),
    enabled: canManage && Boolean(targetSection),
  });
  const staffQuery = useQuery({ queryKey: [...STAFF_DIRECTORY_KEY, {}], queryFn: () => fetchStaffDirectory({}), enabled: canManage && canViewStaff });
  const periodsQuery = useQuery({
    queryKey: [...TIMETABLE_KEY, searched?.sectionId, searched?.groupId],
    queryFn: () => fetchTimetable(searched!.sectionId, searched!.groupId),
    enabled: canManage && searched !== null,
    gcTime: 0,
  });
  const group: SubjectGroup | undefined = groupsQuery.data?.find((g) => g.id === searched?.groupId);

  // Start from what is saved; a day with nothing saved gets one empty row per subject of the group.
  useEffect(() => {
    if (!periodsQuery.data || !group) return;
    const next: Record<number, Row[]> = {};
    for (let day = 1; day <= 7; day += 1) {
      const saved = periodsQuery.data.filter((p) => p.dayOfWeek === day);
      next[day] = saved.length
        ? saved.map((p) => newRow({ subjectId: p.subjectId, from: p.timeFrom.slice(0, 5), to: p.timeTo.slice(0, 5), staffId: p.staffProfileId ?? undefined, room: p.roomNo ?? '' }))
        : group.subjects.map((s) => newRow({ subjectId: s.id }));
    }
    setRows(next);
  }, [periodsQuery.data, periodsQuery.dataUpdatedAt, group]);

  const saveMutation = useMutation({
    mutationFn: (periods: PeriodInput[]) => saveTimetable(searched!.sectionId, searched!.groupId, periods),
    onSuccess: (saved) => {
      message.success(`Timetable saved (${saved.length} period${saved.length === 1 ? '' : 's'})`);
      void queryClient.invalidateQueries({ queryKey: TIMETABLE_KEY });
      void queryClient.invalidateQueries({ queryKey: TEACHER_TIMETABLE_KEY });
      navigate('/app/academics/class-timetable');
    },
    onError: (error) => message.error(serverMessage(error) ?? 'Could not save the timetable. Please try again.'),
  });

  if (!canManage) {
    return <Result status="403" title="Not available" subTitle="You don't have permission to change timetables." />;
  }

  const search = () => {
    const next = {
      classId: classId ? undefined : 'Class is required',
      sectionId: !wholeClass && !targetSection ? 'Section is required' : undefined,
      groupId: groupId ? undefined : 'Subject Group is required',
    };
    setErrors(next);
    if (next.classId || next.sectionId || next.groupId || !targetSection || !groupId || !selectedClass) return;
    const name = sections.find((s) => s.id === targetSection)?.name;
    setSearched({ sectionId: targetSection, groupId, label: name ? `${selectedClass.name} · ${name}` : selectedClass.name });
  };

  const updateRow = (day: number, key: string, patch: Partial<Row>) =>
    setRows((r) => ({ ...r, [day]: (r[day] ?? []).map((row) => (row.key === key ? { ...row, ...patch } : row)) }));
  const removeRow = (day: number, key: string) => setRows((r) => ({ ...r, [day]: (r[day] ?? []).filter((row) => row.key !== key) }));
  const addRow = (day: number) => setRows((r) => ({ ...r, [day]: [...(r[day] ?? []), newRow()] }));

  /** Lays the periods of Monday to Saturday out one after another from the start time. */
  const apply = () => {
    const next = {
      start: startTime ? undefined : 'Period Start Time is required',
      duration: duration && duration > 0 ? undefined : 'Duration is required',
      interval: interval === null ? 'Interval is required' : undefined,
    };
    setQuickErrors(next);
    if (next.start || next.duration || next.interval || !startTime || !duration || interval === null) return;
    const dayStart = startTime.startOf('day');
    let overflow = false;
    const result: Record<number, Row[]> = {};
    for (const [day, dayRows] of Object.entries(rows)) {
      if (Number(day) === 7) {
        result[7] = dayRows; // Sunday is a rest day: Apply leaves it alone
        continue;
      }
      let cursor = startTime;
      result[Number(day)] = dayRows.map((row) => {
        const end = cursor.add(duration, 'minute');
        if (!end.isSame(dayStart, 'day')) overflow = true;
        const updated = { ...row, from: cursor.format(TIME_FORMAT), to: end.format(TIME_FORMAT), room: quickRoom.trim() || row.room };
        cursor = end.add(interval, 'minute');
        return updated;
      });
    }
    if (overflow) {
      message.error('The periods run past midnight. Use an earlier start time or shorter periods.');
      return;
    }
    setRows(result);
  };

  const save = () => {
    const periods: PeriodInput[] = [];
    for (let day = 1; day <= 7; day += 1) {
      for (const row of rows[day] ?? []) {
        if (isBlank(row)) continue;
        const where = WEEK_DAYS[day - 1];
        if (!row.subjectId) return void message.error(`${where}: choose a subject for every period`);
        if (!row.from || !row.to) return void message.error(`${where}: every period needs a start and an end time`);
        if (row.to <= row.from) return void message.error(`${where}: a period must end after it starts`);
        periods.push({ dayOfWeek: day, subjectId: row.subjectId, timeFrom: row.from, timeTo: row.to, staffProfileId: row.staffId ?? null, roomNo: row.room.trim() || null });
      }
    }
    saveMutation.mutate(periods);
  };

  const subjectOptions = (group?.subjects ?? []).map((s) => ({ value: s.id, label: s.code ? `${s.name} (${s.code})` : s.name }));
  const staffOptions = (staffQuery.data ?? []).map((s) => ({ value: s.id, label: `${s.fullName} (${s.staffId})` }));
  const header = (text: string) => (
    <Text strong style={{ display: 'block' }}>
      {text}
    </Text>
  );

  const dayTab = (day: number) => (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(160px, 2fr) 1.5fr 1.5fr minmax(160px, 2fr) 1.5fr 56px', gap: token.marginSM, alignItems: 'center', minWidth: 900 }}>
        {header('Subject')}
        <Text strong>
          Time From <span style={{ color: token.colorError }}>*</span>
        </Text>
        <Text strong>
          Time To <span style={{ color: token.colorError }}>*</span>
        </Text>
        {header('Teacher')}
        {header('Room No.')}
        <Text strong style={{ textAlign: 'right' }}>
          Action
        </Text>
        {(rows[day] ?? []).map((row) => (
          <div key={row.key} style={{ display: 'contents' }}>
            <Select
              aria-label={`${WEEK_DAYS[day - 1]} subject`}
              placeholder="Select"
              options={subjectOptions}
              value={row.subjectId}
              onChange={(v: string) => updateRow(day, row.key, { subjectId: v })}
            />
            <TimePicker
              aria-label={`${WEEK_DAYS[day - 1]} time from`}
              format={DISPLAY_TIME}
              use12Hours
              needConfirm={false}
              style={{ width: '100%' }}
              value={asTime(row.from)}
              onChange={(t) => updateRow(day, row.key, { from: t ? t.format(TIME_FORMAT) : '' })}
            />
            <TimePicker
              aria-label={`${WEEK_DAYS[day - 1]} time to`}
              format={DISPLAY_TIME}
              use12Hours
              needConfirm={false}
              status={row.from && row.to && row.to <= row.from ? 'error' : undefined}
              style={{ width: '100%' }}
              value={asTime(row.to)}
              onChange={(t) => updateRow(day, row.key, { to: t ? t.format(TIME_FORMAT) : '' })}
            />
            <Select
              aria-label={`${WEEK_DAYS[day - 1]} teacher`}
              placeholder="Select"
              allowClear
              showSearch
              optionFilterProp="label"
              options={staffOptions}
              value={row.staffId}
              onChange={(v?: string) => updateRow(day, row.key, { staffId: v })}
            />
            <Input aria-label={`${WEEK_DAYS[day - 1]} room`} maxLength={30} value={row.room} onChange={(e) => updateRow(day, row.key, { room: e.target.value })} />
            <div style={{ textAlign: 'right' }}>
              <Button danger type="primary" icon={<DeleteOutlined />} aria-label={`Remove ${WEEK_DAYS[day - 1]} period`} onClick={() => removeRow(day, row.key)} />
            </div>
          </div>
        ))}
      </div>
      {(rows[day] ?? []).length === 0 && <Text type="secondary">No periods on this day. Use Add New to add one.</Text>}
    </div>
  );

  return (
    <div>
      <Card
        title={
          <Title level={4} style={{ margin: 0, fontWeight: 500 }}>
            Select Criteria
          </Title>
        }
        extra={
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/app/academics/class-timetable')}>
            Back
          </Button>
        }
        style={{ marginBottom: token.marginLG }}
      >
        <Form layout="vertical" onFinish={search}>
          <Row gutter={token.marginLG}>
            <Col xs={24} md={8}>
              <Form.Item label="Class" htmlFor="create-class" required validateStatus={errors.classId ? 'error' : undefined} help={errors.classId}>
                <Select
                  id="create-class"
                  placeholder="Select"
                  loading={classesQuery.isLoading}
                  options={(classes ?? []).map((c) => ({ value: c.id, label: c.name }))}
                  value={classId}
                  onChange={(value: string) => {
                    setClassId(value);
                    setSectionId(undefined);
                    setGroupId(undefined);
                    setSearched(null);
                    setErrors({});
                  }}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item label="Section" htmlFor="create-section" required={!wholeClass} validateStatus={errors.sectionId ? 'error' : undefined} help={errors.sectionId}>
                <Select
                  id="create-section"
                  placeholder={wholeClass ? 'Whole class' : 'Select'}
                  disabled={!classId || Boolean(wholeClass)}
                  options={sections.map((s) => ({ value: s.id, label: s.name }))}
                  value={sectionId}
                  onChange={(value: string) => {
                    setSectionId(value);
                    setGroupId(undefined);
                    setSearched(null);
                    setErrors((e) => ({ ...e, sectionId: undefined }));
                  }}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item label="Subject Group" htmlFor="create-group" required validateStatus={errors.groupId ? 'error' : undefined} help={errors.groupId}>
                <Select
                  id="create-group"
                  placeholder="Select"
                  disabled={!targetSection}
                  loading={groupsQuery.isFetching}
                  options={(groupsQuery.data ?? []).map((g) => ({ value: g.id, label: g.name }))}
                  value={groupId}
                  onChange={(value: string) => {
                    setGroupId(value);
                    setErrors((e) => ({ ...e, groupId: undefined }));
                  }}
                  notFoundContent="No subject group for this section yet"
                />
              </Form.Item>
            </Col>
          </Row>
          <div style={{ textAlign: 'right' }}>
            <Button type="primary" htmlType="submit" icon={<SearchOutlined />} aria-label="Search subject group">
              Search
            </Button>
          </div>
        </Form>
      </Card>

      {searched && (
        <Card>
          {periodsQuery.isError || groupsQuery.isError ? (
            <Alert type="warning" showIcon message="Couldn't load the timetable" description="There was a problem reaching the server." />
          ) : periodsQuery.isLoading || !group ? (
            <div style={{ textAlign: 'center', padding: token.paddingXL }}>
              <Spin />
            </div>
          ) : (
            <>
              <Title level={4} style={{ fontWeight: 500, marginTop: 0 }}>
                {searched.label} &middot; {group.name}
              </Title>
              <Title level={5} style={{ fontWeight: 400 }}>
                Select parameter to generate time table quickly
              </Title>
              <Form layout="vertical" onFinish={apply} style={{ marginBottom: token.marginLG }}>
              <Row gutter={token.marginMD} align="top">
                <Col xs={24} sm={12} lg={5}>
                  <Form.Item label="Period Start Time" required validateStatus={quickErrors.start ? 'error' : undefined} help={quickErrors.start}>
                    <TimePicker aria-label="Period start time" format={DISPLAY_TIME} use12Hours needConfirm={false} style={{ width: '100%' }} value={startTime} onChange={setStartTime} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12} lg={5}>
                  <Form.Item label="Duration (minute)" required validateStatus={quickErrors.duration ? 'error' : undefined} help={quickErrors.duration}>
                    <InputNumber aria-label="Duration in minutes" min={1} max={600} precision={0} style={{ width: '100%' }} value={duration} onChange={setDuration} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12} lg={5}>
                  <Form.Item label="Interval (minute)" required validateStatus={quickErrors.interval ? 'error' : undefined} help={quickErrors.interval}>
                    <InputNumber aria-label="Interval in minutes" min={0} max={600} precision={0} style={{ width: '100%' }} value={interval} onChange={setIntervalMinutes} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12} lg={5}>
                  <Form.Item label="Room No.">
                    <Input aria-label="Room number for all periods" maxLength={30} value={quickRoom} onChange={(e) => setQuickRoom(e.target.value)} />
                  </Form.Item>
                </Col>
                <Col xs={24} lg={4}>
                  <Form.Item label=" " colon={false}>
                    <Button type="primary" htmlType="submit">
                      Apply
                    </Button>
                  </Form.Item>
                </Col>
              </Row>
              </Form>

              <Tabs
                activeKey={activeDay}
                onChange={setActiveDay}
                tabBarExtraContent={
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => addRow(Number(activeDay))}>
                    Add New
                  </Button>
                }
                items={WEEK_DAYS.map((day, index) => ({ key: String(index + 1), label: day, children: <div style={{ overflowX: 'auto' }}>{dayTab(index + 1)}</div> }))}
              />
              <div style={{ textAlign: 'right', marginTop: token.marginLG }}>
                <Button type="primary" icon={<SaveOutlined />} onClick={save} loading={saveMutation.isPending}>
                  Save
                </Button>
              </div>
            </>
          )}
        </Card>
      )}
    </div>
  );
}

export default CreateTimetablePage;
