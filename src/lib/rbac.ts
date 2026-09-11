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

  // Edit a submission's details during review — reviewers included — so a
  // reviewer can fix the data directly instead of returning it to the
  // contributor (fewer rejected materials). Does NOT grant category/materials
  // management (that stays on editContent).
  editSubmission: (role: Role) =>
    has([ROLES.REVIEWER, ROLES.EDITOR, ROLES.CONTENT_MANAGER, ROLES.ADMIN], role),

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

// Section scoping: a staff member may be limited to specific category slugs.
// Empty list = all sections. ADMIN is never restricted.
export function assignedCategoriesOf(
  user?: { assignedCategories?: string | null } | null,
): string[] {
  if (!user?.assignedCategories) return [];
  return user.assignedCategories.split(',').map((s) => s.trim()).filter(Boolean);
}

export function canAccessCategory(
  user: { role: string; assignedCategories?: string | null },
  slug?: string | null,
): boolean {
  if (user.role === ROLES.ADMIN) return true;
  const list = assignedCategoriesOf(user);
  if (list.length === 0) return true;
  return !!slug && list.includes(slug);
}
