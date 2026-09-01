import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button, Segmented, Space, Spin, Tooltip, Typography, theme } from 'antd';
import { CheckCircleFilled, CloseCircleFilled, HistoryOutlined } from '@ant-design/icons';
import { markAttendance, type AttendanceStatus } from '../../api/attendance';
import type { Student } from '../../api/students';
import { ATTENDANCE_OPTIONS } from './status';

const { Text } = Typography;

type Props = {
  student: Student;
  date: string;
  /** Status already saved for this student+date, if any. */
  markedStatus: AttendanceStatus | undefined;
  /** Called after a successful mark so the parent can refresh the summary. */
  onMarked: () => void;
  onOpenHistory: () => void;
};

function SaveIndicator({ state }: { state: 'idle' | 'saving' | 'saved' | 'error' }) {
  const { token } = theme.useToken();

  if (state === 'saving') {
    return (
      <Space size={4}>
        <Spin size="small" />
        <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
          Saving…
        </Text>
      </Space>
    );
  }
  if (state === 'saved') {
    return (
      <Space size={4}>
        <CheckCircleFilled style={{ color: token.colorSuccess }} />
        <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
          Saved
        </Text>
      </Space>
    );
  }
  if (state === 'error') {
    return (
      <Tooltip title="Couldn't save — tap a status to retry">
        <Space size={4}>
          <CloseCircleFilled style={{ color: token.colorError }} />
          <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
            Failed
          </Text>
        </Space>
      </Tooltip>
    );
  }
  return null;
}

function RosterRow({ student, date, markedStatus, onMarked, onOpenHistory }: Props) {
  const { token } = theme.useToken();
  const [optimistic, setOptimistic] = useState<AttendanceStatus | undefined>();

  const mutation = useMutation({
    mutationFn: (status: AttendanceStatus) =>
      markAttendance({ studentId: student.id, date, status }),
    onSuccess: () => onMarked(),
  });

  const value = optimistic ?? markedStatus ?? '';
  const state = mutation.isPending
    ? 'saving'
    : mutation.isError
      ? 'error'
      : mutation.isSuccess
        ? 'saved'
        : 'idle';

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: token.marginSM,
        width: '100%',
      }}
    >
      <div style={{ flex: '1 1 180px', minWidth: 0 }}>
        <Text strong style={{ display: 'block' }}>
          {student.fullName}
        </Text>
        <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
          {student.admissionNumber}
        </Text>
      </div>

      <Segmented
        data-testid="roster-segmented"
        value={value}
        onChange={(next) => {
          const status = next as AttendanceStatus;
          setOptimistic(status);
          mutation.mutate(status);
        }}
        options={ATTENDANCE_OPTIONS}
        size="large"
      />

      <div style={{ flex: '0 0 96px', textAlign: 'right' }}>
        <SaveIndicator state={state} />
      </div>

      <Button type="link" size="small" icon={<HistoryOutlined />} onClick={onOpenHistory}>
        History
      </Button>
    </div>
  );
}

export default RosterRow;
