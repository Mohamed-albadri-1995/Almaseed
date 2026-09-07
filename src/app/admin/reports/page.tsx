import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { can } from '@/lib/rbac';
import { resolveReportAction } from '@/app/admin/actions';
import { MATERIAL_STATUS, type Role } from '@/lib/constants';
import { formatCount, timeAgo } from '@/lib/format';

export const metadata: Metadata = { title: 'التقارير والبلاغات' };
export const dynamic = 'force-dynamic';

export default async function ReportsPage() {
  const user = await getCurrentUser();
  if (!user || !can.manageContent(user.role as Role)) redirect('/admin');

  const [byCategory, totals, topDownloaded, reports] = await Promise.all([
    prisma.material.groupBy({
      by: ['categoryId'],
      where: { status: MATERIAL_STATUS.PUBLISHED },
      _count: { _all: true },
      _sum: { downloads: true, plays: true },
    }),
    prisma.material.aggregate({ _sum: { downloads: true, plays: true }, _count: { _all: true } }),
    prisma.material.findMany({
      where: { status: MATERIAL_STATUS.PUBLISHED },
      orderBy: { downloads: 'desc' },
      take: 5,
      select: { id: true, title: true, downloads: true, plays: true },
    }),
    prisma.contentReport.findMany({
      orderBy: [{ resolved: 'asc' }, { createdAt: 'desc' }],
      take: 30,
      include: { material: { select: { id: true, title: true } } },
    }),
  ]);

  const categories = await prisma.category.findMany();
  const catName = (id: string) => categories.find((c) => c.id === id)?.name ?? '—';
  const maxCount = Math.max(1, ...byCategory.map((b) => b._count._all));

  return (
    <div>
      <div className="mb-6">
        <h1 className="section-title">التقارير والإحصاءات</h1>
        <p className="text-muted">نظرة على توزيع المحتوى والبلاغات الواردة.</p>
      </div>

      {/* Totals */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'إجمالي المواد', value: totals._count._all },
          { label: 'مرات التحميل', value: totals._sum.downloads ?? 0 },
          { label: 'مرات الاستماع', value: totals._sum.plays ?? 0 },
          { label: 'بلاغات مفتوحة', value: reports.filter((r) => !r.resolved).length },
        ].map((s) => (
          <div key={s.label} className="card p-4 text-center">
            <div className="text-2xl font-extrabold text-brand-700">{formatCount(s.value)}</div>
            <div className="mt-1 text-xs text-muted">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Distribution */}
        <div className="card p-5">
          <h2 className="mb-4 text-lg font-bold text-brand-800">توزيع المواد حسب التصنيف</h2>
          <div className="space-y-3">
            {byCategory.map((b) => (
              <div key={b.categoryId}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-medium text-brand-800">{catName(b.categoryId)}</span>
                  <span className="text-muted">{formatCount(b._count._all)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-ivory-200">
                  <div
                    className="h-full rounded-full bg-brand-500"
                    style={{ width: `${(b._count._all / maxCount) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top downloaded */}
        <div className="card p-5">
          <h2 className="mb-4 text-lg font-bold text-brand-800">الأكثر تحميلاً</h2>
          <ol className="space-y-2">
            {topDownloaded.map((m, i) => (
              <li key={m.id} className="flex items-center justify-between gap-3 border-b border-ivory-200 pb-2 text-sm">
                <span className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                    {i + 1}
                  </span>
                  <Link href={`/material/${m.id}`} className="font-medium text-brand-800 hover:underline">
                    {m.title}
                  </Link>
                </span>
                <span className="text-muted">{formatCount(m.downloads)} تحميل</span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* Reports */}
      <div className="mt-8">
        <h2 className="mb-4 text-lg font-bold text-brand-800">البلاغات عن المحتوى</h2>
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-ivory-50 text-xs text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">المادة</th>
                  <th className="px-4 py-3 font-medium">السبب</th>
                  <th className="px-4 py-3 font-medium">التاريخ</th>
                  <th className="px-4 py-3 font-medium">الحالة</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ivory-200">
                {reports.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-10 text-center text-muted">لا توجد بلاغات.</td></tr>
                ) : (
                  reports.map((r) => (
                    <tr key={r.id} className="hover:bg-ivory-50/60">
                      <td className="px-4 py-3">
                        <Link href={`/material/${r.material.id}`} className="font-medium text-brand-800 hover:underline">
                          {r.material.title}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-muted">{r.reason}</td>
                      <td className="px-4 py-3 text-muted">{timeAgo(r.createdAt)}</td>
                      <td className="px-4 py-3">
                        {r.resolved ? (
                          <span className="chip bg-emerald-100 text-emerald-700">تمت المعالجة</span>
                        ) : (
                          <span className="chip bg-amber-100 text-amber-700">مفتوح</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {!r.resolved && (
                          <form action={resolveReportAction}>
                            <input type="hidden" name="id" value={r.id} />
                            <button className="text-sm font-semibold text-brand-700 hover:underline">تمت المعالجة</button>
                          </form>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
