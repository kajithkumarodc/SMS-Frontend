import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, Card, Col, Form, Result, Row, Select, Space, Statistic, Table, Tag, Typography, theme } from 'antd';
import { ArrowLeftOutlined, DownloadOutlined, UploadOutlined } from '@ant-design/icons';
import { importStudents, type StudentImportResult, type StudentImportRow } from '../../../api/students';
import { fetchClasses } from '../../../api/classes';
import { fetchMediums } from '../../../api/mediums';
import { useAuthStore } from '../../../store/authStore';
import { hasRole, ROLE } from '../../../lib/roles';
import { serverMessage } from '../../../lib/apiErrors';
import { CLASSES_QUERY_KEY } from '../../classes/queryKeys';
import { defaultSection, namedSections } from '../../classes/sectionLookup';
import { MEDIUMS_QUERY_KEY } from '../../fees/MediumsModal';
import { STUDENTS_QUERY_KEY } from '../queryKeys';
import FilePicker from './FilePicker';

const { Title, Text } = Typography;

/** Columns of Smart School's sample file, in order, with their table headings. `*` = required. */
const COLUMNS: { key: string; title: string; required?: boolean; sample: string }[] = [
  { key: 'admission_no', title: 'Admission No', required: true, sample: '19001' },
  { key: 'roll_no', title: 'Roll No.', sample: '201' },
  { key: 'first_name', title: 'First Name', required: true, sample: 'Edward' },
  { key: 'middlename', title: 'Middle Name', sample: '' },
  { key: 'last_name', title: 'Last Name', sample: 'Thomas' },
  { key: 'gender', title: 'Gender', required: true, sample: 'Male' },
  { key: 'date_of_birth', title: 'Date Of Birth', required: true, sample: '2019-11-03' },
  { key: 'category', title: 'Category', sample: 'General' },
  { key: 'religion', title: 'Religion', sample: '' },
  { key: 'caste', title: 'Caste', sample: '' },
  { key: 'mobile_no', title: 'Mobile No.', sample: '9876543210' },
  { key: 'email', title: 'Email', sample: 'edward@example.com' },
  { key: 'admission_date', title: 'Admission Date', sample: '2026-06-01' },
  { key: 'blood_group', title: 'Blood Group', sample: 'A+' },
  { key: 'student_house', title: 'House', sample: '' },
  { key: 'height', title: 'Height', sample: "3'6" },
  { key: 'weight', title: 'Weight', sample: '18 kg' },
  { key: 'measurement_date', title: 'Measurement Date', sample: '2026-06-01' },
  { key: 'father_name', title: 'Father Name', sample: 'Olivier Thomas' },
  { key: 'father_phone', title: 'Father Phone', sample: '9865464600' },
  { key: 'father_occupation', title: 'Father Occupation', sample: 'Lawyer' },
  { key: 'mother_name', title: 'Mother Name', sample: 'Caroline Thomas' },
  { key: 'mother_phone', title: 'Mother Phone', sample: '9865465600' },
  { key: 'mother_occupation', title: 'Mother Occupation', sample: 'Teacher' },
  { key: 'guardian_is', title: 'If Guardian Is', sample: 'Father' },
  { key: 'guardian_name', title: 'Guardian Name', sample: 'Olivier Thomas' },
  { key: 'guardian_relation', title: 'Guardian Relation', sample: 'Father' },
  { key: 'guardian_email', title: 'Guardian Email', sample: '' },
  { key: 'guardian_phone', title: 'Guardian Phone', sample: '9865464600' },
  { key: 'guardian_occupation', title: 'Guardian Occupation', sample: 'Lawyer' },
  { key: 'guardian_address', title: 'Guardian Address', sample: '12, Main Road, Karur' },
  { key: 'current_address', title: 'Current Address', sample: '12, Main Road, Karur' },
  { key: 'permanent_address', title: 'Permanent Address', sample: '12, Main Road, Karur' },
  { key: 'bank_account_no', title: 'Bank Account No.', sample: '' },
  { key: 'bank_name', title: 'Bank Name', sample: '' },
  { key: 'ifsc_code', title: 'IFSC Code', sample: '' },
  { key: 'national_identification_no', title: 'National Identification No.', sample: '' },
  { key: 'local_identification_no', title: 'Local Identification No.', sample: '' },
  { key: 'rte', title: 'RTE', sample: 'No' },
  { key: 'previous_school', title: 'Previous School Details', sample: '' },
  { key: 'note', title: 'Note', sample: '' },
];

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function downloadSample() {
  const lines = [COLUMNS.map((c) => c.key).join(','), COLUMNS.map((c) => csvCell(c.sample)).join(',')];
  const blob = new Blob([`﻿${lines.join('\r\n')}\r\n`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'import_student_sample_file.csv';
  a.click();
  URL.revokeObjectURL(url);
}

/** Student Admission -> Import Student: admit many students from a CSV (Smart School's sample format). */
function StudentImportPage() {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canImport = hasRole(useAuthStore((state) => state.user?.roles), ROLE.SCHOOL_ADMIN);

  const [classId, setClassId] = useState<string>();
  const [sectionId, setSectionId] = useState<string>();
  const [mediumId, setMediumId] = useState<string>();
  const [file, setFile] = useState<File | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const [result, setResult] = useState<StudentImportResult | null>(null);

  const classesQuery = useQuery({ queryKey: CLASSES_QUERY_KEY, queryFn: fetchClasses, enabled: canImport });
  const mediumsQuery = useQuery({ queryKey: MEDIUMS_QUERY_KEY, queryFn: fetchMediums, enabled: canImport });
  const selectedClass = classesQuery.data?.find((c) => c.id === classId);
  const wholeClass = defaultSection(selectedClass);
  const sections = namedSections(selectedClass);
  const effectiveSectionId = wholeClass ? wholeClass.id : sectionId;

  const importMutation = useMutation({
    mutationFn: () => importStudents(file as File, effectiveSectionId as string, mediumId),
    onSuccess: (data) => {
      setResult(data);
      void queryClient.invalidateQueries({ queryKey: STUDENTS_QUERY_KEY });
      if (data.imported > 0) message.success(`${data.imported} student${data.imported === 1 ? '' : 's'} imported`);
      if (data.skipped > 0) message.warning(`${data.skipped} row${data.skipped === 1 ? '' : 's'} skipped -- see the list below`);
      setFile(null);
    },
    onError: (error) => message.error(serverMessage(error) ?? 'Could not import the file. Please try again.'),
  });

  if (!canImport) {
    return <Result status="403" title="Not available" subTitle="Only a school administrator can import students." />;
  }

  const startImport = () => {
    const problems = [
      !classId && 'class',
      !effectiveSectionId && 'section',
      !file && 'file',
    ].filter(Boolean) as string[];
    setMissing(problems);
    if (problems.length === 0) {
      setResult(null);
      importMutation.mutate();
    }
  };

  return (
    <div>
      <Card
        title={
          <Space>
            <Button type="text" icon={<ArrowLeftOutlined />} aria-label="Back to Student Admission" onClick={() => navigate('/app/student-information/student-admission')} />
            <Title level={4} style={{ margin: 0, fontWeight: 500 }}>
              Import Student
            </Title>
          </Space>
        }
        extra={
          <Button type="primary" icon={<DownloadOutlined />} onClick={downloadSample}>
            Download Sample Import File
          </Button>
        }
        style={{ marginBottom: token.marginLG }}
      >
        <ol style={{ paddingLeft: token.paddingLG, lineHeight: 1.9, marginTop: 0 }}>
          <li>
            Your CSV data should be in the format below. The first line of your file must be the column headers exactly as in
            the sample file. Save the file as UTF-8 to avoid encoding problems.
          </li>
          <li>Dates must be in the format yyyy-mm-dd (for example 2018-06-06).</li>
          <li>Rows whose Admission No already exists are not imported.</li>
          <li>For Gender use Male or Female.</li>
          <li>For Blood Group use O+, A+, B+, AB+, O-, A-, B- or AB-.</li>
          <li>For RTE use Yes or No.</li>
          <li>For If Guardian Is use father, mother or other.</li>
          <li>Category is the category name (for example General, OBC, SC, ST).</li>
          <li>
            Phone numbers need 10-15 digits. An optional value that isn&rsquo;t valid is left out and listed as a warning; the
            student is still imported.
          </li>
          <li>Every row is admitted into the Class, Section and Medium you choose below.</li>
        </ol>

        <Table
          size="small"
          bordered
          pagination={false}
          scroll={{ x: 'max-content' }}
          rowKey="k"
          dataSource={[{ k: 'sample' }]}
          columns={COLUMNS.map((c) => ({
            key: c.key,
            title: (
              <span style={{ whiteSpace: 'nowrap' }}>
                {c.required && <Text type="danger">* </Text>}
                {c.title}
              </span>
            ),
            render: () => <Text type="secondary">{c.sample || 'Sample Data'}</Text>,
          }))}
        />

        <Form layout="vertical" style={{ marginTop: token.marginLG }} onFinish={startImport} requiredMark>
          <Row gutter={token.marginLG}>
            <Col xs={24} md={6}>
              <Form.Item label="Class" htmlFor="import-class" required validateStatus={missing.includes('class') ? 'error' : undefined} help={missing.includes('class') ? 'Select a class' : undefined}>
                <Select
                  id="import-class"
                  placeholder="Select"
                  showSearch
                  optionFilterProp="label"
                  loading={classesQuery.isLoading}
                  options={(classesQuery.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
                  value={classId}
                  onChange={(v) => {
                    setClassId(v);
                    setSectionId(undefined);
                  }}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item label="Section" htmlFor="import-section" required={!wholeClass} validateStatus={missing.includes('section') ? 'error' : undefined} help={missing.includes('section') ? 'Select a section' : undefined}>
                <Select
                  id="import-section"
                  placeholder={!classId ? 'Select a class first' : wholeClass ? 'Whole class (no sections)' : 'Select'}
                  disabled={!classId || Boolean(wholeClass)}
                  options={sections.map((s) => ({ value: s.id, label: s.name }))}
                  value={sectionId}
                  onChange={setSectionId}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item label="Medium" htmlFor="import-medium">
                <Select
                  id="import-medium"
                  placeholder="Select"
                  allowClear
                  loading={mediumsQuery.isLoading}
                  options={(mediumsQuery.data ?? []).filter((m) => m.active).map((m) => ({ value: m.id, label: m.name }))}
                  value={mediumId}
                  onChange={setMediumId}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item label="Select CSV File" required validateStatus={missing.includes('file') ? 'error' : undefined} help={missing.includes('file') ? 'Choose the CSV file' : undefined}>
                <FilePicker
                  ariaLabel="CSV file"
                  accept=".csv,text/csv"
                  value={file}
                  validate={(f) => (f.name.toLowerCase().endsWith('.csv') ? (f.size > 2 * 1024 * 1024 ? 'The file is larger than 2 MB' : undefined) : 'Choose a .csv file')}
                  onRejected={(reason) => message.error(reason)}
                  onChange={setFile}
                />
              </Form.Item>
            </Col>
          </Row>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button type="primary" htmlType="submit" icon={<UploadOutlined />} loading={importMutation.isPending}>
              Import Student
            </Button>
          </div>
        </Form>
      </Card>

      {result && (
        <Card title={<Title level={4} style={{ margin: 0, fontWeight: 500 }}>Import Result</Title>}>
          <Row gutter={token.marginLG} style={{ marginBottom: token.marginMD }}>
            <Col>
              <Statistic title="Imported" value={result.imported} valueStyle={{ color: token.colorSuccess }} />
            </Col>
            <Col>
              <Statistic title="Skipped" value={result.skipped} valueStyle={{ color: result.skipped ? token.colorError : undefined }} />
            </Col>
          </Row>
          {result.skipped > 0 && (
            <Alert type="warning" showIcon style={{ marginBottom: token.marginMD }} message="Fix the skipped rows in your file and import it again -- rows already imported will be skipped as duplicates." />
          )}
          <Table<StudentImportRow>
            rowKey="row"
            size="small"
            pagination={{ pageSize: 50, hideOnSinglePage: true }}
            dataSource={result.rows}
            columns={[
              { key: 'row', title: 'Row', dataIndex: 'row', width: 70 },
              { key: 'adm', title: 'Admission No', render: (_v, r) => r.admissionNumber ?? '—' },
              { key: 'name', title: 'Student Name', render: (_v, r) => r.name || '—' },
              {
                key: 'status',
                title: 'Status',
                render: (_v, r) => (r.status === 'IMPORTED' ? <Tag color="success">Imported</Tag> : <Tag color="error">Skipped</Tag>),
              },
              {
                key: 'messages',
                title: 'Details',
                render: (_v, r) =>
                  r.messages.length === 0 ? (
                    <Text type="secondary">—</Text>
                  ) : (
                    <ul style={{ margin: 0, paddingLeft: token.paddingMD }}>
                      {r.messages.map((m) => (
                        <li key={m}>
                          <Text type={r.status === 'IMPORTED' ? 'warning' : 'danger'}>{m}</Text>
                        </li>
                      ))}
                    </ul>
                  ),
              },
            ]}
          />
        </Card>
      )}
    </div>
  );
}

export default StudentImportPage;
