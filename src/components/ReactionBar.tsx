'use client';

import { useEffect, useState } from 'react';
import { formatCount } from '@/lib/format';

// Like / dislike / views under a material — the same bar as the app, sharing
// its API and counters. No sign-in: a visitor is an anonymous id kept in this
// browser, with one reaction per material.
type State = { likes: number; dislikes: number; views: number; mine: number };

const KEY = 'almaseed.device.v1';
function deviceId(): string {
  try {
    const have = localStorage.getItem(KEY);
    if (have) return have;
    const id = `w${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}${Math.random().toString(36).slice(2, 12)}`.slice(0, 40);
    localStorage.setItem(KEY, id);
    return id;
  } catch {
    return '';
  }
}

function Thumb({ down = false, filled = false }: { down?: boolean; filled?: boolean }) {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={down ? { transform: 'rotate(180deg)' } : undefined} aria-hidden="true">
      <path d="M7 10v11H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h3zm0 0 4-7a2 2 0 0 1 3 2l-1 5h5.5a2 2 0 0 1 2 2.3l-1.2 7A2 2 0 0 1 17.3 21H7" />
    </svg>
  );
}

export function ReactionBar({ id, countView = false }: { id: string; countView?: boolean }) {
  const [s, setS] = useState<State | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let off = false;
    const d = deviceId();
    fetch(`/api/mobile/materials/${id}/reactions?device=${encodeURIComponent(d)}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((r) => { if (!off && r) setS(r); })
      .catch(() => {});
    // Images, documents and articles have no player to count a view — count
    // opening the page instead (the server keeps one per visitor per 30 min).
    if (countView) {
      try {
        const k = `viewed:${id}`;
        if (!sessionStorage.getItem(k)) {
          sessionStorage.setItem(k, '1');
          fetch(`/api/materials/${id}/play`, { method: 'POST' }).catch(() => {});
        }
      } catch { /* private mode */ }
    }
    return () => { off = true; };
  }, [id, countView]);

  if (!s) return null;

  const tap = async (want: 1 | -1) => {
    const device = deviceId();
    if (busy || !device) return;
    const value = s.mine === want ? 0 : want;
    const prev = s;
    setS({
      ...s,
      mine: value,
      likes: s.likes + (value === 1 ? 1 : 0) - (s.mine === 1 ? 1 : 0),
      dislikes: s.dislikes + (value === -1 ? 1 : 0) - (s.mine === -1 ? 1 : 0),
    });
    setBusy(true);
    try {
      const r = await fetch(`/api/mobile/materials/${id}/reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device, value }),
      });
      if (!r.ok) throw new Error();
      setS(await r.json());
    } catch {
      setS(prev);
    } finally {
      setBusy(false);
    }
  };

  const pill = (active: boolean) =>
    `inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition ${
      active ? 'bg-brand-700 text-ivory-50' : 'bg-brand-50 text-brand-800 hover:bg-brand-100'
    }`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={() => tap(1)} className={pill(s.mine === 1)} aria-pressed={s.mine === 1} aria-label="أعجبني">
        <Thumb filled={s.mine === 1} />
        {formatCount(s.likes)}
      </button>
      <button type="button" onClick={() => tap(-1)} className={pill(s.mine === -1)} aria-pressed={s.mine === -1} aria-label="لم يعجبني">
        <Thumb down filled={s.mine === -1} />
        {formatCount(s.dislikes)}
      </button>
      <span className="inline-flex items-center gap-1.5 px-2 text-sm text-brand-700/70">
        <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
        {formatCount(s.views)} مشاهدة
      </span>
    </div>
  );
}
