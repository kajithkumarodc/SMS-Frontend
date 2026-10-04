import type { CollectionReceipt, FeeLine } from '../../../api/fees';
import { METHOD_LABEL } from '../../../api/fees';
import { formatDisplayDate } from '../../../lib/dates';
import { formatAmount } from '../format';
import { termLabel } from './feeLabels';

function esc(value: string | number | null | undefined): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const STYLE = `
  body { font-family: Arial, sans-serif; color: #222; margin: 24px; }
  h1 { font-size: 20px; margin: 0; text-align: center; }
  h2 { font-size: 15px; margin: 4px 0 16px; text-align: center; font-weight: normal; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 13px; }
  th, td { border: 1px solid #999; padding: 6px 8px; text-align: left; }
  th { background: #f0f0f0; }
  td.num, th.num { text-align: right; }
  .meta { width: 100%; font-size: 13px; }
  .meta td { border: none; padding: 3px 0; }
  .total td { font-weight: bold; background: #f7f7f7; }
  .reversed { color: #c00; font-weight: bold; text-align: center; margin-top: 8px; }
  .sign { margin-top: 48px; display: flex; justify-content: space-between; font-size: 13px; }
`;

function openAndPrint(title: string, body: string) {
  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) return false;
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>${STYLE}</style></head><body>${body}</body></html>`);
  win.document.close();
  win.focus();
  win.setTimeout(() => win.print(), 250);
  return true;
}

/** Prints the receipt of one "Collect Fees". Returns false if the browser blocked the print window. */
export function printCollectionReceipt(r: CollectionReceipt): boolean {
  const classText = r.className ? (r.sectionName ? `${r.className} (${r.sectionName})` : r.className) : '';
  const rows = r.lines
    .map(
      (l, i) => `<tr><td>${i + 1}</td><td>${esc(l.label)}<br><small>${esc(l.feeGroup)} · ${esc(termLabel(l.term))}</small></td>
        <td>${esc(formatDisplayDate(l.dueDate))}</td><td class="num">${esc(formatAmount(l.amount))}</td>
        <td class="num">${esc(formatAmount(l.fine))}</td><td class="num">${esc(formatAmount(l.amount + l.fine))}</td>
        <td class="num">${l.balanceAfter == null ? '' : esc(formatAmount(l.balanceAfter))}</td></tr>`,
    )
    .join('');
  return openAndPrint(
    `Fee Receipt ${r.receiptNumbers.join(', ')}`,
    `<h1>${esc(r.schoolName ?? '')}</h1><h2>Fee Receipt</h2>
    <table class="meta"><tr><td><b>Receipt No:</b> ${esc(r.receiptNumbers.join(', '))}</td><td><b>Date:</b> ${esc(formatDisplayDate(r.paymentDate))}</td></tr>
    <tr><td><b>Student:</b> ${esc(r.studentName)}</td><td><b>Admission No:</b> ${esc(r.admissionNumber)}</td></tr>
    <tr><td><b>Class:</b> ${esc(classText)}</td><td><b>Father Name:</b> ${esc(r.fatherName ?? '')}</td></tr>
    <tr><td><b>Payment Mode:</b> ${esc(METHOD_LABEL[r.method] ?? r.method)}${r.referenceNumber ? ` (Ref: ${esc(r.referenceNumber)})` : ''}</td><td><b>Collected By:</b> ${esc(r.collectedBy ?? '')}</td></tr></table>
    <table><thead><tr><th>#</th><th>Fees</th><th>Due Date</th><th class="num">Amount</th><th class="num">Fine</th><th class="num">Paid</th><th class="num">Balance</th></tr></thead>
    <tbody>${rows}<tr class="total"><td></td><td>Total</td><td></td><td class="num">${esc(formatAmount(r.totalAmount))}</td>
    <td class="num">${esc(formatAmount(r.totalFine))}</td><td class="num">${esc(formatAmount(r.total))}</td><td></td></tr></tbody></table>
    ${r.notes ? `<p><b>Note:</b> ${esc(r.notes)}</p>` : ''}
    ${r.reversed ? '<p class="reversed">THIS PAYMENT HAS BEEN REVERTED</p>' : ''}
    <div class="sign"><span>Parent / Guardian</span><span>Cashier</span></div>`,
  );
}

type StatementHeader = { schoolName?: string | null; studentName: string; admissionNumber: string; classText: string; session?: string };

/** Prints a fee statement of the given lines (Print Selected / a single line). */
export function printFeeStatement(header: StatementHeader, lines: FeeLine[]): boolean {
  const rows = lines
    .map(
      (l, i) => `<tr><td>${i + 1}</td><td>${esc(l.label)}<br><small>${esc(l.feeGroup)} · ${esc(termLabel(l.term))}</small></td>
        <td>${esc(formatDisplayDate(l.dueDate))}</td><td>${esc(l.status === 'PAID' ? 'Paid' : l.status === 'PARTIAL' ? 'Partial' : 'Unpaid')}</td>
        <td class="num">${esc(formatAmount(l.amount))}</td><td class="num">${esc(formatAmount(l.discount))}</td>
        <td class="num">${esc(formatAmount(l.fine))}</td><td class="num">${esc(formatAmount(l.paid))}</td>
        <td class="num">${esc(formatAmount(l.balance))}</td></tr>`,
    )
    .join('');
  const sum = (f: (l: FeeLine) => number) => lines.reduce((s, l) => s + f(l), 0);
  return openAndPrint(
    `Fee Statement ${header.admissionNumber}`,
    `<h1>${esc(header.schoolName ?? '')}</h1><h2>Fee Statement${header.session ? ` · Session ${esc(header.session)}` : ''}</h2>
    <table class="meta"><tr><td><b>Student:</b> ${esc(header.studentName)}</td><td><b>Admission No:</b> ${esc(header.admissionNumber)}</td></tr>
    <tr><td><b>Class:</b> ${esc(header.classText)}</td><td><b>Date:</b> ${esc(formatDisplayDate(new Date().toISOString().slice(0, 10)))}</td></tr></table>
    <table><thead><tr><th>#</th><th>Fees</th><th>Due Date</th><th>Status</th><th class="num">Amount</th><th class="num">Discount</th>
    <th class="num">Fine</th><th class="num">Paid</th><th class="num">Balance</th></tr></thead>
    <tbody>${rows}<tr class="total"><td></td><td>Total</td><td></td><td></td><td class="num">${esc(formatAmount(sum((l) => l.amount)))}</td>
    <td class="num">${esc(formatAmount(sum((l) => l.discount)))}</td><td class="num">${esc(formatAmount(sum((l) => l.fine)))}</td>
    <td class="num">${esc(formatAmount(sum((l) => l.paid)))}</td><td class="num">${esc(formatAmount(sum((l) => l.balance)))}</td></tr></tbody></table>`,
  );
}
