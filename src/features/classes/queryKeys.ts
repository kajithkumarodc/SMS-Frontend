/** Shared TanStack Query key for the classes-with-sections list. */
export const CLASSES_QUERY_KEY = ['classes'] as const;

/** All subjects for the tenant. */
export const SUBJECTS_QUERY_KEY = ['subjects'] as const;

/** Subjects assigned to one class — append the classId: `[...CLASS_SUBJECTS_QUERY_KEY, classId]`. */
export const CLASS_SUBJECTS_QUERY_KEY = ['class-subjects'] as const;
