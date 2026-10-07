import { useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Card, Col, Form, Result, Row, Select, Spin, Typography, theme } from 'antd';
import { PrinterOutlined, SearchOutlined } from '@ant-design/icons';
import { fetchClasses } from '../../api/classes';
import { fetchStaffDirectory } from '../../api/staffMembers';
import { fetchTeacherTimetable } from '../../api/academics';
import { useAuthStore } from '../../store/authStore';
import { hasPermission } from '../../lib/roles';
import { CLASSES_QUERY_KEY } from '../classes/queryKeys';
import { buildSectionLookup } from '../classes/sectionLookup';
import { STAFF_DIRECTORY_KEY } from '../staff/directory/queryKeys';
import { printElement } from './ClassTimetablePage';
import { TEACHER_TIMETABLE_KEY } from './queryKeys';
import TimetableGrid from './TimetableGrid';

const { Title } = Typography;

/** Academics -> Teachers Timetable (/app/academics/teachers-timetable): one teacher's week across every class. */
function TeachersTimetablePage() {
  const { token } = theme.useToken();
  const permissions = useAuthStore((state) => state.user?.permissions);
  const canView = hasPermission(permissions, 'TIMETABLE_VIEW') && hasPermission(permissions, 'STAFF_VIEW');
  const gridRef = useRef<HTMLDivElement>(null);

  const [teacherId, setTeacherId] = useState<string>();
  const [error, setError] = useState<string>();
  const [searched, setSearched] = useState<{ id: string; label: string } | null>(null);

  const staffQuery = useQuery({ queryKey: [...STAFF_DIRECTORY_KEY, {}], queryFn: () => fetchStaffDirectory({}), enabled: canView });
  const classesQuery = useQuery({ queryKey: CLASSES_QUERY_KEY, queryFn: fetchClasses, enabled: canView });
  const sectionLookup = useMemo(() => buildSectionLookup(classesQuery.data), [classesQuery.data]);
  const timetableQuery = useQuery({
    queryKey: [...TEACHER_TIMETABLE_KEY, searched?.id],
    queryFn: () => fetchTeacherTimetable(searched!.id),
    enabled: canView && searched !== null,
    gcTime: 0,
  });

  if (!canView) {
    return <Result status="403" title="Not available" subTitle="You don't have permission to view teacher timetables." />;
  }

  const options = (staffQuery.data ?? []).map((s) => ({ value: s.id, label: `${s.fullName} (${s.staffId})` }));
  const search = () => {
    if (!teacherId) {
      setError('Teacher is required');
      return;
    }
    setError(undefined);
    setSearched({ id: teacherId, label: options.find((o) => o.value === teacherId)?.label ?? '' });
  };

  return (
    <div>
      <Card
        title={
          <Title level={4} style={{ margin: 0, fontWeight: 500 }}>
            Select Criteria
          </Title>
        }
        style={{ marginBottom: token.marginLG }}
      >
        <Form layout="vertical" onFinish={search}>
          <Row gutter={token.marginLG}>
            <Col xs={24}>
              <Form.Item label="Teacher" htmlFor="teacher-timetable-teacher" required validateStatus={error ? 'error' : undefined} help={error}>
                <Select
                  id="teacher-timetable-teacher"
                  placeholder="Select"
                  showSearch
                  optionFilterProp="label"
                  loading={staffQuery.isLoading}
                  options={options}
                  value={teacherId}
                  onChange={(value: string) => {
                    setTeacherId(value);
                    setError(undefined);
                  }}
                />
              </Form.Item>
            </Col>
          </Row>
          <div style={{ textAlign: 'right' }}>
            <Button type="primary" htmlType="submit" icon={<SearchOutlined />} aria-label="Search teacher timetable">
              Search
            </Button>
          </div>
        </Form>
      </Card>

      {searched && (
        <Card
          title={
            <Title level={4} style={{ margin: 0, fontWeight: 500 }}>
              {searched.label}
            </Title>
          }
          extra={<Button icon={<PrinterOutlined />} aria-label="Print timetable" onClick={() => printElement(gridRef.current, `Teachers Timetable - ${searched.label}`)} />}
        >
          {timetableQuery.isError ? (
            <Alert type="warning" showIcon message="Couldn't load the timetable" description="There was a problem reaching the server." />
          ) : timetableQuery.isLoading ? (
            <div style={{ textAlign: 'center', padding: token.paddingXL }}>
              <Spin />
            </div>
          ) : (
            <TimetableGrid ref={gridRef} periods={timetableQuery.data ?? []} sectionLabel={(p) => sectionLookup.get(p.sectionId)?.label} />
          )}
        </Card>
      )}
    </div>
  );
}

export default TeachersTimetablePage;
