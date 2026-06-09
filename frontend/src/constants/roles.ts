/**
 * User role constants used in route guards,
 * sidebar navigation, and permission checks.
 */

export const ROLES = {
  ADMIN: 'admin',
  SUPER_ADMIN: 'superadmin',
  DEPARTMENT_HEAD: 'department_head',
  STAFF: 'staff',
  RESIDENT: 'resident',
} as const;

export type UserRole = typeof ROLES[keyof typeof ROLES];

export const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrator',
  superadmin: 'Super Administrator',
  department_head: 'Department Head',
  staff: 'Staff Member',
  resident: 'Resident',
};

/**
 * Checks if a role has management-level access.
 */
export const isManagementRole = (role: string): boolean => {
  return [ROLES.ADMIN, ROLES.SUPER_ADMIN, ROLES.DEPARTMENT_HEAD].includes(role as any);
};
