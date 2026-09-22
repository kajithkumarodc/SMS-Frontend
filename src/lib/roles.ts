/** Well-known role identifiers, mirroring the backend's `com.smsapp.user.Roles`. */
export const ROLE = {
  SCHOOL_ADMIN: 'SCHOOL_ADMIN',
  TEACHER: 'TEACHER',
  STUDENT: 'STUDENT',
  PARENT: 'PARENT',
  // RBAC Phase 1 (database-driven roles, see V22 migration) -- these are
  // plain role rows, not special-cased on the backend beyond `Roles.HAS_ADMIN`
  // for SUPER_ADMIN. Listed here only so the frontend can label/gate on them.
  SUPER_ADMIN: 'SUPER_ADMIN',
  PRINCIPAL: 'PRINCIPAL',
  ACCOUNTANT: 'ACCOUNTANT',
  LIBRARIAN: 'LIBRARIAN',
  RECEPTIONIST: 'RECEPTIONIST',
} as const;

export type Role = (typeof ROLE)[keyof typeof ROLE];

export function hasRole(roles: string[] | undefined, role: Role): boolean {
  return Boolean(roles?.includes(role));
}

export function hasAnyRole(roles: string[] | undefined, allowed: Role[]): boolean {
  return Boolean(roles?.some((r) => allowed.includes(r as Role)));
}

/** RBAC Phase 1: checks the database-driven `permissions` claim (e.g. "STUDENT_EXPORT"). */
export function hasPermission(permissions: string[] | undefined, permission: string): boolean {
  return Boolean(permissions?.includes(permission));
}
