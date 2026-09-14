'use client';

import { ANDROID_APP } from '@/lib/constants';
import { Icon } from './icons';

// "Continue in the app" — deep-links to the material in the Android app
// (almaseed://material/<id>). If the app isn't installed, falls back to the
// app download section (or the Play listing once the app is published).
export function OpenInApp({ id }: { id: string }) {
  const open = () => {
    const fallback = ANDROID_APP.published ? ANDROID_APP.playUrl : '/#app';
    const start = Date.now();
    // Attempt to open the app via its custom scheme.
    window.location.href = `almaseed://material/${id}`;
    // If the app didn't take over (still visible shortly after), send the user
    // to download it.
    window.setTimeout(() => {
      if (document.visibilityState === 'visible' && Date.now() - start < 2500) {
        window.location.href = fallback;
      }
    }, 1500);
  };

  return (
    <button
      onClick={open}
      className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-semibold text-ivory-50 transition hover:bg-brand-600"
    >
      <Icon.play width={16} height={16} />
      أكمل في التطبيق
    </button>
  );
}
