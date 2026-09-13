import type { LeaveRequestStatus, StaffProfileStatus } from '../../api/staff';
import type { PayrollStatus } from '../../api/payroll';

/**
 * Ant Design semantic Tag colors — resolved from the active theme, not hardcoded
 * hex. PENDING reads as "action needed" (amber), APPROVED/PAID as done (green),
 * REJECTED as a problem (red).
 */
export const LEAVE_STATUS_TAG_COLOR: Record<LeaveRequestStatus, string> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'error',
};

export const STAFF_STATUS_TAG_COLOR: Record<StaffProfileStatus, string> = {
  ACTIVE: 'success',
  INACTIVE: 'default',
};

export const PAYROLL_STATUS_TAG_COLOR: Record<PayrollStatus, string> = {
  PENDING: 'warning',
  PAID: 'success',
};

export function statusLabel(status: string): string {
  return status.charAt(0) + status.slice(1).toLowerCase();
}
