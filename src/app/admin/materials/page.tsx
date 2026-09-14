import Link from 'next/link';
import type { Metadata } from 'next';
import { StatusBadge } from '@/components/StatusBadge';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { can, canAccessCategory } from '@/lib/rbac';
import {
  toggleHideAction,
  mergeMaterialsAction,
  deleteMaterialAction,
  requestMaterialDeletionAction,
  voteMaterialDeletionAction,
  cancelMaterialDeletionAction,
} from '@/app/admin/actions';
import { MATERIAL_STATUS, DELETION_VOTE, STAFF_ROLES, ROLES, type Role } from '@/lib/constants';
import { sectionSupervisors, tallyDeletion } from '@/lib/deletion';
import { formatCount, timeAgo } from '@/lib/format';
import type { Prisma } from '@prisma/client';

export const metadata: Metadata = { title: 'إدارة المواد' };
export const dynamic = 'force-dynamic';

const BANNERS: Record<string, { tone: 'ok' | 'err'; text: string }> = {
  deleted: { tone: 'ok', text: 'تم حذف المادة وملفاتها نهائياً.' },
  delreq: { tone: 'ok', text: 'تم فتح تصويت الحذف، وبانتظار تصويت بقية مشرفي القسم.' },
  delvoted: { tone: 'ok', text: 'سُجّل تصويتك.' },
  delkept: { tone: 'ok', text: 'لم تبلغ الأغلبية المطلوبة، فبقيت المادة في الأرشيف.' },
  delcancelled: { tone: 'ok', text: 'تم إلغاء طلب الحذف.' },
  delexists: { tone: 'err', text: 'يوجد تصويت حذف قائم لهذه المادة بالفعل.' },
  delneedjust: { tone: 'err', text: 'الحذف المباشر لمدير النظام يتطلّب تحديد السبب (طلب صاحب المادة أو مشكلة تقنية).' },
  merged: { tone: 'ok', text: 'تم دمج المادتين، ونُقلت المفضلة والإحصاءات إلى المادة الهدف.' },
  merge: { tone: 'err', text: 'تعذّر الدمج — تأكد من اختيار مادة هدف مختلفة.' },
};

export default async function MaterialsPage({
  searchParams,
}: {
  searchParams: {
    q?: string;
    merged?: string;
    merge?: string;
    deleted?: string;
    delreq?: string;
    delvoted?: string;
    delkept?: string;
    delcancelled?: string;
    delexists?: string;
    delneedjust?: string;
  };
}) {
  const user = await getCurrentUser();
  if (!user) return null;
  const role = user.role as Role;
  const q = (searchParams.q ?? '').trim();

  const where: Prisma.MaterialWhereInput = {
    status: { in: [MATERIAL_STATUS.PUBLISHED, MATERIAL_STATUS.HIDDEN] },
    ...(q ? { title: { contains: q } } : {}),
  };

  const [items, staff] = await Promise.all([
    prisma.material.findMany({
      where,
      orderBy: { publishedAt: 'desc' },
      include: {
        category: { select: { name: true, slug: true } },
        deletionRequest: { include: { votes: true } },
      },
      take: 100,
    }),
    prisma.user.findMany({
      where: { active: true, role: { in: STAFF_ROLES } },
      select: { id: true, name: true, role: true, assignedCategories: true },
    }),
  ]);

  const nameOf = (id: string) => staff.find((s) => s.id === id)?.name ?? '—';
  const canManage = can.manageContent(role); // hide / merge
  const isAdmin = role === ROLES.ADMIN;

  const activeKey = Object.keys(BANNERS).find((k) => (searchParams as Record<string, string>)[k]);
  const banner = activeKey ? BANNERS[activeKey] : null;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="section-title">إدارة المواد المنشورة</h1>
          <p className="text-muted">
            {canManage
              ? 'عدّل البيانات أو أخفِ مادة مؤقتاً عن العرض العام أو اطلب حذفها بتصويت مشرفي القسم.'
              : 'راجع المواد المنشورة، ويمكنك طلب حذف مادة يُقرَّر بأغلبية مشرفي القسم.'}
          </p>
        </div>
        <form method="get" className="flex gap-2">
          <input name="q" defaultValue={q} placeholder="بحث بالعنوان…" className="input w-56" />
          <button className="btn-primary">بحث</button>
        </form>
      </div>

      {banner && (
        <div
          className={`mb-4 rounded-xl px-4 py-3 text-sm font-medium ${
            banner.tone === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
          }`}
        >
          {banner.text}
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
              {items.map((m) => {
                const slug = m.category?.slug;
                // The section's voting pool: reviewers + the levels above them,
                // assigned to this category. Admins are not voters.
                const pool = slug ? sectionSupervisors(staff, slug) : [];
                const userInPool = pool.some((u) => u.id === user.id);
                const pending = m.deletionRequest;

                // Deletion-vote state for this material (if any).
                let del: null | {
                  poolSize: number;
                  approve: number;
                  reject: number;
                  needed: number; // votes needed for a strict majority
                  userVoted: boolean;
                  isInitiator: boolean;
                } = null;
                if (pending && slug) {
                  const poolIds = new Set(pool.map((u) => u.id));
                  const t = tallyDeletion(pool.length, poolIds, pending.votes);
                  del = {
                    poolSize: t.poolSize,
                    approve: t.approve,
                    reject: t.reject,
                    needed: Math.floor(t.poolSize / 2) + 1,
                    userVoted: pending.votes.some((v) => v.voterId === user.id),
                    isInitiator: pending.requestedById === user.id,
                  };
                }

                return (
                  <tr key={m.id} className="hover:bg-ivory-50/60 align-top">
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

                        {/* ---- Deletion workflow (majority vote of section supervisors) ---- */}
                        {del ? (
                          <div className="rounded-lg bg-amber-50 p-2 text-xs text-amber-900">
                            <p className="font-semibold">
                              تصويت حذف — فتحه {nameOf(pending!.requestedById)}
                            </p>
                            {pending!.reason && <p className="text-amber-800">السبب: {pending!.reason}</p>}
                            <p className="mt-1">
                              موافقون {del.approve} · رافضون {del.reject} · من {del.poolSize} مشرفًا
                              {' '}(يلزم {del.needed} للحذف).
                            </p>
                            {userInPool && !del.userVoted && (
                              <div className="mt-2 flex items-center gap-2">
                                <form action={voteMaterialDeletionAction}>
                                  <input type="hidden" name="requestId" value={pending!.id} />
                                  <input type="hidden" name="vote" value={DELETION_VOTE.APPROVE} />
                                  <button className="btn-danger px-2 py-1 text-xs">أوافق على الحذف</button>
                                </form>
                                <form action={voteMaterialDeletionAction}>
                                  <input type="hidden" name="requestId" value={pending!.id} />
                                  <input type="hidden" name="vote" value={DELETION_VOTE.REJECT} />
                                  <button className="btn-outline px-2 py-1 text-xs">أرفض الحذف</button>
                                </form>
                              </div>
                            )}
                            {userInPool && del.userVoted && (
                              <p className="mt-1 font-medium text-emerald-700">سُجّل تصويتك ✓ (يمكنك تغييره بالضغط أدناه)</p>
                            )}
                            {userInPool && del.userVoted && (
                              <div className="mt-1 flex items-center gap-2">
                                <form action={voteMaterialDeletionAction}>
                                  <input type="hidden" name="requestId" value={pending!.id} />
                                  <input type="hidden" name="vote" value={DELETION_VOTE.APPROVE} />
                                  <button className="text-[11px] text-muted hover:text-danger">تغيير إلى موافقة</button>
                                </form>
                                <form action={voteMaterialDeletionAction}>
                                  <input type="hidden" name="requestId" value={pending!.id} />
                                  <input type="hidden" name="vote" value={DELETION_VOTE.REJECT} />
                                  <button className="text-[11px] text-muted hover:text-brand-700">تغيير إلى رفض</button>
                                </form>
                              </div>
                            )}
                            {(del.isInitiator || isAdmin) && (
                              <form action={cancelMaterialDeletionAction} className="mt-2">
                                <input type="hidden" name="requestId" value={pending!.id} />
                                <button className="text-[11px] text-muted hover:text-danger">إلغاء التصويت</button>
                              </form>
                            )}
                          </div>
                        ) : (
                          <>
                            {userInPool && (
                              <details className="text-xs">
                                <summary className="cursor-pointer text-muted hover:text-danger">طلب حذف (تصويت القسم)</summary>
                                <form action={requestMaterialDeletionAction} className="mt-2 space-y-2 rounded-lg bg-red-50 p-2">
                                  <input type="hidden" name="id" value={m.id} />
                                  <p className="text-red-700">
                                    يُقرَّر الحذف بأغلبية مشرفي القسم (أكثر من النصف)؛ التعادل يُبقي المادة.
                                  </p>
                                  <input name="reason" placeholder="سبب الحذف (اختياري)" className="input w-full py-1 text-xs" />
                                  <button className="btn-danger px-2 py-1 text-xs">فتح تصويت الحذف</button>
                                </form>
                              </details>
                            )}
                            {isAdmin && (
                              <details className="text-xs">
                                <summary className="cursor-pointer text-muted hover:text-danger">حذف مباشر (مدير النظام)</summary>
                                <form action={deleteMaterialAction} className="mt-2 space-y-2 rounded-lg bg-red-50 p-2">
                                  <input type="hidden" name="id" value={m.id} />
                                  <p className="text-red-700">
                                    للحذف المباشر سببان فقط: طلب صاحب المادة، أو مشكلة تقنية. يُوثّق في السجل.
                                  </p>
                                  <select name="justification" required defaultValue="" className="input w-full py-1 text-xs">
                                    <option value="" disabled>اختر السبب…</option>
                                    <option value="owner_request">بطلب من صاحب المادة</option>
                                    <option value="technical">مشكلة تقنية</option>
                                  </select>
                                  <button className="btn-danger px-2 py-1 text-xs">تأكيد الحذف المباشر</button>
                                </form>
                              </details>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
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
