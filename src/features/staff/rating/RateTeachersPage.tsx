import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Avatar, Button, Card, Col, Empty, Input, Rate, Result, Row, Spin, Tag, Typography, theme } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import { fetchRatableTeachers, submitTeacherRating, type RatableTeacher } from '../../../api/teacherRatings';
import { staffPhotoUrl } from '../../../api/staffMembers';
import { useAuthStore } from '../../../store/authStore';
import { hasRole, ROLE } from '../../../lib/roles';
import { serverMessage } from '../../../lib/apiErrors';
import { RATABLE_TEACHERS_KEY } from './queryKeys';

const { Title, Text } = Typography;

/** One teacher: the student's own rating if they gave one, otherwise stars and a comment box. */
function TeacherCard({ teacher }: { teacher: RatableTeacher }) {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');

  const submit = useMutation({
    mutationFn: () => submitTeacherRating(teacher.staffProfileId, stars, comment.trim() || null),
    onSuccess: () => {
      message.success(`Thanks! Your rating of ${teacher.name} was sent for approval.`);
      void queryClient.invalidateQueries({ queryKey: RATABLE_TEACHERS_KEY });
    },
    onError: (error) => message.error(serverMessage(error) ?? 'Could not send your rating. Please try again.'),
  });

  const rated = teacher.myRating !== null;

  return (
    <Card size="small" data-testid="rate-teacher-card">
      <div style={{ display: 'flex', gap: token.marginMD }}>
        {teacher.hasPhoto ? (
          <img src={staffPhotoUrl(teacher.staffProfileId)} alt={teacher.name} loading="lazy" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: token.borderRadius, flex: 'none' }} />
        ) : (
          <Avatar shape="square" size={72} icon={<UserOutlined />} style={{ flex: 'none' }} />
        )}
        <div style={{ minWidth: 0, flex: 1 }}>
          <Title level={5} style={{ margin: 0 }}>
            {teacher.name}
          </Title>
          <Text type="secondary">{[teacher.designation, teacher.department].filter(Boolean).join(', ') || teacher.staffId}</Text>
        </div>
      </div>
      <div style={{ marginTop: token.marginSM }}>
        {rated ? (
          <>
            <Rate disabled value={teacher.myRating ?? 0} aria-label={`You rated ${teacher.myRating} out of 5`} />{' '}
            <Tag color={teacher.myStatus === 'APPROVED' ? 'success' : 'warning'}>{teacher.myStatus === 'APPROVED' ? 'Approved' : 'Waiting for approval'}</Tag>
            {teacher.myComment && <div><Text type="secondary">{teacher.myComment}</Text></div>}
          </>
        ) : (
          <>
            <Rate value={stars} onChange={setStars} aria-label={`Rate ${teacher.name}`} />
            <Input.TextArea
              rows={2}
              maxLength={1000}
              placeholder="Comment (optional)"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              style={{ marginTop: token.marginXS }}
              aria-label={`Comment for ${teacher.name}`}
            />
            <div style={{ textAlign: 'right', marginTop: token.marginXS }}>
              <Button type="primary" size="small" disabled={stars === 0} loading={submit.isPending} onClick={() => submit.mutate()}>
                Submit
              </Button>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}

/** Student portal -> Rate Teachers (/app/my-teachers): a student rates each of their teachers once. */
function RateTeachersPage() {
  const { token } = theme.useToken();
  const isStudent = hasRole(useAuthStore((state) => state.user?.roles), ROLE.STUDENT);
  const teachersQuery = useQuery({ queryKey: RATABLE_TEACHERS_KEY, queryFn: fetchRatableTeachers, enabled: isStudent, retry: false });
  const noStudent = (teachersQuery.error as { response?: { status?: number } } | null)?.response?.status === 404;

  if (!isStudent) {
    return <Result status="403" title="Not available" subTitle="Only students can rate teachers." />;
  }
  if (teachersQuery.isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: token.paddingXL }}>
        <Spin />
      </div>
    );
  }
  if (noStudent) {
    return <Alert type="warning" showIcon message="No student record is linked to your account" description="Ask the school office to link your login to your student record." />;
  }

  const teachers = teachersQuery.data ?? [];
  return (
    <Card title={<Title level={4} style={{ margin: 0, fontWeight: 500 }}>Rate Teachers</Title>}>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: token.marginMD }}
        message="You can rate each teacher once. Your rating is shown to the school only after it is approved."
      />
      {teachers.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No teachers to rate yet" />
      ) : (
        <Row gutter={[token.marginMD, token.marginMD]}>
          {teachers.map((t) => (
            <Col key={t.staffProfileId} xs={24} md={12} xl={8}>
              <TeacherCard teacher={t} />
            </Col>
          ))}
        </Row>
      )}
    </Card>
  );
}

export default RateTeachersPage;
