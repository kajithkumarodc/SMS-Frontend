import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Card, Empty, List, Skeleton, Space, Tag, Typography, theme } from 'antd';
import { fetchSectionRoster } from '../../api/attendance';
import { fetchExamMarks, type Exam } from '../../api/exams';
import { EXAM_MARKS_QUERY_KEY, EXAM_ROSTER_QUERY_KEY } from './queryKeys';
import ExamMarkRow from './ExamMarkRow';

const { Title, Text } = Typography;

const DATE_FORMAT = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });

function formatDate(iso: string): string {
  const parsed = new Date(`${iso}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? iso : DATE_FORMAT.format(parsed);
}

type Props = {
  exam: Exam;
  sectionId: string;
  subjectName: string;
};

function ExamGradebook({ exam, sectionId, subjectName }: Props) {
  const { token } = theme.useToken();
  const queryClient = useQueryClient();

  const rosterQuery = useQuery({
    queryKey: [...EXAM_ROSTER_QUERY_KEY, sectionId],
    queryFn: () => fetchSectionRoster(sectionId),
    enabled: sectionId !== '',
  });

  const marksQuery = useQuery({
    queryKey: [...EXAM_MARKS_QUERY_KEY, exam.id],
    queryFn: () => fetchExamMarks(exam.id),
  });

  const marksByStudent = useMemo(() => {
    const map = new Map<string, number>();
    for (const mark of marksQuery.data ?? []) map.set(mark.studentId, mark.marksObtained);
    return map;
  }, [marksQuery.data]);

  const roster = rosterQuery.data ?? [];
  const recordedCount = roster.filter((s) => marksByStudent.has(s.id)).length;

  const handleSaved = () => {
    void queryClient.invalidateQueries({ queryKey: [...EXAM_MARKS_QUERY_KEY, exam.id] });
  };

  const loading = rosterQuery.isPending || marksQuery.isPending;
  const error = rosterQuery.isError || marksQuery.isError;

  return (
    <Card
      style={{ marginTop: token.marginLG, boxShadow: token.boxShadowTertiary }}
      styles={{ body: { padding: token.paddingLG } }}
    >
      <Space direction="vertical" size={token.marginXXS} style={{ marginBottom: token.marginLG }}>
        <Title level={4} style={{ margin: 0 }}>
          {exam.name}
        </Title>
        <Space size={token.marginSM} wrap>
          <Tag color="blue" style={{ marginInlineEnd: 0 }}>
            {subjectName}
          </Tag>
          <Text type="secondary">{formatDate(exam.examDate)}</Text>
          <Text type="secondary">·</Text>
          <Text strong>Max marks: {exam.maxMarks}</Text>
          {roster.length > 0 && (
            <Text type="secondary">
              {recordedCount} / {roster.length} recorded
            </Text>
          )}
        </Space>
      </Space>

      {error ? (
        <Alert type="warning" showIcon message="Couldn't load the gradebook" />
      ) : loading ? (
        <Skeleton active paragraph={{ rows: 5 }} />
      ) : roster.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <>
              No students in this section yet —{' '}
              <Link to="/app/students">assign students from the Students page</Link>.
            </>
          }
        />
      ) : (
        <List
          dataSource={roster}
          rowKey="id"
          renderItem={(student) => (
            <List.Item>
              <ExamMarkRow
                student={student}
                examId={exam.id}
                maxMarks={exam.maxMarks}
                recordedMarks={marksByStudent.get(student.id)}
                onSaved={handleSaved}
              />
            </List.Item>
          )}
        />
      )}
    </Card>
  );
}

export default ExamGradebook;
