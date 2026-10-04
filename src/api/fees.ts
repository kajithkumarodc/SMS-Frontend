import api from '../lib/api';

/** Invoice lifecycle, mirroring the backend's `com.smsapp.fee.InvoiceStatus`. */
export type InvoiceStatus = 'PENDING' | 'PARTIALLY_PAID' | 'PAID' | 'FAILED';

export type FeeFrequency = 'ONE_TIME' | 'MONTHLY' | 'QUARTERLY' | 'HALF_YEARLY' | 'ANNUAL';

export type PaymentMethod = 'CASH' | 'CHEQUE' | 'DD' | 'BANK_TRANSFER' | 'UPI' | 'CARD' | 'ONLINE' | 'OTHER';
/** Methods selectable when manually collecting a payment — excludes ONLINE (Razorpay-only). */
export const MANUAL_PAYMENT_METHODS: PaymentMethod[] = ['CASH', 'BANK_TRANSFER', 'CHEQUE', 'OTHER'];

// --- Fee types (configurable catalog) ---------------------------------

export type FeeType = {
  id: string;
  name: string;
  active: boolean;
};

export async function fetchFeeTypes(includeInactive = false): Promise<FeeType[]> {
  const { data } = await api.get<FeeType[]>('/v1/fee-types', { params: includeInactive ? { includeInactive } : undefined });
  return data;
}

/** Rename and/or (de)activate a fee type. Types are never deleted: old fee lines keep their name. */
export async function updateFeeType(id: string, input: { name: string; active?: boolean }): Promise<FeeType> {
  const { data } = await api.put<FeeType>(`/v1/fee-types/${id}`, input);
  return data;
}

export async function createFeeType(name: string): Promise<FeeType> {
  const { data } = await api.post<FeeType>('/v1/fee-types', { name });
  return data;
}

// --- Fee structures -----------------------------------------------------

export type FeeStructureItem = {
  id: string;
  category: string;
  label: string | null;
  feeTypeId: string | null;
  feeTypeName: string | null;
  amount: number;
  sequenceOrder: number;
  /** YYYY-MM-DD; null = the structure's due date. */
  dueDate: string | null;
};

export type FeeStructure = {
  id: string;
  schoolId: string;
  classId: string | null;
  academicYear: string;
  name: string;
  amount: number;
  dueDate: string; // YYYY-MM-DD
  frequency: FeeFrequency;
  lateFeeAmount: number | null;
  status: 'ACTIVE' | 'INACTIVE';
  items: FeeStructureItem[];
  createdAt: string;
  /** Null = the same fees for every medium. */
  mediumId: string | null;
  /** How many students have been billed for this structure. */
  billedCount: number;
};

export async function fetchFeeStructures(params?: {
  classId?: string;
  academicYear?: string;
  mediumId?: string;
}): Promise<FeeStructure[]> {
  const { data } = await api.get<FeeStructure[]>('/v1/fee-structures', { params });
  return data;
}

export type LineItemInput = {
  category: string;
  label?: string;
  feeTypeId?: string;
  amount: number;
  dueDate?: string | null;
};

export type CreateFeeStructureInput = {
  schoolId: string;
  classId?: string;
  academicYear: string;
  name: string;
  amount?: number;
  dueDate: string; // YYYY-MM-DD
  frequency?: FeeFrequency;
  lateFeeAmount?: number;
  items?: LineItemInput[];
  mediumId?: string | null;
};

export async function createFeeStructure(input: CreateFeeStructureInput): Promise<FeeStructure> {
  const { data } = await api.post<FeeStructure>('/v1/fee-structures', input);
  return data;
}

export type UpdateFeeStructureResult = { structure: FeeStructure; adjustedInvoices: number; skipped: string[] };

/**
 * Edit a fee structure; its fee lines are replaced by `items`. Bills already raised keep their amount unless
 * `applyToExisting` is set: then every unpaid bill moves by the same difference (recorded as an adjustment).
 */
export async function updateFeeStructure(
  id: string,
  input: CreateFeeStructureInput,
  applyToExisting = false,
): Promise<UpdateFeeStructureResult> {
  const { data } = await api.put<UpdateFeeStructureResult>(`/v1/fee-structures/${id}`, input, {
    params: applyToExisting ? { applyToExisting } : undefined,
  });
  return data;
}

/** 409 once any student has been billed for it. */
export async function deleteFeeStructure(id: string): Promise<void> {
  await api.delete(`/v1/fee-structures/${id}`);
}

// --- Discounts ----------------------------------------------------------

export type FeeDiscount = {
  id: string;
  name: string;
  discountType: 'FIXED' | 'PERCENTAGE';
  value: number;
  feeStructureId: string | null;
  validFrom: string | null;
  validTo: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
};

export async function fetchFeeDiscounts(): Promise<FeeDiscount[]> {
  const { data } = await api.get<FeeDiscount[]>('/v1/fee-discounts');
  return data;
}

export type CreateFeeDiscountInput = {
  name: string;
  discountType: 'FIXED' | 'PERCENTAGE';
  value: number;
  feeStructureId?: string;
  validFrom?: string;
  validTo?: string;
};

export async function createFeeDiscount(input: CreateFeeDiscountInput): Promise<FeeDiscount> {
  const { data } = await api.post<FeeDiscount>('/v1/fee-discounts', input);
  return data;
}

export async function applyDiscountToInvoice(invoiceId: string, discountId: string): Promise<Invoice> {
  const { data } = await api.post<Invoice>(`/v1/invoices/${invoiceId}/discount`, { discountId });
  return data;
}

export async function applyLateFee(invoiceId: string): Promise<Invoice> {
  const { data } = await api.post<Invoice>(`/v1/invoices/${invoiceId}/late-fee`);
  return data;
}

// --- Invoices / assignment ----------------------------------------------

export type Invoice = {
  id: string;
  studentId: string;
  feeStructureId: string;
  amount: number;
  discountAmount: number;
  netAmount: number;
  lateFeeAmount: number;
  lateFeeApplied: boolean;
  paidAmount: number;
  balance: number;
  status: InvoiceStatus;
  razorpayOrderId: string | null;
  razorpayPaymentId: string | null;
  createdAt: string;
  paidAt: string | null;
};

/** Invoices for one student. 404 if the student doesn't exist. */
export async function fetchStudentInvoices(studentId: string): Promise<Invoice[]> {
  const { data } = await api.get<Invoice[]>('/v1/invoices', { params: { studentId } });
  return data;
}

export type CreateInvoiceInput = {
  studentId: string;
  feeStructureId: string;
  /** Admission-time adjustment of the template total for this student (recorded with the reason). */
  amount?: number;
  adjustmentReason?: string;
  /** Per-student fee lines (fee type x term) when the template was adjusted at admission. */
  lines?: { label: string; feeTypeId?: string; category: string; dueDate: string; amount: number }[];
};

/** Generate a PENDING invoice for a student against a fee structure. 409 if a duplicate. */
export async function createInvoice(input: CreateInvoiceInput): Promise<Invoice> {
  const { data } = await api.post<Invoice>('/v1/invoices', input);
  return data;
}

export type BulkAssignResult = { studentId: string; assigned: boolean; reason: string | null };
export type BulkAssignResponse = { results: BulkAssignResult[]; assignedCount: number; requestedCount: number };

/** Bulk-assign one fee structure to many students (e.g. a class/section roster) in one call. */
export async function bulkAssignFee(feeStructureId: string, studentIds: string[]): Promise<BulkAssignResponse> {
  const { data } = await api.post<BulkAssignResponse>('/v1/invoices/bulk-assign', { feeStructureId, studentIds });
  return data;
}

// --- Collection -----------------------------------------------------------

export type PaymentType = 'PAYMENT' | 'REVERSAL';

export type Payment = {
  id: string;
  invoiceId: string;
  type: PaymentType;
  amount: number;
  method: PaymentMethod;
  referenceNumber: string | null;
  receiptNumber: string;
  collectedByUserId: string | null;
  notes: string | null;
  reversesPaymentId: string | null;
  reason: string | null;
  paidAt: string;
};

export type CollectPaymentInput = {
  amount: number;
  method: PaymentMethod;
  referenceNumber?: string;
  notes?: string;
};

/** Collect a manual payment against an invoice's current balance. The server validates against the real balance. */
export async function collectPayment(invoiceId: string, input: CollectPaymentInput): Promise<Payment> {
  const { data } = await api.post<Payment>(`/v1/invoices/${invoiceId}/payments`, input);
  return data;
}

export async function fetchInvoicePayments(invoiceId: string): Promise<Payment[]> {
  const { data } = await api.get<Payment[]>(`/v1/invoices/${invoiceId}/payments`);
  return data;
}

export async function reversePayment(paymentId: string, reason: string): Promise<Payment> {
  const { data } = await api.post<Payment>(`/v1/payments/${paymentId}/reverse`, { reason });
  return data;
}

// --- Receipt / statement ----------------------------------------------

export type Receipt = {
  payment: Payment;
  invoiceId: string;
  schoolName: string | null;
  studentName: string;
  admissionNumber: string;
  className: string | null;
  sectionName: string | null;
  academicYear: string | null;
  feeStructureName: string | null;
  originalAmount: number;
  discountAmount: number;
  lateFeeAmount: number;
  balanceAfter: number;
  collectedByName: string | null;
};

export async function fetchReceipt(paymentId: string): Promise<Receipt> {
  const { data } = await api.get<Receipt>(`/v1/payments/${paymentId}/receipt`);
  return data;
}

export type InvoiceStatementLine = {
  invoiceId: string;
  feeStructureName: string | null;
  dueDate: string | null;
  amount: number;
  discountAmount: number;
  netAmount: number;
  paidAmount: number;
  balance: number;
  status: InvoiceStatus;
  overdue: boolean;
  payments: Payment[];
};

export type StudentFeeStatement = {
  studentId: string;
  totalAssigned: number;
  totalDiscount: number;
  totalPayable: number;
  totalPaid: number;
  totalBalance: number;
  invoices: InvoiceStatementLine[];
};

/** Student Profile → Fees tab: full statement (staff view, any student). 404 if the student doesn't exist. */
export async function fetchStudentFeeStatement(studentId: string): Promise<StudentFeeStatement> {
  const { data } = await api.get<StudentFeeStatement>(`/v1/students/${studentId}/fee-statement`);
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
 * Start a payment: creates a Razorpay Order for the invoice server-side, for the
 * invoice's current outstanding balance (not necessarily its original amount).
 * A SCHOOL_ADMIN may check out any invoice; a PARENT only their own child's.
 * 409 if the invoice is already paid.
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

// --- Student Fees (line-by-line collection) ---------------------------------------------------------------------

/** Payment modes offered when collecting fees, in Smart School's order. */
export const COLLECT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'CASH', label: 'Cash' },
  { value: 'CHEQUE', label: 'Cheque' },
  { value: 'DD', label: 'DD' },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
  { value: 'UPI', label: 'UPI' },
  { value: 'CARD', label: 'Card' },
];

export const METHOD_LABEL: Record<string, string> = {
  CASH: 'Cash',
  CHEQUE: 'Cheque',
  DD: 'DD',
  BANK_TRANSFER: 'Bank Transfer',
  UPI: 'UPI',
  CARD: 'Card',
  ONLINE: 'Online',
  OTHER: 'Other',
};

export type FeeLinePayment = {
  paymentId: string;
  /** e.g. RCPT-000123/1 -- receipt number / position on the receipt. */
  paymentNumber: string;
  receiptNumber: string;
  method: PaymentMethod;
  paymentDate: string;
  amount: number;
  fine: number;
  collectionId: string | null;
  referenceNumber: string | null;
  notes: string | null;
  reversed: boolean;
};

export type FeeLineStatus = 'PAID' | 'PARTIAL' | 'UNPAID';

export type FeeLine = {
  lineId: string;
  invoiceId: string;
  feeGroup: string;
  label: string;
  /** TERM_1..TERM_4 or another category. */
  term: string;
  dueDate: string;
  amount: number;
  discount: number;
  fine: number;
  paid: number;
  balance: number;
  status: FeeLineStatus;
  overdue: boolean;
  payments: FeeLinePayment[];
};

export type StudentFeeGroup = {
  invoiceId: string;
  feeStructureId: string;
  name: string;
  academicYear: string | null;
  amount: number;
  discount: number;
  fine: number;
  paid: number;
  balance: number;
  status: string;
};

export type StudentFees = {
  studentId: string;
  groups: StudentFeeGroup[];
  lines: FeeLine[];
  totals: { amount: number; discount: number; fine: number; paid: number; balance: number };
};

export async function fetchStudentFees(studentId: string): Promise<StudentFees> {
  const { data } = await api.get<StudentFees>(`/v1/students/${studentId}/fees`);
  return data;
}

export type CollectFeesInput = {
  paymentDate: string;
  method: PaymentMethod;
  referenceNumber?: string;
  notes?: string;
  lines: { invoiceLineId: string; amount: number; fine: number }[];
};

export type CollectFeesResult = { collectionId: string; receiptNumbers: string[]; total: number };

export async function collectFees(studentId: string, input: CollectFeesInput): Promise<CollectFeesResult> {
  const { data } = await api.post<CollectFeesResult>(`/v1/students/${studentId}/fee-collections`, input);
  return data;
}

export type CollectionReceipt = {
  collectionId: string;
  receiptNumbers: string[];
  paymentDate: string;
  method: PaymentMethod;
  referenceNumber: string | null;
  notes: string | null;
  collectedBy: string | null;
  schoolName: string | null;
  studentId: string;
  studentName: string;
  admissionNumber: string;
  className: string | null;
  sectionName: string | null;
  fatherName: string | null;
  lines: { feeGroup: string; label: string; term: string; dueDate: string; amount: number; fine: number; balanceAfter: number | null }[];
  totalAmount: number;
  totalFine: number;
  total: number;
  reversed: boolean;
};

export async function fetchCollectionReceipt(collectionId: string): Promise<CollectionReceipt> {
  const { data } = await api.get<CollectionReceipt>(`/v1/fee-collections/${collectionId}`);
  return data;
}
