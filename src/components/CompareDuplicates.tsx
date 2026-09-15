'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MediaPlayer } from './MediaPlayer';
import { Icon } from './icons';
import { formatFileSize } from '@/lib/format';
import type { SimilarMaterial } from '@/lib/queries';

interface CurrentMaterial {
  title: string;
  fileUrl: string | null;
  fileKind: string | null;
  fileType: string | null;
  fileSize: number | null;
  coverImage: string | null;
}

/**
 * Side-by-side comparison for the reviewer: the material under review on one
 * side, a suspected duplicate on the other, each with its own player/viewer so
 * both can be seen or heard together before deciding. Only similar materials
 * that actually have a file to play/view are offered here.
 */
export function CompareDuplicates({
  current,
  similar,
}: {
  current: CurrentMaterial;
  similar: SimilarMaterial[];
}) {
  const playable = similar.filter((s) => !!s.fileUrl);
  const [sel, setSel] = useState(0);

  // Nothing worth comparing — the insights card already reports "no duplicates".
  if (playable.length === 0) return null;

  const dup = playable[Math.min(sel, playable.length - 1)];
  const hasExact = playable.some((s) => s.exactFile);

  return (
    <div className={`card p-5 ${hasExact ? 'ring-1 ring-red-200' : ''}`}>
      <h2 className="mb-1 flex items-center gap-2 text-lg font-bold text-brand-800">
        <Icon.sparkle width={18} height={18} className="text-gold-500" />
        مقارنة للتأكّد من عدم التكرار
      </h2>
      <p className="mb-4 text-sm text-muted">
        عُثر على محتوى قد يكون مطابقًا. شغّل المادتين هنا وقارن بينهما قبل اتخاذ القرار.
      </p>

      {playable.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {playable.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSel(i)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                i === (sel < playable.length ? sel : 0)
                  ? 'bg-brand-700 text-ivory-50'
                  : s.exactFile
                    ? 'bg-red-100 text-red-800 hover:bg-red-200'
                    : 'bg-ivory-100 text-brand-700 hover:bg-ivory-200'
              }`}
            >
              {s.exactFile ? '⚠️ ' : ''}المشابهة {i + 1}
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Current material */}
        <div className="rounded-2xl border border-brand-200 bg-brand-50/40 p-3">
          <p className="mb-2 flex items-center justify-between gap-2">
            <span className="rounded-full bg-brand-700 px-2.5 py-0.5 text-[11px] font-bold text-ivory-50">المادة الحالية</span>
            <span className="line-clamp-1 text-sm font-semibold text-brand-800">{current.title}</span>
          </p>
          <MediaPlayer src={current.fileUrl} kind={current.fileKind} title={current.title} poster={current.coverImage} />
          <p className="mt-2 text-[11px] text-muted">{current.fileType ?? '—'} · {formatFileSize(current.fileSize)}</p>
        </div>

        {/* Suspected duplicate */}
        <div className={`rounded-2xl border p-3 ${dup.exactFile ? 'border-red-200 bg-red-50/50' : 'border-amber-200 bg-amber-50/40'}`}>
          <p className="mb-2 flex items-center justify-between gap-2">
            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${dup.exactFile ? 'bg-red-600 text-white' : 'bg-amber-500 text-white'}`}>المادة المشابهة</span>
            <Link href={`/admin/review/${dup.id}`} className="line-clamp-1 text-sm font-semibold text-brand-800 hover:text-brand-600">{dup.title}</Link>
          </p>
          <MediaPlayer src={dup.fileUrl} kind={dup.fileKind} title={dup.title} poster={dup.coverImage} />
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {dup.reasons.map((r) => (
              <span key={r} className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${dup.exactFile ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>{r}</span>
            ))}
            <span className="text-[11px] text-muted">{dup.fileType ?? '—'} · {formatFileSize(dup.fileSize)}</span>
            <span className="text-[11px] text-muted">· {dup.status === 'PUBLISHED' ? 'منشورة' : dup.status === 'PENDING' ? 'قيد المراجعة' : dup.status === 'HELD' ? 'معلّقة' : dup.status}</span>
          </div>
        </div>
      </div>

      {hasExact && (
        <p className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-xs font-semibold leading-6 text-red-700 ring-1 ring-red-200">
          ⚠️ إحدى المواد تبدو مطابِقة تمامًا (نفس الملف أو نفس الحجم والمدة). تأكّد بالاستماع/المشاهدة قبل النشر لتفادي التكرار.
        </p>
      )}
    </div>
  );
}
