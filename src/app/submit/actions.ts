'use server';

import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { submissionSchema } from '@/lib/validation';
import { MATERIAL_STATUS } from '@/lib/constants';
import { logActivity } from '@/lib/activity';
import { buildSearchText } from '@/lib/search';
import { snapshotMaterial } from '@/lib/history';
import { isFileKindAllowed } from '@/lib/fields';
import { notifyReviewersNewSubmission } from '@/lib/push';
import { createSubmission, cleanFields, parseDate, validateCategoryFields, uploadUrlError } from '@/lib/submit-core';

export interface SubmitState { error?: string; }

export async function submitMaterialAction(_prev: SubmitState, formData: FormData): Promise<SubmitState> {
  const user = await getCurrentUser();
  if (!user) return { error: 'يجب تسجيل الدخول لإرسال مادة' };

  const raw = Object.fromEntries(formData.entries());
  // Shared with the mobile share-to-app endpoint so both paths validate and
  // store identically (see lib/submit-core).
  const result = await createSubmission({ id: user.id, name: user.name }, raw);
  if (result.error) return { error: result.error };
  redirect('/account?submitted=1');
}

export async function resubmitMaterialAction(_prev: SubmitState, formData: FormData): Promise<SubmitState> {
  const user = await getCurrentUser();
  if (!user) return { error: 'يجب تسجيل الدخول' };
  const id = formData.get('id') as string;
  const material = await prisma.material.findUnique({ where: { id }, include: { category: true } });
  if (!material || material.submittedById !== user.id) return { error: 'لا تملك صلاحية تعديل هذه المادة' };

  const raw = Object.fromEntries(formData.entries());
  const parsed = submissionSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'يرجى استكمال البيانات' };
  const d = parsed.data;
  const urlError = uploadUrlError(d);
  if (urlError) return { error: urlError };
  const f = cleanFields(d);
  const fieldError = validateCategoryFields(d.categorySlug, f);
  if (fieldError) return { error: fieldError };
  if (d.fileUrl && !isFileKindAllowed(d.categorySlug, d.fileKind)) {
    return { error: 'نوع الملف غير مسموح لهذا القسم — يُقبل الصوت والفيديو فقط.' };
  }

  await snapshotMaterial(id, user.id, user.name, 'resubmit');
  await prisma.material.update({
    where: { id },
    data: {
      ...f, status: MATERIAL_STATUS.PENDING,
      recordDate: parseDate(d.recordDate), searchText: buildSearchText(f),
      ...(d.fileUrl ? { fileUrl: d.fileUrl, fileKind: d.fileKind || 'AUDIO', fileType: d.fileType || null, fileSize: d.fileSize || null, durationSec: d.durationSec || null, watermarkedAt: null } : {}),
    },
  });
  await prisma.reviewNote.create({ data: { materialId: id, reviewerId: user.id, action: 'RESUBMIT', note: 'أعاد المساهم إرسال المادة بعد التعديل.' } });

  // Tell the reviewers the edited material is back for review. The reviewer who
  // asked for the edit (material.reviewedById) gets an in-app bell notification
  // so they see it directly; the review pool for the section gets a push so it
  // reaches their device even when the app is closed.
  const newTitle = (f.title as string | null) || material.title;
  if (material.reviewedById) {
    await prisma.notification.create({
      data: { userId: material.reviewedById, title: 'أُعيد إرسال مادة بعد التعديل', body: `«${newTitle}» عدّلها المساهم وأعاد إرسالها للمراجعة.`, link: `/admin/review/${id}` },
    }).catch(() => {});
  }
  await notifyReviewersNewSubmission(
    { id, title: newTitle, category: { slug: material.category.slug, name: material.category.name } },
    { resubmitted: true },
  ).catch(() => {});
  await logActivity({ userId: user.id, action: 'resubmit', entity: 'material', entityId: id, meta: { title: newTitle } });
  redirect('/account?resubmitted=1');
}
