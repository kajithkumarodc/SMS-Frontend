import { AxiosError } from 'axios';
import api from '../lib/api';

export type PayrollStatus = 'PENDING' | 'PAID';

/** One staff member's payroll record for one month/year. Mirrors `PayrollDtos.PayrollRecordResponse`. */
export type PayrollRecord = {
  id: string;
  staffUserId: string;
  month: number; // 1-12
  year: number;
  baseSalary: number;
  deductions: number;
  netPay: number;
  status: PayrollStatus;
  createdAt: string;
  paidAt: string | null;
};

export type GeneratePayrollInput = {
  staffUserId: string;
  month: number;
  year: number;
  deductions: number;
};

/**
 * Thrown when a payroll record already exists for that staff member + month + year
 * (backend 409). `message` is safe to show inline.
 */
export class DuplicatePayrollRecordError extends Error {
  constructor() {
    super('A payroll record for this staff member and month already exists');
    this.name = 'DuplicatePayrollRecordError';
  }
}

/** Generate a payroll record. SCHOOL_ADMIN only. `netPay = baseSalary - deductions`, baseSalary from the staff profile. */
export async function generatePayroll(input: GeneratePayrollInput): Promise<PayrollRecord> {
  try {
    const { data } = await api.post<PayrollRecord>('/v1/payroll', input);
    return data;
  } catch (error) {
    if ((error as AxiosError).response?.status === 409) throw new DuplicatePayrollRecordError();
    throw error;
  }
}

/** SCHOOL_ADMIN or TEACHER: the caller's own payroll history (empty if none, never a 404). */
export async function fetchOwnPayroll(): Promise<PayrollRecord[]> {
  const { data } = await api.get<PayrollRecord[]>('/v1/me/payroll');
  return data;
}
