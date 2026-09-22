import type { RankedCount } from '@/lib/queries';
import { formatCount } from '@/lib/format';

/**
 * A single-series horizontal bar chart (magnitude by identity) for the top-N
 * entries of a ranked list — top madihs, lecturers, occasions, …. Server
 * rendered as inline SVG (RTL): bars grow from the right, one brand-green hue,
 * each bar directly labeled with its value (so no legend/axis is needed), with a
 * native <title> tooltip per bar. Scales to the container width.
 */
export function TopBarChart({
  title,
  subtitle,
  rows,
  topN = 10,
  unitLabel = 'مادة',
  emptyText = 'لا توجد بيانات بعد.',
}: {
  title: string;
  subtitle?: string;
  rows: RankedCount[];
  topN?: number;
  unitLabel?: string;
  emptyText?: string;
}) {
  const data = rows.slice(0, topN);
  const max = data.reduce((m, r) => Math.max(m, r.count), 0) || 1;

  // Layout (RTL): names on the right, bars extend leftward, value at the bar end.
  const W = 680;
  const rowH = 26;
  const gap = 12;
  const labelW = 168; // right-side name column
  const valueW = 52; // left-side value column
  const padX = 8;
  const barAreaR = W - labelW - padX; // bars' right anchor
  const barAreaL = valueW + padX; // bars' left limit
  const barMaxW = barAreaR - barAreaL;
  const H = data.length * rowH + (data.length - 1) * gap;

  const BAR = '#356b57'; // brand-500 — single hue (single series)
  const TRACK = '#eef4f1'; // brand-50 — recessive track

  return (
    <div className="card p-5">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-brand-800">{title}</h2>
          {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
        </div>
        <span className="shrink-0 rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700">أعلى {formatCount(Math.min(topN, rows.length))}</span>
      </div>
      {data.length === 0 ? (
        <p className="text-sm text-muted">{emptyText}</p>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label={title} className="block">
          {data.map((r, i) => {
            const y = i * (rowH + gap);
            const w = Math.max(3, (r.count / max) * barMaxW);
            const barX = barAreaR - w;
            const cy = y + rowH / 2;
            return (
              <g key={r.name}>
                <title>{`${r.name}: ${r.count} ${unitLabel}`}</title>
                {/* recessive track */}
                <rect x={barAreaL} y={y} width={barMaxW} height={rowH} rx={6} fill={TRACK} />
                {/* data bar (rounded data-end, anchored to the right baseline) */}
                <rect x={barX} y={y} width={w} height={rowH} rx={6} fill={BAR} />
                {/* value at the bar's growing (left) end */}
                <text x={barX - 6} y={cy} textAnchor="end" dominantBaseline="central" fontSize="12" fontWeight="700" fill="#1a332b">{formatCount(r.count)}</text>
                {/* name on the right */}
                <text x={W - padX} y={cy} textAnchor="end" dominantBaseline="central" fontSize="13" fill="#2b2b2b">{r.name.length > 22 ? `${r.name.slice(0, 21)}…` : r.name}</text>
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}
