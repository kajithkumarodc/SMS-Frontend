import api from '../lib/api';

/** An item category (`InventoryDtos.CategoryResponse`). */
export type InventoryCategory = { id: string; name: string };

/** An item with the units in stock (`InventoryDtos.ItemResponse`). */
export type InventoryItem = { id: string; name: string; categoryId: string; categoryName: string; stock: number };

export type InventoryItemInput = { name: string; categoryId: string; stock: number };

export type IssueStatus = 'ISSUED' | 'RETURNED';

/** One issue of an item to a staff member (`InventoryDtos.IssueResponse`). */
export type InventoryIssue = {
  id: string;
  itemId: string;
  itemName: string | null;
  categoryName: string | null;
  note: string | null;
  issueDate: string;
  returnDate: string | null;
  issueToStaffId: string;
  issueToName: string | null;
  issueToCode: string | null;
  issuedByStaffId: string;
  issuedByName: string | null;
  issuedByCode: string | null;
  quantity: number;
  status: IssueStatus;
  returnedAt: string | null;
};

/** The Issue Item form (`InventoryDtos.IssueRequest`). */
export type IssueInput = {
  issueToStaffId: string;
  issuedByStaffId: string;
  issueDate: string;
  returnDate: string | null;
  note: string | null;
  itemId: string;
  quantity: number;
};

export async function fetchInventoryCategories(): Promise<InventoryCategory[]> {
  const { data } = await api.get<InventoryCategory[]>('/v1/inventory/categories');
  return data;
}

export async function createInventoryCategory(name: string): Promise<InventoryCategory> {
  const { data } = await api.post<InventoryCategory>('/v1/inventory/categories', { name });
  return data;
}

export async function updateInventoryCategory(id: string, name: string): Promise<InventoryCategory> {
  const { data } = await api.put<InventoryCategory>(`/v1/inventory/categories/${id}`, { name });
  return data;
}

export async function deleteInventoryCategory(id: string): Promise<void> {
  await api.delete(`/v1/inventory/categories/${id}`);
}

export async function fetchInventoryItems(categoryId?: string): Promise<InventoryItem[]> {
  const { data } = await api.get<InventoryItem[]>('/v1/inventory/items', { params: categoryId ? { categoryId } : undefined });
  return data;
}

export async function createInventoryItem(input: InventoryItemInput): Promise<InventoryItem> {
  const { data } = await api.post<InventoryItem>('/v1/inventory/items', input);
  return data;
}

export async function updateInventoryItem(id: string, input: InventoryItemInput): Promise<InventoryItem> {
  const { data } = await api.put<InventoryItem>(`/v1/inventory/items/${id}`, input);
  return data;
}

export async function deleteInventoryItem(id: string): Promise<void> {
  await api.delete(`/v1/inventory/items/${id}`);
}

export async function fetchInventoryIssues(): Promise<InventoryIssue[]> {
  const { data } = await api.get<InventoryIssue[]>('/v1/inventory/issues');
  return data;
}

export async function issueInventoryItem(input: IssueInput): Promise<InventoryIssue> {
  const { data } = await api.post<InventoryIssue>('/v1/inventory/issues', input);
  return data;
}

export async function returnInventoryIssue(id: string): Promise<InventoryIssue> {
  const { data } = await api.post<InventoryIssue>(`/v1/inventory/issues/${id}/return`);
  return data;
}

export async function deleteInventoryIssue(id: string): Promise<void> {
  await api.delete(`/v1/inventory/issues/${id}`);
}

// --- Stores, suppliers and stock entries ---------------------------------------------------------

export type InventoryStore = { id: string; name: string; code: string | null; description: string | null };
export type InventoryStoreInput = { name: string; code: string | null; description: string | null };

export type InventorySupplier = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  contactPersonName: string | null;
  contactPersonPhone: string | null;
  contactPersonEmail: string | null;
  description: string | null;
};
export type InventorySupplierInput = Omit<InventorySupplier, 'id'>;

export type StockAttachment = { fileName: string; contentType: string; sizeBytes: number };

/** One stock entry (`InventoryDtos.StockEntryResponse`); a negative quantity took units out. */
export type StockEntry = {
  id: string;
  itemId: string;
  itemName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  supplierId: string | null;
  supplierName: string | null;
  storeId: string | null;
  /** "Name (code)". */
  storeName: string | null;
  quantity: number;
  purchasePrice: number;
  date: string;
  description: string | null;
  attachment: StockAttachment | null;
};

export type StockEntryInput = {
  itemId: string;
  supplierId: string | null;
  storeId: string | null;
  quantity: number;
  purchasePrice: number;
  date: string;
  description: string | null;
};

export async function fetchInventoryStores(): Promise<InventoryStore[]> {
  const { data } = await api.get<InventoryStore[]>('/v1/inventory/stores');
  return data;
}

export async function createInventoryStore(input: InventoryStoreInput): Promise<InventoryStore> {
  const { data } = await api.post<InventoryStore>('/v1/inventory/stores', input);
  return data;
}

export async function updateInventoryStore(id: string, input: InventoryStoreInput): Promise<InventoryStore> {
  const { data } = await api.put<InventoryStore>(`/v1/inventory/stores/${id}`, input);
  return data;
}

export async function deleteInventoryStore(id: string): Promise<void> {
  await api.delete(`/v1/inventory/stores/${id}`);
}

export async function fetchInventorySuppliers(): Promise<InventorySupplier[]> {
  const { data } = await api.get<InventorySupplier[]>('/v1/inventory/suppliers');
  return data;
}

export async function createInventorySupplier(input: InventorySupplierInput): Promise<InventorySupplier> {
  const { data } = await api.post<InventorySupplier>('/v1/inventory/suppliers', input);
  return data;
}

export async function updateInventorySupplier(id: string, input: InventorySupplierInput): Promise<InventorySupplier> {
  const { data } = await api.put<InventorySupplier>(`/v1/inventory/suppliers/${id}`, input);
  return data;
}

export async function deleteInventorySupplier(id: string): Promise<void> {
  await api.delete(`/v1/inventory/suppliers/${id}`);
}

export async function fetchStockEntries(): Promise<StockEntry[]> {
  const { data } = await api.get<StockEntry[]>('/v1/inventory/stock');
  return data;
}

export async function createStockEntry(input: StockEntryInput): Promise<StockEntry> {
  const { data } = await api.post<StockEntry>('/v1/inventory/stock', input);
  return data;
}

export async function updateStockEntry(id: string, input: StockEntryInput): Promise<StockEntry> {
  const { data } = await api.put<StockEntry>(`/v1/inventory/stock/${id}`, input);
  return data;
}

export async function deleteStockEntry(id: string): Promise<void> {
  await api.delete(`/v1/inventory/stock/${id}`);
}

export async function uploadStockDocument(id: string, file: File): Promise<StockEntry> {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.put<StockEntry>(`/v1/inventory/stock/${id}/document`, form);
  return data;
}

export async function removeStockDocument(id: string): Promise<StockEntry> {
  const { data } = await api.delete<StockEntry>(`/v1/inventory/stock/${id}/document`);
  return data;
}

function apiBase(): string {
  return (api.defaults.baseURL ?? '/api').replace(/\/$/, '');
}

export function stockDocumentUrl(id: string): string {
  return `${apiBase()}/v1/inventory/stock/${id}/document`;
}
