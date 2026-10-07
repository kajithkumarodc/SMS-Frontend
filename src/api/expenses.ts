import api from '../lib/api';

export type ExpenseAttachment = {
  fileName: string;
  contentType: string;
  sizeBytes: number;
};

/** Mirrors the backend's `ExpenseDtos.ExpenseResponse`. */
export type Expense = {
  id: string;
  expenseHeadId: string;
  expenseHeadName: string | null;
  name: string;
  invoiceNumber: string | null;
  expenseDate: string;
  amount: number;
  description: string | null;
  attachment: ExpenseAttachment | null;
  createdAt: string;
  updatedAt: string;
};

export type ExpenseHead = {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
};

/** The Add Expense form -- mirrors `ExpenseDtos.ExpenseRequest`. */
export type ExpenseInput = {
  expenseHeadId: string;
  name: string;
  invoiceNumber: string | null;
  expenseDate: string;
  amount: number;
  description: string | null;
};

/** List columns the backend can sort by (`ExpenseController.SORTABLE`). */
export type ExpenseSortKey = 'name' | 'description' | 'invoiceNumber' | 'expenseDate' | 'expenseHeadName' | 'amount';

export type ExpenseFilter = {
  /** Text matched against name, description, invoice number and expense head. */
  q?: string;
  /** Second text term (the table search box); must match too. */
  filter?: string;
  /** Inclusive expense-date bounds, `YYYY-MM-DD`. */
  from?: string;
  to?: string;
  /** `<key>,asc|desc`. Omit for the newest date first. */
  sort?: string;
  page: number;
  size: number;
};

type PagedModel<T> = {
  content: T[];
  page: { size: number; number: number; totalElements: number; totalPages: number };
};

export async function fetchExpenses(filter: ExpenseFilter): Promise<PagedModel<Expense>> {
  const { data } = await api.get<PagedModel<Expense>>('/v1/expenses', { params: filter });
  return data;
}

export async function fetchExpenseTotal(filter: Omit<ExpenseFilter, 'sort' | 'page' | 'size'>): Promise<number> {
  const { data } = await api.get<{ total: number }>('/v1/expenses/total', { params: filter });
  return data.total;
}

const EXPORT_PAGE_SIZE = 500;

/** Every expense matching `filter` (all pages, same order) -- for Copy/Excel/CSV/PDF/Print. */
export async function fetchAllExpenses(filter: Omit<ExpenseFilter, 'page' | 'size'>): Promise<Expense[]> {
  const rows: Expense[] = [];
  for (let page = 0; ; page += 1) {
    const result = await fetchExpenses({ ...filter, page, size: EXPORT_PAGE_SIZE });
    rows.push(...result.content);
    if (page + 1 >= result.page.totalPages) return rows;
  }
}

export async function createExpense(input: ExpenseInput): Promise<Expense> {
  const { data } = await api.post<Expense>('/v1/expenses', input);
  return data;
}

export async function updateExpense(id: string, input: ExpenseInput): Promise<Expense> {
  const { data } = await api.put<Expense>(`/v1/expenses/${id}`, input);
  return data;
}

export async function deleteExpense(id: string): Promise<void> {
  await api.delete(`/v1/expenses/${id}`);
}

export async function uploadExpenseAttachment(id: string, file: File): Promise<Expense> {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.put<Expense>(`/v1/expenses/${id}/attachment`, form);
  return data;
}

export async function removeExpenseAttachment(id: string): Promise<Expense> {
  const { data } = await api.delete<Expense>(`/v1/expenses/${id}/attachment`);
  return data;
}

/** Same-origin link; the auth cookie goes with it. */
export function expenseAttachmentUrl(id: string): string {
  const base = (api.defaults.baseURL ?? '/api').replace(/\/$/, '');
  return `${base}/v1/expenses/${id}/attachment`;
}

export async function fetchExpenseHeads(): Promise<ExpenseHead[]> {
  const { data } = await api.get<ExpenseHead[]>('/v1/expense-heads');
  return data;
}

/** The Add Expense Head form -- mirrors `ExpenseDtos.ExpenseHeadRequest`. */
export type ExpenseHeadInput = {
  name: string;
  description: string | null;
};

export async function createExpenseHead(input: ExpenseHeadInput): Promise<ExpenseHead> {
  const { data } = await api.post<ExpenseHead>('/v1/expense-heads', input);
  return data;
}

export async function updateExpenseHead(id: string, input: ExpenseHeadInput): Promise<ExpenseHead> {
  const { data } = await api.put<ExpenseHead>(`/v1/expense-heads/${id}`, input);
  return data;
}

export async function deleteExpenseHead(id: string): Promise<void> {
  await api.delete(`/v1/expense-heads/${id}`);
}
