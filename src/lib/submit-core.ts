import 'server-only';
import { prisma } from './prisma';
import { submissionSchema } from './validation';
import { MATERIAL_STATUS } from './constants';
import { logActivity } from './activity';
import { buildSearchText } from './search';
import { getCategoryForm, isFileKindAllowed } from './fields';
import { notifyReviewersNewSubmission } from './push';
import { decodeEntities } from './format';

// Shared submission core used by BOTH the website form (submitMaterialAction)
// and the mobile share-to-app endpoint (/api/mobile/submit), so a material
// created either way passes the exact same validation and is stored identically
// — the two paths can never diverge or conflict.

export function clean(value?: string | null): string | null {
  if (!value) return null;
  const t = value.trim();
  return t === '' ? null : t;
}

// Plain-text fields: also strip HTML entities (e.g. «&nbsp;») that the rich
// editor can leak in, so they are never stored raw. bodyText stays HTML.
export function cleanText(value?: string | null): string | null {
  const c = clean(value);
  return c == null ? null : decodeEntities(c);
}

export function parseDate(value?: string | null): Date | null {
  const c = clean(value);
  if (!c) return null;
  const d = new Date(c);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function cleanFields(d: Record<string, unknown>) {
  const s = (k: string) => cleanText(d[k] as string | null | undefined);
  return {
    title: decodeEntities(String(d.title ?? '').trim()),
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

export function validateCategoryFields(categorySlug: string, fields: Record<string, string | null>) {
  const form = getCategoryForm(categorySlug);
  if (!form) return 'نوع المادة غير مدعوم';
  for (const field of form.fields) {
    if (field.required && !fields[field.name]) return `الحقل «${field.label}» مطلوب`;
  }
  if (!fields.title) return `الحقل «${form.titleLabel}» مطلوب`;
  return null;
}

export interface CreateSubmissionResult {
  materialId?: string;
  error?: string;
}

/**
 * Validate + create a PENDING submission for `user` from raw form/JSON input.
 * Returns { materialId } on success or { error } with an Arabic message.
 * Does NOT redirect — callers handle their own response.
 */
export async function createSubmission(
  user: { id: string; name: string },
  raw: Record<string, unknown>,
): Promise<CreateSubmissionResult> {
  const parsed = submissionSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'يرجى استكمال البيانات قبل الإرسال' };
  }
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

  await prisma.notification.create({
    data: { userId: user.id, title: 'تم استلام المادة', body: `«${material.title}» قيد المراجعة الآن.`, link: '/account' },
  });
  await notifyReviewersNewSubmission({
    id: material.id,
    title: material.title,
    category: { slug: category.slug, name: category.name },
  }).catch(() => {});
  await logActivity({ userId: user.id, action: 'submit', entity: 'material', entityId: material.id, meta: { title: material.title } });

  return { materialId: material.id };
}
