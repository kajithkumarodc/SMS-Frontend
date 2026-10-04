const TERM_NAMES: Record<string, string> = {
  TERM_1: 'Term I',
  TERM_2: 'Term II',
  TERM_3: 'Term III',
  TERM_4: 'Term IV',
  APPLICATION: 'Application',
  ADMISSION: 'Admission',
  OTHER: 'One-time',
};

/** "Term I" for TERM_1 etc. */
export function termLabel(category: string): string {
  return TERM_NAMES[category] ?? category;
}
