import dayjs from 'dayjs';
import type { Student } from '../../../api/students';

/** Combines First/Middle/Last into the single `fullName` the backend stores. */
export function combineFullName(firstName: string, middleName: string | undefined, lastName: string): string {
  return [firstName, middleName, lastName]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(' ');
}

/** Indian academic-year convention (April start), e.g. "2026–27". Display only -- not persisted. */
export function computeAcademicYear(today: dayjs.Dayjs = dayjs()): string {
  const startYear = today.month() >= 3 ? today.year() : today.year() - 1; // month() is 0-based; 3 = April
  const endYearShort = String((startYear + 1) % 100).padStart(2, '0');
  return `${startYear}–${endYearShort}`;
}

// --- Admission-number suggestion + duplicate-name check (client-side; this ---
// --- app's scale makes a full fetch-and-filter fine without a search index) ---

/**
 * Admission numbers are unique across the whole deployment, not per school
 * (see V18's global `UNIQUE(admission_number)`), so the scan must cover every
 * school's students -- suggesting a number already used by a different school
 * would just bounce off the backend's 409.
 */
export function suggestAdmissionNumber(students: Student[]): string {
  const year = new Date().getFullYear();
  const pattern = new RegExp(`^ADM-${year}-(\\d+)$`, 'i');
  let max = 0;
  for (const student of students) {
    const match = pattern.exec(student.admissionNumber.trim());
    if (match) {
      max = Math.max(max, Number.parseInt(match[1], 10));
    }
  }
  return `ADM-${year}-${String(max + 1).padStart(3, '0')}`;
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

function levenshtein(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dp: number[][] = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));
  for (let i = 0; i < rows; i++) dp[i][0] = i;
  for (let j = 0; j < cols; j++) dp[0][j] = j;
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

/** Exact match, or close enough (typo-distance scaled to name length) to flag as a possible duplicate. */
function isCloseMatch(a: string, b: string): boolean {
  if (a === b) return true;
  const threshold = Math.max(1, Math.floor(Math.min(a.length, b.length) * 0.2));
  return levenshtein(a, b) <= threshold;
}

export function findSimilarStudentName(students: Student[], fullName: string, schoolId: string): string | null {
  const target = normalizeName(fullName);
  if (target.length < 3) return null;
  const scoped = schoolId ? students.filter((student) => student.schoolId === schoolId) : students;
  const match = scoped.find((student) => isCloseMatch(normalizeName(student.fullName), target));
  return match?.fullName ?? null;
}
