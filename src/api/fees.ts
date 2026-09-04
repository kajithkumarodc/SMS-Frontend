import api from '../lib/api';

/** Invoice lifecycle, mirroring the backend's `com.smsapp.fee.InvoiceStatus`. */
export type InvoiceStatus = 'PENDING' | 'PAID' | 'FAILED';

export type FeeStructure = {
  id: string;
  schoolId: string;
  name: string;
  amount: number;
  dueDate: string; // YYYY-MM-DD
  createdAt: string;
};

export type Invoice = {
  id: string;
  studentId: string;
  feeStructureId: string;
  amount: number;
  status: InvoiceStatus;
  razorpayOrderId: string | null;
  razorpayPaymentId: string | null;
  createdAt: string;
  paidAt: string | null;
};

/** All fee structures for the caller's tenant, most recent first. */
export async function fetchFeeStructures(): Promise<FeeStructure[]> {
  const { data } = await api.get<FeeStructure[]>('/v1/fee-structures');
  return data;
}

export type CreateFeeStructureInput = {
  schoolId: string;
  name: string;
  amount: number;
  dueDate: string; // YYYY-MM-DD
};

export async function createFeeStructure(input: CreateFeeStructureInput): Promise<FeeStructure> {
  const { data } = await api.post<FeeStructure>('/v1/fee-structures', input);
  return data;
}

/** Invoices for one student. 404 if the student is not in the caller's tenant. */
export async function fetchStudentInvoices(studentId: string): Promise<Invoice[]> {
  const { data } = await api.get<Invoice[]>('/v1/invoices', { params: { studentId } });
  return data;
}

export type CreateInvoiceInput = {
  studentId: string;
  feeStructureId: string;
};

/** Generate a PENDING invoice for a student against a fee structure. */
export async function createInvoice(input: CreateInvoiceInput): Promise<Invoice> {
  const { data } = await api.post<Invoice>('/v1/invoices', input);
  return data;
}
