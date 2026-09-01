import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Card,
  Empty,
  List,
  Result,
  Select,
  Skeleton,
  Space,
  Tag,
  Typography,
  theme,
} from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { fetchClasses, fetchSubjects } from '../../api/classes';
import { fetchExams, type Exam } from '../../api/exams';
import { useAuthStore } from '../../store/authStore';
import { hasAnyRole, ROLE } from '../../lib/roles';
import { CLASSES_QUERY_KEY, SUBJECTS_QUERY_KEY } from '../classes/queryKeys';
import { buildSectionLookup, buildSectionSelectOptions } from '../classes/sectionLookup';
import { EXAMS_QUERY_KEY } from './queryKeys';
import AddExamModal from './AddExamModal';
import ExamGradebook from './ExamGradebook';

const { Title, Text } = Typography;

const DATE_FORMAT = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });

function formatDate(iso: string): string {
  const parsed = new Date(`${iso}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? iso : DATE_FORMAT.format(parsed);
}

function ExamsPage() {
  const { token } = theme.useToken();
  const roles = useAuthStore((state) => state.user?.roles);
  const canManage = hasAnyRole(roles, [ROLE.SCHOOL_ADMIN, ROLE.TEACHER]);

  const [params, setParams] = useSearchParams();
  const sectionId = params.get('sectionId') ?? '';
  const [addOpen, setAddOpen] = useState(false);
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);

  const setSection = (value: string) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('sectionId', value);
        return next;
      },
      { replace: true },
    );
    setSelectedExam(null);
  };

  const classesQuery = useQuery({ queryKey: CLASSES_QUERY_KEY, queryFn: fetchClasses, enabled: canManage });
  const subjectsQuery = useQuery({ queryKey: SUBJECTS_QUERY_KEY, queryFn: fetchSubjects, enabled: canManage });

  const sectionOptions = useMemo(
    () => buildSectionSelectOptions(classesQuery.data),
    [classesQuery.data],
  );
  const sectionLookup = useMemo(() => buildSectionLookup(classesQuery.data), [classesQuery.data]);
  const section = sectionId ? sectionLookup.get(sectionId) : undefined;
  const classId = section?.classId ?? '';

  const subjectName = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of subjectsQuery.data ?? []) map.set(s.id, s.name);
    return (id: string) => map.get(id) ?? 'Subject';
  }, [subjectsQuery.data]);

  const examsQuery = useQuery({
    queryKey: [...EXAMS_QUERY_KEY, classId],
    queryFn: () => fetchExams(classId),
    enabled: canManage && classId !== '',
  });

  if (!canManage) {
    return (
      <Result
        status="403"
        title="Not available"
        subTitle="Only teachers and school administrators can manage exams."
      />
    );
  }

  const exams = examsQuery.data ?? [];

  return (
    <div style={{ maxWidth: 900, width: '100%', margin: '0 auto' }}>
      <header style={{ marginBottom: token.marginLG }}>
        <Title level={2} style={{ margin: 0 }}>
          Exams &amp; grading
        </Title>
        <Text type="secondary">Schedule exams for a class and enter marks section by section.</Text>
      </header>

      <Card style={{ marginBottom: token.marginLG, boxShadow: token.boxShadowTertiary }}>
        <Space size={token.margin} wrap style={{ width: '100%', justifyContent: 'space-between' }}>
          <div>
            <Text type="secondary" style={{ display: 'block', marginBottom: token.marginXXS }}>
              Section
            </Text>
            <Select
              data-testid="exams-section-select"
              style={{ minWidth: 240 }}
              placeholder="Select a section"
              value={sectionId || undefined}
              onChange={setSection}
              options={sectionOptions}
              loading={classesQuery.isLoading}
              showSearch
              optionFilterProp="label"
            />
          </div>
          {classId !== '' && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddOpen(true)}>
              Add exam
            </Button>
          )}
        </Space>
      </Card>

      {classesQuery.isSuccess && sectionOptions.length === 0 && (
        <Alert
          type="info"
          showIcon
          message="No sections yet"
          description={
            <>
              Create a class and section on the <Link to="/app/classes">Classes</Link> page first.
            </>
          }
        />
      )}

      {sectionId === '' && sectionOptions.length > 0 && (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Select a section to see its class's exams." />
      )}

      {classId !== '' && (
        <Card
          styles={{ body: { padding: token.paddingLG } }}
          style={{ boxShadow: token.boxShadowTertiary }}
          title={`Exams for ${section?.className ?? 'this class'}`}
          extra={
            <Button
              size="small"
              icon={<ReloadOutlined />}
              onClick={() => void examsQuery.refetch()}
              loading={examsQuery.isFetching && !examsQuery.isPending}
            >
              Refresh
            </Button>
          }
        >
          {examsQuery.isError ? (
            <Alert type="warning" showIcon message="Couldn't load exams" />
          ) : examsQuery.isPending ? (
            <Skeleton active paragraph={{ rows: 4 }} />
          ) : exams.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No exams yet — add your first exam" />
          ) : (
            <List
              dataSource={exams}
              rowKey="id"
              renderItem={(exam) => {
                const active = selectedExam?.id === exam.id;
                return (
                  <List.Item
                    onClick={() => setSelectedExam(active ? null : exam)}
                    style={{
                      cursor: 'pointer',
                      paddingInline: token.paddingSM,
                      borderRadius: token.borderRadius,
                      background: active ? token.colorPrimaryBg : undefined,
                    }}
                  >
                    <Space direction="vertical" size={0}>
                      <Text strong>{exam.name}</Text>
                      <Space size={token.marginXS} wrap>
                        <Tag color="blue" style={{ marginInlineEnd: 0 }}>
                          {subjectName(exam.subjectId)}
                        </Tag>
                        <Text type="secondary">{formatDate(exam.examDate)}</Text>
                        <Text type="secondary">· out of {exam.maxMarks}</Text>
                      </Space>
                    </Space>
                    <Button type="link" size="small">
                      {active ? 'Hide gradebook' : 'Open gradebook'}
                    </Button>
                  </List.Item>
                );
              }}
            />
          )}
        </Card>
      )}

      {selectedExam && (
        <ExamGradebook
          exam={selectedExam}
          sectionId={sectionId}
          subjectName={subjectName(selectedExam.subjectId)}
        />
      )}

      {classId !== '' && section && (
        <AddExamModal
          open={addOpen}
          onClose={() => setAddOpen(false)}
          classId={classId}
          className={section.className}
        />
      )}
    </div>
  );
}

export default ExamsPage;
