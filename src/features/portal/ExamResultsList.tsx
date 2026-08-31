import { Empty, List, Space, Tag, Typography, theme } from 'antd';
import type { StudentExamResult } from '../../api/exams';

const { Text } = Typography;

const DATE_FORMAT = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });

function formatDate(iso: string): string {
  const parsed = new Date(`${iso}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? iso : DATE_FORMAT.format(parsed);
}

type Props = {
  results: StudentExamResult[];
  subjectName: (subjectId: string) => string;
};

/** Exam-results timeline, shared by the student's own page and a parent's child page. */
function ExamResultsList({ results, subjectName }: Props) {
  const { token } = theme.useToken();

  if (results.length === 0) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No results published yet" />;
  }

  return (
    <List
      dataSource={results}
      rowKey={(result) => result.examId}
      renderItem={(result) => (
        <List.Item
          style={{ display: 'flex', flexWrap: 'wrap', gap: token.marginSM, justifyContent: 'space-between' }}
        >
          <Space direction="vertical" size={0}>
            <Text strong>{result.examName}</Text>
            <Space size={token.marginXS} wrap>
              <Tag color="blue" style={{ marginInlineEnd: 0 }}>
                {subjectName(result.subjectId)}
              </Tag>
              <Text type="secondary">{formatDate(result.examDate)}</Text>
            </Space>
          </Space>
          <Text strong style={{ fontSize: token.fontSizeHeading5 }}>
            {result.marksObtained}
            <Text type="secondary" style={{ fontWeight: 'normal' }}> / {result.maxMarks}</Text>
          </Text>
        </List.Item>
      )}
    />
  );
}

export default ExamResultsList;
