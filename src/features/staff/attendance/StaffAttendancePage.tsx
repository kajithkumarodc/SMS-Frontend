import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, Card, Col, DatePicker, Empty, Form, Input, Radio, Result, Row, Select, Spin, Table, TimePicker, Typography, theme } from 'antd';
import type { ColumnsType } from 'antd/es/table/interface';
import { SaveOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  fetchStaffAttendance,
  fetchStaffAttendanceRoles,
  saveStaffAttendance,
  STAFF_ATTENDANCE_STATUSES,
  type StaffAttendanceRow,
  type StaffAttendanceStatus,
} from '../../../api/staffAttendance';
import { useAuthStore } from '../../../store/authStore';
import { hasPermission } from '../../../lib/roles';
import { API_DATE_FORMAT, DISPLAY_DATE_FORMAT, formatDisplayDate, todayApiDate } from '../../../lib/dates';
import { serverMessage } from '../../../lib/apiErrors';

const { Title, Text } = Typography;

const TIME_FORMAT = 'HH:mm';
const DISPLAY_TIME = 'hh:mm A';
const ROLES_KEY = ['staff-attendance', 'roles'] as const;
const ROSTER_KEY = ['staff-attendance', 'roster'] as const; // + roleId, date

/** What has been entered for one staff member on the page and not necessarily saved yet. */
type Draft = { status: StaffAttendanceStatus | null; entryTime: string; exitTime: string; note: string };

/** `09:30:00` from the server -> `09:30` for the picker. */
const toPickerTime = (value: string | null) => (value ? value.slice(0, 5) : '');

function draftOf(row: StaffAttendanceRow): Draft {
  return { status: row.status, entryTime: toPickerTime(row.entryTime), exitTime: toPickerTime(row.exitTime), note: row.note ?? '' };
}

/** Why a row's times are not acceptable, or undefined. */
function timeProblem(draft: Draft): string | undefined {
  return draft.entryTime && draft.exitTime && draft.exitTime <= draft.entryTime ? 'Exit time must be after the entry time' : undefined;
}

/** Human Resource -> Staff Attendance (/app/human-resource/staff-attendance): mark one role's staff for a day. */
function StaffAttendancePage() {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const permissions = useAuthStore((state) => state.user?.permissions);
  const canView = hasPermission(permissions, 'STAFF_ATTENDANCE_VIEW');
  const canEdit = hasPermission(permissions, 'STAFF_ATTENDANCE_EDIT');

  const [roleId, setRoleId] = useState<string>();
  const [date, setDate] = useState(todayApiDate());
  const [roleError, setRoleError] = useState<string>();
  /** The role and day last searched; the staff list shows once this is set. */
  const [searched, setSearched] = useState<{ roleId: string; date: string } | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [bulkStatus, setBulkStatus] = useState<StaffAttendanceStatus | null>(null);

  const rolesQuery = useQuery({ queryKey: ROLES_KEY, queryFn: fetchStaffAttendanceRoles, enabled: canView });
  const rosterQuery = useQuery({
    queryKey: [...ROSTER_KEY, searched?.roleId, searched?.date],
    queryFn: () => fetchStaffAttendance(searched!.roleId, searched!.date),
    enabled: canView && searched !== null,
    // Always start from what is saved, never from an earlier search.
    gcTime: 0,
  });
  const rows = useMemo(() => rosterQuery.data ?? [], [rosterQuery.data]);

  // Start the drafts from the saved marks whenever a fresh roster arrives.
  useEffect(() => {
    if (rosterQuery.data) {
      setDrafts(Object.fromEntries(rosterQuery.data.map((r) => [r.staffProfileId, draftOf(r)])));
      setBulkStatus(null);
    }
  }, [rosterQuery.data, rosterQuery.dataUpdatedAt]);

  const saveMutation = useMutation({
    mutationFn: () => {
      const entries = rows
        .map((r) => ({ row: r, draft: drafts[r.staffProfileId] }))
        .filter((x) => x.draft?.status)
        .map(({ row, draft }) => ({
          staffProfileId: row.staffProfileId,
          status: draft.status as StaffAttendanceStatus,
          entryTime: draft.entryTime || null,
          exitTime: draft.exitTime || null,
          note: draft.note.trim() || null,
        }));
      return saveStaffAttendance(searched!.date, entries);
    },
    onSuccess: (saved) => {
      message.success(`Attendance saved for ${saved} staff member${saved === 1 ? '' : 's'}`);
      void queryClient.invalidateQueries({ queryKey: ROSTER_KEY });
    },
    onError: (error) => message.error(serverMessage(error) ?? 'Could not save the attendance. Please try again.'),
  });

  const roleName = rolesQuery.data?.find((r) => r.id === searched?.roleId)?.name;

  if (!canView) {
    return <Result status="403" title="Not available" subTitle="You don't have permission to view staff attendance." />;
  }

  const search = () => {
    if (!roleId) {
      setRoleError('Role is required');
      return;
    }
    setRoleError(undefined);
    setSearched({ roleId, date });
  };

  const update = (id: string, patch: Partial<Draft>) => setDrafts((d) => ({ ...d, [id]: { ...d[id], ...patch } }));

  const setAll = (status: StaffAttendanceStatus) => {
    setBulkStatus(status);
    setDrafts((d) => Object.fromEntries(Object.entries(d).map(([id, draft]) => [id, { ...draft, status }])));
  };

  const save = () => {
    const marked = rows.filter((r) => drafts[r.staffProfileId]?.status);
    if (marked.length === 0) {
      message.warning('Mark the attendance of at least one staff member first');
      return;
    }
    const bad = marked.find((r) => timeProblem(drafts[r.staffProfileId]));
    if (bad) {
      message.error(`${bad.fullName}: exit time must be after the entry time`);
      return;
    }
    saveMutation.mutate();
  };

  const statusLabel = (status: StaffAttendanceStatus | null) => STAFF_ATTENDANCE_STATUSES.find((s) => s.value === status)?.label ?? '';
  const draftStatus = (r: StaffAttendanceRow) => drafts[r.staffProfileId]?.status ?? null;

  const columns: ColumnsType<StaffAttendanceRow> = [
    { key: 'no', title: '#', width: 60, sorter: (a, b) => rows.indexOf(a) - rows.indexOf(b), render: (_v, r) => rows.indexOf(r) + 1 },
    { key: 'staffId', title: 'Staff ID', align: 'right', sorter: (a, b) => a.staffId.localeCompare(b.staffId, undefined, { numeric: true }), render: (_v, r) => r.staffId },
    { key: 'name', title: 'Name', sorter: (a, b) => a.fullName.localeCompare(b.fullName), render: (_v, r) => r.fullName },
    { key: 'role', title: 'Role', sorter: (a, b) => (a.roleName ?? '').localeCompare(b.roleName ?? ''), render: (_v, r) => r.roleName ?? '' },
    {
      key: 'attendance',
      title: 'Attendance',
      width: 340,
      sorter: (a, b) => statusLabel(draftStatus(a)).localeCompare(statusLabel(draftStatus(b))),
      render: (_v, r) => (
        <Radio.Group
          disabled={!canEdit}
          value={draftStatus(r)}
          onChange={(e) => update(r.staffProfileId, { status: e.target.value as StaffAttendanceStatus })}
          aria-label={`Attendance of ${r.fullName}`}
          style={{ display: 'flex', flexWrap: 'wrap', columnGap: token.marginSM, rowGap: 0 }}
        >
          {STAFF_ATTENDANCE_STATUSES.map((s) => (
            <Radio key={s.value} value={s.value} style={{ marginInlineEnd: 0 }}>
              {s.label}
            </Radio>
          ))}
        </Radio.Group>
      ),
    },
    { key: 'date', title: 'Date', sorter: (a, b) => (a.date ?? '').localeCompare(b.date ?? ''), render: (_v, r) => formatDisplayDate(r.date) },
    { key: 'source', title: 'Source', sorter: (a, b) => a.source.localeCompare(b.source), render: (_v, r) => (r.source === 'MANUAL' ? 'Manual' : r.source) },
    {
      key: 'entry',
      title: 'Entry Time',
      width: 150,
      sorter: (a, b) => (drafts[a.staffProfileId]?.entryTime ?? '').localeCompare(drafts[b.staffProfileId]?.entryTime ?? ''),
      render: (_v, r) => {
        const draft = drafts[r.staffProfileId];
        return (
          <TimePicker
            disabled={!canEdit}
            format={DISPLAY_TIME}
            use12Hours
            needConfirm={false}
            style={{ width: '100%' }}
            aria-label={`Entry time of ${r.fullName}`}
            value={draft?.entryTime ? dayjs(draft.entryTime, TIME_FORMAT) : null}
            onChange={(t) => update(r.staffProfileId, { entryTime: t ? t.format(TIME_FORMAT) : '' })}
          />
        );
      },
    },
    {
      key: 'exit',
      title: 'Exit Time',
      width: 150,
      sorter: (a, b) => (drafts[a.staffProfileId]?.exitTime ?? '').localeCompare(drafts[b.staffProfileId]?.exitTime ?? ''),
      render: (_v, r) => {
        const draft = drafts[r.staffProfileId];
        const problem = draft && timeProblem(draft);
        return (
          <TimePicker
            disabled={!canEdit}
            format={DISPLAY_TIME}
            use12Hours
            needConfirm={false}
            status={problem ? 'error' : undefined}
            style={{ width: '100%' }}
            aria-label={`Exit time of ${r.fullName}`}
            value={draft?.exitTime ? dayjs(draft.exitTime, TIME_FORMAT) : null}
            onChange={(t) => update(r.staffProfileId, { exitTime: t ? t.format(TIME_FORMAT) : '' })}
          />
        );
      },
    },
    {
      key: 'note',
      title: 'Note',
      width: 200,
      sorter: (a, b) => (drafts[a.staffProfileId]?.note ?? '').localeCompare(drafts[b.staffProfileId]?.note ?? ''),
      render: (_v, r) => (
        <Input
          disabled={!canEdit}
          maxLength={500}
          aria-label={`Note for ${r.fullName}`}
          value={drafts[r.staffProfileId]?.note ?? ''}
          onChange={(e) => update(r.staffProfileId, { note: e.target.value })}
        />
      ),
    },
  ];

  return (
    <div>
      <Card
        title={<Title level={4} style={{ margin: 0, fontWeight: 500 }}>Select Criteria</Title>}
        style={{ marginBottom: token.marginLG }}
      >
        <Form layout="vertical" onFinish={search}>
          <Row gutter={token.marginLG}>
            <Col xs={24} md={12}>
              <Form.Item label="Role" htmlFor="staff-attendance-role" required validateStatus={roleError ? 'error' : undefined} help={roleError}>
                <Select
                  id="staff-attendance-role"
                  placeholder="Select"
                  showSearch
                  optionFilterProp="label"
                  loading={rolesQuery.isLoading}
                  options={(rolesQuery.data ?? []).map((r) => ({ value: r.id, label: r.name }))}
                  value={roleId}
                  onChange={(value: string) => {
                    setRoleId(value);
                    setRoleError(undefined);
                  }}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label="Attendance Date" htmlFor="staff-attendance-date" required>
                <DatePicker
                  id="staff-attendance-date"
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
            <Button type="primary" htmlType="submit" icon={<SearchOutlined />} aria-label="Search staff">
              Search
            </Button>
          </div>
        </Form>
      </Card>

      {searched && (
        <Card title={<Title level={4} style={{ margin: 0, fontWeight: 500 }}>Staff List</Title>}>
          {rosterQuery.isError ? (
            <Alert
              type="warning"
              showIcon
              message="Couldn't load the staff list"
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
                {roleName ?? 'Staff'} &middot; {formatDisplayDate(searched.date)}
              </Text>
              {canEdit && rows.length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: token.marginMD, flexWrap: 'wrap', marginBottom: token.marginMD }}>
                  <Radio.Group value={bulkStatus} onChange={(e) => setAll(e.target.value as StaffAttendanceStatus)} aria-label="Set attendance for all staff as">
                    <span style={{ marginInlineEnd: token.marginSM }}>Set attendance for all Staff as</span>
                    {STAFF_ATTENDANCE_STATUSES.map((s) => (
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
              <Table<StaffAttendanceRow>
                rowKey="staffProfileId"
                size="middle"
                columns={columns}
                dataSource={rows}
                pagination={false}
                scroll={{ x: 'max-content' }}
                locale={{
                  emptyText: (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No active staff with this role. Try a different role." />
                  ),
                }}
              />
            </>
          )}
        </Card>
      )}
    </div>
  );
}

export default StaffAttendancePage;
