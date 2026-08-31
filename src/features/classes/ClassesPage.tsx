import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Card,
  Collapse,
  Empty,
  Result,
  Skeleton,
  Space,
  Tag,
  Typography,
  theme,
} from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import {
  fetchClasses,
  fetchClassSubjects,
  fetchSubjects,
  type SchoolClass,
  type Subject,
} from '../../api/classes';
import { useAuthStore } from '../../store/authStore';
import { hasRole, ROLE } from '../../lib/roles';
import { CLASSES_QUERY_KEY, CLASS_SUBJECTS_QUERY_KEY, SUBJECTS_QUERY_KEY } from './queryKeys';
import AddClassModal from './AddClassModal';
import AddSectionModal from './AddSectionModal';
import AddSubjectModal from './AddSubjectModal';
import AssignSubjectModal from './AssignSubjectModal';

const { Title, Text } = Typography;

function ClassesPage() {
  const { token } = theme.useToken();
  const roles = useAuthStore((state) => state.user?.roles);
  const canManage = hasRole(roles, ROLE.SCHOOL_ADMIN);

  const [addClassOpen, setAddClassOpen] = useState(false);
  const [addSubjectOpen, setAddSubjectOpen] = useState(false);
  const [sectionTarget, setSectionTarget] = useState<{ id: string; name: string } | null>(null);

  const classesQuery = useQuery({
    queryKey: CLASSES_QUERY_KEY,
    queryFn: fetchClasses,
    enabled: canManage,
  });
  const subjectsQuery = useQuery({
    queryKey: SUBJECTS_QUERY_KEY,
    queryFn: fetchSubjects,
    enabled: canManage,
  });

  if (!canManage) {
    return (
      <Result
        status="403"
        title="Not available"
        subTitle="Only a school administrator can manage classes, sections and subjects."
      />
    );
  }

  const classes = classesQuery.data ?? [];
  const subjects = subjectsQuery.data ?? [];

  const renderClass = (cls: SchoolClass) => ({
    key: cls.id,
    label: (
      <Space>
        <Text strong>{cls.name}</Text>
        <Text type="secondary">
          {cls.sections.length} section{cls.sections.length === 1 ? '' : 's'}
        </Text>
      </Space>
    ),
    extra: (
      <Button
        size="small"
        icon={<PlusOutlined />}
        onClick={(event) => {
          event.stopPropagation();
          setSectionTarget({ id: cls.id, name: cls.name });
        }}
      >
        Add section
      </Button>
    ),
    children: (
      <Space direction="vertical" size={token.marginLG} style={{ width: '100%' }}>
        <div>
          <Text type="secondary" style={{ display: 'block', marginBottom: token.marginXS }}>
            Sections
          </Text>
          {cls.sections.length === 0 ? (
            <Text type="secondary">No sections yet — add the first one.</Text>
          ) : (
            <Space size={[token.marginXS, token.marginXS]} wrap>
              {cls.sections.map((section) => (
                <Tag key={section.id} style={{ marginInlineEnd: 0 }}>
                  {section.name}
                </Tag>
              ))}
            </Space>
          )}
        </div>

        <ClassSubjects classId={cls.id} className={cls.name} allSubjects={subjects} />
      </Space>
    ),
  });

  return (
    <div style={{ maxWidth: 1040, width: '100%', margin: '0 auto' }}>
      <header
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: token.marginSM,
          marginBottom: token.marginLG,
        }}
      >
        <div>
          <Title level={2} style={{ margin: 0 }}>
            Classes, sections &amp; subjects
          </Title>
          <Text type="secondary">Grade / class groups, their sections, and the subjects they teach.</Text>
        </div>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              void classesQuery.refetch();
              void subjectsQuery.refetch();
            }}
            loading={
              (classesQuery.isFetching && !classesQuery.isPending) ||
              (subjectsQuery.isFetching && !subjectsQuery.isPending)
            }
          >
            Refresh
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddClassOpen(true)}>
            Add class
          </Button>
        </Space>
      </header>

      <Card
        title="Subjects"
        extra={
          <Button size="small" icon={<PlusOutlined />} onClick={() => setAddSubjectOpen(true)}>
            Add subject
          </Button>
        }
        style={{ marginBottom: token.marginLG, boxShadow: token.boxShadowTertiary }}
      >
        {subjectsQuery.isError ? (
          <Alert type="warning" showIcon message="Couldn't load subjects" />
        ) : subjectsQuery.isPending ? (
          <Skeleton active paragraph={{ rows: 1 }} title={false} />
        ) : subjects.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="No subjects yet — add your first subject"
          />
        ) : (
          <Space size={[token.marginXS, token.marginXS]} wrap>
            {subjects.map((subject) => (
              <Tag key={subject.id} color="blue" style={{ marginInlineEnd: 0 }}>
                {subject.name}
              </Tag>
            ))}
          </Space>
        )}
      </Card>

      <Card
        styles={{ body: { padding: token.paddingLG } }}
        style={{ boxShadow: token.boxShadowTertiary }}
      >
        {classesQuery.isError ? (
          <Alert
            type="warning"
            showIcon
            message="Couldn't load classes"
            description="There was a problem reaching the server."
            action={
              <Button size="small" onClick={() => void classesQuery.refetch()}>
                Try again
              </Button>
            }
          />
        ) : classesQuery.isPending ? (
          <Skeleton active paragraph={{ rows: 5 }} />
        ) : classes.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="No classes yet — add your first class"
          />
        ) : (
          <Collapse accordion items={classes.map(renderClass)} defaultActiveKey={classes[0]?.id} />
        )}
      </Card>

      <AddClassModal open={addClassOpen} onClose={() => setAddClassOpen(false)} />
      <AddSubjectModal open={addSubjectOpen} onClose={() => setAddSubjectOpen(false)} />
      <AddSectionModal target={sectionTarget} onClose={() => setSectionTarget(null)} />
    </div>
  );
}

function ClassSubjects({
  classId,
  className,
  allSubjects,
}: {
  classId: string;
  className: string;
  allSubjects: Subject[];
}) {
  const { token } = theme.useToken();
  const [assignOpen, setAssignOpen] = useState(false);

  const { data, isPending, isError } = useQuery({
    queryKey: [...CLASS_SUBJECTS_QUERY_KEY, classId],
    queryFn: () => fetchClassSubjects(classId),
  });

  const assigned = data ?? [];
  const assignedIds = new Set(assigned.map((s) => s.id));
  const available = allSubjects.filter((s) => !assignedIds.has(s.id));

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: token.marginSM,
          marginBottom: token.marginXS,
        }}
      >
        <Text type="secondary">Subjects</Text>
        <Button size="small" icon={<PlusOutlined />} onClick={() => setAssignOpen(true)}>
          Assign subject
        </Button>
      </div>

      {isError ? (
        <Text type="danger">Couldn&rsquo;t load this class&rsquo;s subjects.</Text>
      ) : isPending ? (
        <Skeleton active paragraph={{ rows: 1 }} title={false} />
      ) : assigned.length === 0 ? (
        <Text type="secondary">No subjects assigned yet.</Text>
      ) : (
        <Space size={[token.marginXS, token.marginXS]} wrap>
          {assigned.map((subject) => (
            <Tag key={subject.id} color="blue" style={{ marginInlineEnd: 0 }}>
              {subject.name}
            </Tag>
          ))}
        </Space>
      )}

      <AssignSubjectModal
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        classId={classId}
        className={className}
        availableSubjects={available}
        noSubjectsAtAll={allSubjects.length === 0}
      />
    </div>
  );
}

export default ClassesPage;
