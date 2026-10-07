import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Card, Col, Form, Result, Row, Select, Spin, Typography, theme } from 'antd';
import { PlusOutlined, PrinterOutlined, SearchOutlined } from '@ant-design/icons';
import { fetchClasses } from '../../api/classes';
import { fetchTimetable } from '../../api/academics';
import { useAuthStore } from '../../store/authStore';
import { hasPermission } from '../../lib/roles';
import { CLASSES_QUERY_KEY } from '../classes/queryKeys';
import { defaultSection, namedSections } from '../classes/sectionLookup';
import { TIMETABLE_KEY } from './queryKeys';
import TimetableGrid from './TimetableGrid';

const { Title } = Typography;

/** Opens the browser's print dialog for just the timetable. */
export function printElement(element: HTMLElement | null, title: string) {
  if (!element) return;
  const win = window.open('', '_blank', 'width=1200,height=800');
  if (!win) return;
  win.document.write(
    `<html><head><title>${title}</title><style>body{font-family:sans-serif;margin:16px}h2{margin:0 0 12px}</style></head><body><h2>${title}</h2>${element.outerHTML}</body></html>`,
  );
  win.document.close();
  win.focus();
  win.print();
}

/** Academics -> Class Timetable (/app/academics/class-timetable): a section's week. */
function ClassTimetablePage() {
  const { token } = theme.useToken();
  const navigate = useNavigate();
  const permissions = useAuthStore((state) => state.user?.permissions);
  const canView = hasPermission(permissions, 'TIMETABLE_VIEW');
  const canManage = hasPermission(permissions, 'TIMETABLE_MANAGE');
  const gridRef = useRef<HTMLDivElement>(null);

  const [classId, setClassId] = useState<string>();
  const [sectionId, setSectionId] = useState<string>();
  const [errors, setErrors] = useState<{ classId?: string; sectionId?: string }>({});
  const [searched, setSearched] = useState<{ sectionId: string; label: string } | null>(null);

  const classesQuery = useQuery({ queryKey: CLASSES_QUERY_KEY, queryFn: fetchClasses, enabled: canView });
  const classes = classesQuery.data;
  const selectedClass = classes?.find((c) => c.id === classId);
  const sections = useMemo(() => namedSections(selectedClass), [selectedClass]);
  // A class without sections (e.g. LKG) is a single whole-class timetable through its hidden default section.
  const wholeClass = defaultSection(selectedClass);

  const timetableQuery = useQuery({
    queryKey: [...TIMETABLE_KEY, searched?.sectionId],
    queryFn: () => fetchTimetable(searched!.sectionId),
    enabled: canView && searched !== null,
    gcTime: 0,
  });

  if (!canView) {
    return <Result status="403" title="Not available" subTitle="You don't have permission to view timetables." />;
  }

  const search = () => {
    const target = wholeClass ? wholeClass.id : sectionId;
    const next = { classId: classId ? undefined : 'Class is required', sectionId: !wholeClass && !target ? 'Section is required' : undefined };
    setErrors(next);
    if (next.classId || next.sectionId || !target || !selectedClass) return;
    const name = sections.find((s) => s.id === target)?.name;
    setSearched({ sectionId: target, label: name ? `${selectedClass.name} · ${name}` : selectedClass.name });
  };

  return (
    <div>
      <Card
        title={
          <Title level={4} style={{ margin: 0, fontWeight: 500 }}>
            Select Criteria
          </Title>
        }
        extra={
          canManage && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/app/academics/class-timetable/create')}>
              Add
            </Button>
          )
        }
        style={{ marginBottom: token.marginLG }}
      >
        <Form layout="vertical" onFinish={search}>
          <Row gutter={token.marginLG}>
            <Col xs={24} md={12}>
              <Form.Item label="Class" htmlFor="timetable-class" required validateStatus={errors.classId ? 'error' : undefined} help={errors.classId}>
                <Select
                  id="timetable-class"
                  placeholder="Select"
                  loading={classesQuery.isLoading}
                  options={(classes ?? []).map((c) => ({ value: c.id, label: c.name }))}
                  value={classId}
                  onChange={(value: string) => {
                    setClassId(value);
                    setSectionId(undefined);
                    setErrors({});
                  }}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                label="Section"
                htmlFor="timetable-section"
                required={!wholeClass}
                validateStatus={errors.sectionId ? 'error' : undefined}
                help={errors.sectionId}
              >
                <Select
                  id="timetable-section"
                  placeholder={wholeClass ? 'Whole class' : 'Select'}
                  disabled={!classId || Boolean(wholeClass)}
                  options={sections.map((s) => ({ value: s.id, label: s.name }))}
                  value={sectionId}
                  onChange={(value: string) => {
                    setSectionId(value);
                    setErrors((e) => ({ ...e, sectionId: undefined }));
                  }}
                />
              </Form.Item>
            </Col>
          </Row>
          <div style={{ textAlign: 'right' }}>
            <Button type="primary" htmlType="submit" icon={<SearchOutlined />} aria-label="Search timetable">
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
          extra={
            <Button icon={<PrinterOutlined />} aria-label="Print timetable" onClick={() => printElement(gridRef.current, `Class Timetable - ${searched.label}`)} />
          }
        >
          {timetableQuery.isError ? (
            <Alert
              type="warning"
              showIcon
              message="Couldn't load the timetable"
              description="There was a problem reaching the server."
              action={
                <Button size="small" onClick={() => void timetableQuery.refetch()}>
                  Try again
                </Button>
              }
            />
          ) : timetableQuery.isLoading ? (
            <div style={{ textAlign: 'center', padding: token.paddingXL }}>
              <Spin />
            </div>
          ) : (
            <TimetableGrid ref={gridRef} periods={timetableQuery.data ?? []} />
          )}
        </Card>
      )}
    </div>
  );
}

export default ClassTimetablePage;
