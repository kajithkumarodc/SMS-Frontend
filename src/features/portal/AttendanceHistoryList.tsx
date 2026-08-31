import { Empty, List, Tag, Typography, theme } from 'antd';
import type { PortalAttendanceEntry } from '../../api/portal';
import { ATTENDANCE_TAG_COLOR, attendanceLabel } from '../attendance/status';

const { Text } = Typography;

const DATE_FORMAT = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });

function formatDate(iso: string): string {
  const parsed = new Date(`${iso}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? iso : DATE_FORMAT.format(parsed);
}

type Props = {
  entries: PortalAttendanceEntry[];
};

/** Date + status timeline, shared by the student's own page and a parent's child page. */
function AttendanceHistoryList({ entries }: Props) {
  const { token } = theme.useToken();

  if (entries.length === 0) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description="No attendance recorded yet"
      />
    );
  }

  return (
    <List
      dataSource={entries}
      rowKey={(entry) => entry.date}
      renderItem={(entry) => (
        <List.Item
          style={{ display: 'flex', justifyContent: 'space-between', gap: token.marginSM }}
        >
          <Text>{formatDate(entry.date)}</Text>
          <Tag color={ATTENDANCE_TAG_COLOR[entry.status]} style={{ marginInlineEnd: 0 }}>
            {attendanceLabel(entry.status)}
          </Tag>
        </List.Item>
      )}
    />
  );
}

export default AttendanceHistoryList;
