'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Icon } from './icons';

export interface GalleryItem {
  id: string;
  title: string;
  fileUrl?: string | null;
  coverImage?: string | null;
  performer?: string | null;
  speaker?: string | null;
  host?: string | null;
  occasion?: string | null;
}

function src(it: GalleryItem) {
  return it.fileUrl || it.coverImage || '';
}
function person(it: GalleryItem) {
  return it.performer || it.speaker || it.host || '';
}

export function ImageGallery({ items }: { items: GalleryItem[] }) {
  const shots = items.filter((i) => src(i));
  const [open, setOpen] = useState<number | null>(null);

  const close = useCallback(() => setOpen(null), []);
  const go = useCallback(
    (dir: 1 | -1) => setOpen((i) => (i === null ? i : (i + dir + shots.length) % shots.length)),
    [shots.length],
  );

  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowRight') go(-1); // RTL: right = previous
      else if (e.key === 'ArrowLeft') go(1);
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [open, close, go]);

  if (shots.length === 0) {
    return (
      <div className="card flex flex-col items-center justify-center gap-3 p-16 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-ivory-200 text-muted">
          <Icon.image width={26} height={26} />
        </span>
        <p className="text-lg font-semibold text-brand-800">لا توجد صور بعد</p>
        <p className="max-w-sm text-sm text-muted">أضف صوراً من ذاكرة المسيد لتظهر هنا في المعرض.</p>
      </div>
    );
  }

  const current = open === null ? null : shots[open];

  return (
    <>
      {/* Masonry studio grid */}
      <div className="[column-fill:_balance] columns-2 gap-3 sm:columns-3 lg:columns-4">
        {shots.map((it, idx) => (
          <button
            key={it.id}
            onClick={() => setOpen(idx)}
            className="group relative mb-3 block w-full overflow-hidden rounded-2xl bg-brand-900/5 ring-1 ring-black/5"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src(it)}
              alt={it.title}
              loading="lazy"
              className="w-full transition duration-300 group-hover:scale-[1.04]"
            />
            <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/0 to-black/0 opacity-0 transition group-hover:opacity-100" />
            <span className="pointer-events-none absolute inset-x-0 bottom-0 p-3 text-right opacity-0 transition group-hover:opacity-100">
              <span className="block truncate text-sm font-bold text-white">{it.title}</span>
              {person(it) && <span className="block truncate text-xs text-white/80">{person(it)}</span>}
            </span>
            <span className="pointer-events-none absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white opacity-0 backdrop-blur transition group-hover:opacity-100">
              <Icon.search width={15} height={15} />
            </span>
          </button>
        ))}
      </div>

      {/* Lightbox */}
      {current && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-black/92 backdrop-blur-sm"
          onClick={close}
          role="dialog"
          aria-modal="true"
        >
          <div className="flex items-center justify-between p-4 text-white/90" onClick={(e) => e.stopPropagation()}>
            <span className="text-sm text-white/60">{(open ?? 0) + 1} / {shots.length}</span>
            <button onClick={close} aria-label="إغلاق" className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-white/10">
              <Icon.x width={22} height={22} />
            </button>
          </div>

          <div className="flex flex-1 items-center justify-center px-2 pb-2" onClick={(e) => e.stopPropagation()}>
            {/* prev (right side in RTL) */}
            <button
              onClick={() => go(-1)}
              aria-label="السابق"
              className="absolute right-2 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
            >
              <Icon.chevronLeft width={26} height={26} className="rotate-180" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src(current)} alt={current.title} className="max-h-[76vh] max-w-[92vw] rounded-lg object-contain" />
            <button
              onClick={() => go(1)}
              aria-label="التالي"
              className="absolute left-2 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
            >
              <Icon.chevronLeft width={26} height={26} />
            </button>
          </div>

          <div className="flex items-end justify-between gap-4 p-5 text-white" onClick={(e) => e.stopPropagation()}>
            <div className="min-w-0">
              <h3 className="truncate text-lg font-bold">{current.title}</h3>
              <p className="truncate text-sm text-white/70">
                {[person(current), current.occasion].filter(Boolean).join(' · ')}
              </p>
            </div>
            <Link href={`/material/${current.id}`} className="btn-gold shrink-0">
              التفاصيل
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
