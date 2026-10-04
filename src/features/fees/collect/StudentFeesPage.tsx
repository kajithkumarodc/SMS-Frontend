import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Card, Result, Skeleton, Typography } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { fetchStudent, fetchSchools } from '../../../api/students';
import { fetchClasses } from '../../../api/classes';
import { useAuthStore } from '../../../store/authStore';
import { hasPermission } from '../../../lib/roles';
import { serverMessage } from '../../../lib/apiErrors';
import { CLASSES_QUERY_KEY } from '../../classes/queryKeys';
import { buildSectionLookup } from '../../classes/sectionLookup';
import StudentSummary from './StudentSummary';
import StudentFeesPanel from './StudentFeesPanel';

const { Title } = Typography;

/** Fees Collection -> Collect Fees -> Student Fees (/app/fees-collection/collect-fees/:studentId). */
function StudentFeesPage() {
  const { studentId = '' } = useParams();
  const navigate = useNavigate();
  const permissions = useAuthStore((state) => state.user?.permissions);
  const canView = hasPermission(permissions, 'FEE_VIEW');

  const studentQuery = useQuery({ queryKey: ['students', 'one', studentId], queryFn: () => fetchStudent(studentId), enabled: canView && Boolean(studentId) });
  const classesQuery = useQuery({ queryKey: CLASSES_QUERY_KEY, queryFn: fetchClasses, enabled: canView });
  const schoolsQuery = useQuery({ queryKey: ['schools'], queryFn: fetchSchools, enabled: canView });
  const lookup = useMemo(() => buildSectionLookup(classesQuery.data), [classesQuery.data]);

  if (!canView) return <Result status="403" title="Not available" subTitle="You don't have permission to view fees." />;
  if (studentQuery.isPending) return <Skeleton active paragraph={{ rows: 8 }} />;
  if (studentQuery.isError) return <Alert type="error" showIcon message={serverMessage(studentQuery.error) ?? 'Student not found'} />;

  const student = studentQuery.data;
  const info = lookup.get(student.sectionId ?? '');
  const classText = info ? (info.isDefault ? info.className : `${info.className} (${info.sectionName})`) : '';

  return (
    <Card
      title={<Title level={4} style={{ margin: 0, fontWeight: 500 }}>Student Fees</Title>}
      extra={
        <Button type="primary" size="small" icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
          Back
        </Button>
      }
    >
      <StudentSummary student={student} classText={classText} />
      <StudentFeesPanel
        studentId={student.id}
        header={{ schoolName: schoolsQuery.data?.[0]?.name, studentName: student.fullName, admissionNumber: student.admissionNumber, classText }}
      />
    </Card>
  );
}

export default StudentFeesPage;
