'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from './icons';

export interface ShowcaseItem {
  id: string;
  title: string;
  fileKind?: string | null;
  fileUrl?: string | null;
  coverImage?: string | null;
  performer?: string | null;
  speaker?: string | null;
  host?: string | null;
  category?: { name: string } | null;
}

const img = (it: ShowcaseItem) =>
  it.fileKind === 'IMAGE' ? it.fileUrl || it.coverImage || '' : it.coverImage || '';
const person = (it: ShowcaseItem) => it.performer || it.speaker || it.host || '';

export function MediaCarousel({ items }: { items: ShowcaseItem[] }) {
  const shots = items.filter((i) => i.fileUrl);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const n = shots.length;

  const go = useCallback((dir: 1 | -1) => setIndex((i) => (i + dir + n) % n), [n]);

  useEffect(() => {
    if (n <= 1 || paused) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % n), 5000);
    return () => clearInterval(t);
  }, [n, paused]);

  // Touch swipe
  const startX = useRef<number | null>(null);
  const onStart = (e: React.TouchEvent) => { startX.current = e.touches[0].clientX; };
  const onEnd = (e: React.TouchEvent) => {
    if (startX.current === null) return;
    const dx = e.changedTouches[0].clientX - startX.current;
    if (Math.abs(dx) > 40) go(dx > 0 ? -1 : 1); // RTL-friendly: swipe right → previous
    startX.current = null;
  };

  if (n === 0) return null;

  return (
    <section className="relative overflow-hidden bg-brand-800 py-14">
      {/* soft decorative rings */}
      <div className="pointer-events-none absolute inset-0 opacity-20">
        <div className="absolute -right-16 top-8 h-64 w-64 rounded-full border border-gold-400/40" />
        <div className="absolute -left-10 bottom-0 h-80 w-80 rounded-full border border-gold-400/25" />
      </div>

      <div className="container-page relative">
        <div className="mb-8 text-center">
          <p className="eyebrow text-gold-300">شاهد واستمع</p>
          <h2 className="mt-1 font-display text-3xl text-ivory-50 sm:text-4xl">من ذاكرة المسيد</h2>
        </div>

        <div
          className="relative mx-auto flex h-[360px] max-w-4xl items-center justify-center sm:h-[420px]"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onTouchStart={onStart}
          onTouchEnd={onEnd}
        >
          {shots.map((it, i) => {
            let offset = i - index;
            if (offset > n / 2) offset -= n;
            if (offset < -n / 2) offset += n;
            const abs = Math.abs(offset);
            if (abs > 2) return null;
            const isCenter = offset === 0;
            const isVideo = it.fileKind === 'VIDEO';
            return (
              <div
                key={it.id}
                className="absolute transition-all duration-500 ease-out"
                style={{
                  transform: `translateX(${offset * 56}%) scale(${isCenter ? 1 : 0.82})`,
                  opacity: abs > 1 ? 0 : isCenter ? 1 : 0.55,
                  zIndex: 10 - abs,
                  pointerEvents: isCenter ? 'auto' : 'none',
                  filter: isCenter ? 'none' : 'grayscale(0.7)',
                }}
              >
                <Link
                  href={`/material/${it.id}`}
                  className="group block w-[230px] overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-black/10 sm:w-[280px]"
                  tabIndex={isCenter ? 0 : -1}
                  aria-hidden={!isCenter}
                >
                  <div className="relative aspect-[4/5] bg-brand-900/10">
                    {img(it) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={img(it)} alt={it.title} className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-brand-100 text-brand-500">
                        <Icon.image width={40} height={40} />
                      </div>
                    )}
                    {isVideo && (
                      <span className="absolute inset-0 flex items-center justify-center">
                        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/85 text-brand-800 shadow-lg transition group-hover:scale-105">
                          <Icon.play width={26} height={26} />
                        </span>
                      </span>
                    )}
                  </div>
                  <div className="bg-gradient-to-t from-brand-900 to-brand-800 px-4 py-3 text-center text-ivory-50">
                    <p className="truncate text-sm font-bold">{it.title}</p>
                    <p className="truncate text-xs text-gold-300">
                      {[person(it), it.category?.name].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                </Link>
              </div>
            );
          })}

          {n > 1 && (
            <>
              <button
                onClick={() => go(-1)}
                aria-label="السابق"
                className="absolute right-0 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-ivory-50 backdrop-blur transition hover:bg-white/25 sm:right-2"
              >
                <Icon.chevronLeft width={24} height={24} className="rotate-180" />
              </button>
              <button
                onClick={() => go(1)}
                aria-label="التالي"
                className="absolute left-0 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-ivory-50 backdrop-blur transition hover:bg-white/25 sm:left-2"
              >
                <Icon.chevronLeft width={24} height={24} />
              </button>
            </>
          )}
        </div>

        {n > 1 && (
          <div className="mt-6 flex items-center justify-center gap-2">
            {shots.map((_, i) => (
              <button
                key={i}
                onClick={() => setIndex(i)}
                aria-label={`الشريحة ${i + 1}`}
                className={`h-2 rounded-full transition-all ${i === index ? 'w-6 bg-gold-400' : 'w-2 bg-ivory-100/40 hover:bg-ivory-100/70'}`}
              />
            ))}
          </div>
        )}

        <div className="mt-8 text-center">
          <Link href="/archive?category=images" className="btn-outline border-ivory-100/40 text-ivory-50 hover:bg-white/10">
            تصفّح كل الصور والفيديوهات
          </Link>
        </div>
      </div>
    </section>
  );
}
