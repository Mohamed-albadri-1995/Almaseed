'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { can } from '@/lib/rbac';
import { logActivity } from '@/lib/activity';
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

  await prisma.material.update({
    where: { id },
    data: {
      title: get('title') ?? undefined,
      ...(category ? { categoryId: category.id } : {}),
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

export async function resolveReportAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || !can.manageContent(user.role as Role)) throw new Error('غير مصرّح');
  const id = formData.get('id') as string;
  await prisma.contentReport.update({ where: { id }, data: { resolved: true } });
  revalidatePath('/admin/reports');
}
