/** Well-known role identifiers, mirroring the backend's `com.smsapp.user.Roles`. */
export const ROLE = {
  SCHOOL_ADMIN: 'SCHOOL_ADMIN',
  TEACHER: 'TEACHER',
} as const;

export type Role = (typeof ROLE)[keyof typeof ROLE];

export function hasRole(roles: string[] | undefined, role: Role): boolean {
  return Boolean(roles?.includes(role));
}

export function hasAnyRole(roles: string[] | undefined, allowed: Role[]): boolean {
  return Boolean(roles?.some((r) => allowed.includes(r as Role)));
}
