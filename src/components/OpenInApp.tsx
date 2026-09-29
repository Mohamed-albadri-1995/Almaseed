'use client';

import { useEffect } from 'react';
import { ANDROID_APP } from '@/lib/constants';
import { Icon } from './icons';

// Opens this material in the Android app. Order of preference:
//   1. The app, if installed (Android intent → almaseed://material/<id>).
//   2. Its Google Play page, if the app isn't installed (once it's published).
//   3. Otherwise this page just stays open — the website is the fallback.
// With a verified App Link the OS opens the app before this page even loads;
// this covers everything else (unverified links, other browsers' handoffs).
const isAndroid = () => /android/i.test(navigator.userAgent);
const inOurApp = () => /AlmaseedApp/.test(navigator.userAgent);

function intentUrl(id: string, fallback: string) {
  return `intent://material/${encodeURIComponent(id)}#Intent;scheme=almaseed;package=${ANDROID_APP.packageId};`
    + `S.browser_fallback_url=${encodeURIComponent(fallback)};end`;
}

function openApp(id: string) {
  const here = `${window.location.origin}${window.location.pathname}`;
  // Not on Play yet → fall back to this page (without «?s=1», so no loop).
  const fallback = ANDROID_APP.published ? ANDROID_APP.playUrl : here;
  window.location.href = intentUrl(id, fallback);
}

export function OpenInApp({ id }: { id: string }) {
  // A shared link («?s=1») opened on an Android phone: try the app right away,
  // once per page per session. Drop the marker first so «back» returns to the
  // plain page instead of bouncing again.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get('s') !== '1') return;
    url.searchParams.delete('s');
    window.history.replaceState(null, '', url.pathname + url.search + url.hash);
    if (!isAndroid() || inOurApp()) return;
    const key = `openapp:${id}`;
    try { if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key, '1'); } catch { /* private mode */ }
    openApp(id);
  }, [id]);

  return (
    <button
      onClick={() => {
        if (isAndroid()) openApp(id);
        else window.location.href = ANDROID_APP.published ? ANDROID_APP.playUrl : '/#app';
      }}
      className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-semibold text-ivory-50 transition hover:bg-brand-600"
    >
      <Icon.play width={16} height={16} />
      أكمل في التطبيق
    </button>
  );
}
