import type { InvoiceStatus } from '../../api/fees';

/**
 * Ant Design semantic Tag colors — resolved from the active theme, not hardcoded
 * hex. PENDING reads as "action needed" (amber), PARTIALLY_PAID as in-progress
 * (blue), PAID as done (green), FAILED as a problem (red).
 */
export const INVOICE_STATUS_TAG_COLOR: Record<InvoiceStatus, string> = {
  PENDING: 'warning',
  PARTIALLY_PAID: 'processing',
  PAID: 'success',
  FAILED: 'error',
};

export function invoiceStatusLabel(status: InvoiceStatus): string {
  return status.charAt(0) + status.slice(1).toLowerCase();
}
