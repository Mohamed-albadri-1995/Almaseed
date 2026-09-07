import Link from 'next/link';
import type { Metadata } from 'next';
import { StatusBadge } from '@/components/StatusBadge';
import { Icon } from '@/components/icons';
import { prisma } from '@/lib/prisma';
import { MATERIAL_STATUS, STATUS_LABELS } from '@/lib/constants';
import { timeAgo } from '@/lib/format';
import type { Prisma } from '@prisma/client';

export const metadata: Metadata = { title: 'المراجعة' };
export const dynamic = 'force-dynamic';

const TABS = [
  { status: 'PENDING', label: 'قيد المراجعة' },
  { status: 'NEEDS_EDIT', label: 'تحتاج تعديل' },
  { status: 'PUBLISHED', label: 'منشورة' },
  { status: 'REJECTED', label: 'مرفوضة' },
  { status: 'DRAFT', label: 'مسودات' },
  { status: '', label: 'الكل' },
];

export default async function SubmissionsPage({
  searchParams,
}: {
  searchParams: { status?: string; done?: string };
}) {
  const status = searchParams.status ?? 'PENDING';
  const where: Prisma.MaterialWhereInput = status ? { status } : {};

  const [items, counts] = await Promise.all([
    prisma.material.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        category: { select: { name: true } },
        submittedBy: { select: { name: true } },
      },
    }),
    prisma.material.groupBy({ by: ['status'], _count: { _all: true } }),
  ]);

  const countFor = (s: string) =>
    counts.find((c) => c.status === s)?._count._all ?? 0;

  return (
    <div>
      <div className="mb-6">
        <h1 className="section-title">مراجعة المحتوى</h1>
        <p className="text-muted">راجع المواد المُرسَلة واتخذ القرار المناسب.</p>
      </div>

      {searchParams.done && (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          <Icon.check width={18} height={18} /> تم حفظ القرار بنجاح.
        </div>
      )}

      {/* Tabs */}
      <div className="mb-5 flex flex-wrap gap-2">
        {TABS.map((t) => {
          const active = (searchParams.status ?? 'PENDING') === t.status;
          return (
            <Link
              key={t.label}
              href={t.status ? `/admin/submissions?status=${t.status}` : '/admin/submissions?status='}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                active
                  ? 'bg-brand-700 text-ivory-50'
                  : 'bg-white text-brand-700 ring-1 ring-ivory-300 hover:bg-brand-50'
              }`}
            >
              {t.label}
              {t.status && (
                <span className="mr-1.5 text-xs opacity-80">({countFor(t.status)})</span>
              )}
            </Link>
          );
        })}
      </div>

      {items.length === 0 ? (
        <div className="card p-12 text-center text-muted">
          لا توجد مواد بحالة «{STATUS_LABELS[(status || 'PENDING') as keyof typeof STATUS_LABELS] ?? 'الكل'}».
        </div>
      ) : (
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
                {items.map((m) => (
                  <tr key={m.id} className="hover:bg-ivory-50/60">
                    <td className="px-4 py-3 font-medium text-brand-800">{m.title}</td>
                    <td className="px-4 py-3 text-muted">{m.category?.name}</td>
                    <td className="px-4 py-3 text-muted">{m.submittedBy?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-muted">{timeAgo(m.createdAt)}</td>
                    <td className="px-4 py-3"><StatusBadge status={m.status} /></td>
                    <td className="px-4 py-3">
                      <Link href={`/admin/review/${m.id}`} className="btn-outline px-3 py-1.5 text-xs">
                        فتح المراجعة
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
