import { prisma } from './prisma';
import { canAccessCategory } from './rbac';
import { ROLES } from './constants';

// The "supervisors" of a section who take part in a deletion vote: the section's
// reviewers and the level(s) above them (editor, content manager). ADMIN is not
// here — an admin does not vote; an admin may only delete directly at the owner's
// request or for a technical problem.
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

// Every supervisor assigned to the material's category. This is the full voting
// pool: NO ONE is excluded — the original approver and the requester are counted
// too (the requester's own request stands as an approval vote).
export function sectionSupervisors(
  staff: ApproverUser[],
  categorySlug: string,
): ApproverUser[] {
  return staff.filter(
    (u) => DELETION_APPROVER_ROLES.includes(u.role) && canAccessCategory(u, categorySlug),
  );
}

// Tally a deletion vote against the section supervisors. Deletion needs a strict
// majority of the whole pool (> 50%); an exact 50% tie keeps the material.
//   - decided/'delete' : approvals passed the majority → delete now.
//   - decided/'keep'   : rejections make a majority impossible → keep, close it.
//   - undecided        : still collecting votes.
export function tallyDeletion(
  poolSize: number,
  poolIds: Set<string>,
  votes: { voterId: string; vote: string }[],
): { poolSize: number; approve: number; reject: number; decision: 'delete' | 'keep' | 'pending' } {
  const seen = new Set<string>();
  let approve = 0;
  let reject = 0;
  for (const v of votes) {
    if (!poolIds.has(v.voterId) || seen.has(v.voterId)) continue; // only pool members, once
    seen.add(v.voterId);
    if (v.vote === 'APPROVE') approve += 1;
    else if (v.vote === 'REJECT') reject += 1;
  }
  let decision: 'delete' | 'keep' | 'pending' = 'pending';
  if (approve * 2 > poolSize) decision = 'delete'; // strict majority approves
  else if (reject * 2 >= poolSize) decision = 'keep'; // majority no longer reachable (ties keep)
  return { poolSize, approve, reject, decision };
}

// Active staff who can take part in reviewing (used both to build the voting pool
// and to resolve reviewer names in the UI).
export function loadReviewStaff(): Promise<ApproverUser[]> {
  return prisma.user.findMany({
    where: { active: true, role: { in: DELETION_APPROVER_ROLES } },
    select: { id: true, name: true, role: true, assignedCategories: true },
  });
}
