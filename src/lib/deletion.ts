import { prisma } from './prisma';
import { canAccessCategory } from './rbac';
import { ROLES } from './constants';

// Roles whose approval can be required to delete a material. ADMIN is not here:
// an admin deletes directly and is never counted as a required voter.
export const DELETION_APPROVER_ROLES: string[] = [
  ROLES.REVIEWER,
  ROLES.EDITOR,
  ROLES.CONTENT_MANAGER,
];

export interface ApproverUser {
  id: string;
  name: string;
  role: string;
  assignedCategories: string | null;
}

// The set of reviewers whose approval is required to delete a material:
//   every reviewer assigned to the material's category,
//   EXCEPT the reviewer who first approved it (they already vouched for it),
//   EXCEPT the reviewer who requested the deletion (their request = consent),
//   EXCEPT admins (who delete directly, never by vote).
// If this set is empty, the deletion may proceed immediately.
export function computeRequiredApprovers(
  staff: ApproverUser[],
  categorySlug: string,
  firstApprovedById: string | null | undefined,
  initiatorId: string,
): ApproverUser[] {
  return staff.filter(
    (u) =>
      DELETION_APPROVER_ROLES.includes(u.role) &&
      canAccessCategory(u, categorySlug) &&
      u.id !== firstApprovedById &&
      u.id !== initiatorId,
  );
}

// Active staff who can take part in reviewing (used both to compute required
// approvers and to resolve reviewer names in the UI).
export function loadReviewStaff(): Promise<ApproverUser[]> {
  return prisma.user.findMany({
    where: { active: true, role: { in: DELETION_APPROVER_ROLES } },
    select: { id: true, name: true, role: true, assignedCategories: true },
  });
}
