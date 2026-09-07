import Link from 'next/link';
import { Icon } from './icons';

export function Pagination({
  page,
  pages,
  makeHref,
}: {
  page: number;
  pages: number;
  makeHref: (page: number) => string;
}) {
  if (pages <= 1) return null;
  const nums = Array.from({ length: pages }, (_, i) => i + 1).filter(
    (n) => n === 1 || n === pages || Math.abs(n - page) <= 1,
  );

  const items: (number | '…')[] = [];
  let prev = 0;
  for (const n of nums) {
    if (n - prev > 1) items.push('…');
    items.push(n);
    prev = n;
  }

  return (
    <nav className="mt-10 flex items-center justify-center gap-1.5" aria-label="ترقيم الصفحات">
      {page > 1 && (
        <Link href={makeHref(page - 1)} className="btn-outline px-3 py-2">
          <Icon.chevronLeft width={16} height={16} className="rotate-180" />
        </Link>
      )}
      {items.map((it, i) =>
        it === '…' ? (
          <span key={`e${i}`} className="px-2 text-muted">
            …
          </span>
        ) : (
          <Link
            key={it}
            href={makeHref(it)}
            className={`flex h-10 min-w-10 items-center justify-center rounded-xl px-3 text-sm font-semibold ${
              it === page
                ? 'bg-brand-700 text-ivory-50'
                : 'border border-ivory-300 bg-white text-brand-700 hover:bg-brand-50'
            }`}
          >
            {it}
          </Link>
        ),
      )}
      {page < pages && (
        <Link href={makeHref(page + 1)} className="btn-outline px-3 py-2">
          <Icon.chevronLeft width={16} height={16} />
        </Link>
      )}
    </nav>
  );
}
