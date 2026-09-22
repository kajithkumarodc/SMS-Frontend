import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  App,
  Avatar,
  Button,
  Descriptions,
  Drawer,
  Empty,
  Result,
  Select,
  Skeleton,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
  theme,
} from 'antd';
import { UserOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  fetchAcademicHistory,
  fetchSiblings,
  linkSibling,
  searchStudents,
  studentPhotoUrl,
  type Student,
} from '../../api/students';
import { fetchStudentAttendanceHistory } from '../../api/attendance';
import { fetchStudentExamResults } from '../../api/exams';
import { fetchClasses } from '../../api/classes';
import { buildSectionLookup } from '../classes/sectionLookup';
import { CLASSES_QUERY_KEY } from '../classes/queryKeys';
import { ATTENDANCE_TAG_COLOR, attendanceLabel } from '../attendance/status';
import { STUDENT_ACADEMIC_HISTORY_KEY, STUDENT_SIBLINGS_KEY, STUDENTS_QUERY_KEY } from './queryKeys';

const { Title } = Typography;

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: 'success',
  INACTIVE: 'default',
  GRADUATED: 'blue',
  LEFT_SCHOOL: 'default',
  TRANSFERRED: 'gold',
};

function ComingSoon({ label }: { label: string }) {
  return (
    <Empty
      image={Empty.PRESENTED_IMAGE_SIMPLE}
      description={`${label} isn't part of this application yet — no records to show.`}
    />
  );
}

type Props = {
  student: Student | null;
  onClose: () => void;
  canEdit: boolean;
  onEdit: (student: Student) => void;
  onOpenDocuments: (student: Student) => void;
  onOpenInvoices: (student: Student) => void;
  onOpenLibrary: (student: Student) => void;
  onOpenTransport: (student: Student) => void;
  onOpenHostel: (student: Student) => void;
};

function StudentProfileDrawer({
  student,
  onClose,
  canEdit,
  onEdit,
  onOpenDocuments,
  onOpenInvoices,
  onOpenLibrary,
  onOpenTransport,
  onOpenHostel,
}: Props) {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const open = student !== null;
  const [linkingSiblingId, setLinkingSiblingId] = useState<string | undefined>();

  const classesQuery = useQuery({ queryKey: CLASSES_QUERY_KEY, queryFn: fetchClasses, enabled: open });
  const sectionLookup = useMemo(() => buildSectionLookup(classesQuery.data), [classesQuery.data]);

  const siblingsQuery = useQuery({
    queryKey: student ? [...STUDENT_SIBLINGS_KEY, student.id] : STUDENT_SIBLINGS_KEY,
    queryFn: () => fetchSiblings(student!.id),
    enabled: open,
  });

  const historyQuery = useQuery({
    queryKey: student ? [...STUDENT_ACADEMIC_HISTORY_KEY, student.id] : STUDENT_ACADEMIC_HISTORY_KEY,
    queryFn: () => fetchAcademicHistory(student!.id),
    enabled: open,
  });

  const attendanceQuery = useQuery({
    queryKey: ['students', 'attendance-history', student?.id],
    queryFn: () => fetchStudentAttendanceHistory(student!.id),
    enabled: open,
  });

  const examsQuery = useQuery({
    queryKey: ['students', 'exam-results', student?.id],
    queryFn: () => fetchStudentExamResults(student!.id),
    enabled: open,
  });

  // A lightweight "pick any other student" search for linking a sibling -- not a
  // separate management screen, just enough to find the right record by name/admission #.
  const candidateSiblingsQuery = useQuery({
    queryKey: ['students', 'sibling-candidates', student?.id],
    queryFn: () => searchStudents({ page: 0, size: 50 }),
    enabled: open,
  });

  const linkSiblingMutation = useMutation({
    mutationFn: (siblingId: string) => {
      if (!student) return Promise.reject(new Error('No student'));
      return linkSibling(student.id, siblingId);
    },
    onSuccess: () => {
      message.success('Sibling linked');
      if (student) void queryClient.invalidateQueries({ queryKey: [...STUDENT_SIBLINGS_KEY, student.id] });
      void queryClient.invalidateQueries({ queryKey: STUDENTS_QUERY_KEY });
      setLinkingSiblingId(undefined);
    },
    onError: () => message.error('Could not link this sibling'),
  });

  if (!student) {
    return null;
  }

  const sectionInfo = student.sectionId ? sectionLookup.get(student.sectionId) : undefined;
  const initials = student.fullName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');

  const overviewTab = (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Space size="large" align="center">
        <Avatar size={72} src={student.photoUrl ? studentPhotoUrl(student.id) : undefined} icon={<UserOutlined />}>
          {!student.photoUrl && initials}
        </Avatar>
        <div>
          <Title level={4} style={{ margin: 0 }}>
            {student.fullName}
          </Title>
          <Space size="small" wrap>
            <Tag color={STATUS_COLOR[student.status] ?? 'default'}>{student.status}</Tag>
            {student.rteStatus && <Tag color="purple">RTE</Tag>}
          </Space>
        </div>
      </Space>
      <Descriptions size="small" column={2} bordered>
        <Descriptions.Item label="Admission #">{student.admissionNumber}</Descriptions.Item>
        <Descriptions.Item label="Roll #">{student.rollNumber || '—'}</Descriptions.Item>
        <Descriptions.Item label="Class · Section">
          {sectionInfo ? `${sectionInfo.className} · ${sectionInfo.sectionName}` : 'Unassigned'}
        </Descriptions.Item>
        <Descriptions.Item label="Admission date">{student.admissionDate || '—'}</Descriptions.Item>
        <Descriptions.Item label="Guardian" span={2}>
          {[student.guardianName, student.guardianPhone].filter(Boolean).join(' · ') || '—'}
        </Descriptions.Item>
      </Descriptions>
      {canEdit && <Button onClick={() => onEdit(student)}>Edit student</Button>}
    </Space>
  );

  const personalTab = (
    <Descriptions size="small" column={2} bordered>
      <Descriptions.Item label="Gender">{student.gender || '—'}</Descriptions.Item>
      <Descriptions.Item label="Date of birth">{student.dateOfBirth || '—'}</Descriptions.Item>
      <Descriptions.Item label="Blood group">{student.bloodGroup || '—'}</Descriptions.Item>
      <Descriptions.Item label="Nationality">{student.nationality || '—'}</Descriptions.Item>
      <Descriptions.Item label="Religion">{student.religion || '—'}</Descriptions.Item>
      <Descriptions.Item label="Category">{student.category || '—'}</Descriptions.Item>
      <Descriptions.Item label="Mother tongue">{student.motherTongue || '—'}</Descriptions.Item>
      <Descriptions.Item label="Enrollment #">{student.enrollmentNumber || '—'}</Descriptions.Item>
      <Descriptions.Item label="Admission source">{student.admissionSource || '—'}</Descriptions.Item>
      <Descriptions.Item label="Previous school">{student.previousSchoolName || '—'}</Descriptions.Item>
      <Descriptions.Item label="Previous class">{student.previousSchoolClass || '—'}</Descriptions.Item>
      <Descriptions.Item label="Transfer certificate #">{student.transferCertificateNumber || '—'}</Descriptions.Item>
      <Descriptions.Item label="Current address" span={2}>
        {[student.addressLine1, student.addressLine2, student.city, student.state, student.currentCountry, student.pincode]
          .filter(Boolean)
          .join(', ') || '—'}
      </Descriptions.Item>
      <Descriptions.Item label="Permanent address" span={2}>
        {[student.permanentAddressLine1, student.permanentAddressLine2, student.permanentCity, student.permanentState,
          student.permanentCountry, student.permanentPincode]
          .filter(Boolean)
          .join(', ') || '—'}
      </Descriptions.Item>
    </Descriptions>
  );

  const parentsTab = (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Descriptions title="Guardian" size="small" column={2} bordered>
        <Descriptions.Item label="Name">{student.guardianName || '—'}</Descriptions.Item>
        <Descriptions.Item label="Relationship">{student.guardianRelationship || '—'}</Descriptions.Item>
        <Descriptions.Item label="Phone">{student.guardianPhone || '—'}</Descriptions.Item>
        <Descriptions.Item label="Alternate phone">{student.guardianAlternatePhone || '—'}</Descriptions.Item>
        <Descriptions.Item label="Email">{student.guardianEmail || '—'}</Descriptions.Item>
        <Descriptions.Item label="Occupation">{student.guardianOccupation || '—'}</Descriptions.Item>
      </Descriptions>
      <Descriptions title="Father" size="small" column={2} bordered>
        <Descriptions.Item label="Name">{student.fatherName || '—'}</Descriptions.Item>
        <Descriptions.Item label="Mobile">{student.fatherMobile || '—'}</Descriptions.Item>
        <Descriptions.Item label="Email">{student.fatherEmail || '—'}</Descriptions.Item>
        <Descriptions.Item label="Occupation">{student.fatherOccupation || '—'}</Descriptions.Item>
      </Descriptions>
      <Descriptions title="Mother" size="small" column={2} bordered>
        <Descriptions.Item label="Name">{student.motherName || '—'}</Descriptions.Item>
        <Descriptions.Item label="Mobile">{student.motherMobile || '—'}</Descriptions.Item>
        <Descriptions.Item label="Email">{student.motherEmail || '—'}</Descriptions.Item>
        <Descriptions.Item label="Occupation">{student.motherOccupation || '—'}</Descriptions.Item>
      </Descriptions>
      <Descriptions title="Emergency contact" size="small" column={2} bordered>
        <Descriptions.Item label="Name">{student.emergencyContactName || '—'}</Descriptions.Item>
        <Descriptions.Item label="Relationship">{student.emergencyContactRelationship || '—'}</Descriptions.Item>
        <Descriptions.Item label="Mobile">{student.emergencyContactMobile || '—'}</Descriptions.Item>
        <Descriptions.Item label="Alternate mobile">{student.emergencyContactAlternateMobile || '—'}</Descriptions.Item>
        <Descriptions.Item label="Address" span={2}>{student.emergencyContactAddress || '—'}</Descriptions.Item>
      </Descriptions>
    </Space>
  );

  const otherCandidates = (candidateSiblingsQuery.data?.content ?? []).filter((s) => s.id !== student.id);

  const siblingsTab = (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      {canEdit && (
        <Space>
          <Select
            style={{ width: 280 }}
            placeholder="Search a student to link as sibling"
            showSearch
            loading={candidateSiblingsQuery.isLoading}
            optionFilterProp="label"
            value={linkingSiblingId}
            onChange={setLinkingSiblingId}
            options={otherCandidates.map((s) => ({ value: s.id, label: `${s.fullName} (${s.admissionNumber})` }))}
          />
          <Button
            type="primary"
            disabled={!linkingSiblingId}
            loading={linkSiblingMutation.isPending}
            onClick={() => linkingSiblingId && linkSiblingMutation.mutate(linkingSiblingId)}
          >
            Link
          </Button>
        </Space>
      )}
      {siblingsQuery.isPending ? (
        <Skeleton active paragraph={{ rows: 2 }} />
      ) : (siblingsQuery.data ?? []).length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No siblings linked yet" />
      ) : (
        <Table
          rowKey="id"
          size="small"
          pagination={false}
          dataSource={siblingsQuery.data}
          columns={[
            { title: 'Name', dataIndex: 'fullName', key: 'fullName' },
            { title: 'Admission #', dataIndex: 'admissionNumber', key: 'admissionNumber' },
            { title: 'Status', dataIndex: 'status', key: 'status', render: (v: string) => <Tag>{v}</Tag> },
          ]}
        />
      )}
    </Space>
  );

  const academicHistoryTab = historyQuery.isPending ? (
    <Skeleton active paragraph={{ rows: 3 }} />
  ) : (historyQuery.data ?? []).length === 0 ? (
    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No academic history recorded yet" />
  ) : (
    <Table
      rowKey="id"
      size="small"
      pagination={false}
      dataSource={historyQuery.data}
      columns={[
        {
          title: 'Section',
          key: 'section',
          render: (_v, record) => {
            const info = record.sectionId ? sectionLookup.get(record.sectionId) : undefined;
            return info ? `${info.className} · ${info.sectionName}` : '—';
          },
        },
        {
          title: 'Recorded',
          dataIndex: 'recordedAt',
          key: 'recordedAt',
          render: (v: string) => dayjs(v).format('D MMM YYYY, HH:mm'),
        },
      ]}
    />
  );

  const attendanceTab = attendanceQuery.isPending ? (
    <Skeleton active paragraph={{ rows: 3 }} />
  ) : (attendanceQuery.data ?? []).length === 0 ? (
    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No attendance recorded yet" />
  ) : (
    <Table
      rowKey="id"
      size="small"
      pagination={{ pageSize: 10 }}
      dataSource={attendanceQuery.data}
      columns={[
        { title: 'Date', dataIndex: 'date', key: 'date' },
        {
          title: 'Status',
          dataIndex: 'status',
          key: 'status',
          render: (v: 'PRESENT' | 'ABSENT' | 'LATE') => <Tag color={ATTENDANCE_TAG_COLOR[v]}>{attendanceLabel(v)}</Tag>,
        },
      ]}
    />
  );

  const examsTab = examsQuery.isPending ? (
    <Skeleton active paragraph={{ rows: 3 }} />
  ) : (examsQuery.data ?? []).length === 0 ? (
    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No exam results recorded yet" />
  ) : (
    <Table
      rowKey="examId"
      size="small"
      pagination={{ pageSize: 10 }}
      dataSource={examsQuery.data}
      columns={[
        { title: 'Exam', dataIndex: 'examName', key: 'examName' },
        { title: 'Date', dataIndex: 'examDate', key: 'examDate' },
        {
          title: 'Marks',
          key: 'marks',
          render: (_v, record) => `${record.marksObtained} / ${record.maxMarks}`,
        },
      ]}
    />
  );

  const linkedModuleTab = (label: string, onOpen: () => void) => (
    <Result
      status="info"
      title={label}
      subTitle={`Manage ${student.fullName}'s ${label.toLowerCase()} records from the ${label} screen.`}
      extra={
        <Button type="primary" onClick={onOpen}>
          Open {label}
        </Button>
      }
    />
  );

  return (
    <Drawer
      title={student.fullName}
      open={open}
      onClose={onClose}
      width={720}
      styles={{ body: { paddingTop: token.paddingSM } }}
    >
      <Tabs
        defaultActiveKey="overview"
        items={[
          { key: 'overview', label: 'Overview', children: overviewTab },
          { key: 'personal', label: 'Personal Information', children: personalTab },
          { key: 'parents', label: 'Parents/Guardians', children: parentsTab },
          { key: 'siblings', label: 'Siblings', children: siblingsTab },
          { key: 'academic-history', label: 'Academic History', children: academicHistoryTab },
          { key: 'attendance', label: 'Attendance', children: attendanceTab },
          { key: 'fees', label: 'Fees', children: linkedModuleTab('Fees', () => onOpenInvoices(student)) },
          { key: 'exams', label: 'Examinations', children: examsTab },
          { key: 'homework', label: 'Homework', children: <ComingSoon label="Homework" /> },
          { key: 'library', label: 'Library', children: linkedModuleTab('Library', () => onOpenLibrary(student)) },
          { key: 'transport', label: 'Transport', children: linkedModuleTab('Transport', () => onOpenTransport(student)) },
          { key: 'hostel', label: 'Hostel', children: linkedModuleTab('Hostel', () => onOpenHostel(student)) },
          { key: 'documents', label: 'Documents', children: linkedModuleTab('Documents', () => onOpenDocuments(student)) },
          { key: 'certificates', label: 'Certificates', children: <ComingSoon label="Certificates" /> },
          { key: 'communication', label: 'Communication', children: <ComingSoon label="Communication" /> },
        ]}
      />
    </Drawer>
  );
}

export default StudentProfileDrawer;
