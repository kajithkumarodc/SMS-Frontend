import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Radio,
  Result,
  Row,
  Select,
  Skeleton,
  Space,
  Tag,
  Tooltip,
  Typography,
  theme,
} from 'antd';
import {
  CopyOutlined,
  DeleteOutlined,
  DownOutlined,
  EditOutlined,
  GlobalOutlined,
  PlusOutlined,
  RightOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { fetchClasses } from '../../api/classes';
import { fetchSchools } from '../../api/students';
import { fetchCurrentAcademicYear } from '../../api/academicYears';
import { fetchMediums } from '../../api/mediums';
import {
  createFeeStructure,
  deleteFeeStructure,
  fetchFeeStructures,
  fetchFeeTypes,
  updateFeeStructure,
  type CreateFeeStructureInput,
  type FeeStructure,
} from '../../api/fees';
import { useAuthStore } from '../../store/authStore';
import { hasRole, ROLE } from '../../lib/roles';
import { serverMessage } from '../../lib/apiErrors';
import { CLASSES_QUERY_KEY } from '../classes/queryKeys';
import { FEE_STRUCTURES_QUERY_KEY } from './queryKeys';
import { formatAmount } from './format';
import MediumsModal, { MEDIUMS_QUERY_KEY } from './MediumsModal';
import GenerateInvoiceForm from './GenerateInvoiceForm';
import FeeGridTable from './FeeGridTable';
import {
  defaultTermDates,
  MAX_TERMS,
  newRow,
  structureTermTotals,
  TERM_LABELS,
  toGrid,
  toItems,
  termTotal,
  type GridDraft,
} from './feeGrid';

const { Title, Text } = Typography;

const FREQUENCIES = [
  { value: 'ANNUAL', label: 'Yearly (paid in terms)' },
  { value: 'HALF_YEARLY', label: 'Half-yearly' },
  { value: 'QUARTERLY', label: 'Quarterly' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'ONE_TIME', label: 'One-time' },
];

function defaultAcademicYear(): string {
  const now = dayjs();
  const startYear = now.month() >= 5 ? now.year() : now.year() - 1;
  return `${startYear}-${startYear + 1}`;
}

type SavePrompt = { input: CreateFeeStructureInput; id: string; billed: number; applyToExisting: boolean };

/**
 * Fees Master: each class's fee sheet per medium, laid out like a printed fee structure -- fee types down the
 * side, Term I / II / III across, with a due date per term, a fine and totals. Everything is editable so each
 * school can set its own fees. Student Admission offers exactly these fee groups for the student's class and
 * medium.
 */
function FeesMasterPage() {
  const { token } = theme.useToken();
  const { message, modal } = App.useApp();
  const queryClient = useQueryClient();
  const canManage = hasRole(useAuthStore((state) => state.user?.roles), ROLE.SCHOOL_ADMIN);

  const [classId, setClassId] = useState<string>();
  const [mediumId, setMediumId] = useState<string>('ALL');
  const [academicYear, setAcademicYear] = useState('');
  const [mediumsOpen, setMediumsOpen] = useState(false);
  const [expanded, setExpanded] = useState<string[]>([]);
  const [draft, setDraft] = useState<GridDraft | null>(null);
  const [draftErrors, setDraftErrors] = useState<string[]>([]);
  const [savePrompt, setSavePrompt] = useState<SavePrompt | null>(null);
  const [copying, setCopying] = useState<{ structure: FeeStructure; classId?: string; mediumId: string } | null>(null);

  const classesQuery = useQuery({ queryKey: CLASSES_QUERY_KEY, queryFn: fetchClasses, enabled: canManage });
  const mediumsQuery = useQuery({ queryKey: MEDIUMS_QUERY_KEY, queryFn: fetchMediums, enabled: canManage });
  const schoolsQuery = useQuery({ queryKey: ['schools'], queryFn: fetchSchools, enabled: canManage });
  const feeTypesQuery = useQuery({ queryKey: ['fee-types'], queryFn: () => fetchFeeTypes(), enabled: canManage });
  const currentYearQuery = useQuery({ queryKey: ['academic-year-current'], queryFn: fetchCurrentAcademicYear, enabled: canManage });

  useEffect(() => {
    if (!academicYear && currentYearQuery.isFetched) setAcademicYear(currentYearQuery.data?.name ?? defaultAcademicYear());
  }, [academicYear, currentYearQuery.isFetched, currentYearQuery.data]);
  useEffect(() => {
    if (!classId && classesQuery.data?.length) setClassId(classesQuery.data[0].id);
  }, [classId, classesQuery.data]);

  const selectedClass = classesQuery.data?.find((c) => c.id === classId);
  const selectedMedium = mediumsQuery.data?.find((m) => m.id === mediumId);
  const mediumName = (id: string | null) => mediumsQuery.data?.find((m) => m.id === id)?.name;
  const feeTypeName = (id?: string) => feeTypesQuery.data?.find((t) => t.id === id)?.name;

  const structuresQuery = useQuery({
    queryKey: [...FEE_STRUCTURES_QUERY_KEY, 'master', classId, mediumId, academicYear],
    queryFn: () =>
      fetchFeeStructures({
        classId,
        academicYear: academicYear.trim() || undefined,
        mediumId: mediumId === 'ALL' ? undefined : mediumId,
      }),
    enabled: canManage && Boolean(classId) && Boolean(academicYear.trim()),
  });
  // "All mediums" lists only the groups charged to every medium; a medium lists its own plus those.
  const groups = useMemo(
    () =>
      (structuresQuery.data ?? [])
        .filter((s) => mediumId !== 'ALL' || s.mediumId === null)
        .sort(
          (a, b) =>
            Number(a.classId === null) - Number(b.classId === null) ||
            a.name.localeCompare(b.name, undefined, { numeric: true }),
        ),
    [structuresQuery.data, mediumId],
  );

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: FEE_STRUCTURES_QUERY_KEY });
  const onError = (error: unknown) => message.error(serverMessage(error) ?? 'Could not save the fees. Please try again.');

  const createMutation = useMutation({
    mutationFn: (input: CreateFeeStructureInput) => createFeeStructure(input),
    onSuccess: (saved) => {
      message.success(`"${saved.name}" added`);
      setDraft(null);
      setCopying(null);
      setExpanded((keys) => [...keys, saved.id]);
      invalidate();
    },
    onError,
  });
  const updateMutation = useMutation({
    mutationFn: (p: SavePrompt) => updateFeeStructure(p.id, p.input, p.applyToExisting),
    onSuccess: (result) => {
      setDraft(null);
      setSavePrompt(null);
      invalidate();
      if (result.adjustedInvoices > 0 || result.skipped.length > 0) {
        modal.info({
          title: `"${result.structure.name}" saved`,
          content: (
            <>
              <p>
                {result.adjustedInvoices} existing bill{result.adjustedInvoices === 1 ? ' was' : 's were'} updated (each change is recorded).
              </p>
              {result.skipped.length > 0 && (
                <>
                  <p>Not changed:</p>
                  <ul style={{ paddingLeft: token.paddingLG }}>
                    {result.skipped.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </>
              )}
            </>
          ),
        });
      } else {
        message.success(`"${result.structure.name}" saved`);
      }
    },
    onError,
  });
  const deleteMutation = useMutation({
    mutationFn: (s: FeeStructure) => deleteFeeStructure(s.id).then(() => s),
    onSuccess: (s) => {
      message.success(`"${s.name}" deleted`);
      invalidate();
    },
    onError: (error) => message.error(serverMessage(error) ?? 'Could not delete the fee group. Please try again.'),
  });

  if (!canManage) {
    return <Result status="403" title="Not available" subTitle="Only a school administrator can manage fees." />;
  }

  const startNew = () => {
    const suggested = [selectedClass?.name, selectedMedium?.name, 'Fees'].filter(Boolean).join(' ');
    const active = (feeTypesQuery.data ?? []).filter((t) => t.active && !/transport|hostel/i.test(t.name));
    setDraftErrors([]);
    setDraft({
      name: suggested,
      termCount: 3,
      termDates: defaultTermDates(academicYear),
      frequency: 'ANNUAL',
      lateFeeAmount: null,
      rows: active.length > 0 ? active.map((t) => newRow({ feeTypeId: t.id, label: t.name })) : [newRow()],
    });
  };

  const startEdit = (s: FeeStructure) => {
    const grid = toGrid(s);
    const defaults = defaultTermDates(s.academicYear);
    setDraftErrors([]);
    setExpanded((keys) => (keys.includes(s.id) ? keys : [...keys, s.id]));
    setDraft({
      id: s.id,
      name: s.name,
      termCount: grid.termCount,
      termDates: grid.termDates.map((d, i) => d || defaults[i]),
      frequency: s.frequency,
      lateFeeAmount: s.lateFeeAmount,
      rows: grid.rows,
    });
  };

  const buildInput = (d: GridDraft, existing?: FeeStructure): CreateFeeStructureInput | null => {
    const errors: string[] = [];
    if (!d.name.trim()) errors.push('Give the fee group a name.');
    const usedRows = d.rows.filter((r) => r.amounts.slice(0, d.termCount).some((a) => (a ?? 0) > 0));
    if (usedRows.length === 0) errors.push('Enter at least one amount.');
    d.rows.forEach((r, i) => {
      const hasAmount = r.amounts.slice(0, d.termCount).some((a) => (a ?? 0) > 0);
      if (hasAmount && !r.feeTypeId && !r.label.trim()) errors.push(`Row ${i + 1}: choose a fees type or type a name.`);
    });
    for (let t = 0; t < d.termCount; t += 1) {
      if (!d.termDates[t] && termTotal(d.rows, t) > 0) errors.push(`${TERM_LABELS[t]}: pick a due date.`);
    }
    setDraftErrors(errors);
    if (errors.length > 0) return null;
    const schoolId = schoolsQuery.data?.[0]?.id;
    if (!schoolId) {
      message.error('Set up the school first.');
      return null;
    }
    return {
      schoolId,
      classId: existing ? (existing.classId ?? undefined) : classId,
      mediumId: existing ? existing.mediumId : mediumId === 'ALL' ? null : mediumId,
      academicYear: existing?.academicYear ?? academicYear.trim(),
      name: d.name.trim(),
      dueDate: d.termDates[0] || dayjs().format('YYYY-MM-DD'),
      frequency: d.frequency as CreateFeeStructureInput['frequency'],
      lateFeeAmount: d.lateFeeAmount && d.lateFeeAmount > 0 ? d.lateFeeAmount : undefined,
      items: toItems(d, feeTypeName),
    };
  };

  const saveDraft = () => {
    if (!draft) return;
    const existing = draft.id ? structuresQuery.data?.find((s) => s.id === draft.id) : undefined;
    const input = buildInput(draft, existing);
    if (!input) return;
    if (!existing) {
      createMutation.mutate(input);
      return;
    }
    const newTotal = (input.items ?? []).reduce((sum, i) => sum + i.amount, 0);
    if (existing.billedCount > 0 && newTotal !== existing.amount) {
      setSavePrompt({ input, id: existing.id, billed: existing.billedCount, applyToExisting: false });
    } else {
      updateMutation.mutate({ input, id: existing.id, billed: existing.billedCount, applyToExisting: false });
    }
  };

  const draftTotal = draft
    ? Array.from({ length: draft.termCount }, (_, t) => termTotal(draft.rows, t)).reduce((a, b) => a + b, 0)
    : 0;

  const editor = (d: GridDraft) => (
    <div>
      <Form layout="vertical">
        <Row gutter={token.marginMD}>
          <Col xs={24} md={9}>
            <Form.Item label="Fee group name" htmlFor="fee-group-name" required>
              <Input id="fee-group-name" value={d.name} maxLength={150} onChange={(e) => setDraft({ ...d, name: e.target.value })} />
            </Form.Item>
          </Col>
          <Col xs={12} md={4}>
            <Form.Item label="Terms" htmlFor="fee-group-terms">
              <Select
                id="fee-group-terms"
                value={d.termCount}
                onChange={(n) => setDraft({ ...d, termCount: n })}
                options={Array.from({ length: MAX_TERMS }, (_, i) => ({ value: i + 1, label: `${i + 1} term${i ? 's' : ''}` }))}
              />
            </Form.Item>
          </Col>
          <Col xs={12} md={5}>
            <Form.Item label="Frequency" htmlFor="fee-group-frequency">
              <Select id="fee-group-frequency" value={d.frequency} options={FREQUENCIES} onChange={(v) => setDraft({ ...d, frequency: v })} />
            </Form.Item>
          </Col>
          <Col xs={24} md={6}>
            <Form.Item label="Fine (late fee)" htmlFor="fee-group-fine" tooltip="Added to a bill that is not paid by its due date.">
              <InputNumber
                id="fee-group-fine"
                min={0}
                precision={2}
                style={{ width: '100%' }}
                placeholder="No fine"
                value={d.lateFeeAmount}
                onChange={(v) => setDraft({ ...d, lateFeeAmount: v })}
              />
            </Form.Item>
          </Col>
        </Row>
      </Form>
      <FeeGridTable
        mode="full"
        rows={d.rows}
        termCount={d.termCount}
        termDates={d.termDates}
        feeTypes={feeTypesQuery.data ?? []}
        onRowsChange={(rows) => setDraft({ ...d, rows })}
        onTermDatesChange={(termDates) => setDraft({ ...d, termDates })}
      />
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: token.marginSM, marginTop: token.marginSM }}>
        <Button icon={<PlusOutlined />} onClick={() => setDraft({ ...d, rows: [...d.rows, newRow()] })}>
          Add fee
        </Button>
        <Text strong style={{ fontSize: token.fontSizeLG }}>
          Total: {formatAmount(draftTotal)}
        </Text>
      </div>
      {draftErrors.length > 0 && (
        <Alert type="error" showIcon style={{ marginTop: token.marginSM }} message={draftErrors.map((e) => <div key={e}>{e}</div>)} />
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: token.marginXS, marginTop: token.marginMD }}>
        <Button onClick={() => setDraft(null)}>Cancel</Button>
        <Button type="primary" icon={<SaveOutlined />} loading={createMutation.isPending || updateMutation.isPending} onClick={saveDraft}>
          Save
        </Button>
      </div>
    </div>
  );

  const groupCard = (s: FeeStructure) => {
    const isOpen = expanded.includes(s.id) || draft?.id === s.id;
    const toggle = () => setExpanded((keys) => (keys.includes(s.id) ? keys.filter((k) => k !== s.id) : [...keys, s.id]));
    const terms = structureTermTotals(s);
    const grid = toGrid(s);
    return (
      <Card
        key={s.id}
        size="small"
        style={{ marginBottom: token.marginSM }}
        styles={{ body: { padding: isOpen ? token.paddingMD : 0 } }}
        title={
          <Space wrap onClick={toggle} style={{ cursor: 'pointer' }} role="button" aria-expanded={isOpen}>
            {isOpen ? <DownOutlined /> : <RightOutlined />}
            <Text strong>{s.name}</Text>
            {s.mediumId ? <Tag color="purple">{mediumName(s.mediumId) ?? 'Medium'}</Tag> : <Tag icon={<GlobalOutlined />}>All mediums</Tag>}
            {!s.classId && <Tag color="blue">All classes</Tag>}
            {s.billedCount > 0 && <Tag>{s.billedCount} billed</Tag>}
            {s.status !== 'ACTIVE' && <Tag>Inactive</Tag>}
          </Space>
        }
        extra={
          <Space wrap>
            <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
              {terms.length > 1 ? terms.map((t, i) => `${TERM_LABELS[i]} ${formatAmount(t)}`).join(' · ') : ''}
            </Text>
            <Text strong>{formatAmount(s.amount)}</Text>
            {draft?.id !== s.id && (
              <Tooltip title="Edit fees">
                <Button size="small" icon={<EditOutlined />} aria-label={`Edit ${s.name}`} onClick={() => startEdit(s)} />
              </Tooltip>
            )}
            <Tooltip title="Copy to another class or medium">
              <Button
                size="small"
                icon={<CopyOutlined />}
                aria-label={`Copy ${s.name}`}
                onClick={() => setCopying({ structure: s, classId: s.classId ?? undefined, mediumId: s.mediumId ?? 'ALL' })}
              />
            </Tooltip>
            <Popconfirm
              title={`Delete "${s.name}"?`}
              description="Only possible while no student has been billed for it."
              okText="Delete"
              okButtonProps={{ danger: true }}
              onConfirm={() => deleteMutation.mutateAsync(s).catch(() => undefined)}
            >
              <Tooltip title="Delete">
                <Button size="small" danger icon={<DeleteOutlined />} aria-label={`Delete ${s.name}`} />
              </Tooltip>
            </Popconfirm>
          </Space>
        }
      >
        {isOpen &&
          (draft?.id === s.id ? (
            editor(draft)
          ) : (
            <>
              <FeeGridTable mode="view" rows={grid.rows} termCount={grid.termCount} termDates={grid.termDates} />
              <Text type="secondary" style={{ display: 'block', marginTop: token.marginXS, fontSize: token.fontSizeSM }}>
                {FREQUENCIES.find((f) => f.value === s.frequency)?.label ?? s.frequency}
                {s.lateFeeAmount ? ` · Fine ${formatAmount(s.lateFeeAmount)} after the due date` : ' · No fine'}
              </Text>
            </>
          ))}
      </Card>
    );
  };

  const copy = () => {
    if (!copying) return;
    const s = copying.structure;
    const schoolId = schoolsQuery.data?.[0]?.id;
    if (!schoolId) return;
    const targetClass = classesQuery.data?.find((c) => c.id === copying.classId);
    const targetMedium = mediumsQuery.data?.find((m) => m.id === copying.mediumId);
    createMutation.mutate({
      schoolId,
      classId: copying.classId,
      mediumId: copying.mediumId === 'ALL' ? null : copying.mediumId,
      academicYear: s.academicYear,
      name: [s.classId ? targetClass?.name ?? 'All classes' : s.name, targetMedium?.name, s.classId ? 'Fees' : null]
        .filter(Boolean)
        .join(' '),
      dueDate: s.dueDate,
      frequency: s.frequency,
      lateFeeAmount: s.lateFeeAmount ?? undefined,
      items: s.items.map((i) => ({
        category: i.category,
        label: i.label ?? undefined,
        feeTypeId: i.feeTypeId ?? undefined,
        amount: i.amount,
        dueDate: i.dueDate,
      })),
    });
  };

  const noMediums = mediumsQuery.isSuccess && mediumsQuery.data.filter((m) => m.active).length === 0;

  return (
    <div>
      <Card
        title={<Title level={4} style={{ margin: 0, fontWeight: 500 }}>Fees Master</Title>}
        extra={
          <Button icon={<GlobalOutlined />} onClick={() => setMediumsOpen(true)}>
            Mediums
          </Button>
        }
        style={{ marginBottom: token.marginLG }}
      >
        <Form layout="vertical">
          <Row gutter={token.marginMD}>
            <Col xs={24} md={8}>
              <Form.Item label="Class" htmlFor="fees-master-class" required>
                <Select
                  id="fees-master-class"
                  showSearch
                  optionFilterProp="label"
                  loading={classesQuery.isLoading}
                  value={classId}
                  onChange={(v) => {
                    setClassId(v);
                    setDraft(null);
                  }}
                  options={(classesQuery.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item label="Medium" htmlFor="fees-master-medium">
                <Select
                  id="fees-master-medium"
                  loading={mediumsQuery.isLoading}
                  value={mediumId}
                  onChange={(v) => {
                    setMediumId(v);
                    setDraft(null);
                  }}
                  options={[
                    { value: 'ALL', label: 'All mediums (same fees for every medium)' },
                    ...(mediumsQuery.data ?? []).filter((m) => m.active || m.id === mediumId).map((m) => ({ value: m.id, label: m.name })),
                  ]}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item label="Session" htmlFor="fees-master-session">
                <Input
                  id="fees-master-session"
                  value={academicYear}
                  maxLength={20}
                  placeholder="e.g. 2026-2027"
                  onChange={(e) => {
                    setAcademicYear(e.target.value);
                    setDraft(null);
                  }}
                />
              </Form.Item>
            </Col>
          </Row>
        </Form>
        {noMediums && (
          <Alert
            type="info"
            showIcon
            message="No mediums yet"
            description="Add mediums (for example CBSE, English Medium, Tamil Medium) to set different fees for each."
            action={<Button onClick={() => setMediumsOpen(true)}>Add mediums</Button>}
          />
        )}
      </Card>

      <Card
        title={
          <Space direction="vertical" size={0}>
            <Title level={4} style={{ margin: 0, fontWeight: 500 }}>
              {selectedClass ? `${selectedClass.name} fees` : 'Fees'}
              {mediumId === 'ALL' ? '' : ` — ${selectedMedium?.name ?? ''}`}
            </Title>
            <Text type="secondary" style={{ fontWeight: 400 }}>
              {mediumId === 'ALL'
                ? 'Fee groups charged to every medium (plus groups for all classes, such as Transport).'
                : `Fee groups for ${selectedMedium?.name ?? 'this medium'}, plus those charged to every medium.`}
            </Text>
          </Space>
        }
        extra={
          <Button type="primary" icon={<PlusOutlined />} disabled={!classId || Boolean(draft && !draft.id)} onClick={startNew}>
            Add Fees Group
          </Button>
        }
        style={{ marginBottom: token.marginLG }}
      >
        {draft && !draft.id && (
          <Card size="small" title={<Text strong>New fee group</Text>} style={{ marginBottom: token.marginMD, borderColor: token.colorPrimaryBorder }}>
            {editor(draft)}
          </Card>
        )}
        {structuresQuery.isError ? (
          <Alert type="error" showIcon message={serverMessage(structuresQuery.error) ?? "Couldn't load the fees."} />
        ) : structuresQuery.isLoading ? (
          <Skeleton active paragraph={{ rows: 4 }} />
        ) : groups.length === 0 && !draft ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={`No fees set for ${selectedClass?.name ?? 'this class'}${mediumId === 'ALL' ? '' : ` (${selectedMedium?.name ?? ''})`} in ${academicYear}`}
          >
            <Button type="primary" icon={<PlusOutlined />} onClick={startNew} disabled={!classId}>
              Add Fees Group
            </Button>
          </Empty>
        ) : (
          groups.map(groupCard)
        )}
      </Card>

      <Card title={<Title level={4} style={{ margin: 0, fontWeight: 500 }}>Assign fees to existing students</Title>}>
        <GenerateInvoiceForm feeStructures={structuresQuery.data ?? []} feeStructuresLoading={structuresQuery.isLoading} />
      </Card>

      <MediumsModal open={mediumsOpen} onClose={() => setMediumsOpen(false)} />

      <Modal
        title="Students are already billed for these fees"
        open={savePrompt !== null}
        onCancel={() => setSavePrompt(null)}
        onOk={() => savePrompt && updateMutation.mutate(savePrompt)}
        okText="Save"
        confirmLoading={updateMutation.isPending}
        destroyOnHidden
      >
        {savePrompt && (
          <>
            <p>
              {savePrompt.billed} student{savePrompt.billed === 1 ? ' has' : 's have'} already been billed for this fee group. How should
              the change apply?
            </p>
            <Radio.Group
              value={savePrompt.applyToExisting}
              onChange={(e) => setSavePrompt({ ...savePrompt, applyToExisting: e.target.value })}
              style={{ display: 'flex', flexDirection: 'column', gap: token.marginXS }}
              options={[
                { value: false, label: 'Only new admissions and new bills (recommended)' },
                { value: true, label: 'Also update the unpaid bills already raised' },
              ]}
            />
            {savePrompt.applyToExisting && (
              <Alert
                type="warning"
                showIcon
                style={{ marginTop: token.marginSM }}
                message="Each unpaid bill changes by the same difference. Every change is recorded as an adjustment in the audit log; fully paid bills are not touched."
              />
            )}
          </>
        )}
      </Modal>

      <Modal
        title={copying ? `Copy "${copying.structure.name}"` : 'Copy'}
        open={copying !== null}
        onCancel={() => setCopying(null)}
        onOk={copy}
        okText="Copy"
        confirmLoading={createMutation.isPending}
        destroyOnHidden
      >
        {copying && (
          <Form layout="vertical">
            <Text type="secondary" style={{ display: 'block', marginBottom: token.marginSM }}>
              Creates an editable copy with the same fees and due dates for another class or medium.
            </Text>
            <Form.Item label="To class" htmlFor="copy-class">
              <Select
                id="copy-class"
                allowClear
                placeholder="All classes"
                value={copying.classId}
                onChange={(v) => setCopying({ ...copying, classId: v })}
                options={(classesQuery.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
              />
            </Form.Item>
            <Form.Item label="To medium" htmlFor="copy-medium">
              <Select
                id="copy-medium"
                value={copying.mediumId}
                onChange={(v) => setCopying({ ...copying, mediumId: v })}
                options={[
                  { value: 'ALL', label: 'All mediums' },
                  ...(mediumsQuery.data ?? []).filter((m) => m.active).map((m) => ({ value: m.id, label: m.name })),
                ]}
              />
            </Form.Item>
          </Form>
        )}
      </Modal>
    </div>
  );
}

export default FeesMasterPage;
