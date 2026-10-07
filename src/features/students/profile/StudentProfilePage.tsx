import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Alert, Avatar, Button, Card, Col, Descriptions, Dropdown, Empty, List, Result, Row, Skeleton, Space, Tabs, Tag, Tooltip, Typography, theme } from 'antd';
import type { MenuProps } from 'antd';
import {
  ApartmentOutlined,
  ArrowLeftOutlined,
  DollarOutlined,
  DownloadOutlined,
  EditOutlined,
  FolderOutlined,
  MoreOutlined,
  PrinterOutlined,
  UserOutlined,
} from '@ant-design/icons';
import {
  documentDownloadUrl,
  fetchDocuments,
  fetchIdentifications,
  fetchSchools,
  fetchStudent,
  studentPhotoUrl,
  type Student,
} from '../../../api/students';
import { fetchClasses } from '../../../api/classes';
import { fetchMediums } from '../../../api/mediums';
import { useAuthStore } from '../../../store/authStore';
import { hasAnyRole, hasPermission, hasRole, ROLE } from '../../../lib/roles';
import { formatDisplayDate } from '../../../lib/dates';
import { formatFileSize } from '../../../lib/files';
import { serverMessage } from '../../../lib/apiErrors';
import { CLASSES_QUERY_KEY } from '../../classes/queryKeys';
import { buildSectionLookup } from '../../classes/sectionLookup';
import { MEDIUMS_QUERY_KEY } from '../../fees/MediumsModal';
import StudentFeesPanel from '../../fees/collect/StudentFeesPanel';
import EditStudentModal from '../EditStudentModal';
import StudentDocumentsModal from '../StudentDocumentsModal';
import AssignSectionModal from '../AssignSectionModal';

const { Title, Text } = Typography;

const GENDER: Record<string, string> = { MALE: 'Male', FEMALE: 'Female', OTHER: 'Other' };
const RELATION: Record<string, string> = { FATHER: 'Father', MOTHER: 'Mother', GUARDIAN: 'Guardian', OTHER: 'Other' };

function address(parts: (string | null | undefined)[]) {
  return parts.filter(Boolean).join(', ');
}

/**
 * Student Information -> Student Details -> one student (Smart School profile page): a summary card with quick
 * actions (print, edit, collect fees) and tabs for the full profile, fees and documents.
 */
function StudentProfilePage() {
  const { studentId = '' } = useParams();
  const navigate = useNavigate();
  const { token } = theme.useToken();
  const roles = useAuthStore((s) => s.user?.roles);
  const permissions = useAuthStore((s) => s.user?.permissions);
  const canView = hasAnyRole(roles, [ROLE.SCHOOL_ADMIN, ROLE.TEACHER]);
  const canManage = hasRole(roles, ROLE.SCHOOL_ADMIN);
  const canSeeFees = hasPermission(permissions, 'FEE_VIEW');

  const [tab, setTab] = useState('profile');
  const [editing, setEditing] = useState<Student | null>(null);
  const [docsOpen, setDocsOpen] = useState<Student | null>(null);
  const [assigning, setAssigning] = useState<Student | null>(null);

  const studentQuery = useQuery({ queryKey: ['students', 'one', studentId], queryFn: () => fetchStudent(studentId), enabled: canView && Boolean(studentId) });
  const classesQuery = useQuery({ queryKey: CLASSES_QUERY_KEY, queryFn: fetchClasses, enabled: canView });
  const mediumsQuery = useQuery({ queryKey: MEDIUMS_QUERY_KEY, queryFn: fetchMediums, enabled: canView });
  const schoolsQuery = useQuery({ queryKey: ['schools'], queryFn: fetchSchools, enabled: canView });
  const idsQuery = useQuery({ queryKey: ['students', 'one', studentId, 'ids'], queryFn: () => fetchIdentifications(studentId), enabled: canView && Boolean(studentId) });
  const docsQuery = useQuery({ queryKey: ['student-documents', studentId], queryFn: () => fetchDocuments(studentId), enabled: canView && tab === 'documents' });
  const lookup = useMemo(() => buildSectionLookup(classesQuery.data), [classesQuery.data]);

  if (!canView) return <Result status="403" title="Not available" subTitle="You don't have permission to view student details." />;
  if (studentQuery.isPending) return <Skeleton active paragraph={{ rows: 10 }} />;
  if (studentQuery.isError) return <Alert type="error" showIcon message={serverMessage(studentQuery.error) ?? 'Student not found'} />;

  const s = studentQuery.data;
  const info = lookup.get(s.sectionId ?? '');
  const classText = info ? (info.isDefault ? info.className : `${info.className} (${info.sectionName})`) : '';
  const medium = mediumsQuery.data?.find((m) => m.id === s.extra?.mediumId)?.name;
  const idOf = (type: string) => idsQuery.data?.find((i) => i.idType === type)?.idValue ?? '';
  const x = s.extra;

  const moreItems: MenuProps['items'] = [
    { key: 'documents', icon: <FolderOutlined />, label: 'Documents' },
    ...(canManage ? [{ key: 'section', icon: <ApartmentOutlined />, label: 'Assign section' }] : []),
  ];

  const row = (label: string, value: React.ReactNode) => (
    <Descriptions.Item label={label}>{value || <Text type="secondary">-</Text>}</Descriptions.Item>
  );
  const block = (title: string, children: React.ReactNode) => (
    <Card size="small" title={<Text strong style={{ fontSize: token.fontSizeLG, fontWeight: 500 }}>{title}</Text>} style={{ marginBottom: token.marginMD }}>
      {children}
    </Card>
  );
  const desc = (items: React.ReactNode) => (
    <Descriptions size="small" column={{ xs: 1, sm: 1, md: 2, lg: 2, xl: 2, xxl: 2 }} styles={{ label: { width: 190, color: token.colorTextSecondary } }}>
      {items}
    </Descriptions>
  );

  const profileTab = (
    <div>
      {block(
        'Student',
        desc(
          <>
            {row('Admission Date', formatDisplayDate(s.admissionDate))}
            {row('Date Of Birth', formatDisplayDate(s.dateOfBirth))}
            {row('Category', s.category)}
            {row('Mobile Number', x?.mobileNumber)}
            {row('Caste', x?.caste)}
            {row('Religion', s.religion)}
            {row('Email', x?.email)}
            {row('Medium', medium)}
            {row('Blood Group', s.bloodGroup === 'UNKNOWN' ? '' : s.bloodGroup)}
            {row('Height / Weight', [x?.height, x?.weight].filter(Boolean).join(' / '))}
            {row('Medical History', x?.medicalHistory)}
            {row('Note', x?.note)}
          </>,
        ),
      )}
      {block(
        'Address',
        desc(
          <>
            {row('Current Address', address([s.addressLine1, s.addressLine2, s.city, s.state, s.pincode]))}
            {row('Permanent Address', address([s.permanentAddressLine1, s.permanentAddressLine2, s.permanentCity, s.permanentState, s.permanentPincode]))}
          </>,
        ),
      )}
      {block(
        'Parent Guardian Detail',
        desc(
          <>
            {row('Father Name', s.fatherName)}
            {row('Father Phone', s.fatherMobile)}
            {row('Father Occupation', s.fatherOccupation)}
            {row('Mother Name', s.motherName)}
            {row('Mother Phone', s.motherMobile)}
            {row('Mother Occupation', s.motherOccupation)}
            {row('Guardian Name', s.guardianName)}
            {row('Guardian Relation', s.guardianRelationship ? RELATION[s.guardianRelationship] : '')}
            {row('Guardian Phone', s.guardianPhone)}
            {row('Guardian Email', s.guardianEmail)}
            {row('Guardian Occupation', s.guardianOccupation)}
            {row('Guardian Address', x?.guardianAddress)}
          </>,
        ),
      )}
      {block(
        'Miscellaneous Details',
        desc(
          <>
            {row('Bank Account Number', x?.bankAccountNumber)}
            {row('Bank Name', x?.bankName)}
            {row('IFSC Code', x?.ifscCode)}
            {row('National Identification Number', idOf('NATIONAL_ID'))}
            {row('Local Identification Number', idOf('LOCAL_ID'))}
            {row('Previous School Details', s.previousSchoolName)}
          </>,
        ),
      )}
    </div>
  );

  const documentsTab = docsQuery.isPending ? (
    <Skeleton active />
  ) : (docsQuery.data ?? []).length === 0 ? (
    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No documents uploaded">
      {canManage && <Button onClick={() => setDocsOpen(s)}>Upload documents</Button>}
    </Empty>
  ) : (
    <>
      <List
        bordered
        dataSource={docsQuery.data ?? []}
        renderItem={(d) => (
          <List.Item
            actions={[
              <a key="dl" href={documentDownloadUrl(s.id, d.id)} target="_blank" rel="noreferrer" aria-label={`Download ${d.originalFilename}`}>
                <DownloadOutlined /> Download
              </a>,
            ]}
          >
            <List.Item.Meta
              title={d.notes || d.originalFilename}
              description={`${d.documentType.replace(/_/g, ' ')} · ${d.originalFilename} · ${formatFileSize(d.fileSizeBytes)} · ${formatDisplayDate(d.uploadedAt.slice(0, 10))}`}
            />
          </List.Item>
        )}
      />
      {canManage && (
        <Button style={{ marginTop: token.marginSM }} onClick={() => setDocsOpen(s)}>
          Manage documents
        </Button>
      )}
    </>
  );

  return (
    <div>
      <Button type="link" icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} style={{ paddingInline: 0, marginBottom: token.marginXS }}>
        Back
      </Button>
      <Row gutter={[token.marginLG, token.marginLG]} align="top">
        <Col xs={24} lg={8} xl={7}>
          <Card styles={{ body: { padding: 0 } }}>
            <div style={{ display: 'flex', gap: token.marginMD, padding: token.paddingLG, background: token.colorFillQuaternary }}>
              <Avatar shape="square" size={88} src={s.photoUrl ? studentPhotoUrl(s.id) : undefined} icon={<UserOutlined />} alt={`Photo of ${s.fullName}`} />
              <div style={{ minWidth: 0 }}>
                <Title level={4} style={{ margin: 0, fontWeight: 500 }}>
                  {s.fullName}
                </Title>
                <div>
                  Admission No <Text style={{ color: token.colorPrimary }}>{s.admissionNumber}</Text>
                </div>
                <div>Roll Number {s.rollNumber ?? ''}</div>
                {s.status !== 'ACTIVE' && <Tag style={{ marginTop: 4 }}>{s.status.replace('_', ' ')}</Tag>}
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-around', padding: token.paddingSM, borderBlock: `1px solid ${token.colorBorderSecondary}` }}>
              <Tooltip title="Print">
                <Button type="text" icon={<PrinterOutlined />} aria-label="Print profile" onClick={() => window.print()} />
              </Tooltip>
              {canManage && (
                <Tooltip title="Edit">
                  <Button type="text" icon={<EditOutlined />} aria-label="Edit student" onClick={() => setEditing(s)} />
                </Tooltip>
              )}
              {canSeeFees && (
                <Tooltip title="Collect Fees">
                  <Button type="text" icon={<DollarOutlined />} aria-label="Collect fees" onClick={() => navigate(`/app/fees-collection/collect-fees/${s.id}`)} />
                </Tooltip>
              )}
              <Dropdown
                trigger={['click']}
                menu={{
                  items: moreItems,
                  onClick: ({ key }) => {
                    if (key === 'documents') setDocsOpen(s);
                    if (key === 'section') setAssigning(s);
                  },
                }}
              >
                <Button type="text" icon={<MoreOutlined />} aria-label="More actions" />
              </Dropdown>
            </div>
            <Descriptions
              size="small"
              column={1}
              style={{ padding: `${token.paddingSM}px ${token.paddingLG}px` }}
              styles={{ label: { fontWeight: 600, color: token.colorText }, content: { justifyContent: 'flex-end', color: token.colorPrimary } }}
            >
              <Descriptions.Item label="Class">{info?.className ?? ''}</Descriptions.Item>
              <Descriptions.Item label="Section">{info && !info.isDefault ? info.sectionName : '-'}</Descriptions.Item>
              <Descriptions.Item label="Gender">{s.gender ? GENDER[s.gender] : ''}</Descriptions.Item>
              <Descriptions.Item label="Medium">{medium ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="RTE">{s.rteStatus ? 'Yes' : 'No'}</Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
        <Col xs={24} lg={16} xl={17}>
          <Card styles={{ body: { paddingTop: 0 } }}>
            <Tabs
              activeKey={tab}
              onChange={setTab}
              items={[
                { key: 'profile', label: 'Profile', children: profileTab },
                ...(canSeeFees
                  ? [
                      {
                        key: 'fees',
                        label: 'Fees',
                        children: (
                          <StudentFeesPanel
                            studentId={s.id}
                            header={{ schoolName: schoolsQuery.data?.[0]?.name, studentName: s.fullName, admissionNumber: s.admissionNumber, classText }}
                          />
                        ),
                      },
                    ]
                  : []),
                { key: 'documents', label: 'Documents', children: documentsTab },
              ]}
            />
            <Space style={{ marginTop: token.marginSM }}>
              <Link to={`/app/student-information/student-details`}>All students</Link>
            </Space>
          </Card>
        </Col>
      </Row>

      {canManage && <EditStudentModal student={editing} onClose={() => setEditing(null)} />}
      {canManage && <AssignSectionModal student={assigning} onClose={() => setAssigning(null)} />}
      <StudentDocumentsModal student={docsOpen} onClose={() => setDocsOpen(null)} canUpload={canManage} canDelete={canManage} />
    </div>
  );
}

export default StudentProfilePage;
