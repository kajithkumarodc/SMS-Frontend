import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  App,
  Button,
  Card,
  Checkbox,
  Col,
  Empty,
  Form,
  Result,
  Row,
  Select,
  Table,
  Tooltip,
  Typography,
  theme,
} from 'antd';
import type { ColumnsType } from 'antd/es/table/interface';
import { DeleteOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { fetchClasses } from '../../api/classes';
import { bulkDeleteStudents, fetchBulkDeleteCandidates, type BulkDeleteCandidate } from '../../api/students';
import { useAuthStore } from '../../store/authStore';
import { hasPermission } from '../../lib/roles';
import { formatDisplayDate } from '../../lib/dates';
import { serverMessage } from '../../lib/apiErrors';
import {
  copyRows,
  downloadCsv,
  downloadExcel,
  downloadPdf,
  printRows,
  type ExportColumn,
  type ExportKind,
} from '../../lib/tableExport';
import DataTableToolbar from '../../components/DataTableToolbar';
import { CLASSES_QUERY_KEY } from '../classes/queryKeys';
import { namedSections } from '../classes/sectionLookup';
import { STUDENTS_QUERY_KEY } from './queryKeys';

const { Title, Text } = Typography;

const DEFAULT_PAGE_SIZE = 50;
const BULK_DELETE_KEY = [...STUDENTS_QUERY_KEY, 'bulk-delete'] as const;

/** Applied criteria -- only changes when Search is pressed. */
type Criteria = { classId: string; sectionId?: string };

function titleCase(value: string | null): string {
  if (!value) return '';
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

const DATA_COLUMNS: { key: string; title: string; value: (s: BulkDeleteCandidate) => string }[] = [
  { key: 'admissionNumber', title: 'Admission No', value: (s) => s.admissionNumber },
  { key: 'fullName', title: 'Student Name', value: (s) => s.fullName },
  { key: 'class', title: 'Class', value: (s) => (s.sectionName ? `${s.className}(${s.sectionName})` : s.className) },
  { key: 'dateOfBirth', title: 'Date Of Birth', value: (s) => formatDisplayDate(s.dateOfBirth) },
  { key: 'gender', title: 'Gender', value: (s) => titleCase(s.gender) },
  { key: 'category', title: 'Category', value: (s) => s.category ?? '' },
  { key: 'mobile', title: 'Mobile Number', value: (s) => s.mobile ?? '' },
];

function BulkDeletePage() {
  const { token } = theme.useToken();
  const { message, modal } = App.useApp();
  const queryClient = useQueryClient();
  const permissions = useAuthStore((state) => state.user?.permissions);
  const canDelete = hasPermission(permissions, 'STUDENT_DELETE');

  const [draftClassId, setDraftClassId] = useState<string>();
  const [draftSectionId, setDraftSectionId] = useState<string>();
  const [classError, setClassError] = useState(false);
  const [criteria, setCriteria] = useState<Criteria | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [hiddenColumns, setHiddenColumns] = useState<string[]>([]);
  const [exporting, setExporting] = useState<ExportKind | null>(null);
  const [selected, setSelected] = useState<string[]>([]);

  const classesQuery = useQuery({ queryKey: CLASSES_QUERY_KEY, queryFn: fetchClasses, enabled: canDelete });
  const draftClass = classesQuery.data?.find((c) => c.id === draftClassId);
  const sectionOptions = namedSections(draftClass).map((s) => ({ value: s.id, label: s.name }));

  const candidatesQuery = useQuery({
    queryKey: [...BULK_DELETE_KEY, criteria],
    queryFn: () => fetchBulkDeleteCandidates(criteria!.classId, criteria!.sectionId),
    enabled: canDelete && criteria !== null,
  });

  const rows = useMemo(() => {
    const all = candidatesQuery.data ?? [];
    const needle = search.trim().toLowerCase();
    if (!needle) return all;
    return all.filter((s) => DATA_COLUMNS.some((c) => c.value(s).toLowerCase().includes(needle)));
  }, [candidatesQuery.data, search]);

  const deletableIds = rows.filter((s) => s.deletable).map((s) => s.id);
  const selectedVisible = selected.filter((id) => deletableIds.includes(id));
  const allSelected = deletableIds.length > 0 && selectedVisible.length === deletableIds.length;
  const blockedCount = rows.length - deletableIds.length;

  const deleteMutation = useMutation({
    mutationFn: (ids: string[]) => bulkDeleteStudents(ids),
    onSuccess: (result) => {
      setSelected([]);
      void queryClient.invalidateQueries({ queryKey: STUDENTS_QUERY_KEY });
      const count = result.deleted.length;
      if (count > 0) message.success(`${count} student${count === 1 ? '' : 's'} deleted`);
      if (result.skipped.length > 0) {
        modal.warning({
          title: `${result.skipped.length} student${result.skipped.length === 1 ? ' was' : 's were'} not deleted`,
          content: (
            <ul style={{ paddingLeft: token.paddingLG, margin: 0 }}>
              {result.skipped.map((s) => (
                <li key={s.id}>
                  {s.fullName ? `${s.fullName} (${s.admissionNumber})` : 'Unknown student'}: {s.reason}
                </li>
              ))}
            </ul>
          ),
        });
      }
    },
    onError: (error) => message.error(serverMessage(error) ?? 'Could not delete the students. Please try again.'),
  });

  if (!canDelete) {
    return <Result status="403" title="Not available" subTitle="You don't have permission to delete students." />;
  }

  const applyCriteria = () => {
    if (!draftClassId) {
      setClassError(true);
      return;
    }
    setClassError(false);
    setCriteria({ classId: draftClassId, sectionId: draftSectionId });
    setSelected([]);
    setSearch('');
    setPage(1);
  };

  const confirmDelete = () => {
    const ids = selectedVisible;
    if (ids.length === 0) {
      message.warning('Select at least one student to delete');
      return;
    }
    const names = rows.filter((s) => ids.includes(s.id)).map((s) => `${s.fullName} (${s.admissionNumber})`);
    modal.confirm({
      title: `Permanently delete ${ids.length} student${ids.length === 1 ? '' : 's'}?`,
      content: (
        <>
          <p style={{ marginTop: 0 }}>
            This removes the student record, identification details, documents and academic history. It cannot be
            undone. To keep the history, disable the student instead.
          </p>
          <ul style={{ paddingLeft: token.paddingLG, margin: 0, maxHeight: 200, overflowY: 'auto' }}>
            {names.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </>
      ),
      okText: 'Delete',
      okButtonProps: { danger: true },
      onOk: () => deleteMutation.mutateAsync(ids).catch(() => undefined),
    });
  };

  const visibleDataColumns = DATA_COLUMNS.filter((c) => !hiddenColumns.includes(c.key));

  const handleExport = async (kind: ExportKind) => {
    setExporting(kind);
    try {
      const columns: ExportColumn<BulkDeleteCandidate>[] = visibleDataColumns.map((c) => ({ title: c.title, value: c.value }));
      const fileBase = `students-${dayjs().format('YYYY-MM-DD')}`;
      const title = 'Student List';
      if (kind === 'copy') {
        await copyRows(rows, columns);
        message.success(`Copied ${rows.length} row${rows.length === 1 ? '' : 's'} to the clipboard`);
      } else if (kind === 'csv') downloadCsv(rows, columns, fileBase);
      else if (kind === 'excel') await downloadExcel(rows, columns, fileBase, title);
      else if (kind === 'pdf') await downloadPdf(rows, columns, fileBase, title);
      else printRows(rows, columns, title);
    } catch {
      message.error("Couldn't export the students. Please try again.");
    } finally {
      setExporting(null);
    }
  };

  const columns: ColumnsType<BulkDeleteCandidate> = visibleDataColumns.map((c) => ({
    key: c.key,
    title: c.title,
    render: (_: unknown, record: BulkDeleteCandidate) =>
      c.key === 'fullName' ? (
        <Link to={`/app/student-information/student-details?profile=${record.id}`}>{record.fullName}</Link>
      ) : (
        c.value(record)
      ),
  }));

  const cardTitle = (text: string) => (
    <Title level={4} style={{ margin: 0, fontWeight: 500, whiteSpace: 'normal' }}>
      {text}
    </Title>
  );

  return (
    <div>
      <Card title={cardTitle('Select Criteria')} style={{ marginBottom: token.marginLG }}>
        <Form layout="vertical" onFinish={applyCriteria} requiredMark>
          <Row gutter={token.marginMD}>
            <Col xs={24} md={12}>
              <Form.Item
                label="Class"
                htmlFor="bulk-delete-class"
                required
                validateStatus={classError ? 'error' : undefined}
                help={classError ? 'Class is required' : undefined}
              >
                <Select
                  id="bulk-delete-class"
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
            <Col xs={24} md={12}>
              <Form.Item label="Section" htmlFor="bulk-delete-section">
                <Select
                  id="bulk-delete-section"
                  placeholder={!draftClassId ? 'Select a class first' : sectionOptions.length === 0 ? 'Whole class (no sections)' : 'All sections'}
                  allowClear
                  disabled={!draftClassId || sectionOptions.length === 0}
                  options={sectionOptions}
                  value={draftSectionId}
                  onChange={(v) => setDraftSectionId(v)}
                />
              </Form.Item>
            </Col>
          </Row>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button type="primary" htmlType="submit" icon={<SearchOutlined />} loading={candidatesQuery.isFetching}>
              Search
            </Button>
          </div>
        </Form>
      </Card>

      {criteria && (
        <Card>
          {candidatesQuery.isError ? (
            <Alert
              type="error"
              showIcon
              message={serverMessage(candidatesQuery.error) ?? "Couldn't load the students."}
              action={<Button onClick={() => void candidatesQuery.refetch()}>Retry</Button>}
            />
          ) : (
            <>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: token.marginSM,
                  marginBottom: token.marginMD,
                }}
              >
                <Checkbox
                  checked={allSelected}
                  indeterminate={selectedVisible.length > 0 && !allSelected}
                  disabled={deletableIds.length === 0}
                  onChange={(e) => setSelected(e.target.checked ? deletableIds : [])}
                >
                  Select All
                </Checkbox>
                <Button
                  danger
                  type="primary"
                  icon={<DeleteOutlined />}
                  disabled={selectedVisible.length === 0}
                  loading={deleteMutation.isPending}
                  onClick={confirmDelete}
                >
                  Delete{selectedVisible.length > 0 ? ` (${selectedVisible.length})` : ''}
                </Button>
              </div>

              {blockedCount > 0 && (
                <Alert
                  type="info"
                  showIcon
                  style={{ marginBottom: token.marginMD }}
                  message={`${blockedCount} student${blockedCount === 1 ? " can't" : "s can't"} be deleted because they already have attendance, marks, fees, library or visitor records. Disable them instead.`}
                />
              )}

              <DataTableToolbar
                search={search}
                onSearchChange={(v) => {
                  setSearch(v);
                  setPage(1);
                }}
                searchLabel="Search students"
                pageSize={pageSize}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setPage(1);
                }}
                columns={DATA_COLUMNS.map((c) => ({ key: c.key, title: c.title }))}
                hiddenColumns={hiddenColumns}
                onHiddenColumnsChange={setHiddenColumns}
                onExport={(kind) => void handleExport(kind)}
                exporting={exporting}
                canExport
                canPrint
              />

              <Table<BulkDeleteCandidate>
                rowKey="id"
                size="middle"
                columns={columns}
                dataSource={rows}
                loading={candidatesQuery.isFetching}
                scroll={{ x: 'max-content' }}
                rowSelection={{
                  columnTitle: '#',
                  selectedRowKeys: selectedVisible,
                  onChange: (keys) => setSelected(keys as string[]),
                  getCheckboxProps: (record) => ({
                    disabled: !record.deletable,
                    'aria-label': `Select ${record.fullName}`,
                  }),
                  renderCell: (_checked, record, _index, node) =>
                    record.deletable ? node : <Tooltip title={record.blockReason}>{node}</Tooltip>,
                }}
                pagination={{
                  current: page,
                  pageSize,
                  onChange: setPage,
                  showSizeChanger: false,
                  showTotal: (total, [from, to]) => `Records: ${from} to ${to} of ${total}`,
                }}
                locale={{
                  emptyText: (
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description={
                        search.trim() ? 'No students match your search' : 'No students in this class / section'
                      }
                    />
                  ),
                }}
              />
              <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                Deleting is permanent. Students with any history can only be disabled.
              </Text>
            </>
          )}
        </Card>
      )}
    </div>
  );
}

export default BulkDeletePage;
