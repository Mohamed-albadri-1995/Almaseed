import { ROLES, STAFF_ROLES, type Role } from './constants';

const has = (allowed: Role[], role: Role) => allowed.includes(role);

// Permission checks derived from the role hierarchy in the design spec.
export const can = {
  // Access the admin area at all.
  accessAdmin: (role: Role) => has(STAFF_ROLES, role),

  // Review submissions (approve / request edit / reject).
  reviewContent: (role: Role) =>
    has([ROLES.REVIEWER, ROLES.EDITOR, ROLES.CONTENT_MANAGER, ROLES.ADMIN], role),

  // Edit material data & categories.
  editContent: (role: Role) =>
    has([ROLES.EDITOR, ROLES.CONTENT_MANAGER, ROLES.ADMIN], role),

  // Manage all content, hide/merge/restore, manage contributors.
  manageContent: (role: Role) =>
    has([ROLES.CONTENT_MANAGER, ROLES.ADMIN], role),

  // Manage users, staff roles, settings.
  manageUsers: (role: Role) => role === ROLES.ADMIN,

  // View the activity log & reports.
  viewReports: (role: Role) => has([ROLES.CONTENT_MANAGER, ROLES.ADMIN], role),
};

export function isStaff(role?: string | null): boolean {
  return !!role && (STAFF_ROLES as Role[]).includes(role as Role);
}
