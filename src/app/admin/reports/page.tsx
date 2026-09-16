import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { can } from '@/lib/rbac';
import { resolveReportAction } from '@/app/admin/actions';
import { type Role } from '@/lib/constants';
import { formatCount, timeAgo } from '@/lib/format';

export const metadata: Metadata = { title: 'التقارير والبلاغات' };
export const dynamic = 'force-dynamic';

export default async function ReportsPage() {
  const user = await getCurrentUser();
  if (!user || !can.manageContent(user.role as Role)) redirect('/admin');

  const [totals, reports] = await Promise.all([
    prisma.material.aggregate({ _sum: { downloads: true, plays: true }, _count: { _all: true } }),
    prisma.contentReport.findMany({
      orderBy: [{ resolved: 'asc' }, { createdAt: 'desc' }],
      take: 30,
      include: { material: { select: { id: true, title: true } } },
    }),
  ]);

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
