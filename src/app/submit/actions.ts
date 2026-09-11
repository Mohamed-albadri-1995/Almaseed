'use server';

import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { submissionSchema } from '@/lib/validation';
import { MATERIAL_STATUS } from '@/lib/constants';
import { logActivity } from '@/lib/activity';
import { buildSearchText } from '@/lib/search';
import { snapshotMaterial } from '@/lib/history';
import { getCategoryForm, isFileKindAllowed } from '@/lib/fields';
import { notifyReviewersNewSubmission } from '@/lib/push';

export interface SubmitState { error?: string; }

function clean(value?: string | null): string | null {
  if (!value) return null;
  const t = value.trim();
  return t === '' ? null : t;
}

function parseDate(value?: string | null): Date | null {
  const c = clean(value);
  if (!c) return null;
  const d = new Date(c);
  return Number.isNaN(d.getTime()) ? null : d;
}

function cleanFields(d: Record<string, unknown>) {
  const s = (k: string) => clean(d[k] as string | null | undefined);
  return {
    title: String(d.title ?? '').trim(),
    subtitle: s('subtitle'),
    bodyText: clean(d.bodyText as string | null | undefined),
    description: s('description'), lyrics: s('lyrics'), summary: s('summary'),
    performer: s('performer'), narrator: s('narrator'), speaker: s('speaker'),
    host: s('host'), participants: s('participants'), occasion: s('occasion'),
    topic: s('topic'), place: s('place'), city: s('city'), organizer: s('organizer'),
    source: s('source'), author: s('author'), keywords: s('keywords'),
    docType: s('docType'),
  };
}

function validateCategoryFields(categorySlug: string, fields: Record<string, string | null>) {
  const form = getCategoryForm(categorySlug);
  if (!form) return 'نوع المادة غير مدعوم';
  for (const field of form.fields) {
    if (field.required && !fields[field.name]) return `الحقل «${field.label}» مطلوب`;
  }
  if (!fields.title) return `الحقل «${form.titleLabel}» مطلوب`;
  return null;
}

export async function submitMaterialAction(_prev: SubmitState, formData: FormData): Promise<SubmitState> {
  const user = await getCurrentUser();
  if (!user) return { error: 'يجب تسجيل الدخول لإرسال مادة' };

  const raw = Object.fromEntries(formData.entries());
  const parsed = submissionSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'يرجى استكمال البيانات قبل الإرسال' };
  const d = parsed.data;
  const category = await prisma.category.findUnique({ where: { slug: d.categorySlug } });
  if (!category) return { error: 'التصنيف غير موجود' };

  const f = cleanFields(d);
  const fieldError = validateCategoryFields(d.categorySlug, f);
  if (fieldError) return { error: fieldError };

  const form = getCategoryForm(d.categorySlug);
  const hasFile = !!d.fileUrl;
  const hasArticle = !!(d.bodyText && d.bodyText.trim());
  if (form?.article) {
    if (!hasFile && !hasArticle) return { error: 'أرفق ملفاً أو اكتب مادة نصية قبل الإرسال' };
  } else if (!hasFile) {
    return { error: 'يجب رفع الملف واكتمال التحميل قبل الإرسال' };
  }
  if (hasFile && !isFileKindAllowed(d.categorySlug, d.fileKind)) {
    return { error: 'نوع الملف غير مسموح لهذا القسم — يُقبل الصوت والفيديو فقط.' };
  }

  const material = await prisma.material.create({
    data: {
      ...f,
      status: MATERIAL_STATUS.PENDING,
      categoryId: category.id,
      language: clean(d.language) || 'العربية',
      recordDate: parseDate(d.recordDate),
      fileUrl: d.fileUrl || null,
      fileKind: d.fileUrl ? d.fileKind || 'AUDIO' : null,
      fileType: d.fileType || null,
      fileSize: d.fileSize || null,
      durationSec: d.durationSec || null,
      coverImage: d.coverImage || null,
      source: f.source || user.name,
      submittedById: user.id,
      searchText: buildSearchText(f),
    },
  });

  await prisma.notification.create({ data: { userId: user.id, title: 'تم استلام المادة', body: `«${material.title}» قيد المراجعة الآن.`, link: '/account' } });
  // Push the reviewers/admins who have the app (keeps them alert). Non-blocking.
  await notifyReviewersNewSubmission({
    id: material.id,
    title: material.title,
    category: { slug: category.slug, name: category.name },
  }).catch(() => {});
  await logActivity({ userId: user.id, action: 'submit', entity: 'material', entityId: material.id, meta: { title: material.title } });
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
      ...(d.fileUrl ? { fileUrl: d.fileUrl, fileKind: d.fileKind || 'AUDIO', fileType: d.fileType || null, fileSize: d.fileSize || null, durationSec: d.durationSec || null } : {}),
    },
  });
  await prisma.reviewNote.create({ data: { materialId: id, reviewerId: user.id, action: 'RESUBMIT', note: 'أعاد المساهم إرسال المادة بعد التعديل.' } });
  redirect('/account?resubmitted=1');
}
