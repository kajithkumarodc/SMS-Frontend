import { Button, DatePicker, Input, InputNumber, Select, Space, Table, Tooltip, Typography, theme } from 'antd';
import { MinusCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { FeeType } from '../../api/fees';
import { API_DATE_FORMAT, DISPLAY_DATE_FORMAT, formatDisplayDate } from '../../lib/dates';
import { formatAmount } from './format';
import { rowTotal, TERM_LABELS, termTotal, type GridRow } from './feeGrid';

const { Text } = Typography;

type Props = {
  rows: GridRow[];
  termCount: number;
  termDates: string[];
  /** view = read only; amounts = only the amounts can change (admission adjustments); full = Fees Master editing. */
  mode: 'view' | 'amounts' | 'full';
  onRowsChange?: (rows: GridRow[]) => void;
  onTermDatesChange?: (dates: string[]) => void;
  feeTypes?: FeeType[];
  /** Amounts to compare against (admission): changed cells are highlighted. */
  original?: GridRow[];
  size?: 'small' | 'middle';
};

type TableRow = GridRow & { isTotal?: boolean };

/**
 * A fee sheet like a school's printed fee structure: one row per fee type, a column per term, row totals and a
 * TOTAL row. The same table shows, adjusts (admission) and edits (Fees Master) a fee group.
 */
function FeeGridTable({ rows, termCount, termDates, mode, onRowsChange, onTermDatesChange, feeTypes = [], original, size = 'small' }: Props) {
  const { token } = theme.useToken();
  const setRow = (key: string, patch: Partial<GridRow>) => onRowsChange?.(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const setAmount = (row: GridRow, t: number, value: number | null) => {
    const amounts = [...row.amounts];
    amounts[t] = value;
    setRow(row.key, { amounts });
  };
  const originalAmount = (row: GridRow, t: number) => original?.find((o) => o.key === row.key)?.amounts[t] ?? null;

  const terms = Array.from({ length: termCount }, (_, t) => t);
  const grand = terms.reduce((sum, t) => sum + termTotal(rows, t), 0);
  const data: TableRow[] = [...rows, { key: '__total', label: 'TOTAL', amounts: terms.map((t) => termTotal(rows, t)), isTotal: true }];

  const totalCell = (value: number) => <Text strong>{value ? formatAmount(value) : '-'}</Text>;

  return (
    <>
    <style>{`.fee-grid-total-row > td { background: ${token.colorFillTertiary} !important; }`}</style>
    <Table<TableRow>
      rowKey="key"
      size={size}
      bordered
      pagination={false}
      dataSource={data}
      scroll={{ x: 'max-content' }}
      rowClassName={(r) => (r.isTotal ? 'fee-grid-total-row' : '')}
      columns={[
        {
          key: 'n',
          title: 'S. No',
          width: 60,
          align: 'center',
          render: (_v, r, i) => (r.isTotal ? '' : i + 1),
        },
        {
          key: 'name',
          title: 'Nature Of Fee',
          render: (_v, r) =>
            r.isTotal ? (
              <Text strong>TOTAL</Text>
            ) : mode === 'full' ? (
              <Space.Compact style={{ minWidth: 330 }}>
                <Select
                  aria-label="Fees type"
                  style={{ width: 160 }}
                  placeholder="Fees type"
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  value={r.feeTypeId}
                  options={feeTypes.filter((ft) => ft.active || ft.id === r.feeTypeId).map((ft) => ({ value: ft.id, label: ft.name }))}
                  onChange={(v) => {
                    const typeName = feeTypes.find((ft) => ft.id === v)?.name;
                    const previousTypeName = feeTypes.find((ft) => ft.id === r.feeTypeId)?.name;
                    setRow(r.key, { feeTypeId: v, label: !r.label || r.label === previousTypeName ? typeName ?? '' : r.label });
                  }}
                />
                <Input
                  aria-label="Fee name"
                  style={{ width: 170 }}
                  placeholder="Name on the bill"
                  maxLength={150}
                  value={r.label}
                  onChange={(e) => setRow(r.key, { label: e.target.value })}
                />
              </Space.Compact>
            ) : (
              r.label
            ),
        },
        {
          key: 'total',
          title: 'Total',
          align: 'right',
          width: 110,
          onCell: () => ({ style: { background: token.colorFillQuaternary } }),
          render: (_v, r) => totalCell(r.isTotal ? grand : rowTotal(r, termCount)),
        },
        ...terms.map((t) => ({
          key: `t${t}`,
          align: 'right' as const,
          width: mode === 'view' ? 110 : 140,
          title: (
            <div style={{ textAlign: 'right' }}>
              <div>{TERM_LABELS[t]}</div>
              {mode === 'full' ? (
                <DatePicker
                  aria-label={`${TERM_LABELS[t]} due date`}
                  size="small"
                  format={DISPLAY_DATE_FORMAT}
                  style={{ width: 125, marginTop: 4 }}
                  allowClear={false}
                  value={termDates[t] ? dayjs(termDates[t]) : null}
                  onChange={(d) => {
                    const next = [...termDates];
                    next[t] = d ? d.format(API_DATE_FORMAT) : '';
                    onTermDatesChange?.(next);
                  }}
                />
              ) : (
                <Text type="secondary" style={{ fontSize: token.fontSizeSM, fontWeight: 400 }}>
                  {termDates[t] ? `Due ${formatDisplayDate(termDates[t])}` : ''}
                </Text>
              )}
            </div>
          ),
          render: (_v: unknown, r: TableRow) => {
            if (r.isTotal) return totalCell(r.amounts[t] ?? 0);
            if (mode === 'view') return r.amounts[t] ? formatAmount(r.amounts[t] as number) : '-';
            const changed = original && (originalAmount(r, t) ?? 0) !== (r.amounts[t] ?? 0);
            return (
              <InputNumber
                aria-label={`${r.label || 'Fee'} ${TERM_LABELS[t]}`}
                min={0}
                step={100}
                precision={2}
                controls={false}
                style={{ width: 115, background: changed ? token.colorWarningBg : undefined }}
                value={r.amounts[t]}
                placeholder="-"
                onChange={(v) => setAmount(r, t, v)}
              />
            );
          },
        })),
        ...(mode === 'full'
          ? [
              {
                key: 'remove',
                width: 44,
                render: (_v: unknown, r: TableRow) =>
                  r.isTotal ? null : (
                    <Tooltip title="Remove this fee">
                      <Button
                        type="text"
                        danger
                        icon={<MinusCircleOutlined />}
                        aria-label={`Remove ${r.label || 'row'}`}
                        onClick={() => onRowsChange?.(rows.filter((x) => x.key !== r.key))}
                      />
                    </Tooltip>
                  ),
              },
            ]
          : []),
      ]}
    />
    </>
  );
}

export default FeeGridTable;
