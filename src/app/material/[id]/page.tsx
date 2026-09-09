import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { MediaPlayer } from '@/components/MediaPlayer';
import { PdfViewer } from '@/components/PdfViewer';
import { MaterialCard } from '@/components/MaterialCard';
import {
  ShareButton,
  FavoriteButton,
  ReportButton,
} from '@/components/MaterialActions';
import { StarRating } from '@/components/StarRating';
import { Comments } from '@/components/Comments';
import { Icon } from '@/components/icons';
import { getMaterial, getRelatedMaterials } from '@/lib/queries';
import { getCurrentUser } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { MATERIAL_STATUS } from '@/lib/constants';
import { renderArticle } from '@/lib/richtext';
import {
  formatDate,
  formatDurationLabel,
  formatFileSize,
  splitKeywords,
} from '@/lib/format';

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const m = await getMaterial(params.id);
  if (!m) return { title: 'مادة غير موجودة' };
  return { title: m.title, description: m.description ?? m.summary ?? undefined };
}

export default async function MaterialPage({
  params,
}: {
  params: { id: string };
}) {
  const material = await getMaterial(params.id);
  if (!material) notFound();

  const user = await getCurrentUser();
  const isOwnerOrStaff =
    user && (user.id === material.submittedById || user.role !== 'CONTRIBUTOR');

  // Public visitors only see published materials.
  if (material.status !== MATERIAL_STATUS.PUBLISHED && !isOwnerOrStaff) {
    notFound();
  }

  const [related, favorited, ratingAgg, userRating, commentRows] = await Promise.all([
    getRelatedMaterials(material.id, material.categoryId),
    user
      ? prisma.favorite
          .findUnique({
            where: { userId_materialId: { userId: user.id, materialId: material.id } },
          })
          .then(Boolean)
      : Promise.resolve(false),
    prisma.rating.aggregate({
      where: { materialId: material.id },
      _avg: { value: true },
      _count: { _all: true },
    }),
    user
      ? prisma.rating.findUnique({
          where: { userId_materialId: { userId: user.id, materialId: material.id } },
        })
      : Promise.resolve(null),
    prisma.comment.findMany({
      where: { materialId: material.id, hidden: false },
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { id: true, name: true } } },
    }),
  ]);

  const canModerate = !!user && user.role !== 'CONTRIBUTOR';
  const comments = commentRows.map((c) => ({
    id: c.id,
    body: c.body,
    createdAt: c.createdAt,
    authorName: c.user.name,
    authorId: c.user.id,
  }));

  const info: { label: string; value?: string | null }[] = [
    { label: 'التصنيف', value: material.category?.name },
    { label: 'المادح', value: material.performer },
    { label: 'المحاضر / المتحدث', value: material.speaker },
    { label: 'الراوي', value: material.narrator },
    { label: 'مدير الندوة', value: material.host },
    { label: 'المشاركون', value: material.participants },
    { label: 'المناسبة', value: material.occasion },
    { label: 'الموضوع', value: material.topic },
    { label: 'الجهة المنظمة', value: material.organizer },
    { label: 'المكان', value: material.place },
    { label: 'المدينة', value: material.city },
    { label: 'تاريخ التسجيل', value: material.recordDate ? formatDate(material.recordDate) : null },
    { label: 'مدة التسجيل', value: formatDurationLabel(material.durationSec) || null },
    { label: 'نوع الملف', value: material.fileType },
    { label: 'حجم الملف', value: material.fileSize ? formatFileSize(material.fileSize) : null },
    { label: 'اللغة', value: material.language },
    { label: 'المصدر', value: material.source },
  ].filter((r) => r.value);

  const keywords = splitKeywords(material.keywords);

  return (
    <div className="container-page py-10">
      {/* Breadcrumb */}
      <nav className="mb-4 flex items-center gap-1 text-sm text-muted">
        <Link href="/" className="hover:text-brand-600">الرئيسية</Link>
        <Icon.chevronLeft width={14} height={14} />
        <Link href={`/archive?category=${material.category?.slug}`} className="hover:text-brand-600">
          {material.category?.name}
        </Link>
        <Icon.chevronLeft width={14} height={14} />
        <span className="line-clamp-1 text-brand-700">{material.title}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        {/* Main */}
        <div>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="chip">{material.category?.name}</span>
            <span className="chip bg-emerald-100 text-emerald-700">منشورة ومراجَعة</span>
          </div>
          <h1 className="text-3xl font-extrabold leading-snug text-brand-800">
            {material.title}
          </h1>
          {material.subtitle && (
            <p className="mt-1 text-lg text-brand-600">{material.subtitle}</p>
          )}
          {(material.performer || material.speaker || material.host) && (
            <p className="mt-2 text-lg text-muted">
              {material.performer || material.speaker || material.host}
            </p>
          )}

          {material.fileKind === 'IMAGE' && material.fileUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={material.fileUrl}
              alt={material.title}
              className="mt-6 w-full rounded-2xl object-contain"
            />
          ) : material.fileKind === 'DOCUMENT' && material.fileUrl ? (
            <div className="mt-6">
              <PdfViewer url={material.fileUrl} fileType={material.fileType} title={material.title} />
            </div>
          ) : (
            <>
              {material.coverImage && material.fileKind !== 'VIDEO' && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={material.coverImage}
                  alt={material.title}
                  className="mt-6 max-h-80 w-full rounded-2xl object-cover"
                />
              )}
              {!material.bodyText && (
                <div className="mt-6">
                  <MediaPlayer
                    src={material.fileUrl}
                    kind={material.fileKind}
                    title={material.title}
                    poster={material.coverImage}
                  />
                </div>
              )}
            </>
          )}

          {/* Actions */}
          <div className="mt-5 flex flex-wrap items-center gap-2">
            {material.fileUrl ? (
              <a href={`/api/materials/${material.id}/download`} className="btn-primary">
                <Icon.download width={18} height={18} />
                تنزيل الملف
                {material.fileType ? ` (${material.fileType})` : ''}
              </a>
            ) : (
              <button disabled className="btn-primary">
                <Icon.download width={18} height={18} />
                لا يوجد ملف للتنزيل
              </button>
            )}
            <ShareButton title={material.title} />
            <FavoriteButton
              materialId={material.id}
              initial={favorited}
              loggedIn={!!user}
            />
          </div>

          {/* Rating */}
          <div className="mt-6">
            <StarRating
              materialId={material.id}
              average={ratingAgg._avg.value ?? 0}
              count={ratingAgg._count._all}
              initialUserRating={userRating?.value ?? 0}
              loggedIn={!!user}
            />
          </div>

          {/* Article body (readings) — rendered Markdown, distinguished layout */}
          {material.bodyText && (
            <section className="mt-10">
              <div className="overflow-hidden rounded-3xl bg-white shadow-card ring-1 ring-black/5">
                <div className="flex items-center gap-2 border-b border-ivory-200 bg-brand-800 px-6 py-4 text-ivory-50">
                  <Icon.file width={18} height={18} className="text-gold-300" />
                  <span className="font-display text-lg font-bold">النص الكامل</span>
                </div>
                <article
                  className="article-prose px-6 py-8 sm:px-10 sm:py-10"
                  dangerouslySetInnerHTML={{ __html: renderArticle(material.bodyText) }}
                />
              </div>
            </section>
          )}

          {/* Description */}
          {material.description && (
            <section className="mt-8">
              <h2 className="mb-2 text-lg font-bold text-brand-800">الوصف</h2>
              <p className="whitespace-pre-line leading-8 text-ink/90">{material.description}</p>
            </section>
          )}

          {material.summary && (
            <section className="mt-6">
              <h2 className="mb-2 text-lg font-bold text-brand-800">ملخص</h2>
              <p className="whitespace-pre-line leading-8 text-ink/90">{material.summary}</p>
            </section>
          )}

          {material.lyrics && (
            <section className="mt-6">
              <h2 className="mb-2 text-lg font-bold text-brand-800">الكلمات</h2>
              <div className="rounded-2xl bg-ivory-50 p-5">
                <p className="whitespace-pre-line leading-9 text-ink/90">{material.lyrics}</p>
              </div>
            </section>
          )}

          {keywords.length > 0 && (
            <section className="mt-6">
              <div className="flex flex-wrap gap-2">
                {keywords.map((k) => (
                  <Link key={k} href={`/search?q=${encodeURIComponent(k)}`} className="chip">
                    #{k}
                  </Link>
                ))}
              </div>
            </section>
          )}

          <div className="mt-8 border-t border-ivory-300 pt-4">
            <ReportButton materialId={material.id} />
          </div>

          <Comments
            materialId={material.id}
            comments={comments}
            loggedIn={!!user}
            currentUserId={user?.id}
            canModerate={canModerate}
          />
        </div>

        {/* Sidebar: info table */}
        <aside className="space-y-6">
          <div className="card overflow-hidden">
            <div className="border-b border-ivory-200 bg-ivory-50 px-5 py-3">
              <h2 className="font-bold text-brand-800">معلومات المادة</h2>
            </div>
            <dl className="divide-y divide-ivory-200">
              {info.map((row) => (
                <div key={row.label} className="flex items-start justify-between gap-4 px-5 py-2.5">
                  <dt className="text-sm text-muted">{row.label}</dt>
                  <dd className="text-left text-sm font-medium text-brand-800">{row.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </aside>
      </div>

      {/* Related */}
      {related.length > 0 && (
        <section className="mt-14">
          <h2 className="section-title mb-6">مواد ذات صلة</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((m) => (
              <MaterialCard key={m.id} material={m} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
