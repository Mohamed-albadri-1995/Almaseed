import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { MediaPlayer } from '@/components/MediaPlayer';
import { StatusBadge } from '@/components/StatusBadge';
import { ReviewPanel } from '@/components/ReviewPanel';
import { ReviewInsights } from '@/components/ReviewInsights';
import { getSimilarMaterials } from '@/lib/queries';
import { MaterialEditForm } from '@/components/MaterialEditForm';
import { restoreMaterialAction, rollbackVersionAction } from '@/app/admin/actions';
import { Icon } from '@/components/icons';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { can } from '@/lib/rbac';
import {
  REVIEW_ACTION_LABELS,
  type Role,
  type ReviewAction,
} from '@/lib/constants';
import { formatDateTime, formatFileSize } from '@/lib/format';

export const metadata: Metadata = { title: 'مراجعة مادة' };
export const dynamic = 'force-dynamic';

export default async function ReviewPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { error?: string; saved?: string; restored?: string; rolledback?: string };
}) {
  const user = await getCurrentUser();
  if (!user || !can.reviewContent(user.role as Role)) redirect('/admin');

  const material = await prisma.material.findUnique({
    where: { id: params.id },
    include: {
      category: true,
      submittedBy: { select: { name: true, email: true } },
      reviewNotes: {
        orderBy: { createdAt: 'desc' },
        include: { reviewer: { select: { name: true } } },
      },
      versions: { orderBy: { createdAt: 'desc' }, take: 10 },
    },
  });
  if (!material) notFound();

  const categories = await prisma.category.findMany({
    orderBy: { order: 'asc' },
    select: { slug: true, name: true },
  });

  const similar = await getSimilarMaterials(material);
  const canEdit = can.editContent(user.role as Role);
  const canRestore =
    material.status === 'REJECTED' || material.status === 'HIDDEN';

  return (
    <div>
      <nav className="mb-4 flex items-center gap-1 text-sm text-muted">
        <Link href="/admin/submissions" className="hover:text-brand-600">المراجعة</Link>
        <Icon.chevronLeft width={14} height={14} />
        <span className="line-clamp-1 text-brand-700">{material.title}</span>
      </nav>

      {searchParams.restored && (
        <div className="mb-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          تمت استعادة المادة ونشرها.
        </div>
      )}
      {searchParams.rolledback && (
        <div className="mb-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          تمت استعادة النسخة السابقة من البيانات.
        </div>
      )}

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-brand-800">{material.title}</h1>
          <p className="mt-1 text-sm text-muted">
            {material.category.name} · المساهم: {material.submittedBy?.name ?? '—'}
            {material.submittedBy?.email ? ` (${material.submittedBy.email})` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={material.status} />
          {canRestore && (
            <form action={restoreMaterialAction}>
              <input type="hidden" name="id" value={material.id} />
              <button className="btn-gold text-sm">استعادة ونشر</button>
            </form>
          )}
          <Link href={`/material/${material.id}`} className="btn-outline text-sm">
            معاينة عامة
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Left: preview + edit */}
        <div className="space-y-6">
          <div className="card p-5">
            <h2 className="mb-4 text-lg font-bold text-brand-800">معاينة الملف</h2>
            <MediaPlayer
              src={material.fileUrl}
              kind={material.fileKind}
              title={material.title}
              poster={material.coverImage}
            />
            {material.fileUrl && (
              <p className="mt-3 text-xs text-muted">
                {material.fileType} · {formatFileSize(material.fileSize)} ·{' '}
                <a href={material.fileUrl} target="_blank" className="text-brand-600 hover:underline">
                  فتح الملف في نافذة جديدة
                </a>
              </p>
            )}
          </div>

          {canEdit ? (
            <MaterialEditForm
              material={{
                id: material.id,
                categorySlug: material.category.slug,
                title: material.title,
                subtitle: material.subtitle,
                bodyText: material.bodyText,
                coverImage: material.coverImage,
                performer: material.performer,
                narrator: material.narrator,
                speaker: material.speaker,
                host: material.host,
                participants: material.participants,
                occasion: material.occasion,
                topic: material.topic,
                place: material.place,
                city: material.city,
                organizer: material.organizer,
                description: material.description,
                summary: material.summary,
                lyrics: material.lyrics,
                keywords: material.keywords,
              }}
              categories={categories}
              saved={!!searchParams.saved}
            />
          ) : (
            <div className="card p-5">
              <h2 className="mb-3 text-lg font-bold text-brand-800">بيانات المادة</h2>
              <dl className="grid gap-2 text-sm sm:grid-cols-2">
                {[
                  ['المادح', material.performer],
                  ['المحاضر', material.speaker],
                  ['المناسبة', material.occasion],
                  ['المكان', material.place],
                  ['المدينة', material.city],
                  ['الموضوع', material.topic],
                ]
                  .filter(([, v]) => v)
                  .map(([k, v]) => (
                    <div key={k as string} className="flex justify-between gap-2 border-b border-ivory-200 py-1.5">
                      <dt className="text-muted">{k}</dt>
                      <dd className="font-medium text-brand-800">{v}</dd>
                    </div>
                  ))}
              </dl>
              {material.description && (
                <p className="mt-3 whitespace-pre-line text-sm leading-7 text-ink/90">{material.description}</p>
              )}
            </div>
          )}
        </div>

        {/* Right: decision + history */}
        <div className="space-y-6">
          <ReviewInsights
            fileKind={material.fileKind}
            fileSize={material.fileSize}
            durationSec={material.durationSec}
            similar={similar}
          />
          <ReviewPanel materialId={material.id} errorReason={searchParams.error === 'reason'} />

          <div className="card p-5">
            <h2 className="mb-3 text-lg font-bold text-brand-800">سجل المراجعة</h2>
            {material.reviewNotes.length === 0 ? (
              <p className="text-sm text-muted">لا توجد ملاحظات بعد.</p>
            ) : (
              <ol className="space-y-3">
                {material.reviewNotes.map((n) => (
                  <li key={n.id} className="border-r-2 border-brand-200 pr-3">
                    <p className="text-sm font-semibold text-brand-800">
                      {REVIEW_ACTION_LABELS[n.action as ReviewAction] ?? n.action}
                      {n.reviewer?.name ? ` — ${n.reviewer.name}` : ''}
                    </p>
                    {n.reason && <p className="text-sm text-muted">السبب: {n.reason}</p>}
                    {n.note && <p className="text-sm text-ink/80">{n.note}</p>}
                    <p className="mt-0.5 text-xs text-muted">{formatDateTime(n.createdAt)}</p>
                  </li>
                ))}
              </ol>
            )}
          </div>

          {/* Edit history */}
          <div className="card p-5">
            <h2 className="mb-3 text-lg font-bold text-brand-800">سجل التعديلات</h2>
            {material.versions.length === 0 ? (
              <p className="text-sm text-muted">لا توجد تعديلات سابقة.</p>
            ) : (
              <ol className="space-y-2">
                {material.versions.map((v) => {
                  const REASON: Record<string, string> = {
                    edit: 'تعديل بيانات',
                    merge: 'دمج مادة',
                    resubmit: 'إعادة إرسال',
                  };
                  return (
                    <li key={v.id} className="flex items-center justify-between gap-3 border-b border-ivory-200 pb-1.5 text-sm">
                      <span className="text-brand-800">
                        {REASON[v.reason ?? ''] ?? v.reason}
                        {v.editorName ? ` — ${v.editorName}` : ''}
                        <span className="mr-2 block text-xs text-muted">{formatDateTime(v.createdAt)}</span>
                      </span>
                      {canEdit && (
                        <form action={rollbackVersionAction}>
                          <input type="hidden" name="versionId" value={v.id} />
                          <button className="text-xs font-semibold text-brand-700 hover:underline">استرجاع</button>
                        </form>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
