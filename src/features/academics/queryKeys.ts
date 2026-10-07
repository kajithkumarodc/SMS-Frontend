/** TanStack Query keys for the Academics feature. */
export const ACADEMIC_SUBJECTS_KEY = ['academics', 'subjects'] as const;
export const SUBJECT_GROUPS_KEY = ['academics', 'subject-groups'] as const; // + sectionId
export const TIMETABLE_KEY = ['academics', 'timetable'] as const; // + sectionId, subjectGroupId
export const TEACHER_TIMETABLE_KEY = ['academics', 'teacher-timetable'] as const; // + staffProfileId
export const SECTION_NAMES_KEY = ['academics', 'section-names'] as const;
export const CLASS_TEACHERS_KEY = ['academics', 'class-teachers'] as const;
