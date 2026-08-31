import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { InputNumber, Space, Spin, Tooltip, Typography, theme } from 'antd';
import { CheckCircleFilled, CloseCircleFilled } from '@ant-design/icons';
import { recordExamMark } from '../../api/exams';
import type { Student } from '../../api/students';

const { Text } = Typography;

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

function SaveIndicator({ state }: { state: SaveState }) {
  const { token } = theme.useToken();
  const small = { fontSize: token.fontSizeSM };

  if (state === 'saving') {
    return (
      <Space size={4}>
        <Spin size="small" />
        <Text type="secondary" style={small}>
          Saving…
        </Text>
      </Space>
    );
  }
  if (state === 'saved') {
    return (
      <Space size={4}>
        <CheckCircleFilled style={{ color: token.colorSuccess }} />
        <Text type="secondary" style={small}>
          Saved
        </Text>
      </Space>
    );
  }
  if (state === 'error') {
    return (
      <Tooltip title="Couldn't save — check the value and try again">
        <Space size={4}>
          <CloseCircleFilled style={{ color: token.colorError }} />
          <Text type="secondary" style={small}>
            Failed
          </Text>
        </Space>
      </Tooltip>
    );
  }
  return null;
}

type Props = {
  student: Student;
  examId: string;
  maxMarks: number;
  /** Marks already recorded for this student, if any. */
  recordedMarks: number | undefined;
  onSaved: () => void;
};

/** One gradebook row: a number input that upserts the student's marks on blur / Enter. */
function ExamMarkRow({ student, examId, maxMarks, recordedMarks, onSaved }: Props) {
  const { token } = theme.useToken();
  const [value, setValue] = useState<number | null>(recordedMarks ?? null);

  useEffect(() => {
    setValue(recordedMarks ?? null);
  }, [recordedMarks]);

  const mutation = useMutation({
    mutationFn: (marks: number) => recordExamMark(examId, { studentId: student.id, marksObtained: marks }),
    onSuccess: () => onSaved(),
  });

  const state: SaveState = mutation.isPending
    ? 'saving'
    : mutation.isError
      ? 'error'
      : mutation.isSuccess
        ? 'saved'
        : 'idle';

  const commit = () => {
    if (value == null || value < 0 || value > maxMarks) return;
    if (value === recordedMarks) return; // unchanged
    mutation.mutate(value);
  };

  const outOfRange = value != null && (value < 0 || value > maxMarks);

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

      <Space size={4} align="baseline">
        <InputNumber
          value={value}
          min={0}
          max={maxMarks}
          step={0.5}
          status={outOfRange ? 'error' : undefined}
          onChange={(v) => setValue(v == null ? null : Number(v))}
          onBlur={commit}
          onPressEnter={commit}
          style={{ width: 96 }}
        />
        <Text type="secondary">/ {maxMarks}</Text>
      </Space>

      <div style={{ flex: '0 0 90px', textAlign: 'right' }}>
        <SaveIndicator state={state} />
      </div>
    </div>
  );
}

export default ExamMarkRow;
