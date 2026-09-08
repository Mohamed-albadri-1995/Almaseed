/* Official emblem of الطريقة السمّانية — السجادة السليمانية. */

export function LogoMark({ size = 40, className = '' }: { size?: number; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo.png"
      alt="شعار الطريقة السمّانية — السجادة السليمانية"
      width={size}
      height={size}
      className={`shrink-0 select-none ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

/**
 * Full lock‑up: the emblem beside the two‑line name of the order.
 * `tone` switches the text colours for light (default) or dark backgrounds.
 */
export function LogoLockup({
  size = 42,
  tone = 'light',
  showText = true,
}: {
  size?: number;
  tone?: 'light' | 'dark';
  showText?: boolean;
}) {
  const primary = tone === 'dark' ? 'text-ivory-50' : 'text-brand-800';
  const secondary = tone === 'dark' ? 'text-gold-300' : 'text-gold-600';
  return (
    <span className="flex items-center gap-3">
      <LogoMark size={size} />
      {showText && (
        <span className="leading-tight">
          <span className={`block text-base font-extrabold ${primary}`}>
            الطريقة السمّانية
          </span>
          <span className={`block text-xs font-bold ${secondary}`}>
            السجادة السليمانية
          </span>
        </span>
      )}
    </span>
  );
}
