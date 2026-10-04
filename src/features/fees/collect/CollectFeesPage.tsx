import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Alert, App, Button, Card, Col, Empty, Form, Input, Result, Row, Select, Table, Typography, theme } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { SearchOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { fetchAllStudents, type Student } from '../../../api/students';
import { fetchClasses } from '../../../api/classes';
import { useAuthStore } from '../../../store/authStore';
import { hasPermission } from '../../../lib/roles';
import { formatDisplayDate } from '../../../lib/dates';
import { serverMessage } from '../../../lib/apiErrors';
import { downloadCsv, downloadExcel, downloadPdf, printRows, type ExportColumn, type ExportKind } from '../../../lib/tableExport';
import DataTableToolbar from '../../../components/DataTableToolbar';
import { CLASSES_QUERY_KEY } from '../../classes/queryKeys';
import { buildSectionLookup, defaultSection, namedSections } from '../../classes/sectionLookup';

const { Title } = Typography;

type Criteria = { mode: 'class'; classId: string; sectionId?: string } | { mode: 'keyword'; q: string };

function mobile(s: Student) {
  return s.extra?.mobileNumber || s.guardianPhone || s.fatherMobile || s.motherMobile || '';
}

/** Fees Collection -> Collect Fees: find a student by class/section or keyword, then open their fees. */
function CollectFeesPage() {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const permissions = useAuthStore((state) => state.user?.permissions);
  const canView = hasPermission(permissions, 'FEE_VIEW') || hasPermission(permissions, 'FEE_COLLECT');

  const [params, setParams] = useSearchParams();
  const criteria: Criteria | null = useMemo(() => {
    const q = params.get('q');
    if (q) return { mode: 'keyword', q };
    const classId = params.get('classId');
    return classId ? { mode: 'class', classId, sectionId: params.get('sectionId') ?? undefined } : null;
  }, [params]);

  const [draftClassId, setDraftClassId] = useState<string | undefined>(criteria?.mode === 'class' ? criteria.classId : undefined);
  const [draftSectionId, setDraftSectionId] = useState<string | undefined>(criteria?.mode === 'class' ? criteria.sectionId : undefined);
  const [draftKeyword, setDraftKeyword] = useState(criteria?.mode === 'keyword' ? criteria.q : '');
  const [classError, setClassError] = useState(false);
  const [keywordError, setKeywordError] = useState(false);
  const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = useState(50);
  const [exporting, setExporting] = useState<ExportKind | null>(null);

  const classesQuery = useQuery({ queryKey: CLASSES_QUERY_KEY, queryFn: fetchClasses, enabled: canView });
  const lookup = useMemo(() => buildSectionLookup(classesQuery.data), [classesQuery.data]);
  const draftClass = classesQuery.data?.find((c) => c.id === draftClassId);
  const draftWhole = defaultSection(draftClass);

  const studentsQuery = useQuery({
    queryKey: ['students', 'collect-fees', criteria],
    queryFn: () =>
      criteria!.mode === 'keyword'
        ? fetchAllStudents({ q: criteria!.q, status: 'ACTIVE' })
        : fetchAllStudents({ classId: criteria!.classId, sectionId: criteria!.sectionId, status: 'ACTIVE' }),
    enabled: canView && criteria !== null,
  });

  const rows = useMemo(() => {
    const cls = (s: Student) => lookup.get(s.sectionId ?? '');
    const all = [...(studentsQuery.data ?? [])].sort(
      (a, b) =>
        (cls(a)?.label ?? '').localeCompare(cls(b)?.label ?? '', undefined, { numeric: true }) ||
        a.fullName.localeCompare(b.fullName),
    );
    const q = search.trim().toLowerCase();
    return q
      ? all.filter((s) => [s.admissionNumber, s.fullName, s.fatherName, mobile(s), cls(s)?.label].some((v) => (v ?? '').toLowerCase().includes(q)))
      : all;
  }, [studentsQuery.data, search, lookup]);

  if (!canView) {
    return <Result status="403" title="Not available" subTitle="You don't have permission to collect fees." />;
  }

  const apply = (next: Record<string, string>) => {
    setSearch('');
    setParams(next);
  };

  const columns: ColumnsType<Student> = [
    { key: 'class', title: 'Class', sorter: (a, b) => (lookup.get(a.sectionId ?? '')?.className ?? '').localeCompare(lookup.get(b.sectionId ?? '')?.className ?? '', undefined, { numeric: true }), render: (_v, s) => lookup.get(s.sectionId ?? '')?.className ?? '' },
    { key: 'section', title: 'Section', render: (_v, s) => lookup.get(s.sectionId ?? '')?.sectionName || '-' },
    { key: 'adm', title: 'Admission No', sorter: (a, b) => a.admissionNumber.localeCompare(b.admissionNumber, undefined, { numeric: true }), dataIndex: 'admissionNumber' },
    {
      key: 'name',
      title: 'Student Name',
      sorter: (a, b) => a.fullName.localeCompare(b.fullName),
      render: (_v, s) => <Link to={`/app/student-information/student-details/${s.id}`}>{s.fullName}</Link>,
    },
    { key: 'father', title: 'Father Name', render: (_v, s) => s.fatherName ?? '' },
    { key: 'dob', title: 'Date Of Birth', render: (_v, s) => formatDisplayDate(s.dateOfBirth) },
    { key: 'mobile', title: 'Mobile No.', render: (_v, s) => mobile(s) },
    {
      key: 'action',
      title: 'Action',
      align: 'right',
      render: (_v, s) => (
        <Button type="primary" size="small" onClick={() => navigate(`/app/fees-collection/collect-fees/${s.id}`)} aria-label={`Collect fees for ${s.fullName}`}>
          Collect Fees
        </Button>
      ),
    },
  ];

  const exportColumns: ExportColumn<Student>[] = [
    { title: 'Class', value: (s) => lookup.get(s.sectionId ?? '')?.className ?? '' },
    { title: 'Section', value: (s) => lookup.get(s.sectionId ?? '')?.sectionName ?? '' },
    { title: 'Admission No', value: (s) => s.admissionNumber },
    { title: 'Student Name', value: (s) => s.fullName },
    { title: 'Father Name', value: (s) => s.fatherName ?? '' },
    { title: 'Date Of Birth', value: (s) => formatDisplayDate(s.dateOfBirth) },
    { title: 'Mobile No.', value: mobile },
  ];
  const handleExport = async (kind: ExportKind) => {
    setExporting(kind);
    try {
      const base = `collect-fees-students-${dayjs().format('YYYY-MM-DD')}`;
      if (kind === 'csv') downloadCsv(rows, exportColumns, base);
      else if (kind === 'excel') await downloadExcel(rows, exportColumns, base, 'Student List');
      else if (kind === 'pdf') await downloadPdf(rows, exportColumns, base, 'Student List');
      else printRows(rows, exportColumns, 'Student List');
    } catch {
      message.error("Couldn't export the list.");
    } finally {
      setExporting(null);
    }
  };

  return (
    <div>
      <Card title={<Title level={4} style={{ margin: 0, fontWeight: 500 }}>Select Criteria</Title>} style={{ marginBottom: token.marginLG }}>
        <Row gutter={token.marginLG}>
          <Col xs={24} lg={12}>
            <Form
              layout="vertical"
              requiredMark
              onFinish={() => {
                setKeywordError(false);
                if (!draftClassId) return setClassError(true);
                setClassError(false);
                apply(draftWhole || !draftSectionId ? { classId: draftClassId } : { classId: draftClassId, sectionId: draftSectionId });
              }}
            >
              <Row gutter={token.marginMD}>
                <Col xs={24} sm={12}>
                  <Form.Item label="Class" htmlFor="cf-class" required validateStatus={classError ? 'error' : undefined} help={classError ? 'Class is required' : undefined}>
                    <Select
                      id="cf-class"
                      placeholder="Select"
                      showSearch
                      optionFilterProp="label"
                      loading={classesQuery.isLoading}
                      options={(classesQuery.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
                      value={draftClassId}
                      onChange={(v) => {
                        setDraftClassId(v);
                        setDraftSectionId(undefined);
                        setClassError(false);
                      }}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item label="Section" htmlFor="cf-section">
                    <Select
                      id="cf-section"
                      allowClear
                      placeholder={!draftClassId ? 'Select a class first' : draftWhole ? 'Whole class (no sections)' : 'All sections'}
                      disabled={!draftClassId || Boolean(draftWhole)}
                      options={namedSections(draftClass).map((s) => ({ value: s.id, label: s.name }))}
                      value={draftSectionId}
                      onChange={setDraftSectionId}
                    />
                  </Form.Item>
                </Col>
              </Row>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button type="primary" htmlType="submit" icon={<SearchOutlined />} data-testid="cf-class-search">
                  Search
                </Button>
              </div>
            </Form>
          </Col>
          <Col xs={24} lg={12}>
            <Form
              layout="vertical"
              onFinish={() => {
                setClassError(false);
                const q = draftKeyword.trim();
                if (!q) return setKeywordError(true);
                setKeywordError(false);
                apply({ q });
              }}
            >
              <Form.Item label="Search By Keyword" htmlFor="cf-keyword" validateStatus={keywordError ? 'error' : undefined} help={keywordError ? 'Type something to search for' : undefined}>
                <Input
                  id="cf-keyword"
                  allowClear
                  placeholder="Search By Student Name, Roll Number, Enroll Number, National Id, Local Id Etc."
                  value={draftKeyword}
                  onChange={(e) => {
                    setDraftKeyword(e.target.value);
                    setKeywordError(false);
                  }}
                />
              </Form.Item>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button type="primary" htmlType="submit" icon={<SearchOutlined />} data-testid="cf-keyword-search">
                  Search
                </Button>
              </div>
            </Form>
          </Col>
        </Row>
      </Card>

      <Card title={<Title level={4} style={{ margin: 0, fontWeight: 500 }}>Student List</Title>}>
        {studentsQuery.isError ? (
          <Alert type="error" showIcon message={serverMessage(studentsQuery.error) ?? "Couldn't load the students."} />
        ) : (
          <>
            {criteria && (
              <DataTableToolbar
                search={search}
                onSearchChange={setSearch}
                searchLabel="Search this student list"
                pageSize={pageSize}
                onPageSizeChange={setPageSize}
                columns={[]}
                hiddenColumns={[]}
                onHiddenColumnsChange={() => undefined}
                onExport={(k) => void handleExport(k)}
                exporting={exporting}
                canExport
                canPrint
                exportKinds={['excel', 'csv', 'pdf', 'print']}
                showColumnToggle={false}
              />
            )}
            <Table<Student>
              rowKey="id"
              size="middle"
              columns={columns}
              dataSource={criteria ? rows : []}
              loading={studentsQuery.isFetching}
              scroll={{ x: 'max-content' }}
              pagination={{ pageSize, showSizeChanger: false, showTotal: (total, [from, to]) => `Records: ${from} to ${to} of ${total}` }}
              locale={{
                emptyText: (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={criteria ? 'No students found -- search with different criteria.' : 'Select a class or type a keyword, then press Search.'}
                  />
                ),
              }}
            />
          </>
        )}
      </Card>
    </div>
  );
}

export default CollectFeesPage;
