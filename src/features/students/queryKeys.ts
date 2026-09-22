/** Shared TanStack Query key prefix for every students list query, so a create can invalidate them all. */
export const STUDENTS_QUERY_KEY = ['students'] as const;

// Phase 3: append the studentId, e.g. `[...STUDENT_DOCUMENTS_KEY, studentId]`.
export const STUDENT_DOCUMENTS_KEY = ['students', 'documents'] as const;
export const STUDENT_SIBLINGS_KEY = ['students', 'siblings'] as const;
export const STUDENT_ACADEMIC_HISTORY_KEY = ['students', 'academic-history'] as const;
export const STUDENT_IDENTIFICATIONS_KEY = ['students', 'identifications'] as const;
