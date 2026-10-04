import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, Card, Col, Form, Result, Row, Select, Space, Statistic, Table, Tag, Typography, theme } from 'antd';
import { ArrowLeftOutlined, DownloadOutlined, UploadOutlined } from '@ant-design/icons';
import {
  fetchStaffOptions,
  fetchStaffSampleCsv,
  importStaff,
  type StaffImportResult,
  type StaffImportRow,
} from '../../../api/staffMembers';
import { useAuthStore } from '../../../store/authStore';
import { hasPermission } from '../../../lib/roles';
import { serverMessage } from '../../../lib/apiErrors';
import FilePicker from '../../students/admission/FilePicker';
import { STAFF_DIRECTORY_KEY, STAFF_OPTIONS_KEY } from './queryKeys';

const { Title, Text } = Typography;

/** Columns of the import file, in order, with their table headings. `required` = the row is skipped without it. */
const COLUMNS: { title: string; required?: boolean; sample: string }[] = [
  { title: 'Staff ID', required: true, sample: '1001' },
  { title: 'First Name', required: true, sample: 'Jason' },
  { title: 'Last Name', sample: 'Sharlton' },
  { title: 'Father Name', sample: 'Max Sharlton' },
  { title: 'Mother Name', sample: 'Arya Sharlton' },
  { title: 'Email', required: true, sample: 'jason@example.com' },
  { title: 'Gender', required: true, sample: 'Male' },
  { title: 'Date Of Birth', required: true, sample: '1980-06-16' },
  { title: 'Date Of Joining', sample: '2021-06-24' },
  { title: 'Phone', sample: '4654665456' },
  { title: 'Emergency Contact Number', sample: '5456121565' },
  { title: 'Marital Status', sample: 'Married' },
  { title: 'Current Address', sample: '83 Evan Street' },
  { title: 'Permanent Address', sample: '83 Evan Street' },
  { title: 'Qualification', sample: 'B.Ed.' },
  { title: 'Work Experience', sample: '3 Yrs' },
  { title: 'Note', sample: '' },
];

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** The new logins (email + one-time temporary password) of an import, so they can be handed out. */
function downloadLogins(rows: StaffImportRow[]) {
  const imported = rows.filter((r) => r.status === 'IMPORTED' && r.temporaryPassword);
  const lines = ['Staff ID,Name,Username,Temporary Password', ...imported.map((r) => [r.staffId ?? '', r.name, r.email ?? '', r.temporaryPassword ?? ''].map(csvCell).join(','))];
  const blob = new Blob([`﻿${lines.join('\r\n')}\r\n`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'imported_staff_logins.csv';
  a.click();
  URL.revokeObjectURL(url);
}

/** Human Resource -> Staff Directory -> Import Staff: add many staff from a CSV (Smart School's sample format). */
function ImportStaffPage() {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canImport = hasPermission(useAuthStore((state) => state.user?.permissions), 'STAFF_CREATE');

  const [roleId, setRoleId] = useState<string>();
  const [designationId, setDesignationId] = useState<string>();
  const [departmentId, setDepartmentId] = useState<string>();
  const [file, setFile] = useState<File | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const [result, setResult] = useState<StaffImportResult | null>(null);

  const optionsQuery = useQuery({ queryKey: STAFF_OPTIONS_KEY, queryFn: fetchStaffOptions, enabled: canImport });

  const sampleMutation = useMutation({
    mutationFn: fetchStaffSampleCsv,
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'staff_csvfile.csv';
      a.click();
      URL.revokeObjectURL(url);
    },
    onError: () => message.error("Couldn't download the sample file. Please try again."),
  });

  const importMutation = useMutation({
    mutationFn: () => importStaff(file as File, roleId as string, designationId, departmentId),
    onSuccess: (data) => {
      setResult(data);
      void queryClient.invalidateQueries({ queryKey: STAFF_DIRECTORY_KEY });
      if (data.imported > 0) message.success(`${data.imported} staff member${data.imported === 1 ? '' : 's'} imported`);
      if (data.skipped > 0) message.warning(`${data.skipped} row${data.skipped === 1 ? '' : 's'} skipped -- see the list below`);
      setFile(null);
    },
    onError: (error) => message.error(serverMessage(error) ?? 'Could not import the file. Please try again.'),
  });

  if (!canImport) {
    return <Result status="403" title="Not available" subTitle="You don't have permission to import staff." />;
  }

  const startImport = () => {
    const problems = [!roleId && 'role', !file && 'file'].filter(Boolean) as string[];
    setMissing(problems);
    if (problems.length === 0) {
      setResult(null);
      importMutation.mutate();
    }
  };

  const options = optionsQuery.data;
  const hasLogins = result?.rows.some((r) => r.status === 'IMPORTED' && r.temporaryPassword) ?? false;

  return (
    <div>
      <Card
        title={
          <Space>
            <Button type="text" icon={<ArrowLeftOutlined />} aria-label="Back to Add Staff" onClick={() => navigate('/app/human-resource/staff-directory/add')} />
            <Title level={4} style={{ margin: 0, fontWeight: 500 }}>
              Staff Import
            </Title>
          </Space>
        }
        extra={
          <Button type="primary" icon={<DownloadOutlined />} loading={sampleMutation.isPending} onClick={() => sampleMutation.mutate()}>
            Download Sample Import File
          </Button>
        }
        style={{ marginBottom: token.marginLG }}
      >
        <ol style={{ paddingLeft: token.paddingLG, lineHeight: 1.9, marginTop: 0 }}>
          <li>
            Your CSV data should be in the format of the sample file. The first line of your CSV file must be the column headers
            exactly as in the sample file. Also make sure that your file is UTF-8 to avoid unnecessary encoding problems.
          </li>
          <li>If the column you are importing is a date, make sure it is in the format yyyy-mm-dd (2018-06-06).</li>
          <li>Staff ID, Name, Email, Gender and Date Of Birth are required. Rows whose Staff ID or Email already exists are not imported.</li>
          <li>For Gender use Male or Female. For Marital Status use Single, Married, Widowed, Separated or Not Specified. For Contract Type use Permanent or Probation.</li>
          <li>
            Every imported staff member gets a login (their email) with a temporary password. The passwords are shown once when the
            import finishes -- download them then.
          </li>
        </ol>

        <Table
          size="small"
          bordered
          pagination={false}
          scroll={{ x: 'max-content' }}
          rowKey="k"
          dataSource={[{ k: 'sample' }]}
          columns={COLUMNS.map((c) => ({
            key: c.title,
            title: (
              <span style={{ whiteSpace: 'nowrap' }}>
                {c.required && <Text type="danger">* </Text>}
                {c.title}
              </span>
            ),
            render: () => <Text type="secondary">{c.sample || 'XYZ'}</Text>,
          }))}
        />

        <Form layout="vertical" style={{ marginTop: token.marginLG }} onFinish={startImport} requiredMark>
          <Row gutter={token.marginLG}>
            <Col xs={24} md={8}>
              <Form.Item label="Role" htmlFor="import-role" required validateStatus={missing.includes('role') ? 'error' : undefined} help={missing.includes('role') ? 'Select a role' : undefined}>
                <Select
                  id="import-role"
                  placeholder="Select"
                  showSearch
                  optionFilterProp="label"
                  loading={optionsQuery.isLoading}
                  options={(options?.roles ?? []).map((r) => ({ value: r.id, label: r.name }))}
                  value={roleId}
                  onChange={setRoleId}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item label="Designation" htmlFor="import-designation">
                <Select
                  id="import-designation"
                  placeholder="Select"
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  loading={optionsQuery.isLoading}
                  options={(options?.designations ?? []).map((d) => ({ value: d.id, label: d.name }))}
                  value={designationId}
                  onChange={setDesignationId}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item label="Department" htmlFor="import-department">
                <Select
                  id="import-department"
                  placeholder="Select"
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  loading={optionsQuery.isLoading}
                  options={(options?.departments ?? []).map((d) => ({ value: d.id, label: d.name }))}
                  value={departmentId}
                  onChange={setDepartmentId}
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={token.marginLG} align="bottom">
            <Col xs={24} md={16}>
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
            <Col xs={24} md={8}>
              <Form.Item style={{ textAlign: 'right' }}>
                <Button type="primary" htmlType="submit" icon={<UploadOutlined />} loading={importMutation.isPending}>
                  Staff Import
                </Button>
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Card>

      {result && (
        <Card title={<Title level={4} style={{ margin: 0, fontWeight: 500 }}>Import Result</Title>}>
          <Row gutter={token.marginLG} style={{ marginBottom: token.marginMD }} align="middle">
            <Col>
              <Statistic title="Imported" value={result.imported} valueStyle={{ color: token.colorSuccess }} />
            </Col>
            <Col>
              <Statistic title="Skipped" value={result.skipped} valueStyle={{ color: result.skipped ? token.colorError : undefined }} />
            </Col>
            {hasLogins && (
              <Col flex="auto" style={{ textAlign: 'right' }}>
                <Button icon={<DownloadOutlined />} onClick={() => downloadLogins(result.rows)}>
                  Download logins (CSV)
                </Button>
              </Col>
            )}
          </Row>
          {hasLogins && (
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: token.marginMD }}
              message="The temporary passwords below are shown only now. Download them before leaving this page; each staff member must change theirs at first sign-in."
            />
          )}
          {result.skipped > 0 && (
            <Alert type="warning" showIcon style={{ marginBottom: token.marginMD }} message="Fix the skipped rows in your file and import it again -- rows already imported will be skipped as duplicates." />
          )}
          <Table<StaffImportRow>
            rowKey="row"
            size="small"
            scroll={{ x: 'max-content' }}
            pagination={{ pageSize: 50, hideOnSinglePage: true }}
            dataSource={result.rows}
            columns={[
              { key: 'row', title: 'Row', dataIndex: 'row', width: 70 },
              { key: 'staffId', title: 'Staff ID', render: (_v, r) => r.staffId ?? '—' },
              { key: 'name', title: 'Name', render: (_v, r) => r.name || '—' },
              { key: 'email', title: 'Username', render: (_v, r) => r.email ?? '—' },
              {
                key: 'password',
                title: 'Temporary Password',
                render: (_v, r) => (r.temporaryPassword ? <Text code copyable>{r.temporaryPassword}</Text> : <Text type="secondary">—</Text>),
              },
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

export default ImportStaffPage;
