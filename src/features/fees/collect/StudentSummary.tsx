import { Avatar, Col, Descriptions, Row, Typography, theme } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import { studentPhotoUrl, type Student } from '../../../api/students';

const { Text } = Typography;

/** Photo plus the key student details, as at the top of Smart School's Student Fees page. */
function StudentSummary({ student, classText }: { student: Student; classText: string }) {
  const { token } = theme.useToken();
  const mobile = student.extra?.mobileNumber || student.guardianPhone || student.fatherMobile || '';
  return (
    <Row gutter={token.marginLG} align="middle" style={{ marginBottom: token.marginLG, paddingBottom: token.marginLG, borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
      <Col flex="none">
        <Avatar shape="square" size={120} src={student.photoUrl ? studentPhotoUrl(student.id) : undefined} icon={<UserOutlined />} alt={`Photo of ${student.fullName}`} />
      </Col>
      <Col flex="1 1 480px">
        <Descriptions size="small" column={{ xs: 1, md: 2 }} bordered={false} styles={{ label: { fontWeight: 600, color: token.colorText, width: 150 } }}>
          <Descriptions.Item label="Name">{student.fullName}</Descriptions.Item>
          <Descriptions.Item label="Class (Section)">{classText}</Descriptions.Item>
          <Descriptions.Item label="Father Name">{student.fatherName ?? ''}</Descriptions.Item>
          <Descriptions.Item label="Admission No">{student.admissionNumber}</Descriptions.Item>
          <Descriptions.Item label="Mobile Number">{mobile}</Descriptions.Item>
          <Descriptions.Item label="Roll Number">{student.rollNumber ?? ''}</Descriptions.Item>
          <Descriptions.Item label="Category">{student.category ?? ''}</Descriptions.Item>
          <Descriptions.Item label="RTE">
            <Text type={student.rteStatus ? 'success' : 'danger'}>{student.rteStatus ? 'Yes' : 'No'}</Text>
          </Descriptions.Item>
        </Descriptions>
      </Col>
    </Row>
  );
}

export default StudentSummary;
