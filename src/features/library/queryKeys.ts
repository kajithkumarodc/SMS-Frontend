/** TanStack Query keys for the library feature. Append the id / params where noted. */
export const LIBRARY_BOOKS_KEY = ['library', 'books'] as const; // + { page, pageSize, q }
export const LIBRARY_ACTIVE_LOANS_KEY = ['library', 'active-loans'] as const;
export const STUDENT_LOANS_KEY = ['library', 'student-loans'] as const; // + studentId
export const MY_LIBRARY_KEY = ['library', 'mine'] as const;
export const CHILD_LIBRARY_KEY = ['library', 'child'] as const; // + studentId
