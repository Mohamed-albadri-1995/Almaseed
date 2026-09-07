'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { rateMaterial } from '@/app/actions';
import { formatNumber } from '@/lib/format';

function Star({ filled, half = false }: { filled: boolean; half?: boolean }) {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" className={filled ? 'text-gold-400' : 'text-ivory-300'}>
      <defs>
        <linearGradient id="half">
          <stop offset="50%" stopColor="currentColor" />
          <stop offset="50%" stopColor="transparent" />
        </linearGradient>
      </defs>
      <path
        d="M12 3l2.7 5.5 6 .9-4.3 4.2 1 6-5.4-2.8L6.6 19.6l1-6L3.3 9.4l6-.9z"
        fill={half ? 'url(#half)' : filled ? 'currentColor' : 'currentColor'}
        stroke="currentColor"
        strokeWidth="0.5"
      />
    </svg>
  );
}

export function StarRating({
  materialId,
  average,
  count,
  initialUserRating,
  loggedIn,
}: {
  materialId: string;
  average: number;
  count: number;
  initialUserRating: number;
  loggedIn: boolean;
}) {
  const [userRating, setUserRating] = useState(initialUserRating);
  const [hover, setHover] = useState(0);
  const [pending, start] = useTransition();

  const submit = (value: number) => {
    setUserRating(value);
    start(async () => {
      await rateMaterial(materialId, value);
    });
  };

  const displayAvg = Math.round(average * 10) / 10;

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-3xl font-extrabold text-brand-800">{formatNumber(displayAvg)}</span>
          <div>
            <div className="flex">
              {[1, 2, 3, 4, 5].map((n) => (
                <Star key={n} filled={n <= Math.round(average)} />
              ))}
            </div>
            <p className="mt-0.5 text-xs text-muted">
              {count > 0 ? `${formatNumber(count)} تقييم` : 'لا توجد تقييمات بعد'}
            </p>
          </div>
        </div>

        <div className="text-left">
          {loggedIn ? (
            <>
              <p className="mb-1 text-xs text-muted">قيّم هذه المادة:</p>
              <div className="flex" onMouseLeave={() => setHover(0)}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    disabled={pending}
                    onMouseEnter={() => setHover(n)}
                    onClick={() => submit(n)}
                    aria-label={`${n} من 5`}
                    className="transition-transform hover:scale-110"
                  >
                    <Star filled={n <= (hover || userRating)} />
                  </button>
                ))}
              </div>
              {userRating > 0 && <p className="mt-1 text-xs text-emerald-600">تقييمك: {userRating}/5</p>}
            </>
          ) : (
            <Link href="/login" className="text-sm font-semibold text-brand-700 hover:underline">
              سجّل الدخول للتقييم
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
