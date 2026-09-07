'use server';

import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { submissionSchema } from '@/lib/validation';
import { MATERIAL_STATUS } from '@/lib/constants';
import { logActivity } from '@/lib/activity';
import { buildSearchText } from '@/lib/search';
import { snapshotMaterial } from '@/lib/history';

export interface SubmitState {
  error?: string;
}

// Parse a date input safely — "لا أعلم"/invalid values become null.
function parseDate(value?: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function submitMaterialAction(
  _prev: SubmitState,
  formData: FormData,
): Promise<SubmitState> {
  const user = await getCurrentUser();
  if (!user) return { error: 'يجب تسجيل الدخول لإرسال مادة' };

  const raw = Object.fromEntries(formData.entries());
  const parsed = submissionSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'يرجى استكمال البيانات قبل الإرسال' };
  }
  const d = parsed.data;

  const category = await prisma.category.findUnique({
    where: { slug: d.categorySlug },
  });
  if (!category) return { error: 'التصنيف غير موجود' };

  const material = await prisma.material.create({
    data: {
      title: d.title,
      status: MATERIAL_STATUS.PENDING,
      categoryId: category.id,
      description: d.description || null,
      lyrics: d.lyrics || null,
      summary: d.summary || null,
      performer: d.performer || null,
      narrator: d.narrator || null,
      speaker: d.speaker || null,
      host: d.host || null,
      participants: d.participants || null,
      occasion: d.occasion || null,
      topic: d.topic || null,
      place: d.place || null,
      city: d.city || null,
      organizer: d.organizer || null,
      language: d.language || 'العربية',
      recordDate: parseDate(d.recordDate),
      keywords: d.keywords || null,
      fileUrl: d.fileUrl || null,
      fileKind: d.fileKind || 'AUDIO',
      fileType: d.fileType || null,
      fileSize: d.fileSize || null,
      durationSec: d.durationSec || null,
      coverImage: d.coverImage || null,
      source: user.name,
      submittedById: user.id,
      searchText: buildSearchText(d),
    },
  });

  await prisma.notification.create({
    data: {
      userId: user.id,
      title: 'تم استلام المادة',
      body: `«${material.title}» قيد المراجعة الآن.`,
      link: `/account`,
    },
  });

  await logActivity({
    userId: user.id,
    action: 'submit',
    entity: 'material',
    entityId: material.id,
    meta: { title: material.title },
  });

  redirect('/account?submitted=1');
}

// Contributor edits & resubmits a material that was returned for editing.
export async function resubmitMaterialAction(
  _prev: SubmitState,
  formData: FormData,
): Promise<SubmitState> {
  const user = await getCurrentUser();
  if (!user) return { error: 'يجب تسجيل الدخول' };

  const id = formData.get('id') as string;
  const material = await prisma.material.findUnique({ where: { id } });
  if (!material || material.submittedById !== user.id) {
    return { error: 'لا تملك صلاحية تعديل هذه المادة' };
  }

  const raw = Object.fromEntries(formData.entries());
  const parsed = submissionSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'يرجى استكمال البيانات' };
  }
  const d = parsed.data;

  // Snapshot the current data before overwriting (edit history).
  await snapshotMaterial(id, user.id, user.name, 'resubmit');

  await prisma.material.update({
    where: { id },
    data: {
      title: d.title,
      status: MATERIAL_STATUS.PENDING,
      description: d.description || null,
      lyrics: d.lyrics || null,
      summary: d.summary || null,
      performer: d.performer || null,
      narrator: d.narrator || null,
      speaker: d.speaker || null,
      host: d.host || null,
      participants: d.participants || null,
      occasion: d.occasion || null,
      topic: d.topic || null,
      place: d.place || null,
      city: d.city || null,
      organizer: d.organizer || null,
      recordDate: parseDate(d.recordDate),
      keywords: d.keywords || null,
      searchText: buildSearchText(d),
      ...(d.fileUrl
        ? {
            fileUrl: d.fileUrl,
            fileKind: d.fileKind || 'AUDIO',
            fileType: d.fileType || null,
            fileSize: d.fileSize || null,
          }
        : {}),
    },
  });

  await prisma.reviewNote.create({
    data: { materialId: id, reviewerId: user.id, action: 'RESUBMIT', note: 'أعاد المساهم إرسال المادة بعد التعديل.' },
  });

  redirect('/account?resubmitted=1');
}
