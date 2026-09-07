import Link from 'next/link';
import type { Metadata } from 'next';
import { StatusBadge } from '@/components/StatusBadge';
import { Icon } from '@/components/icons';
import { prisma } from '@/lib/prisma';
import { MATERIAL_STATUS } from '@/lib/constants';
import { formatCount, timeAgo } from '@/lib/format';

export const metadata: Metadata = { title: 'لوحة التحكم' };
export const dynamic = 'force-dynamic';

export default async function AdminDashboard() {
  const [pending, published, needsEdit, rejected, downloads, recent] =
    await Promise.all([
      prisma.material.count({ where: { status: MATERIAL_STATUS.PENDING } }),
      prisma.material.count({ where: { status: MATERIAL_STATUS.PUBLISHED } }),
      prisma.material.count({ where: { status: MATERIAL_STATUS.NEEDS_EDIT } }),
      prisma.material.count({ where: { status: MATERIAL_STATUS.REJECTED } }),
      prisma.material.aggregate({ _sum: { downloads: true } }),
      prisma.material.findMany({
        orderBy: { createdAt: 'desc' },
        take: 8,
        include: {
          category: { select: { name: true } },
          submittedBy: { select: { name: true } },
        },
      }),
    ]);

  const cards = [
    { label: 'بانتظار المراجعة', value: pending, tone: 'bg-amber-50 text-amber-700', icon: 'file' as const, href: '/admin/submissions?status=PENDING' },
    { label: 'مواد منشورة', value: published, tone: 'bg-emerald-50 text-emerald-700', icon: 'check' as const, href: '/admin/materials' },
    { label: 'تحتاج إلى تعديل', value: needsEdit, tone: 'bg-sky-50 text-sky-700', icon: 'edit' as const, href: '/admin/submissions?status=NEEDS_EDIT' },
    { label: 'مواد مرفوضة', value: rejected, tone: 'bg-red-50 text-red-700', icon: 'x' as const, href: '/admin/submissions?status=REJECTED' },
    { label: 'إجمالي التحميلات', value: downloads._sum.downloads ?? 0, tone: 'bg-brand-50 text-brand-700', icon: 'download' as const, href: '/admin/reports' },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="section-title">لوحة التحكم</h1>
        <p className="text-muted">نظرة عامة على حالة الأرشيف والمراجعة.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {cards.map((c) => {
          const IconCmp = Icon[c.icon];
          return (
            <Link key={c.label} href={c.href} className="card p-4 transition hover:shadow-card-hover">
              <span className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${c.tone}`}>
                <IconCmp width={18} height={18} />
              </span>
              <div className="mt-3 text-2xl font-extrabold text-brand-800">{formatCount(c.value)}</div>
              <div className="text-xs text-muted">{c.label}</div>
            </Link>
          );
        })}
      </div>

      <div className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-brand-800">آخر الإرسالات</h2>
          <Link href="/admin/submissions" className="text-sm font-semibold text-brand-700 hover:underline">
            عرض الكل
          </Link>
        </div>

        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-ivory-50 text-xs text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">العنوان</th>
                  <th className="px-4 py-3 font-medium">النوع</th>
                  <th className="px-4 py-3 font-medium">المساهم</th>
                  <th className="px-4 py-3 font-medium">التاريخ</th>
                  <th className="px-4 py-3 font-medium">الحالة</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ivory-200">
                {recent.map((m) => (
                  <tr key={m.id} className="hover:bg-ivory-50/60">
                    <td className="px-4 py-3 font-medium text-brand-800">{m.title}</td>
                    <td className="px-4 py-3 text-muted">{m.category?.name}</td>
                    <td className="px-4 py-3 text-muted">{m.submittedBy?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-muted">{timeAgo(m.createdAt)}</td>
                    <td className="px-4 py-3"><StatusBadge status={m.status} /></td>
                    <td className="px-4 py-3">
                      <Link href={`/admin/review/${m.id}`} className="text-sm font-semibold text-brand-700 hover:underline">
                        فتح
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
