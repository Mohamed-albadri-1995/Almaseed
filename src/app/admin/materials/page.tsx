import Link from 'next/link';
import type { Metadata } from 'next';
import { StatusBadge } from '@/components/StatusBadge';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { can } from '@/lib/rbac';
import { toggleHideAction, mergeMaterialsAction } from '@/app/admin/actions';
import { MATERIAL_STATUS, type Role } from '@/lib/constants';
import { formatCount, timeAgo } from '@/lib/format';
import type { Prisma } from '@prisma/client';

export const metadata: Metadata = { title: 'إدارة المواد' };
export const dynamic = 'force-dynamic';

export default async function MaterialsPage({
  searchParams,
}: {
  searchParams: { q?: string; merged?: string; merge?: string };
}) {
  const user = await getCurrentUser();
  const q = (searchParams.q ?? '').trim();

  const where: Prisma.MaterialWhereInput = {
    status: { in: [MATERIAL_STATUS.PUBLISHED, MATERIAL_STATUS.HIDDEN] },
    ...(q ? { title: { contains: q } } : {}),
  };

  const items = await prisma.material.findMany({
    where,
    orderBy: { publishedAt: 'desc' },
    include: { category: { select: { name: true } } },
    take: 100,
  });

  const canManage = user && can.manageContent(user.role as Role);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="section-title">إدارة المواد المنشورة</h1>
          <p className="text-muted">عدّل البيانات أو أخفِ مادة مؤقتاً عن العرض العام.</p>
        </div>
        <form method="get" className="flex gap-2">
          <input name="q" defaultValue={q} placeholder="بحث بالعنوان…" className="input w-56" />
          <button className="btn-primary">بحث</button>
        </form>
      </div>

      {searchParams.merged && (
        <div className="mb-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          تم دمج المادتين، ونُقلت المفضلة والإحصاءات إلى المادة الهدف.
        </div>
      )}
      {searchParams.merge && (
        <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          تعذّر الدمج — تأكد من اختيار مادة هدف مختلفة.
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-ivory-50 text-xs text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">العنوان</th>
                <th className="px-4 py-3 font-medium">النوع</th>
                <th className="px-4 py-3 font-medium">التحميلات</th>
                <th className="px-4 py-3 font-medium">النشر</th>
                <th className="px-4 py-3 font-medium">الحالة</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ivory-200">
              {items.map((m) => (
                <tr key={m.id} className="hover:bg-ivory-50/60">
                  <td className="px-4 py-3 font-medium text-brand-800">{m.title}</td>
                  <td className="px-4 py-3 text-muted">{m.category?.name}</td>
                  <td className="px-4 py-3 text-muted">{formatCount(m.downloads)}</td>
                  <td className="px-4 py-3 text-muted">{timeAgo(m.publishedAt ?? m.createdAt)}</td>
                  <td className="px-4 py-3"><StatusBadge status={m.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-3">
                        <Link href={`/admin/review/${m.id}`} className="text-sm font-semibold text-brand-700 hover:underline">
                          تعديل
                        </Link>
                        {canManage && (
                          <form action={toggleHideAction}>
                            <input type="hidden" name="id" value={m.id} />
                            <button className="text-sm text-muted hover:text-danger">
                              {m.status === MATERIAL_STATUS.HIDDEN ? 'إظهار' : 'إخفاء'}
                            </button>
                          </form>
                        )}
                      </div>
                      {canManage && items.length > 1 && (
                        <details className="text-xs">
                          <summary className="cursor-pointer text-muted hover:text-brand-700">دمج مع مادة أخرى</summary>
                          <form action={mergeMaterialsAction} className="mt-2 flex items-center gap-1">
                            <input type="hidden" name="sourceId" value={m.id} />
                            <select name="targetId" required className="input py-1 text-xs" defaultValue="">
                              <option value="" disabled>ادمج في…</option>
                              {items
                                .filter((o) => o.id !== m.id)
                                .map((o) => (
                                  <option key={o.id} value={o.id}>{o.title}</option>
                                ))}
                            </select>
                            <button className="btn-outline px-2 py-1 text-xs">دمج</button>
                          </form>
                        </details>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted">لا توجد مواد.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
