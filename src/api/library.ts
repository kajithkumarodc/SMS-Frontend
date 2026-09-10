import { AxiosError } from 'axios';
import api from '../lib/api';
import { ChildNotFoundError, NoLinkedStudentError } from './portal';

/** A catalogued book. Mirrors the backend's `LibraryDtos.BookResponse`. */
export type LibraryBook = {
  id: string;
  title: string;
  author: string;
  isbn: string | null;
  totalCopies: number;
  availableCopies: number;
  createdAt: string; // ISO timestamp
};

/** Shape of Spring's `PagedModel` response. */
export type LibraryBooksPage = {
  content: LibraryBook[];
  page: {
    size: number;
    number: number;
    totalElements: number;
    totalPages: number;
  };
};

/** The loan row returned when a book is issued or returned (`LibraryDtos.LoanResponse`). */
export type BookLoan = {
  id: string;
  bookId: string;
  studentId: string;
  issuedDate: string; // YYYY-MM-DD
  dueDate: string; // YYYY-MM-DD
  returnedDate: string | null;
};

/** One row of a student's loan history (`LibraryDtos.LoanHistoryView` / portal `LoanView`). */
export type LoanHistoryEntry = {
  id: string;
  bookId: string;
  bookTitle: string;
  bookAuthor: string;
  issuedDate: string;
  dueDate: string;
  returnedDate: string | null;
};

/** One currently-issued loan for the staff "active loans" view (`LibraryDtos.ActiveLoanView`). */
export type ActiveLoan = {
  id: string;
  bookId: string;
  bookTitle: string;
  studentId: string;
  studentName: string;
  issuedDate: string;
  dueDate: string;
};

export type FetchBooksParams = {
  /** Zero-based page index, as the backend expects. */
  page: number;
  size: number;
  /** Optional free-text match on title or author. */
  q?: string;
};

/** Browse / search the catalogue. Any authenticated role. */
export async function fetchBooks(params: FetchBooksParams): Promise<LibraryBooksPage> {
  const { q, ...rest } = params;
  const { data } = await api.get<LibraryBooksPage>('/v1/library/books', {
    params: q && q.trim() ? { ...rest, q: q.trim() } : rest,
  });
  return data;
}

export type AddBookInput = {
  title: string;
  author: string;
  isbn?: string | null;
  totalCopies: number;
};

/** Add a book to the catalogue. SCHOOL_ADMIN only server-side. */
export async function addBook(input: AddBookInput): Promise<LibraryBook> {
  const { data } = await api.post<LibraryBook>('/v1/library/books', input);
  return data;
}

/** Thrown when a book is issued but no copies are available (backend 400). */
export class NoCopiesAvailableError extends Error {
  constructor() {
    super('No copies of this book are available');
    this.name = 'NoCopiesAvailableError';
  }
}

export type IssueBookInput = {
  bookId: string;
  studentId: string;
};

/** Issue a book to a student. SCHOOL_ADMIN only server-side. 400 if no copies are available. */
export async function issueBook(input: IssueBookInput): Promise<BookLoan> {
  try {
    const { data } = await api.post<BookLoan>('/v1/library/loans', input);
    return data;
  } catch (error) {
    if ((error as AxiosError).response?.status === 400) throw new NoCopiesAvailableError();
    throw error;
  }
}

/** Mark a loan returned. SCHOOL_ADMIN only server-side. 409 if it was already returned. */
export async function returnLoan(loanId: string): Promise<BookLoan> {
  const { data } = await api.post<BookLoan>(`/v1/library/loans/${loanId}/return`);
  return data;
}

/** A student's full loan history, for staff. 404 if the student is not in the caller's tenant. */
export async function fetchStudentLoans(studentId: string): Promise<LoanHistoryEntry[]> {
  const { data } = await api.get<LoanHistoryEntry[]>('/v1/library/loans', { params: { studentId } });
  return data;
}

/** Every not-yet-returned loan across the tenant, soonest due first. SCHOOL_ADMIN or TEACHER. */
export async function fetchActiveLoans(): Promise<ActiveLoan[]> {
  const { data } = await api.get<ActiveLoan[]>('/v1/library/loans/active');
  return data;
}

/** STUDENT: the caller's own library loan history. */
export async function fetchMyLibrary(): Promise<LoanHistoryEntry[]> {
  try {
    const { data } = await api.get<LoanHistoryEntry[]>('/v1/me/student/library');
    return data;
  } catch (error) {
    if ((error as AxiosError).response?.status === 404) throw new NoLinkedStudentError();
    throw error;
  }
}

/** PARENT: one of the caller's own children's library loan history. 404 (ChildNotFoundError) if not their child. */
export async function fetchChildLibrary(studentId: string): Promise<LoanHistoryEntry[]> {
  try {
    const { data } = await api.get<LoanHistoryEntry[]>(`/v1/me/children/${studentId}/library`);
    return data;
  } catch (error) {
    if ((error as AxiosError).response?.status === 404) throw new ChildNotFoundError();
    throw error;
  }
}
