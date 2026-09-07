'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { can } from '@/lib/rbac';
import { logActivity } from '@/lib/activity';
import { buildSearchText } from '@/lib/search';
import { snapshotMaterial } from '@/lib/history';
import {
  MATERIAL_STATUS,
  REVIEW_ACTIONS,
  STATUS_LABELS,
  type Role,
  ROLES,
} from '@/lib/constants';

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

  const material = await prisma.material.findUnique({ where: { id: materialId } });
  if (!material) throw new Error('المادة غير موجودة');

  // Reason is mandatory for edit-requests and rejections.
  if (
    (action === REVIEW_ACTIONS.REQUEST_EDIT || action === REVIEW_ACTIONS.REJECT) &&
    !reason
  ) {
    redirect(`/admin/review/${materialId}?error=reason`);
  }

  let newStatus = material.status;
  let notifyTitle = '';
  if (action === REVIEW_ACTIONS.APPROVE) {
    newStatus = MATERIAL_STATUS.PUBLISHED;
    notifyTitle = 'تم نشر مادتك';
  } else if (action === REVIEW_ACTIONS.REQUEST_EDIT) {
    newStatus = MATERIAL_STATUS.NEEDS_EDIT;
    notifyTitle = 'مادتك تحتاج إلى تعديل';
  } else if (action === REVIEW_ACTIONS.REJECT) {
    newStatus = MATERIAL_STATUS.REJECTED;
    notifyTitle = 'تم رفض مادتك';
  } else if (action === REVIEW_ACTIONS.DRAFT) {
    newStatus = MATERIAL_STATUS.DRAFT;
  }

  await prisma.material.update({
    where: { id: materialId },
    data: {
      status: newStatus,
      reviewedById: user.id,
      publishedAt:
        newStatus === MATERIAL_STATUS.PUBLISHED
          ? material.publishedAt ?? new Date()
          : material.publishedAt,
    },
  });

  await prisma.reviewNote.create({
    data: { materialId, reviewerId: user.id, action, reason, note },
  });

  if (material.submittedById && notifyTitle) {
    await prisma.notification.create({
      data: {
        userId: material.submittedById,
        title: notifyTitle,
        body: `«${material.title}» — ${STATUS_LABELS[newStatus as keyof typeof STATUS_LABELS]}${
          reason ? ` (${reason})` : ''
        }`,
        link: '/account',
      },
    });
  }

  await logActivity({
    userId: user.id,
    action: action.toLowerCase(),
    entity: 'material',
    entityId: materialId,
    meta: { title: material.title, reason },
  });

  revalidatePath('/admin');
  revalidatePath('/admin/submissions');
  redirect('/admin/submissions?done=1');
}

// ---- Edit material data ----------------------------------------------------
export async function editMaterialAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || !can.editContent(user.role as Role)) throw new Error('غير مصرّح');

  const id = formData.get('id') as string;
  const get = (k: string) => {
    const v = formData.get(k);
    return v == null || v === '' ? null : String(v);
  };

  const categorySlug = get('categorySlug');
  const category = categorySlug
    ? await prisma.category.findUnique({ where: { slug: categorySlug } })
    : null;

  // Snapshot current state before overwriting (edit history).
  await snapshotMaterial(id, user.id, user.name, 'edit');

  const fields = {
    title: get('title') ?? undefined,
    performer: get('performer'),
    narrator: get('narrator'),
    speaker: get('speaker'),
    host: get('host'),
    participants: get('participants'),
    occasion: get('occasion'),
    topic: get('topic'),
    place: get('place'),
    city: get('city'),
    organizer: get('organizer'),
    description: get('description'),
    summary: get('summary'),
    lyrics: get('lyrics'),
    keywords: get('keywords'),
  };

  // Cover image: hidden field is always present; empty string clears it.
  const coverRaw = formData.get('coverImage');
  const coverImage = coverRaw == null ? undefined : String(coverRaw) || null;

  await prisma.material.update({
    where: { id },
    data: {
      ...fields,
      ...(category ? { categoryId: category.id } : {}),
      ...(coverImage !== undefined ? { coverImage } : {}),
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

  await prisma.user.update({ where: { id }, data: { role } });
  await logActivity({
    userId: user.id,
    action: 'change_role',
    entity: 'user',
    entityId: id,
    meta: { role },
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

export async function resolveReportAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || !can.manageContent(user.role as Role)) throw new Error('غير مصرّح');
  const id = formData.get('id') as string;
  await prisma.contentReport.update({ where: { id }, data: { resolved: true } });
  revalidatePath('/admin/reports');
}
