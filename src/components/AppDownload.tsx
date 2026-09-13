import { ANDROID_APP } from '@/lib/constants';

// Coloured Google Play triangle mark (inline so we need no external asset).
function PlayMark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" aria-hidden="true">
      <path fill="#00E0FF" d="M47 20 296 256 47 492c-9 6-19 2-19-11V31c0-13 10-17 19-11z" />
      <path fill="#00F076" d="M28 20c3-2 7-2 11 0l246 132-58 58L28 20z" />
      <path fill="#FF3A44" d="M373 214l-88-62 58-58 88 47c17 9 17 33 0 42l-58 31z" />
      <path fill="#FFC800" d="M373 214l58 31c17 9 17 33 0 42l-88 47-58-58 88-62z" opacity="0" />
      <path fill="#FFC900" d="M285 360l-58-58 88-62 59 31c18 10 18 36 0 46l-89 43z" />
    </svg>
  );
}

// "Download the app" call-to-action for the public site. While the app is in
// closed testing the store link is hidden (ANDROID_APP.published === false) and
// a "coming soon" note is shown instead.
export function AppDownload() {
  const live = ANDROID_APP.published;
  return (
    <section className="container-page pb-16">
      <div className="grid items-center gap-8 overflow-hidden rounded-3xl bg-brand-800 px-6 py-12 text-ivory-50 sm:px-12 md:grid-cols-[1fr_auto]">
        <div className="text-center md:text-right">
          <p className="eyebrow text-gold-300">تطبيق الأندرويد</p>
          <h2 className="mt-1 font-display text-3xl text-ivory-50 sm:text-4xl">
            الأرشيف في جيبك
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-ivory-100/85 md:mx-0">
            استمع للمدائح والمحاضرات، شاهد المرئيات، وحمّلها للاستماع دون اتصال —
            كل ذلك من تطبيق «الطريقة السمّانية» على هاتفك.
          </p>
        </div>

        <div className="flex justify-center md:justify-start">
          {live ? (
            <a
              href={ANDROID_APP.playUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 rounded-2xl bg-ivory-50 px-6 py-3 font-bold text-brand-900 shadow-card transition hover:bg-white"
            >
              <PlayMark />
              <span className="text-right leading-tight">
                <span className="block text-[11px] font-medium text-brand-700/70">
                  احصل عليه من
                </span>
                <span className="block text-lg">Google Play</span>
              </span>
            </a>
          ) : (
            <div className="inline-flex items-center gap-3 rounded-2xl bg-white/10 px-6 py-3 font-bold ring-1 ring-white/20">
              <PlayMark />
              <span className="text-right leading-tight">
                <span className="block text-[11px] font-medium text-gold-300">
                  قريبًا على
                </span>
                <span className="block text-lg">Google Play</span>
              </span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
