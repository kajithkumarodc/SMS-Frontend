/**
 * Copy / CSV / Excel / PDF / Print for list pages. Callers pass the rows to export (usually every
 * row matching the current filters, not just the visible page) and the columns currently shown.
 * The Excel and PDF libraries are loaded only when those buttons are used.
 */

export type ExportColumn<T> = {
  title: string;
  value: (row: T) => string | number | null | undefined;
};

export type ExportKind = 'copy' | 'excel' | 'csv' | 'pdf' | 'print';

function cells<T>(rows: T[], columns: ExportColumn<T>[]): string[][] {
  return rows.map((row) => columns.map((column) => String(column.value(row) ?? '')));
}

function download(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);
}

/** Tab-separated with a header row, so it pastes straight into a spreadsheet. */
export async function copyRows<T>(rows: T[], columns: ExportColumn<T>[]): Promise<void> {
  const clean = (v: string) => v.replace(/[\t\r\n]+/g, ' ');
  const lines = [columns.map((c) => clean(c.title)), ...cells(rows, columns).map((r) => r.map(clean))];
  await navigator.clipboard.writeText(lines.map((line) => line.join('\t')).join('\n'));
}

export function downloadCsv<T>(rows: T[], columns: ExportColumn<T>[], fileBaseName: string): void {
  const quote = (v: string) => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const lines = [columns.map((c) => quote(c.title)), ...cells(rows, columns).map((r) => r.map(quote))];
  // BOM so Excel opens UTF-8 names correctly.
  download(new Blob(['﻿' + lines.map((l) => l.join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }), `${fileBaseName}.csv`);
}

export async function downloadExcel<T>(
  rows: T[],
  columns: ExportColumn<T>[],
  fileBaseName: string,
  sheetTitle: string,
): Promise<void> {
  const { Workbook } = await import('exceljs');
  const workbook = new Workbook();
  const sheet = workbook.addWorksheet(sheetTitle.slice(0, 31));
  sheet.addRow(columns.map((c) => c.title)).font = { bold: true };
  cells(rows, columns).forEach((r) => sheet.addRow(r));
  sheet.columns.forEach((column, i) => {
    const longest = Math.max(columns[i].title.length, ...cells(rows, [columns[i]]).map((r) => r[0].length));
    column.width = Math.min(Math.max(longest + 2, 10), 50);
  });
  const buffer = await workbook.xlsx.writeBuffer();
  download(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `${fileBaseName}.xlsx`,
  );
}

export async function downloadPdf<T>(
  rows: T[],
  columns: ExportColumn<T>[],
  fileBaseName: string,
  title: string,
): Promise<void> {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ orientation: columns.length > 5 ? 'landscape' : 'portrait' });
  doc.setFontSize(14);
  doc.text(title, 14, 16);
  autoTable(doc, {
    startY: 22,
    head: [columns.map((c) => c.title)],
    body: cells(rows, columns),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [99, 91, 255] },
  });
  doc.save(`${fileBaseName}.pdf`);
}

/** Prints through a hidden iframe so the app page itself is untouched. */
export function printRows<T>(rows: T[], columns: ExportColumn<T>[], title: string): void {
  const head = columns.map((c) => `<th>${escapeHtml(c.title)}</th>`).join('');
  const body = cells(rows, columns)
    .map((r) => `<tr>${r.map((v) => `<td>${escapeHtml(v)}</td>`).join('')}</tr>`)
    .join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 24px; color: #111; }
  h1 { font-size: 18px; margin: 0 0 12px; }
  table { border-collapse: collapse; width: 100%; font-size: 12px; }
  th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
  th { background: #f3f3f3; }
</style></head><body><h1>${escapeHtml(title)}</h1><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></body></html>`;

  const frame = document.createElement('iframe');
  frame.style.position = 'fixed';
  frame.style.width = '0';
  frame.style.height = '0';
  frame.style.border = '0';
  document.body.appendChild(frame);
  const doc = frame.contentDocument!;
  doc.open();
  doc.write(html);
  doc.close();
  frame.contentWindow!.focus();
  frame.contentWindow!.print();
  setTimeout(() => frame.remove(), 1000);
}
