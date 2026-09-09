/** TanStack Query keys for the reports feature. Append params where noted. */
export const ATTENDANCE_TREND_QUERY_KEY = ['reports', 'attendance-trend'] as const; // + { from, to }
export const ACADEMIC_PERFORMANCE_QUERY_KEY = ['reports', 'academic-performance'] as const; // + classId
export const FEE_COLLECTION_QUERY_KEY = ['reports', 'fee-collection'] as const;
