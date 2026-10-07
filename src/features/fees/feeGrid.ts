import dayjs from 'dayjs';
import type { FeeStructure, LineItemInput } from '../../api/fees';

/** Up to four terms; Smart School-style fee sheets use three (Term I, II, III). */
export const MAX_TERMS = 4;
export const TERM_LABELS = ['Term I', 'Term II', 'Term III', 'Term IV'];

/** One fee type across the terms, e.g. Tuition Fee 11,785 / 5,893 / 5,892. */
export type GridRow = { key: string; feeTypeId?: string; label: string; amounts: (number | null)[] };

export type GridDraft = {
  id?: string;
  name: string;
  termCount: number;
  termDates: string[];
  frequency: string;
  lateFeeAmount: number | null;
  rows: GridRow[];
};

let rowCounter = 0;
export function newRow(partial?: Partial<GridRow>): GridRow {
  return { key: `row-${(rowCounter += 1)}`, label: '', amounts: [null, null, null, null], ...partial };
}

/** Which term an item belongs to: TERM_1..TERM_4; anything else (one-time lines) counts as Term I. */
export function termIndex(category: string): number {
  const match = /^TERM_(\d)$/.exec(category);
  return match ? Math.min(Number(match[1]) - 1, MAX_TERMS - 1) : 0;
}

/** Group a structure's items into fee-type rows with one amount per term. */
export function toGrid(structure: FeeStructure): { rows: GridRow[]; termCount: number; termDates: string[] } {
  const rows: GridRow[] = [];
  const termDates: string[] = ['', '', '', ''];
  let termCount = 1;
  for (const item of structure.items) {
    const t = termIndex(item.category);
    termCount = Math.max(termCount, t + 1);
    if (!termDates[t]) termDates[t] = item.dueDate ?? structure.dueDate;
    const label = item.label || item.feeTypeName || structure.name;
    let row = rows.find((r) => r.label === label && (r.feeTypeId ?? null) === (item.feeTypeId ?? null) && r.amounts[t] === null);
    if (!row) {
      row = newRow({ feeTypeId: item.feeTypeId ?? undefined, label });
      rows.push(row);
    }
    row.amounts[t] = item.amount;
  }
  if (!termDates[0]) termDates[0] = structure.dueDate;
  return { rows, termCount, termDates };
}

export function rowTotal(row: GridRow, termCount: number): number {
  return row.amounts.slice(0, termCount).reduce<number>((sum, a) => sum + (a ?? 0), 0);
}

export function termTotal(rows: GridRow[], t: number): number {
  return rows.reduce((sum, r) => sum + (r.amounts[t] ?? 0), 0);
}

/** Default term due dates for a session like "2025-2026": June, October and January. */
export function defaultTermDates(academicYear: string): string[] {
  const start = Number.parseInt(academicYear, 10) || dayjs().year();
  return [`${start}-06-10`, `${start}-10-10`, `${start + 1}-01-10`, `${start + 1}-03-10`];
}

/** The API's fee lines for a grid: one line per fee type per term with an amount. */
export function toItems(draft: GridDraft, feeTypeName: (id?: string) => string | undefined): LineItemInput[] {
  const items: LineItemInput[] = [];
  for (let t = 0; t < draft.termCount; t += 1) {
    for (const row of draft.rows) {
      const amount = row.amounts[t];
      if (amount && amount > 0) {
        items.push({
          category: `TERM_${t + 1}`,
          label: row.label.trim() || feeTypeName(row.feeTypeId) || undefined,
          feeTypeId: row.feeTypeId,
          amount,
          dueDate: draft.termDates[t],
        });
      }
    }
  }
  return items;
}

/** Per-term totals of a saved structure (for summaries such as "Term I 15,085 · Term II 7,143"). */
export function structureTermTotals(structure: FeeStructure): number[] {
  const totals = [0, 0, 0, 0];
  for (const item of structure.items) totals[termIndex(item.category)] += item.amount;
  const used = Math.max(1, ...structure.items.map((i) => termIndex(i.category) + 1));
  return totals.slice(0, used);
}
