'use client';

import { useState } from 'react';
import Link from 'next/link';

// A small tutorial-clip card: shows a poster with a play button and only loads
// the video when tapped (data-friendly — nothing downloads until the user asks).
// Used on the home page to show the right short guide: how to sign in for
// signed-out visitors, and how to share a material for signed-in ones.
export function GuideVideoCard({
  src,
  poster,
  title,
  subtitle,
  href,
  hrefLabel,
}: {
  src: string;
  poster: string;
  title: string;
  subtitle?: string;
  href?: string;
  hrefLabel?: string;
}) {
  const [playing, setPlaying] = useState(false);

  return (
    <div className="mx-auto w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-card ring-1 ring-black/5">
      <div className="relative aspect-[9/16] w-full bg-brand-900/5">
        {playing ? (
          <video
            src={src}
            poster={poster}
            controls
            autoPlay
            playsInline
            className="absolute inset-0 h-full w-full bg-black object-contain"
          />
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            aria-label={`تشغيل الفيديو: ${title}`}
            className="group absolute inset-0 h-full w-full"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={poster} alt={title} className="absolute inset-0 h-full w-full object-cover" />
            <span className="absolute inset-0 bg-brand-900/25 transition group-hover:bg-brand-900/35" />
            <span className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-gold-400 text-brand-900 shadow-lg transition group-hover:scale-105">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M8 5v14l11-7z" /></svg>
            </span>
          </button>
        )}
      </div>
      <div className="p-4 text-center">
        <h3 className="text-base font-bold text-brand-800">{title}</h3>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
        {href && (
          <Link href={href} className="mt-3 inline-block text-sm font-semibold text-brand-700 hover:text-brand-500">
            {hrefLabel || 'التفاصيل خطوة بخطوة ←'}
          </Link>
        )}
      </div>
    </div>
  );
}
