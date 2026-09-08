import type { SVGProps } from 'react';

/**
 * Emblem of الطريقة السمّانية — السجادة السليمانية.
 *
 * A "khatam" seal built from two overlapping squares (the classic Rub‑el‑Hizb
 * ۞ figure long used in Islamic and Sufi manuscripts), wrapped in a gold ring
 * with a small radiant centre — a quiet, dignified mark rather than a literal
 * illustration. Colours default to `currentColor` for the seal so it can be
 * tinted by the surrounding text colour; the ring and centre use gold.
 */
export function LogoMark({
  size = 40,
  ring = '#d9b060',
  ...props
}: { size?: number; ring?: string } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      role="img"
      aria-label="شعار الطريقة السمّانية"
      {...props}
    >
      {/* Outer ring */}
      <circle cx="24" cy="24" r="22.5" stroke={ring} strokeWidth="1.5" />
      <circle cx="24" cy="24" r="19.5" stroke={ring} strokeWidth="0.75" opacity="0.7" />

      {/* Two overlapping squares → 8‑pointed seal (Rub el Hizb) */}
      <g stroke="currentColor" strokeWidth="2" strokeLinejoin="round" fill="none">
        <rect x="11" y="11" width="26" height="26" rx="2" />
        <rect
          x="11"
          y="11"
          width="26"
          height="26"
          rx="2"
          transform="rotate(45 24 24)"
        />
      </g>

      {/* Radiant centre */}
      <circle cx="24" cy="24" r="5.25" fill={ring} />
      <circle cx="24" cy="24" r="2.25" fill="#1f3d33" />
    </svg>
  );
}

/**
 * Full lock‑up: the emblem beside the two‑line name of the order.
 * Used in the navbar and footer. `tone` switches text colours for use on
 * light (default) or dark (footer) backgrounds.
 */
export function LogoLockup({
  size = 40,
  tone = 'light',
}: {
  size?: number;
  tone?: 'light' | 'dark';
}) {
  const primary = tone === 'dark' ? 'text-ivory-50' : 'text-brand-800';
  const secondary = tone === 'dark' ? 'text-gold-300' : 'text-gold-600';
  const mark = tone === 'dark' ? 'text-ivory-50' : 'text-brand-700';
  return (
    <span className="flex items-center gap-3">
      <span className={`shrink-0 ${mark}`}>
        <LogoMark size={size} />
      </span>
      <span className="leading-tight">
        <span className={`block text-base font-extrabold ${primary}`}>
          الطريقة السمّانية
        </span>
        <span className={`block text-xs font-bold ${secondary}`}>
          السجادة السليمانية
        </span>
      </span>
    </span>
  );
}
