import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Avatar, Button, Card, Col, Descriptions, Rate, Result, Row, Space, Spin, Tabs, Tag, Timeline, Tooltip, Typography, theme } from 'antd';
import { QRCodeSVG } from 'qrcode.react';
import { ArrowLeftOutlined, DislikeOutlined, DownloadOutlined, EditOutlined, KeyOutlined, LikeOutlined, UserOutlined } from '@ant-design/icons';
import { fetchStaffMember, resetStaffPassword, setStaffActive, staffDocumentUrl, staffPhotoUrl, type StaffMember } from '../../../api/staffMembers';
import { fetchRatingSummary } from '../../../api/teacherRatings';
import { useAuthStore } from '../../../store/authStore';
import { hasPermission } from '../../../lib/roles';
import { formatDisplayDate } from '../../../lib/dates';
import { formatFileSize } from '../../../lib/files';
import { formatAmount } from '../../fees/format';
import { RATING_SUMMARY_KEY } from '../rating/queryKeys';
import { STAFF_DIRECTORY_KEY, STAFF_MEMBER_KEY } from './queryKeys';
import AttendanceTab from './profile/AttendanceTab';
import Code39Barcode from './profile/Code39Barcode';
import LeavesTab from './profile/LeavesTab';
import PayrollTab from './profile/PayrollTab';
import { CONTRACT_TYPE_OPTIONS, GENDER_OPTIONS, labelFor, MARITAL_STATUS_OPTIONS } from './options';

const { Title, Text } = Typography;

const dash = (value: string | number | null | undefined) =>
  value === null || value === undefined || value === '' ? <Text type="secondary">—</Text> : value;

/** One titled block of label/value rows, like the sections of Smart School's staff profile. */
function Section({ title, children, columns = 1 }: { title: string; children: React.ReactNode; columns?: number }) {
  const { token } = theme.useToken();
  return (
    <div style={{ marginBottom: token.marginLG }}>
      <div style={{ background: token.colorFillTertiary, padding: `${token.paddingSM}px ${token.paddingMD}px` }}>
        <Title level={5} style={{ margin: 0, fontWeight: 500 }}>
          {title}
        </Title>
      </div>
      <Descriptions size="small" column={columns} bordered={false} layout="horizontal" labelStyle={{ width: '34%' }} style={{ paddingInline: token.paddingMD }}>
        {children}
      </Descriptions>
    </div>
  );
}

/** Human Resource -> Staff Directory -> a staff member's profile (/app/human-resource/staff-directory/:staffId). */
function StaffProfilePage() {
  const { token } = theme.useToken();
  const navigate = useNavigate();
  const { staffId: id } = useParams<{ staffId: string }>();
  const permissions = useAuthStore((state) => state.user?.permissions);
  const canView = hasPermission(permissions, 'STAFF_VIEW');
  const canEdit = hasPermission(permissions, 'STAFF_EDIT');

  const staffQuery = useQuery({
    queryKey: [...STAFF_MEMBER_KEY, id],
    queryFn: () => fetchStaffMember(id as string),
    enabled: canView && Boolean(id),
  });
  const staff: StaffMember | undefined = staffQuery.data;
  const summaryQuery = useQuery({
    queryKey: [...RATING_SUMMARY_KEY, id],
    queryFn: () => fetchRatingSummary(id as string),
    enabled: canView && staff?.roleName === 'TEACHER',
    retry: false,
  });
  const summary = summaryQuery.data;
  const queryClient = useQueryClient();
  const { message, modal } = App.useApp();
  const statusMutation = useMutation({
    mutationFn: (active: boolean) => setStaffActive(id as string, active),
    onSuccess: (updated) => {
      queryClient.setQueryData([...STAFF_MEMBER_KEY, id], updated);
      void queryClient.invalidateQueries({ queryKey: STAFF_DIRECTORY_KEY.slice(0, 1) });
      message.success(updated.status === 'ACTIVE' ? 'Staff member enabled' : 'Staff member disabled');
    },
    onError: () => message.error("Couldn't change the status. Please try again."),
  });
  const passwordMutation = useMutation({
    mutationFn: () => resetStaffPassword(id as string),
    onSuccess: (password) =>
      modal.success({
        title: 'New temporary password',
        content: (
          <div>
            <p>Share this with the staff member. It is shown only once; they must change it at their next sign-in.</p>
            <Text code copyable>
              {password}
            </Text>
          </div>
        ),
      }),
    onError: () => message.error("Couldn't reset the password. Please try again."),
  });
  const canPayroll = hasPermission(permissions, 'PAYROLL_VIEW');
  const canLeaves = hasPermission(permissions, 'LEAVE_VIEW');
  const canAttendance = hasPermission(permissions, 'STAFF_ATTENDANCE_VIEW');

  if (!canView) {
    return <Result status="403" title="Not available" subTitle="You don't have permission to view staff profiles." />;
  }
  if (staffQuery.isError) {
    return <Result status="404" title="Staff member not found" extra={<Button onClick={() => navigate('/app/human-resource/staff-directory')}>Back to Staff Directory</Button>} />;
  }
  if (!staff) {
    return (
      <div style={{ textAlign: 'center', padding: token.paddingXL }}>
        <Spin />
      </div>
    );
  }

  const side = (label: string, value: React.ReactNode) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: token.marginSM, padding: `${token.paddingSM}px ${token.paddingMD}px`, borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
      <Text strong>{label}</Text>
      <span style={{ color: token.colorPrimary, textAlign: 'right' }}>{value ?? '—'}</span>
    </div>
  );

  const profileTab = (
    <div data-testid="staff-profile">
      <Descriptions size="small" column={1} labelStyle={{ width: '34%' }} style={{ paddingInline: token.paddingMD, marginBottom: token.marginLG }}>
        <Descriptions.Item label="Phone">{dash(staff.phone)}</Descriptions.Item>
        <Descriptions.Item label="Emergency Contact Number">{dash(staff.emergencyContactNumber)}</Descriptions.Item>
        <Descriptions.Item label="Email">{staff.email}</Descriptions.Item>
        <Descriptions.Item label="Gender">{dash(labelFor(GENDER_OPTIONS, staff.gender))}</Descriptions.Item>
        <Descriptions.Item label="Date Of Birth">{dash(formatDisplayDate(staff.dateOfBirth))}</Descriptions.Item>
        <Descriptions.Item label="Marital Status">{dash(labelFor(MARITAL_STATUS_OPTIONS, staff.maritalStatus))}</Descriptions.Item>
        <Descriptions.Item label="Father Name">{dash(staff.fatherName)}</Descriptions.Item>
        <Descriptions.Item label="Mother Name">{dash(staff.motherName)}</Descriptions.Item>
        <Descriptions.Item label="Qualification">{dash(staff.qualification)}</Descriptions.Item>
        <Descriptions.Item label="Work Experience">{dash(staff.workExperience)}</Descriptions.Item>
        <Descriptions.Item label="Note">{dash(staff.note)}</Descriptions.Item>
        <Descriptions.Item label="PAN Number">{dash(staff.panNumber)}</Descriptions.Item>
      </Descriptions>
      <Section title="Address Details">
        <Descriptions.Item label="Current Address">{dash(staff.currentAddress)}</Descriptions.Item>
        <Descriptions.Item label="Permanent Address">{dash(staff.permanentAddress)}</Descriptions.Item>
      </Section>
      <Section title="Leaves">
        <Descriptions.Item label="Medical Leave">{dash(staff.medicalLeave)}</Descriptions.Item>
        <Descriptions.Item label="Casual Leave">{dash(staff.casualLeave)}</Descriptions.Item>
        <Descriptions.Item label="Maternity Leave">{dash(staff.maternityLeave)}</Descriptions.Item>
        <Descriptions.Item label="Sick Leave">{dash(staff.sickLeave)}</Descriptions.Item>
        <Descriptions.Item label="Mandatory Leave">{dash(staff.mandatoryLeave)}</Descriptions.Item>
      </Section>
      <Section title="Bank Account Details">
        <Descriptions.Item label="Account Title">{dash(staff.accountTitle)}</Descriptions.Item>
        <Descriptions.Item label="Bank Name">{dash(staff.bankName)}</Descriptions.Item>
        <Descriptions.Item label="Bank Branch Name">{dash(staff.bankBranchName)}</Descriptions.Item>
        <Descriptions.Item label="Bank Account Number">{dash(staff.bankAccountNumber)}</Descriptions.Item>
        <Descriptions.Item label="IFSC Code">{dash(staff.ifscCode)}</Descriptions.Item>
      </Section>
      <Section title="Social Media Link">
        <Descriptions.Item label="Facebook URL">{dash(staff.facebookUrl)}</Descriptions.Item>
        <Descriptions.Item label="Twitter URL">{dash(staff.twitterUrl)}</Descriptions.Item>
        <Descriptions.Item label="Linkedin URL">{dash(staff.linkedinUrl)}</Descriptions.Item>
        <Descriptions.Item label="Instagram URL">{dash(staff.instagramUrl)}</Descriptions.Item>
      </Section>
    </div>
  );

  const documentsTab =
    staff.documents.length === 0 ? (
      <Alert type="info" showIcon message="No documents have been uploaded for this staff member." />
    ) : (
      <Descriptions size="small" column={1} bordered>
        {staff.documents.map((d) => (
          <Descriptions.Item key={d.kind} label={d.title}>
            <Button type="link" size="small" icon={<DownloadOutlined />} href={staffDocumentUrl(staff.id, d.kind)} style={{ padding: 0 }}>
              {d.fileName}
            </Button>{' '}
            <Text type="secondary">({formatFileSize(d.sizeBytes)})</Text>
          </Descriptions.Item>
        ))}
      </Descriptions>
    );

  const timelineItems = [
    staff.dateOfJoining && { date: staff.dateOfJoining, title: 'Joined', detail: [staff.designationName, staff.departmentName].filter(Boolean).join(', ') },
    { date: staff.createdAt.slice(0, 10), title: 'Added to the staff directory', detail: `Staff ID ${staff.staffId}` },
    staff.dateOfLeaving && { date: staff.dateOfLeaving, title: 'Left', detail: '' },
  ]
    .filter((item): item is { date: string; title: string; detail: string } => Boolean(item))
    .sort((a, b) => b.date.localeCompare(a.date));
  const timelineTab = (
    <Timeline
      style={{ marginTop: token.marginMD }}
      items={timelineItems.map((item) => ({
        children: (
          <div>
            <Text strong>{formatDisplayDate(item.date)}</Text> — {item.title}
            {item.detail && <div><Text type="secondary">{item.detail}</Text></div>}
          </div>
        ),
      }))}
    />
  );

  return (
    <Row gutter={[token.marginLG, token.marginLG]} align="top">
      <Col xs={24} lg={8} xl={7}>
        <Card styles={{ body: { padding: 0 } }}>
          <div style={{ textAlign: 'center', padding: token.paddingLG }}>
            {staff.hasPhoto ? (
              <img src={staffPhotoUrl(staff.id, staff.createdAt)} alt={staff.fullName} style={{ width: 128, height: 128, objectFit: 'cover', borderRadius: token.borderRadius }} />
            ) : (
              <Avatar shape="square" size={128} icon={<UserOutlined />} />
            )}
            <Title level={3} style={{ margin: `${token.marginSM}px 0 ${token.marginXS}px`, fontWeight: 400 }}>
              {staff.fullName}
            </Title>
            {staff.roleName === 'TEACHER' && summary && (
              <div>
                <Rate disabled allowHalf value={summary.average ?? 0} aria-label={summary.average === null ? 'Not rated yet' : `${summary.average} out of 5`} />
                <div>
                  <Text type="secondary">
                    {summary.average === null
                      ? 'No approved reviews yet.'
                      : `${summary.average.toFixed(1)} average based on ${summary.count} Review${summary.count === 1 ? '' : 's'}.`}
                  </Text>
                </div>
              </div>
            )}
          </div>
          <div style={{ borderTop: `1px solid ${token.colorBorderSecondary}` }}>
            {side('Staff ID', staff.staffId)}
            {side('Role', staff.roleName)}
            {side('Designation', staff.designationName)}
            {side('Department', staff.departmentName)}
            {side('EPF No.', staff.epfNo)}
            {side('Basic Salary', staff.basicSalary === null ? null : formatAmount(staff.basicSalary))}
            {side('Contract Type', labelFor(CONTRACT_TYPE_OPTIONS, staff.contractType))}
            {side('Work Shift', staff.workShift)}
            {side('Work Location', staff.workLocation)}
            {side('Date Of Joining', formatDisplayDate(staff.dateOfJoining) || null)}
            {side('Barcode', <Code39Barcode value={staff.staffId} />)}
            {side('QR Code', <QRCodeSVG value={staff.staffId} size={72} aria-label={`QR code ${staff.staffId}`} />)}
          </div>
        </Card>
      </Col>
      <Col xs={24} lg={16} xl={17}>
        <Card
          extra={
            <Space>
              <Tag>{staff.status === 'ACTIVE' ? 'Active' : 'Disabled'}</Tag>
              {canEdit && (
                <Button type="text" icon={<EditOutlined />} aria-label="Edit staff" onClick={() => navigate(`/app/human-resource/staff-directory/${staff.id}/edit`)} />
              )}
              {canEdit && (
                <Tooltip title="Reset login password">
                  <Button
                    type="text"
                    icon={<KeyOutlined />}
                    aria-label="Reset login password"
                    loading={passwordMutation.isPending}
                    onClick={() =>
                      modal.confirm({
                        title: 'Reset login password?',
                        content: `${staff.fullName} will be signed out of their old password and get a new temporary one.`,
                        okText: 'Reset',
                        onOk: () => passwordMutation.mutateAsync().catch(() => undefined),
                      })
                    }
                  />
                </Tooltip>
              )}
              {canEdit && (
                <Tooltip title={staff.status === 'ACTIVE' ? 'Disable staff' : 'Enable staff'}>
                  <Button
                    type="text"
                    danger={staff.status === 'ACTIVE'}
                    icon={staff.status === 'ACTIVE' ? <DislikeOutlined /> : <LikeOutlined />}
                    aria-label={staff.status === 'ACTIVE' ? 'Disable staff' : 'Enable staff'}
                    loading={statusMutation.isPending}
                    onClick={() =>
                      modal.confirm({
                        title: staff.status === 'ACTIVE' ? 'Disable this staff member?' : 'Enable this staff member?',
                        content:
                          staff.status === 'ACTIVE'
                            ? `${staff.fullName} will no longer be able to sign in. You can enable them again from Human Resource > Disabled Staff.`
                            : `${staff.fullName} will be able to sign in again.`,
                        okText: staff.status === 'ACTIVE' ? 'Disable' : 'Enable',
                        okButtonProps: { danger: staff.status === 'ACTIVE' },
                        onOk: () => statusMutation.mutateAsync(staff.status !== 'ACTIVE').catch(() => undefined),
                      })
                    }
                  />
                </Tooltip>
              )}
              <Button type="text" icon={<ArrowLeftOutlined />} aria-label="Back to Staff Directory" onClick={() => navigate('/app/human-resource/staff-directory')} />
            </Space>
          }
          styles={{ body: { paddingTop: 0 } }}
        >
          <Tabs
            items={[
              { key: 'profile', label: 'Profile', children: profileTab },
              ...(canPayroll ? [{ key: 'payroll', label: 'Payroll', children: <PayrollTab staffId={staff.id} /> }] : []),
              ...(canLeaves ? [{ key: 'leaves', label: 'Leaves', children: <LeavesTab staffId={staff.id} staffName={staff.fullName} staffCode={staff.staffId} /> }] : []),
              ...(canAttendance ? [{ key: 'attendance', label: 'Attendance', children: <AttendanceTab staffId={staff.id} /> }] : []),
              { key: 'documents', label: 'Documents', children: documentsTab },
              { key: 'timeline', label: 'Timeline', children: timelineTab },
            ]}
          />
        </Card>
      </Col>
    </Row>
  );
}

export default StaffProfilePage;
