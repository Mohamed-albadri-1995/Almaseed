import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { Icon } from '@/components/icons';
import { getReviewStats, type RankedCount } from '@/lib/queries';
import { getCurrentUser } from '@/lib/session';
import { can } from '@/lib/rbac';
import { type Role } from '@/lib/constants';
import { formatCount } from '@/lib/format';

export const metadata: Metadata = { title: 'الإحصائيات' };
export const dynamic = 'force-dynamic';

// A ranked list (المادح، الراوي، المحاضر، المناسبة …) with a subtle proportion
// bar so the busiest names read at a glance. Long lists are collapsible.
function RankTable({
  title,
  subtitle,
  rows,
  unitLabel = 'مادة',
  emptyText = 'لا توجد بيانات بعد.',
  initial = 12,
}: {
  title: string;
  subtitle?: string;
  rows: RankedCount[];
  unitLabel?: string;
  emptyText?: string;
  initial?: number;
}) {
  const max = rows.reduce((m, r) => Math.max(m, r.count), 0) || 1;
  const shown = rows.slice(0, initial);
  const rest = rows.slice(initial);
  return (
    <div className="card min-w-0 overflow-hidden p-5">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-brand-800">{title}</h2>
          {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
        </div>
        <span className="shrink-0 rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700">{formatCount(rows.length)}</span>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">{emptyText}</p>
      ) : (
        <ol className="space-y-1.5">
          {shown.map((r, i) => (
            <li key={r.name} className="relative overflow-hidden rounded-lg bg-ivory-50">
              <span
                className="absolute inset-y-0 right-0 bg-brand-100/70"
                style={{ width: `${Math.max(6, (r.count / max) * 100)}%` }}
                aria-hidden
              />
              <div className="relative flex min-w-0 items-center justify-between gap-3 px-3 py-2 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="w-5 shrink-0 text-left text-xs font-bold text-muted">{i + 1}</span>
                  <span className="truncate font-medium text-brand-800">{r.name}</span>
                </span>
                <span className="shrink-0 font-bold text-brand-700">{formatCount(r.count)} <span className="text-xs font-normal text-muted">{unitLabel}</span></span>
              </div>
            </li>
          ))}
        </ol>
      )}
      {rest.length > 0 && (
        <details className="group mt-2">
          <summary className="cursor-pointer list-none px-1 py-1 text-sm font-semibold text-brand-700 hover:underline">
            عرض الباقي (<span>{formatCount(rest.length)}</span>) ▾
          </summary>
          <ol className="mt-1.5 space-y-1.5" start={initial + 1}>
            {rest.map((r, i) => (
              <li key={r.name} className="relative overflow-hidden rounded-lg bg-ivory-50">
                <span
                  className="absolute inset-y-0 right-0 bg-brand-100/70"
                  style={{ width: `${Math.max(6, (r.count / max) * 100)}%` }}
                  aria-hidden
                />
                <div className="relative flex min-w-0 items-center justify-between gap-3 px-3 py-2 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="w-5 shrink-0 text-left text-xs font-bold text-muted">{initial + i + 1}</span>
                    <span className="truncate font-medium text-brand-800">{r.name}</span>
                  </span>
                  <span className="shrink-0 font-bold text-brand-700">{formatCount(r.count)} <span className="text-xs font-normal text-muted">{unitLabel}</span></span>
                </div>
              </li>
            ))}
          </ol>
        </details>
      )}
    </div>
  );
}

export default async function StatsPage() {
  const user = await getCurrentUser();
  if (!user || !can.reviewContent(user.role as Role)) redirect('/admin');

  const stats = await getReviewStats();

  const kpis = [
    { label: 'إجمالي المواد', value: stats.total, tone: 'bg-brand-50 text-brand-700', icon: 'archive' as const },
    { label: 'إجمالي المساهمين', value: stats.totalContributors, tone: 'bg-gold-100 text-gold-700', icon: 'users' as const },
    { label: 'صوتيات', value: stats.byKind.audio, tone: 'bg-emerald-50 text-emerald-700', icon: 'file' as const },
    { label: 'مرئيات', value: stats.byKind.video, tone: 'bg-sky-50 text-sky-700', icon: 'file' as const },
    { label: 'صور', value: stats.byKind.image, tone: 'bg-amber-50 text-amber-700', icon: 'image' as const },
    { label: 'مكتوبات', value: stats.byKind.written, tone: 'bg-violet-50 text-violet-700', icon: 'book-open' as const },
    { label: 'ملفات PDF', value: stats.byKind.pdf, tone: 'bg-red-50 text-red-700', icon: 'file' as const },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="section-title">الإحصائيات</h1>
        <p className="text-muted">أرقام الأرشيف المنشور: المواد والمساهمون وأنواع الملفات، وتوزيعها حسب الأقسام والأشخاص والمناسبات.</p>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        {kpis.map((c) => {
          const IconCmp = Icon[c.icon] ?? Icon.file;
          return (
            <div key={c.label} className="card p-4">
              <span className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${c.tone}`}>
                <IconCmp width={18} height={18} />
              </span>
              <div className="mt-3 text-2xl font-extrabold text-brand-800">{formatCount(c.value)}</div>
              <div className="text-xs text-muted">{c.label}</div>
            </div>
          );
        })}
      </div>

      {/* Per-category: count + distinct contributors */}
      <div className="mt-8 card overflow-hidden">
        <div className="border-b border-ivory-200 px-5 py-4">
          <h2 className="text-lg font-bold text-brand-800">حسب القسم</h2>
          <p className="text-xs text-muted">عدد المواد وعدد المساهمين في كل قسم.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-ivory-50 text-xs text-muted">
              <tr>
                <th className="px-5 py-3 font-medium">القسم</th>
                <th className="px-5 py-3 font-medium">عدد المواد</th>
                <th className="px-5 py-3 font-medium">عدد المساهمين</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ivory-200">
              {stats.perCategory.map((c) => (
                <tr key={c.slug} className="hover:bg-ivory-50/60">
                  <td className="px-5 py-3 font-medium text-brand-800">{c.name}</td>
                  <td className="px-5 py-3 font-bold text-brand-700">{formatCount(c.count)}</td>
                  <td className="px-5 py-3 text-muted">{formatCount(c.contributors)}</td>
                </tr>
              ))}
              <tr className="bg-brand-50/40 font-bold">
                <td className="px-5 py-3 text-brand-800">الإجمالي</td>
                <td className="px-5 py-3 text-brand-800">{formatCount(stats.total)}</td>
                <td className="px-5 py-3 text-brand-800">{formatCount(stats.totalContributors)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Ranked person/occasion tallies — HTML bars (Arabic shapes correctly),
          compact: top 8 with the rest collapsible. */}
      <h2 className="mt-8 mb-3 text-lg font-bold text-brand-800">الأعلى مساهمةً</h2>
      <div className="grid gap-5 lg:grid-cols-2">
        <RankTable title="أكثر المادحين" subtitle="عدد المدائح لكل مادح" rows={stats.madeehByPerformer} unitLabel="مدحة" initial={8} />
        <RankTable title="أكثر المحاضرين" subtitle="عدد المحاضرات لكل محاضر" rows={stats.lecturesBySpeaker} unitLabel="محاضرة" initial={8} />
        <RankTable title="أكثر الرواة" subtitle="عدد المدائح لكل راوٍ" rows={stats.madeehByNarrator} unitLabel="مدحة" initial={8} />
        <RankTable title="أكثر المناسبات" subtitle="عدد المواد لكل مناسبة" rows={stats.byOccasion} unitLabel="مادة" initial={8} />
      </div>
    </div>
  );
}
