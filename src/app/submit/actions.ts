'use server';

import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { submissionSchema } from '@/lib/validation';
import { MATERIAL_STATUS } from '@/lib/constants';
import { logActivity } from '@/lib/activity';
import { buildSearchText } from '@/lib/search';
import { snapshotMaterial } from '@/lib/history';
import { getCategoryForm } from '@/lib/fields';

export interface SubmitState {
  error?: string;
}

const UNKNOWN = 'غير معروف';

// Normalize a text field: empty or the "لا أعلم" marker becomes null.
function clean(value?: string | null): string | null {
  if (!value) return null;
  const t = value.trim();
  return t === '' || t === UNKNOWN ? null : t;
}

// Parse a date input safely — "لا أعلم"/invalid values become null.
function parseDate(value?: string | null): Date | null {
  const c = clean(value);
  if (!c) return null;
  const d = new Date(c);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Build the cleaned text fields shared by create/resubmit.
function cleanFields(d: Record<string, unknown>) {
  const s = (k: string) => clean(d[k] as string | null | undefined);
  return {
    title: (d.title as string).trim(),
    subtitle: s('subtitle'),
    bodyText: (d.bodyText as string | undefined)?.trim() || null,
    description: s('description'),
    lyrics: s('lyrics'),
    summary: s('summary'),
    performer: s('performer'),
    narrator: s('narrator'),
    speaker: s('speaker'),
    host: s('host'),
    participants: s('participants'),
    occasion: s('occasion'),
    topic: s('topic'),
    place: s('place'),
    city: s('city'),
    organizer: s('organizer'),
    keywords: s('keywords'),
  };
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

  // Enforce the file requirement: a file must be uploaded before submitting,
  // except in the readings "article" mode where a typed body is enough.
  const form = getCategoryForm(d.categorySlug);
  const hasFile = !!d.fileUrl;
  const hasArticle = !!(d.bodyText && d.bodyText.trim());
  if (form?.article) {
    if (!hasFile && !hasArticle) {
      return { error: 'أرفق ملفاً أو اكتب مقالاً قبل الإرسال' };
    }
  } else if (!hasFile) {
    return { error: 'يجب رفع الملف واكتمال التحميل قبل الإرسال' };
  }

  const f = cleanFields(d);
  const material = await prisma.material.create({
    data: {
      ...f,
      status: MATERIAL_STATUS.PENDING,
      categoryId: category.id,
      language: clean(d.language) || 'العربية',
      recordDate: parseDate(d.recordDate),
      fileUrl: d.fileUrl || null,
      fileKind: d.fileKind || 'AUDIO',
      fileType: d.fileType || null,
      fileSize: d.fileSize || null,
      durationSec: d.durationSec || null,
      coverImage: d.coverImage || null,
      source: user.name,
      submittedById: user.id,
      searchText: buildSearchText(f),
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

  const f = cleanFields(d);
  await prisma.material.update({
    where: { id },
    data: {
      ...f,
      status: MATERIAL_STATUS.PENDING,
      recordDate: parseDate(d.recordDate),
      searchText: buildSearchText(f),
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
