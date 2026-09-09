import Link from 'next/link';
import { Icon } from './icons';
import { formatFileSize } from '@/lib/format';
import { assessFile, type InsightLevel } from '@/lib/review-insights';
import type { SimilarMaterial } from '@/lib/queries';

const LEVEL_STYLE: Record<InsightLevel, string> = {
  ok: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  warn: 'bg-amber-50 text-amber-700 ring-amber-200',
  bad: 'bg-red-50 text-red-700 ring-red-200',
  unknown: 'bg-ivory-100 text-muted ring-ivory-300',
};

export function ReviewInsights({
  fileKind,
  fileSize,
  durationSec,
  similar,
}: {
  fileKind?: string | null;
  fileSize?: number | null;
  durationSec?: number | null;
  similar: SimilarMaterial[];
}) {
  const a = assessFile(fileKind, fileSize, durationSec);

  return (
    <div className="card p-5">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-brand-800">
        <Icon.sparkle width={18} height={18} className="text-gold-500" />
        مساعد المراجعة
      </h2>

      {/* File size vs duration */}
      <div className={`rounded-xl px-4 py-3 ring-1 ${LEVEL_STYLE[a.level]}`}>
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold">تناسب الحجم مع المدة</span>
          <span className="text-xs font-semibold">{a.label}</span>
        </div>
        <p className="mt-1 text-xs leading-6">{a.note}</p>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs opacity-90">
          {typeof fileSize === 'number' && <span>الحجم: {formatFileSize(fileSize)}</span>}
          {typeof durationSec === 'number' && durationSec > 0 && (
            <span>المدة: {Math.floor(durationSec / 60)}:{String(durationSec % 60).padStart(2, '0')}</span>
          )}
          {typeof a.kbps === 'number' && <span>المعدل: ~{a.kbps} kbps</span>}
        </div>
      </div>

      {/* Similar / possible duplicates */}
      <div className="mt-4">
        <p className="mb-2 text-sm font-bold text-brand-800">
          محتوى مشابه أو مكرّر
          {similar.length > 0 && <span className="mr-1 text-xs font-normal text-muted">({similar.length})</span>}
        </p>
        {similar.length === 0 ? (
          <p className="rounded-xl bg-emerald-50 px-4 py-3 text-xs text-emerald-700 ring-1 ring-emerald-200">
            لم يُعثر على محتوى مشابه — يبدو أنه غير مكرّر.
          </p>
        ) : (
          <ul className="space-y-2">
            {similar.map((s) => (
              <li key={s.id} className="rounded-xl border border-ivory-300 bg-ivory-50/60 p-3">
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/admin/review/${s.id}`} className="line-clamp-1 text-sm font-semibold text-brand-800 hover:text-brand-600">
                    {s.title}
                  </Link>
                  <span className="shrink-0 text-[11px] text-muted">{s.category?.name}</span>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {s.reasons.map((r) => (
                    <span key={r} className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                      {r}
                    </span>
                  ))}
                  <span className="text-[11px] text-muted">
                    {s.status === 'PUBLISHED' ? 'منشور' : s.status === 'PENDING' ? 'قيد المراجعة' : s.status}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
