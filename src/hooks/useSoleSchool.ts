import { useEffect } from 'react';

/**
 * The app serves a single school (V38 allows only one). Forms that still carry a `schoolId` use this to fill it
 * in automatically and hide the School picker: returns that school's id once the list has loaded with exactly
 * one school, and keeps `currentValue` set to it (including after a form reset).
 */
export function useSoleSchool(
  schools: { id: string }[] | undefined,
  currentValue: string | undefined,
  setSchoolId: (id: string) => void,
): string | undefined {
  const soleSchoolId = schools?.length === 1 ? schools[0].id : undefined;
  useEffect(() => {
    if (soleSchoolId && currentValue !== soleSchoolId) setSchoolId(soleSchoolId);
  }, [soleSchoolId, currentValue, setSchoolId]);
  return soleSchoolId;
}
