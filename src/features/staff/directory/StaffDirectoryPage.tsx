import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Alert, App, Avatar, Button, Card, Col, Empty, Form, Input, Result, Row, Select, Spin, Table, Tabs, Tag, Typography, theme } from 'antd';
import type { ColumnsType } from 'antd/es/table/interface';
import { AppstoreOutlined, BarsOutlined, PlusOutlined, SearchOutlined, UserOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  fetchStaffDirectory,
  fetchStaffOptions,
  staffPhotoUrl,
  type StaffCard,
  type StaffDirectoryFilter,
} from '../../../api/staffMembers';
import { useAuthStore } from '../../../store/authStore';
import { hasPermission } from '../../../lib/roles';
import { formatDisplayDate } from '../../../lib/dates';
import {
  copyRows,
  downloadCsv,
  downloadExcel,
  downloadPdf,
  printRows,
  type ExportColumn,
  type ExportKind,
} from '../../../lib/tableExport';
import DataTableToolbar from '../../../components/DataTableToolbar';
import { STAFF_DIRECTORY_KEY, STAFF_OPTIONS_KEY } from './queryKeys';

const { Title, Text } = Typography;

const DEFAULT_PAGE_SIZE = 50;
const HIDDEN_COLUMNS_STORAGE_KEY = 'sms.staffDirectory.hiddenColumns';

/** What the last Search button pressed asked for; nothing yet means the whole directory. */
type Criteria = { kind: 'role'; roleId: string } | { kind: 'keyword'; q: string } | null;

const DATA_COLUMNS: { key: string; title: string; value: (s: StaffCard) => string }[] = [
  { key: 'staffId', title: 'Staff ID', value: (s) => s.staffId },
  { key: 'fullName', title: 'Name', value: (s) => s.fullName },
  { key: 'roleName', title: 'Role', value: (s) => s.roleName ?? '' },
  { key: 'designationName', title: 'Designation', value: (s) => s.designationName ?? '' },
  { key: 'departmentName', title: 'Department', value: (s) => s.departmentName ?? '' },
  { key: 'email', title: 'Email', value: (s) => s.email },
  { key: 'phone', title: 'Phone', value: (s) => s.phone ?? '' },
  { key: 'dateOfJoining', title: 'Date Of Joining', value: (s) => formatDisplayDate(s.dateOfJoining) },
];

function readHiddenColumns(): string[] {
  try {
    const raw = localStorage.getItem(HIDDEN_COLUMNS_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

function writeHiddenColumns(hidden: string[]) {
  try {
    localStorage.setItem(HIDDEN_COLUMNS_STORAGE_KEY, JSON.stringify(hidden));
  } catch {
    // Storage blocked -- the choice just won't persist.
  }
}

/** "Ground Floor, Admin": the work location and department, whichever are set. */
function placeLine(staff: StaffCard): string {
  return [staff.workLocation, staff.departmentName].filter(Boolean).join(', ');
}

/** Human Resource -> Staff Directory (/app/human-resource/staff-directory): find staff by role or keyword. */
function StaffDirectoryPage() {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const permissions = useAuthStore((state) => state.user?.permissions);
  const canView = hasPermission(permissions, 'STAFF_VIEW');
  const canCreate = hasPermission(permissions, 'STAFF_CREATE');
  const canExport = hasPermission(permissions, 'STAFF_EXPORT');

  const [roleId, setRoleId] = useState<string>();
  const [roleError, setRoleError] = useState<string>();
  const [keyword, setKeyword] = useState('');
  const [keywordError, setKeywordError] = useState<string>();
  const [criteria, setCriteria] = useState<Criteria>(null);
  const [tab, setTab] = useState('card');
  const [tableSearch, setTableSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [hiddenColumns, setHiddenColumns] = useState<string[]>(readHiddenColumns);
  const [exporting, setExporting] = useState<ExportKind | null>(null);
  const openProfile = (id: string) => navigate(`/app/human-resource/staff-directory/${id}`);

  const filter: StaffDirectoryFilter = {
    roleId: criteria?.kind === 'role' ? criteria.roleId : undefined,
    q: criteria?.kind === 'keyword' ? criteria.q : undefined,
  };
  const optionsQuery = useQuery({ queryKey: STAFF_OPTIONS_KEY, queryFn: fetchStaffOptions, enabled: canView });
  const staffQuery = useQuery({
    queryKey: [...STAFF_DIRECTORY_KEY, filter],
    queryFn: () => fetchStaffDirectory(filter),
    enabled: canView,
  });

  const staff = staffQuery.data ?? [];
  const tableRows = useMemo(() => {
    const term = tableSearch.trim().toLowerCase();
    if (!term) return staff;
    return staff.filter((s) => DATA_COLUMNS.some((c) => c.value(s).toLowerCase().includes(term)));
  }, [staff, tableSearch]);
  const visibleDataColumns = useMemo(() => DATA_COLUMNS.filter((c) => !hiddenColumns.includes(c.key)), [hiddenColumns]);

  if (!canView) {
    return <Result status="403" title="Not available" subTitle="You don't have permission to view the staff directory." />;
  }

  const searchByRole = () => {
    if (!roleId) {
      setRoleError('Role is required');
      return;
    }
    setRoleError(undefined);
    setCriteria({ kind: 'role', roleId });
    setTableSearch('');
    setPage(1);
  };

  const searchByKeyword = () => {
    const q = keyword.trim();
    if (!q) {
      // Nothing typed: show everyone again.
      setKeywordError(undefined);
      setCriteria(null);
      return;
    }
    setKeywordError(undefined);
    setCriteria({ kind: 'keyword', q });
    setTableSearch('');
    setPage(1);
  };

  const handleExport = async (kind: ExportKind) => {
    setExporting(kind);
    try {
      const columns: ExportColumn<StaffCard>[] = visibleDataColumns.map((c) => ({ title: c.title, value: c.value }));
      const fileBase = `staff-directory-${dayjs().format('YYYY-MM-DD')}`;
      const title = 'Staff Directory';
      if (kind === 'copy') {
        await copyRows(tableRows, columns);
        message.success(`Copied ${tableRows.length} row${tableRows.length === 1 ? '' : 's'} to the clipboard`);
      } else if (kind === 'csv') downloadCsv(tableRows, columns, fileBase);
      else if (kind === 'excel') await downloadExcel(tableRows, columns, fileBase, title);
      else if (kind === 'pdf') await downloadPdf(tableRows, columns, fileBase, title);
      else printRows(tableRows, columns, title);
    } catch {
      message.error("Couldn't export the staff list. Please try again.");
    } finally {
      setExporting(null);
    }
  };

  const columns: ColumnsType<StaffCard> = visibleDataColumns.map((c) => ({
    key: c.key,
    title: c.title,
    sorter: (a: StaffCard, b: StaffCard) => c.value(a).localeCompare(c.value(b), undefined, { numeric: true, sensitivity: 'base' }),
    render: (_: unknown, record: StaffCard) =>
      c.key === 'fullName' ? (
        <Button type="link" style={{ padding: 0, height: 'auto' }} onClick={() => openProfile(record.id)}>
          {record.fullName}
        </Button>
      ) : (
        c.value(record)
      ),
  }));

  const tagStyle = { marginInlineEnd: token.marginXXS, marginBlock: 0 };
  const cardView = (
    <Row gutter={[token.marginMD, token.marginMD]} style={{ padding: token.paddingMD }}>
      {staff.map((s) => (
        <Col key={s.id} xs={24} md={12} xl={8} xxl={6}>
          <Card
            hoverable
            size="small"
            styles={{ body: { padding: 0, display: 'flex', minHeight: 124 } }}
            onClick={() => openProfile(s.id)}
            data-testid="staff-card"
          >
            <div style={{ width: 124, flex: 'none', background: token.colorFillTertiary, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {s.hasPhoto ? (
                <img
                  src={staffPhotoUrl(s.id)}
                  alt={s.fullName}
                  loading="lazy"
                  style={{ width: 124, height: 124, objectFit: 'cover', display: 'block' }}
                />
              ) : (
                <Avatar shape="square" size={124} icon={<UserOutlined />} style={{ background: token.colorFillTertiary, color: token.colorTextQuaternary }} />
              )}
            </div>
            <div style={{ padding: token.paddingSM, minWidth: 0, flex: 1 }}>
              <Title level={5} style={{ margin: 0 }} ellipsis={{ tooltip: s.fullName }}>
                {s.fullName}
              </Title>
              <div style={{ fontSize: token.fontSizeSM, lineHeight: 1.45, color: token.colorTextSecondary, marginBottom: token.marginXXS }}>
                <div>{s.staffId}</div>
                {s.phone && <div>{s.phone}</div>}
                {placeLine(s) && <div>{placeLine(s)}</div>}
              </div>
              {s.roleName && <Tag style={tagStyle}>{s.roleName}</Tag>}
              {s.designationName && <Tag style={tagStyle}>{s.designationName}</Tag>}
            </div>
          </Card>
        </Col>
      ))}
    </Row>
  );

  const empty = (
    <Empty
      image={Empty.PRESENTED_IMAGE_SIMPLE}
      description={criteria ? 'No staff match your search. Try different criteria.' : 'No staff added yet.'}
      style={{ padding: token.paddingXL }}
    />
  );

  const listView = (
    <div style={{ padding: token.paddingMD }}>
      <DataTableToolbar
        search={tableSearch}
        onSearchChange={(value) => {
          setTableSearch(value);
          setPage(1);
        }}
        searchPlaceholder="Search"
        pageSize={pageSize}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
        }}
        columns={DATA_COLUMNS.map((c) => ({ key: c.key, title: c.title }))}
        hiddenColumns={hiddenColumns}
        onHiddenColumnsChange={(hidden) => {
          setHiddenColumns(hidden);
          writeHiddenColumns(hidden);
        }}
        onExport={(kind) => void handleExport(kind)}
        exporting={exporting}
        canExport={canExport}
        canPrint={canExport}
      />
      <Table<StaffCard>
        rowKey="id"
        size="middle"
        columns={columns}
        dataSource={tableRows}
        scroll={{ x: 'max-content' }}
        locale={{ emptyText: empty }}
        pagination={{
          current: page,
          pageSize,
          showSizeChanger: false,
          showTotal: (count, [start, end]) =>
            count === 0 ? '' : <Text type="secondary">Showing {start} to {end} of {count} entries</Text>,
          onChange: (nextPage) => setPage(nextPage),
        }}
      />
    </div>
  );

  return (
    <Card
      title={
        <Title level={4} style={{ margin: 0, fontWeight: 500 }}>
          Select Criteria
        </Title>
      }
      extra={
        canCreate && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/app/human-resource/staff-directory/add')}>
            Add Staff
          </Button>
        )
      }
      styles={{ body: { padding: 0 } }}
    >
      <Row gutter={[token.marginLG, 0]} style={{ padding: token.paddingLG }}>
        <Col xs={24} md={12}>
          <Form layout="vertical" onFinish={searchByRole}>
            <Form.Item label="Role" htmlFor="staff-search-role" required validateStatus={roleError ? 'error' : undefined} help={roleError}>
              <Select
                id="staff-search-role"
                placeholder="Select"
                showSearch
                optionFilterProp="label"
                loading={optionsQuery.isLoading}
                options={(optionsQuery.data?.roles ?? []).map((r) => ({ value: r.id, label: r.name }))}
                value={roleId}
                onChange={(value: string) => {
                  setRoleId(value);
                  setRoleError(undefined);
                }}
              />
            </Form.Item>
            <div style={{ textAlign: 'right' }}>
              <Button type="primary" htmlType="submit" icon={<SearchOutlined />} aria-label="Search by role">
                Search
              </Button>
            </div>
          </Form>
        </Col>
        <Col xs={24} md={12}>
          <Form layout="vertical" onFinish={searchByKeyword}>
            <Form.Item label="Search By Keyword" htmlFor="staff-search-keyword" validateStatus={keywordError ? 'error' : undefined} help={keywordError}>
              <Input
                id="staff-search-keyword"
                placeholder="Search By Staff ID, Name, Role etc..."
                autoComplete="off"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
              />
            </Form.Item>
            <div style={{ textAlign: 'right' }}>
              <Button type="primary" htmlType="submit" icon={<SearchOutlined />} aria-label="Search by keyword">
                Search
              </Button>
            </div>
          </Form>
        </Col>
      </Row>

      <Tabs
        activeKey={tab}
        onChange={setTab}
        tabBarStyle={{ paddingInline: token.paddingLG, marginBottom: 0 }}
        items={[
          { key: 'card', label: 'Card View', icon: <AppstoreOutlined /> },
          { key: 'list', label: 'List View', icon: <BarsOutlined /> },
        ]}
      />
      {staffQuery.isError ? (
        <Alert
          type="warning"
          showIcon
          style={{ margin: token.margin }}
          message="Couldn't load the staff directory"
          description="There was a problem reaching the server."
          action={
            <Button size="small" onClick={() => void staffQuery.refetch()}>
              Try again
            </Button>
          }
        />
      ) : staffQuery.isLoading ? (
        <div style={{ textAlign: 'center', padding: token.paddingXL }}>
          <Spin />
        </div>
      ) : tab === 'card' ? (
        staff.length === 0 ? empty : cardView
      ) : (
        listView
      )}

    </Card>
  );
}

export default StaffDirectoryPage;
