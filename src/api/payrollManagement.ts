import api from '../lib/api';
import type { LookupOption } from './staffMembers';

export type PayrollRunStatus = 'NOT_GENERATED' | 'GENERATED' | 'PAID';

export type PaymentMode = 'CASH' | 'CHEQUE' | 'BANK_TRANSFER';

/** The Payment Mode choices on Proceed To Pay (`PayrollPaymentMode` on the backend). */
export const PAYMENT_MODES: { value: PaymentMode; label: string }[] = [
  { value: 'CASH', label: 'Cash' },
  { value: 'CHEQUE', label: 'Cheque' },
  { value: 'BANK_TRANSFER', label: 'Transfer to Bank Account' },
];

/** One staff member in the Staff List with their payroll state (`PayrollManagementDtos.PayrollRow`). */
export type PayrollRow = {
  staffProfileId: string;
  staffId: string;
  fullName: string;
  roleName: string | null;
  departmentName: string | null;
  designationName: string | null;
  phone: string | null;
  status: PayrollRunStatus;
  payrollId: string | null;
  netSalary: number | null;
};

export type PayrollLine = { type: string; amount: number };

export type PayrollStaff = {
  staffProfileId: string;
  staffId: string;
  fullName: string;
  phone: string | null;
  email: string;
  epfNo: string | null;
  roleName: string | null;
  departmentName: string | null;
  designationName: string | null;
  hasPhoto: boolean;
  photoVersion: string;
};

/** P present, L late, A absent, F half day, H holiday, SH second half, V approved leave. */
export type PayrollAttendanceMonth = {
  month: number;
  year: number;
  present: number;
  late: number;
  absent: number;
  halfDay: number;
  holiday: number;
  halfDaySecondHalf: number;
  leave: number;
  /** Finished days with no attendance mark (taken as leave) -- not counting Sundays or approved leave. */
  unmarked: number;
};

export type PayrollPayment = {
  mode: PaymentMode;
  modeLabel: string;
  date: string;
  note: string | null;
  paidAt: string;
};

/**
 * What the month's attendance is worth (`PayrollManagementDtos.AttendancePay`). Present days (half days count half)
 * are paid; leave days are unpaid: absent days, unmarked days (no attendance mark, taken as leave) and half of each
 * half day. Approved leave, holidays, Sundays with no mark and days not yet finished are paid.
 */
export type AttendancePay = {
  daysInMonth: number;
  /** Full days present plus half of each half day. */
  presentDays: number;
  /** Unpaid leave days: absent + unmarked + half of each half day. */
  leaveDays: number;
  absentDays: number;
  /** Finished days with no attendance mark, taken as leave. */
  unmarkedDays: number;
  /** Half days of both kinds. */
  halfDays: number;
  /** Days marked Holiday, plus Sundays with no mark. */
  holidayDays: number;
  /** Unmarked days covered by approved leave. */
  paidLeaveDays: number;
  /** Days of the month that are today or later. */
  upcomingDays: number;
  payableDays: number;
  perDayRate: number;
  /** Basic salary for the payable days: perDayRate x payableDays. */
  earnedSalary: number;
  lossOfPay: number;
  /** The deduction line name, e.g. `Loss of pay (2 days)`. */
  deductionType: string;
};

/** A payroll with everything the Edit Payroll page and the payslip show (`PayrollDetail`). */
export type PayrollDetail = {
  id: string;
  month: number;
  year: number;
  status: Exclude<PayrollRunStatus, 'NOT_GENERATED'>;
  staff: PayrollStaff;
  attendance: PayrollAttendanceMonth[];
  basicSalary: number;
  earnings: PayrollLine[];
  deductions: PayrollLine[];
  earningTotal: number;
  deductionTotal: number;
  grossSalary: number;
  tax: number;
  netSalary: number;
  payment: PayrollPayment | null;
  schoolName: string | null;
  attendancePay: AttendancePay;
};

export type PayrollUpdateInput = {
  earnings: PayrollLine[];
  deductions: PayrollLine[];
  tax: number;
};

export type PayInput = {
  paymentMode: PaymentMode;
  paymentDate: string;
  note: string | null;
};

export async function fetchPayrollRoles(): Promise<LookupOption[]> {
  const { data } = await api.get<LookupOption[]>('/v1/payroll/roles');
  return data;
}

export async function fetchPayrollRows(roleId: string, month: number, year: number): Promise<PayrollRow[]> {
  const { data } = await api.get<PayrollRow[]>('/v1/payroll', { params: { roleId, month, year } });
  return data;
}

export async function generateStaffPayroll(staffProfileId: string, month: number, year: number): Promise<PayrollDetail> {
  const { data } = await api.post<PayrollDetail>('/v1/payroll/generate', { staffProfileId, month, year });
  return data;
}

export async function fetchPayroll(id: string): Promise<PayrollDetail> {
  const { data } = await api.get<PayrollDetail>(`/v1/payroll/${id}`);
  return data;
}

export async function updatePayroll(id: string, input: PayrollUpdateInput): Promise<PayrollDetail> {
  const { data } = await api.put<PayrollDetail>(`/v1/payroll/${id}`, input);
  return data;
}

export async function payPayroll(id: string, input: PayInput): Promise<PayrollDetail> {
  const { data } = await api.post<PayrollDetail>(`/v1/payroll/${id}/pay`, input);
  return data;
}

export async function revertPayroll(id: string): Promise<void> {
  await api.post(`/v1/payroll/${id}/revert`);
}
