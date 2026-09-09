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

/**
 * The safe slice of a Razorpay Order the browser Checkout widget needs — never
 * any raw payment data. Mirrors the backend's `FeeDtos.CheckoutResponse`.
 */
export type CheckoutResponse = {
  invoiceId: string;
  razorpayOrderId: string;
  razorpayKeyId: string;
  amountInPaise: number;
  currency: string;
};

/**
 * Start a payment: creates a Razorpay Order for the invoice server-side.
 * A SCHOOL_ADMIN may check out any invoice in the tenant; a PARENT only their
 * own child's. 409 if the invoice is already paid.
 */
export async function startInvoiceCheckout(invoiceId: string): Promise<CheckoutResponse> {
  const { data } = await api.post<CheckoutResponse>(`/v1/invoices/${invoiceId}/checkout`);
  return data;
}

/**
 * ⚠️ DEV-ONLY. Flips the invoice to PAID by calling the backend's dev-tools
 * endpoint, which stands in for the real Razorpay webhook during local demos
 * (the webhook needs a public URL Razorpay can reach — not available locally).
 *
 * In a deployed environment payment confirmation comes ONLY from the
 * signature-verified webhook (`POST /api/v1/webhooks/razorpay`); the backend
 * endpoint this calls is gated by `app.dev-tools-enabled` and returns 404 when
 * off, so this call simply fails and the invoice stays PENDING until the real
 * webhook arrives. Remove this call (and the dev endpoint) before real launch.
 */
export async function simulateInvoicePayment(invoiceId: string): Promise<Invoice> {
  const { data } = await api.post<Invoice>(`/v1/dev/invoices/${invoiceId}/simulate-payment-success`);
  return data;
}
