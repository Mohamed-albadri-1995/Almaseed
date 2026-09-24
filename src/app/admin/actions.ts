'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { can, canAccessCategory } from '@/lib/rbac';
import { logActivity } from '@/lib/activity';
import { buildSearchText } from '@/lib/search';
import { snapshotMaterial } from '@/lib/history';
import { deleteUpload, isOwnUploadUrl } from '@/lib/storage';
import { hashPassword } from '@/lib/auth';
import { decodeEntities, normalizeLine } from '@/lib/format';
import {
  MATERIAL_STATUS,
  REVIEW_ACTIONS,
  STATUS_LABELS,
  DELETION_VOTE,
  type Role,
  ROLES,
} from '@/lib/constants';
import { notifyAllNewMaterial, pushToUsers } from '@/lib/push';
import { sectionSupervisors, tallyDeletion, loadReviewStaff } from '@/lib/deletion';
import { HOLD_DAYS } from '@/lib/review-holds';

async function requireReviewer() {
  const user = await getCurrentUser();
  if (!user || !can.reviewContent(user.role as Role)) {
    throw new Error('غير مصرّح');
  }
  return user;
}

// ---- Review decision -------------------------------------------------------
export async function reviewDecisionAction(formData: FormData) {
  const user = await requireReviewer();
  const materialId = formData.get('materialId') as string;
  const action = formData.get('action') as string;
  const reason = (formData.get('reason') as string) || null;
  const note = (formData.get('note') as string) || null;

  const material = await prisma.material.findUnique({
    where: { id: materialId },
    include: { category: { select: { slug: true, name: true } } },
  });
  if (!material) throw new Error('المادة غير موجودة');
  const wasPublishedBefore = !!material.publishedAt;
  if (!canAccessCategory(user, material.category?.slug)) throw new Error('غير مصرّح لهذا القسم');

  // Conflict of interest: a reviewer may not take a review decision on a
  // material they submitted themselves — it must be reviewed by another
  // reviewer. (An admin isn't exempt when they are the submitter.)
  if (material.submittedById && material.submittedById === user.id) {
    redirect(`/admin/review/${materialId}?error=self`);
  }

  // Reason is mandatory for edit-requests and rejections.
  if (
    (action === REVIEW_ACTIONS.REQUEST_EDIT || action === REVIEW_ACTIONS.REJECT) &&
    !reason
  ) {
    redirect(`/admin/review/${materialId}?error=reason`);
  }

  // Two-reviewer rejection: one rejection HOLDS the material; a second, different
  // reviewer's rejection finalizes it; the same reviewer can't count twice.
  const isReject = action === REVIEW_ACTIONS.REJECT;
  const wasHeld = material.status === MATERIAL_STATUS.HELD;
  const isSecondRejection = isReject && wasHeld && !!material.firstRejectedById && material.firstRejectedById !== user.id;
  const isFirstRejection = isReject && !wasHeld;
  if (isReject && wasHeld && material.firstRejectedById === user.id) {
    // The initiator can't be the two required reviewers on their own.
    redirect(`/admin/review/${materialId}?error=held`);
  }

  // Second, different reviewer confirms the rejection → delete permanently
  // (files + record). The submitter is notified before removal.
  if (isSecondRejection) {
    if (material.submittedById) {
      await prisma.notification.create({
        data: {
          userId: material.submittedById,
          title: 'تم رفض مادتك',
          body: `«${material.title}» — رفضها مراجعان فحُذفت من الأرشيف${reason ? ` (${reason})` : ''}.`,
          link: '/account',
        },
      });
      await pushToUsers([material.submittedById], {
        title: 'تم رفض مادتك',
        body: `«${material.title}» — رفضها مراجعان فحُذفت من الأرشيف${reason ? ` (${reason})` : ''}.`,
        data: { type: 'material_rejected' },
      }).catch(() => {});
    }
    await logActivity({
      userId: user.id,
      action: 'reject',
      entity: 'material',
      entityId: materialId,
      meta: { title: material.title, reason, secondRejection: true },
    });
    await performMaterialDeletion(material, user.id);
    revalidatePath('/admin');
    revalidatePath('/admin/submissions');
    redirect('/admin/submissions?done=1');
  }

  let newStatus = material.status;
  let notifyTitle = '';
  const extra: { heldAt?: Date | null; firstRejectedById?: string | null } = {};
  if (action === REVIEW_ACTIONS.APPROVE) {
    newStatus = MATERIAL_STATUS.PUBLISHED;
    notifyTitle = 'تم نشر مادتك';
    extra.heldAt = null; // approving clears any rejection hold
  } else if (action === REVIEW_ACTIONS.REQUEST_EDIT) {
    newStatus = MATERIAL_STATUS.NEEDS_EDIT;
    notifyTitle = 'مادتك تحتاج إلى تعديل';
    extra.heldAt = null;
  } else if (isFirstRejection) {
    // First rejection → hold (not rejected). The submitter isn't notified yet.
    newStatus = MATERIAL_STATUS.HELD;
    extra.heldAt = new Date();
    extra.firstRejectedById = user.id;
  } else if (action === REVIEW_ACTIONS.DRAFT) {
    newStatus = MATERIAL_STATUS.DRAFT;
  }

  // Only a finalized rejection frees storage — a hold keeps the files.
  const clearFiles = newStatus === MATERIAL_STATUS.REJECTED;
  if (clearFiles) {
    await deleteUpload(material.fileUrl, material.id);
    await deleteUpload(material.coverImage, material.id);
  }

  await prisma.material.update({
    where: { id: materialId },
    data: {
      status: newStatus,
      reviewedById: user.id,
      // Record the FIRST approver once — never overwrite (kept for the record;
      // the deletion vote now includes every reviewer, none excluded).
      ...(action === REVIEW_ACTIONS.APPROVE && !material.firstApprovedById
        ? { firstApprovedById: user.id }
        : {}),
      publishedAt:
        newStatus === MATERIAL_STATUS.PUBLISHED
          ? material.publishedAt ?? new Date()
          : material.publishedAt,
      ...extra,
      ...(clearFiles ? { fileUrl: null, coverImage: null } : {}),
    },
  });

  await prisma.reviewNote.create({
    data: { materialId, reviewerId: user.id, action, reason, note },
  });

  if (material.submittedById && notifyTitle) {
    const body = `«${material.title}» — ${STATUS_LABELS[newStatus as keyof typeof STATUS_LABELS]}${
      reason ? ` (${reason})` : ''
    }`;
    // The exact page this decision should open. A NEEDS_EDIT material is not
    // public, so it must go to the edit page (not the public detail, which 404s
    // — the reported «غير موجودة» bug); a published one opens its detail; anything
    // else (held/draft) goes to the account page.
    const to =
      newStatus === MATERIAL_STATUS.NEEDS_EDIT ? `/account/edit/${material.id}`
      : newStatus === MATERIAL_STATUS.PUBLISHED ? `/material/${material.id}`
      : '/account';
    await prisma.notification.create({
      data: { userId: material.submittedById, title: notifyTitle, body, link: to },
    });
    // Also push to the contributor's device so accept / needs-edit / (a first
    // rejection shows as «معلّقة») reach them even when the app is closed.
    await pushToUsers([material.submittedById], {
      title: notifyTitle,
      body,
      data: { materialId: material.id, type: 'review_decision', to },
    }).catch(() => {});
  }

  await logActivity({
    userId: user.id,
    action: action.toLowerCase(),
    entity: 'material',
    entityId: materialId,
    meta: { title: material.title, reason },
  });

  // First publication → OS push to every registered device. Guarded on
  // publishedAt so re-approving an already-published material doesn't re-notify.
  if (action === REVIEW_ACTIONS.APPROVE && !wasPublishedBefore) {
    await notifyAllNewMaterial({
      id: material.id,
      title: material.title,
      category: material.category ? { name: material.category.name } : null,
    }).catch(() => {});
  }

  // First rejection put the material on hold → ask the OTHER reviewers of the
  // section to weigh in (a second rejection finalizes it; else it auto-publishes).
  if (isFirstRejection) {
    const staff = await loadReviewStaff();
    const others = sectionSupervisors(staff, material.category?.slug ?? '').filter((u) => u.id !== user.id);
    if (others.length) {
      const body = `علّق ${user.name} «${material.title}» برفضٍ أوّل. يلزم رفض مراجع ثانٍ خلال ${HOLD_DAYS} أيام وإلا نُشرت.`;
      await prisma.notification.createMany({
        data: others.map((u) => ({
          userId: u.id,
          title: 'مادة معلّقة تحتاج رأيك',
          body,
          link: `/admin/review/${material.id}`,
        })),
      });
      await pushToUsers(others.map((u) => u.id), {
        title: 'مادة معلّقة تحتاج رأيك',
        body,
        data: { materialId: material.id, type: 'review_hold' },
      }).catch(() => {});
    }
  }

  revalidatePath('/admin');
  revalidatePath('/admin/submissions');
  redirect(`/admin/submissions?${isFirstRejection ? 'held=1' : 'done=1'}`);
}

// ---- Edit material data ----------------------------------------------------
export async function editMaterialAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || !can.editSubmission(user.role as Role)) throw new Error('غير مصرّح');

  const id = formData.get('id') as string;
  const get = (k: string) => {
    const v = formData.get(k);
    return v == null || v === '' ? null : String(v);
  };
  // Plain-text getter: also strips HTML entities the editor can leak in (e.g.
  // «&nbsp;»), so edits never re-introduce them. bodyText keeps get() (HTML).
  const getText = (k: string) => {
    const v = get(k);
    if (v == null) return null;
    const t = decodeEntities(v).trim();
    return t === '' ? null : t;
  };
  // Single-line names/labels: fully normalized so the same name always matches.
  const getLine = (k: string) => normalizeLine(getText(k));

  const categorySlug = get('categorySlug');
  const category = categorySlug
    ? await prisma.category.findUnique({ where: { slug: categorySlug } })
    : null;

  // Section scoping: the editor must have access to both the material's current
  // section and (if moving it) the target section.
  const current = await prisma.material.findUnique({
    where: { id },
    include: { category: { select: { slug: true } } },
  });
  if (!current) throw new Error('المادة غير موجودة');
  if (!canAccessCategory(user, current.category?.slug)) throw new Error('غير مصرّح لهذا القسم');
  if (category && !canAccessCategory(user, category.slug)) throw new Error('غير مصرّح للقسم المستهدف');

  // Snapshot current state before overwriting (edit history).
  await snapshotMaterial(id, user.id, user.name, 'edit');

  const fields = {
    title: getLine('title') ?? undefined,
    subtitle: getLine('subtitle'),
    bodyText: get('bodyText'),
    performer: getLine('performer'),
    narrator: getLine('narrator'),
    speaker: getLine('speaker'),
    host: getLine('host'),
    participants: getLine('participants'),
    occasion: getLine('occasion'),
    topic: getLine('topic'),
    place: getLine('place'),
    city: getLine('city'),
    organizer: getLine('organizer'),
    description: getText('description'),
    summary: getText('summary'),
    lyrics: getText('lyrics'),
    keywords: getLine('keywords'),
    author: getLine('author'),
    source: getLine('source'),
    docType: getLine('docType'),
  };

  // Cover image: hidden field is always present; empty string clears it.
  const coverRaw = formData.get('coverImage');
  let coverImage = coverRaw == null ? undefined : String(coverRaw) || null;
  // Only accept a cover from our own storage; anything else keeps the current one.
  if (coverImage && !isOwnUploadUrl(coverImage)) coverImage = undefined;

  // Record date (optional): parse safely; invalid/empty clears it.
  const dateRaw = get('recordDate');
  let recordDate: Date | null | undefined = undefined;
  if (formData.has('recordDate')) {
    if (!dateRaw) recordDate = null;
    else {
      const d = new Date(dateRaw);
      recordDate = Number.isNaN(d.getTime()) ? null : d;
    }
  }

  await prisma.material.update({
    where: { id },
    data: {
      ...fields,
      ...(category ? { categoryId: category.id } : {}),
      ...(coverImage !== undefined ? { coverImage } : {}),
      ...(recordDate !== undefined ? { recordDate } : {}),
      searchText: buildSearchText({ ...fields, title: fields.title ?? '' }),
    },
  });

  await logActivity({
    userId: user.id,
    action: 'edit',
    entity: 'material',
    entityId: id,
  });

  revalidatePath(`/admin/review/${id}`);
  redirect(`/admin/review/${id}?saved=1`);
}

// ---- Merge duplicate materials --------------------------------------------
// Merges `sourceId` into `targetId`: favorites & reports move to the target,
// metrics are summed, the source is marked HIDDEN + mergedInto, and a version
// snapshot records the merge.
export async function mergeMaterialsAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || !can.manageContent(user.role as Role)) throw new Error('غير مصرّح');

  const sourceId = formData.get('sourceId') as string;
  const targetId = formData.get('targetId') as string;
  if (!sourceId || !targetId || sourceId === targetId) {
    redirect('/admin/materials?merge=invalid');
  }

  const [source, target] = await Promise.all([
    prisma.material.findUnique({ where: { id: sourceId } }),
    prisma.material.findUnique({ where: { id: targetId } }),
  ]);
  if (!source || !target) redirect('/admin/materials?merge=notfound');

  await snapshotMaterial(targetId, user.id, user.name, 'merge');

  // Move favorites (skip ones that would duplicate), reassign reports.
  const favs = await prisma.favorite.findMany({ where: { materialId: sourceId } });
  for (const f of favs) {
    await prisma.favorite
      .update({ where: { id: f.id }, data: { materialId: targetId } })
      .catch(async () => {
        // target already favorited by this user → drop the duplicate
        await prisma.favorite.delete({ where: { id: f.id } });
      });
  }
  await prisma.contentReport.updateMany({
    where: { materialId: sourceId },
    data: { materialId: targetId },
  });

  await prisma.material.update({
    where: { id: targetId },
    data: {
      downloads: { increment: source!.downloads },
      plays: { increment: source!.plays },
    },
  });

  await prisma.material.update({
    where: { id: sourceId },
    data: { status: MATERIAL_STATUS.HIDDEN, mergedIntoId: targetId },
  });

  await logActivity({
    userId: user.id,
    action: 'merge',
    entity: 'material',
    entityId: sourceId,
    meta: { into: targetId, title: source!.title },
  });

  revalidatePath('/admin/materials');
  redirect('/admin/materials?merged=1');
}

// ---- Toggle hide/publish (content managers) --------------------------------
export async function toggleHideAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || !can.manageContent(user.role as Role)) throw new Error('غير مصرّح');
  const id = formData.get('id') as string;
  const material = await prisma.material.findUnique({ where: { id } });
  if (!material) throw new Error('غير موجودة');

  const next =
    material.status === MATERIAL_STATUS.HIDDEN
      ? MATERIAL_STATUS.PUBLISHED
      : MATERIAL_STATUS.HIDDEN;

  await prisma.material.update({ where: { id }, data: { status: next } });
  await logActivity({
    userId: user.id,
    action: next === MATERIAL_STATUS.HIDDEN ? 'hide' : 'unhide',
    entity: 'material',
    entityId: id,
  });
  revalidatePath('/admin/materials');
}

// ---- Change user role (admin only) -----------------------------------------
export async function changeRoleAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || !can.manageUsers(user.role as Role)) throw new Error('غير مصرّح');
  const id = formData.get('id') as string;
  const role = formData.get('role') as string;
  if (!Object.values(ROLES).includes(role as Role)) throw new Error('دور غير صحيح');

  // Section scoping: validate the submitted slugs against real categories.
  const slugs = (formData.getAll('categories') as string[]).map((s) => s.trim()).filter(Boolean);
  const valid = await prisma.category.findMany({
    where: { slug: { in: slugs } },
    select: { slug: true },
  });
  const assignedCategories = valid.length ? valid.map((c) => c.slug).join(',') : null;

  await prisma.user.update({ where: { id }, data: { role, assignedCategories } });
  await logActivity({
    userId: user.id,
    action: 'change_role',
    entity: 'user',
    entityId: id,
    meta: { role, assignedCategories },
  });
  revalidatePath('/admin/users');
}

export async function toggleUserActiveAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || !can.manageUsers(user.role as Role)) throw new Error('غير مصرّح');
  const id = formData.get('id') as string;
  if (id === user.id) throw new Error('لا يمكنك تعطيل حسابك');
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) throw new Error('غير موجود');
  await prisma.user.update({ where: { id }, data: { active: !target.active } });
  revalidatePath('/admin/users');
}

// ---- Restore a rejected/hidden material to published -----------------------
export async function restoreMaterialAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || !can.reviewContent(user.role as Role)) throw new Error('غير مصرّح');
  const id = formData.get('id') as string;
  const material = await prisma.material.findUnique({ where: { id } });
  if (!material) throw new Error('غير موجودة');

  await prisma.material.update({
    where: { id },
    data: {
      status: MATERIAL_STATUS.PUBLISHED,
      reviewedById: user.id,
      publishedAt: material.publishedAt ?? new Date(),
      mergedIntoId: null,
    },
  });
  await prisma.reviewNote.create({
    data: { materialId: id, reviewerId: user.id, action: REVIEW_ACTIONS.APPROVE, reason: 'استعادة ونشر' },
  });
  if (material.submittedById) {
    await prisma.notification.create({
      data: {
        userId: material.submittedById,
        title: 'تمت استعادة مادتك ونشرها',
        body: `«${material.title}» أصبحت منشورة من جديد.`,
        link: '/account',
      },
    });
    await pushToUsers([material.submittedById], {
      title: 'تمت استعادة مادتك ونشرها',
      body: `«${material.title}» أصبحت منشورة من جديد.`,
      data: { materialId: id, type: 'material_restored' },
    }).catch(() => {});
  }
  await logActivity({ userId: user.id, action: 'restore', entity: 'material', entityId: id });
  revalidatePath('/admin/materials');
  revalidatePath(`/admin/review/${id}`);
  redirect(`/admin/review/${id}?restored=1`);
}

// ---- Roll a material back to a previous version snapshot --------------------
const ROLLBACK_FIELDS = [
  'title', 'description', 'lyrics', 'summary', 'performer', 'narrator',
  'speaker', 'host', 'participants', 'occasion', 'topic', 'place', 'city',
  'organizer', 'language', 'keywords', 'fileUrl', 'fileKind', 'fileType',
  'fileSize', 'durationSec', 'coverImage',
] as const;

export async function rollbackVersionAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || !can.editContent(user.role as Role)) throw new Error('غير مصرّح');
  const versionId = formData.get('versionId') as string;

  const version = await prisma.materialVersion.findUnique({ where: { id: versionId } });
  if (!version) throw new Error('النسخة غير موجودة');
  const materialId = version.materialId;

  // Save the current state before rolling back.
  await snapshotMaterial(materialId, user.id, user.name, 'rollback');

  const snap = JSON.parse(version.snapshot) as Record<string, unknown>;
  const data: Record<string, unknown> = {};
  for (const key of ROLLBACK_FIELDS) {
    if (key in snap) data[key] = snap[key] ?? null;
  }
  if ('recordDate' in snap) {
    data.recordDate = snap.recordDate ? new Date(snap.recordDate as string) : null;
  }
  data.searchText = buildSearchText(data as Parameters<typeof buildSearchText>[0]);

  await prisma.material.update({ where: { id: materialId }, data });
  await logActivity({ userId: user.id, action: 'rollback', entity: 'material', entityId: materialId });
  revalidatePath(`/admin/review/${materialId}`);
  redirect(`/admin/review/${materialId}?rolledback=1`);
}

// ---- Shared deletion primitive (files + DB row, cascades children) ----------
// `material` must carry the stored-file fields so their blobs are removed too.
async function performMaterialDeletion(
  material: {
    id: string;
    title: string;
    fileUrl: string | null;
    coverImage: string | null;
    originalFileUrl?: string | null;
    originalCoverImage?: string | null;
  },
  actorId: string,
) {
  await deleteUpload(material.fileUrl, material.id);
  await deleteUpload(material.coverImage, material.id);
  await deleteUpload(material.originalFileUrl ?? null, material.id);
  await deleteUpload(material.originalCoverImage ?? null, material.id);
  // Deleting the material cascades its children — including any DeletionRequest.
  // Idempotent: if a concurrent vote/rejection already removed it, don't error.
  try {
    await prisma.material.delete({ where: { id: material.id } });
  } catch (e: unknown) {
    if ((e as { code?: string })?.code === 'P2025') return; // already deleted
    throw e;
  }
  await logActivity({
    userId: actorId,
    action: 'delete',
    entity: 'material',
    entityId: material.id,
    meta: { title: material.title },
  });
}

// ---- ADMIN direct delete — ONLY at the owner's request or a technical issue --
// Policy: an admin may not delete on their own judgement even though they
// technically can; they must record one of these two justifications.
export async function deleteMaterialAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || user.role !== ROLES.ADMIN) throw new Error('غير مصرّح');
  const id = formData.get('id') as string;
  const justification = formData.get('justification') as string; // owner_request | technical
  if (justification !== 'owner_request' && justification !== 'technical') {
    redirect('/admin/materials?delneedjust=1');
  }
  const material = await prisma.material.findUnique({ where: { id } });
  if (!material) throw new Error('غير موجودة');

  await performMaterialDeletion(material, user.id);
  await logActivity({
    userId: user.id,
    action: 'delete_admin',
    entity: 'material',
    entityId: id,
    meta: { title: material.title, justification },
  });
  revalidatePath('/admin/materials');
  redirect('/admin/materials?deleted=1');
}

// Load the deletion vote state for a material and act on the current tally:
// delete on a strict majority of the section's supervisors, keep (and close the
// request) once a majority is no longer reachable. Returns the decision taken.
async function resolveDeletionTally(requestId: string): Promise<'delete' | 'keep' | 'pending'> {
  const req = await prisma.deletionRequest.findUnique({
    where: { id: requestId },
    include: {
      material: { include: { category: { select: { slug: true } } } },
      votes: true,
    },
  });
  if (!req) return 'keep';
  const staff = await loadReviewStaff();
  const pool = sectionSupervisors(staff, req.material.category.slug);
  const poolIds = new Set(pool.map((u) => u.id));
  const { decision } = tallyDeletion(pool.length, poolIds, req.votes);

  // Notify the whole section pool of the outcome (a deletion is rare + important).
  const notifyPool = async (title: string, body: string) => {
    await prisma.notification.createMany({
      data: pool.map((u) => ({ userId: u.id, title, body, link: '/admin/materials' })),
    });
    await pushToUsers(pool.map((u) => u.id), { title, body, data: { type: 'deletion_outcome' } }).catch(() => {});
  };

  if (decision === 'delete') {
    await performMaterialDeletion(req.material, req.requestedById);
    await notifyPool('تم حذف المادة', `وافقت أغلبية مراجعي القسم فحُذفت «${req.material.title}».`);
  } else if (decision === 'keep') {
    try {
      await prisma.deletionRequest.delete({ where: { id: requestId } });
    } catch (e: unknown) {
      if ((e as { code?: string })?.code !== 'P2025') throw e; // already closed
    }
    await notifyPool('أُبقيت المادة', `لم تبلغ الأغلبية المطلوبة لحذف «${req.material.title}»، فبقيت في الأرشيف.`);
  }
  return decision;
}

// ---- A supervisor opens a deletion request (majority vote) ------------------
export async function requestMaterialDeletionAction(formData: FormData) {
  const user = await requireReviewer();
  const id = formData.get('id') as string;
  const reason = ((formData.get('reason') as string) || '').trim() || null;

  const material = await prisma.material.findUnique({
    where: { id },
    include: { category: { select: { slug: true } }, deletionRequest: true },
  });
  if (!material) throw new Error('غير موجودة');
  if (!canAccessCategory(user, material.category?.slug)) throw new Error('غير مصرّح لهذا القسم');
  if (material.deletionRequest) redirect('/admin/materials?delexists=1');

  const staff = await loadReviewStaff();
  const pool = sectionSupervisors(staff, material.category.slug);
  if (!pool.some((u) => u.id === user.id)) throw new Error('لست من مراجعي هذا القسم');

  // Create the request and record the requester's own vote as an approval.
  const req = await prisma.deletionRequest.create({
    data: {
      materialId: id,
      requestedById: user.id,
      reason,
      votes: { create: { voterId: user.id, vote: DELETION_VOTE.APPROVE } },
    },
  });

  // A lone supervisor (pool of one) is already a majority → delete now.
  const decision = await resolveDeletionTally(req.id);
  if (decision === 'delete') {
    revalidatePath('/admin/materials');
    redirect('/admin/materials?deleted=1');
  }

  // Otherwise notify the other supervisors to cast their vote.
  const voteBody = `طلب ${user.name} حذف «${material.title}»${reason ? ` — السبب: ${reason}` : ''}. صوّت في «إدارة المواد».`;
  const otherIds = pool.filter((u) => u.id !== user.id).map((u) => u.id);
  await prisma.notification.createMany({
    data: otherIds.map((uid) => ({
      userId: uid,
      title: 'طلب حذف مادة يحتاج تصويتك',
      body: voteBody,
      link: '/admin/materials',
    })),
  });
  await pushToUsers(otherIds, {
    title: 'طلب حذف مادة يحتاج تصويتك',
    body: voteBody,
    data: { materialId: id, type: 'deletion_vote' },
  }).catch(() => {});
  await logActivity({
    userId: user.id,
    action: 'delete_request',
    entity: 'material',
    entityId: id,
    meta: { title: material.title, reason, pool: pool.length },
  });
  revalidatePath('/admin/materials');
  redirect('/admin/materials?delreq=1');
}

// ---- A supervisor votes on a deletion request (approve / reject) ------------
export async function voteMaterialDeletionAction(formData: FormData) {
  const user = await requireReviewer();
  const requestId = formData.get('requestId') as string;
  const vote = formData.get('vote') === DELETION_VOTE.REJECT ? DELETION_VOTE.REJECT : DELETION_VOTE.APPROVE;

  const req = await prisma.deletionRequest.findUnique({
    where: { id: requestId },
    include: { material: { include: { category: { select: { slug: true } } } } },
  });
  if (!req) redirect('/admin/materials');
  if (!canAccessCategory(user, req.material.category?.slug)) throw new Error('غير مصرّح لهذا القسم');

  const staff = await loadReviewStaff();
  const pool = sectionSupervisors(staff, req.material.category.slug);
  if (!pool.some((u) => u.id === user.id)) throw new Error('لست من مراجعي هذا القسم');

  await prisma.deletionVote.upsert({
    where: { requestId_voterId: { requestId, voterId: user.id } },
    create: { requestId, voterId: user.id, vote },
    update: { vote },
  });
  await logActivity({
    userId: user.id,
    action: vote === DELETION_VOTE.REJECT ? 'delete_reject' : 'delete_approve',
    entity: 'material',
    entityId: req.material.id,
    meta: { title: req.material.title },
  });

  const decision = await resolveDeletionTally(requestId);
  revalidatePath('/admin/materials');
  if (decision === 'delete') redirect('/admin/materials?deleted=1');
  if (decision === 'keep') redirect('/admin/materials?delkept=1');
  redirect('/admin/materials?delvoted=1');
}

// ---- Requester (or admin) cancels a pending deletion request ----------------
export async function cancelMaterialDeletionAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || !can.reviewContent(user.role as Role)) throw new Error('غير مصرّح');
  const requestId = formData.get('requestId') as string;
  const req = await prisma.deletionRequest.findUnique({ where: { id: requestId } });
  if (!req) redirect('/admin/materials');
  if (req.requestedById !== user.id && user.role !== ROLES.ADMIN) {
    throw new Error('لا يمكنك إلغاء طلب غيرك');
  }
  try {
    await prisma.deletionRequest.delete({ where: { id: requestId } });
  } catch (e: unknown) {
    if ((e as { code?: string })?.code !== 'P2025') throw e; // already resolved/cancelled
  }
  await logActivity({
    userId: user.id,
    action: 'delete_cancel',
    entity: 'material',
    entityId: req.materialId,
  });
  revalidatePath('/admin/materials');
  redirect('/admin/materials?delcancelled=1');
}

// ---- Delete a user (admin only) --------------------------------------------
export async function deleteUserAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || !can.manageUsers(user.role as Role)) throw new Error('غير مصرّح');
  const id = formData.get('id') as string;
  if (id === user.id) throw new Error('لا يمكنك حذف حسابك');
  // Their submitted/reviewed materials remain (author becomes null).
  await prisma.user.delete({ where: { id } });
  await logActivity({ userId: user.id, action: 'delete', entity: 'user', entityId: id });
  revalidatePath('/admin/users');
  redirect('/admin/users?userdeleted=1');
}

// ---- Reset a user's password (admin only) — helps a locked-out user --------
export async function resetUserPasswordAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || !can.manageUsers(user.role as Role)) throw new Error('غير مصرّح');
  const id = formData.get('id') as string;
  // A short random temporary password the admin can hand to the user.
  const temp = Math.random().toString(36).slice(-8);
  await prisma.user.update({
    where: { id },
    data: { passwordHash: await hashPassword(temp), active: true },
  });
  await logActivity({ userId: user.id, action: 'reset_password', entity: 'user', entityId: id });
  revalidatePath('/admin/users');
  redirect(`/admin/users?tempuser=${id}&temppass=${encodeURIComponent(temp)}`);
}

export async function resolveReportAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || !can.manageContent(user.role as Role)) throw new Error('غير مصرّح');
  const id = formData.get('id') as string;
  await prisma.contentReport.update({ where: { id }, data: { resolved: true } });
  revalidatePath('/admin/reports');
}
