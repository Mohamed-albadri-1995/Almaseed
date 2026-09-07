import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { Icon } from '@/components/icons';
import { StatusBadge } from '@/components/StatusBadge';
import { MaterialCard } from '@/components/MaterialCard';
import { getCurrentUser } from '@/lib/session';
import { logoutAction } from '@/app/auth-actions';
import { prisma } from '@/lib/prisma';
import { isStaff } from '@/lib/rbac';
import { ROLE_LABELS, MATERIAL_STATUS, type Role } from '@/lib/constants';
import { timeAgo } from '@/lib/format';

export const metadata: Metadata = { title: 'حسابي' };

export default async function AccountPage({
  searchParams,
}: {
  searchParams: { submitted?: string; resubmitted?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?redirect=/account');

  const [submissions, favorites, notifications] = await Promise.all([
    prisma.material.findMany({
      where: { submittedById: user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        category: { select: { name: true, slug: true } },
        reviewNotes: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    }),
    prisma.favorite.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        material: {
          select: {
            id: true,
            title: true,
            fileKind: true,
            fileType: true,
            durationSec: true,
            performer: true,
            speaker: true,
            host: true,
            plays: true,
            category: { select: { name: true, slug: true } },
          },
        },
      },
    }),
    prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
  ]);

  const counts = {
    pending: submissions.filter((s) => s.status === MATERIAL_STATUS.PENDING).length,
    published: submissions.filter((s) => s.status === MATERIAL_STATUS.PUBLISHED).length,
    needsEdit: submissions.filter((s) => s.status === MATERIAL_STATUS.NEEDS_EDIT).length,
    rejected: submissions.filter((s) => s.status === MATERIAL_STATUS.REJECTED).length,
  };

  return (
    <div className="container-page py-10">
      {/* Header */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-700 text-2xl font-bold text-ivory-50">
            {user.name.charAt(0)}
          </span>
          <div>
            <h1 className="text-2xl font-extrabold text-brand-800">{user.name}</h1>
            <p className="text-sm text-muted">
              {user.email} · <span className="chip">{ROLE_LABELS[user.role as Role]}</span>
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {isStaff(user.role) && (
            <Link href="/admin" className="btn-outline">لوحة الإشراف</Link>
          )}
          <form action={logoutAction}>
            <button className="btn-ghost text-danger">تسجيل الخروج</button>
          </form>
        </div>
      </div>

      {(searchParams.submitted || searchParams.resubmitted) && (
        <div className="mb-6 flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          <Icon.check width={18} height={18} />
          {searchParams.resubmitted
            ? 'تم إعادة إرسال المادة، وستُراجع من جديد.'
            : 'تم استلام المادة، وسيقوم فريق المراجعة بفحصها قبل النشر.'}
        </div>
      )}

      {/* Stat chips */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'قيد المراجعة', value: counts.pending, tone: 'text-amber-600' },
          { label: 'منشورة', value: counts.published, tone: 'text-emerald-600' },
          { label: 'تحتاج تعديل', value: counts.needsEdit, tone: 'text-sky-600' },
          { label: 'مرفوضة', value: counts.rejected, tone: 'text-red-600' },
        ].map((s) => (
          <div key={s.label} className="card p-4 text-center">
            <div className={`text-2xl font-extrabold ${s.tone}`}>{s.value}</div>
            <div className="mt-1 text-xs text-muted">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        {/* Submissions */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-brand-800">موادي المُرسَلة</h2>
            <Link href="/submit" className="btn-gold text-sm">إرسال مادة</Link>
          </div>

          {submissions.length === 0 ? (
            <div className="card p-10 text-center text-muted">
              لم ترسل أي مادة بعد.{' '}
              <Link href="/submit" className="font-semibold text-brand-700 hover:underline">ابدأ الآن</Link>.
            </div>
          ) : (
            <div className="space-y-3">
              {submissions.map((s) => (
                <div key={s.id} className="card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <Link href={`/material/${s.id}`} className="font-bold text-brand-800 hover:text-brand-600">
                        {s.title}
                      </Link>
                      <p className="mt-0.5 text-xs text-muted">
                        {s.category?.name} · أُرسلت {timeAgo(s.createdAt)}
                      </p>
                    </div>
                    <StatusBadge status={s.status} />
                  </div>

                  {s.status === MATERIAL_STATUS.NEEDS_EDIT && s.reviewNotes[0] && (
                    <div className="mt-3 rounded-xl bg-sky-50 p-3 text-sm">
                      <p className="font-semibold text-sky-800">ملاحظة المراجع:</p>
                      <p className="mt-0.5 text-sky-700">
                        {s.reviewNotes[0].reason ? `${s.reviewNotes[0].reason} — ` : ''}
                        {s.reviewNotes[0].note}
                      </p>
                      <Link href={`/account/edit/${s.id}`} className="btn-primary mt-3 text-xs">
                        تعديل وإعادة الإرسال
                      </Link>
                    </div>
                  )}

                  {s.status === MATERIAL_STATUS.REJECTED && s.reviewNotes[0] && (
                    <div className="mt-3 rounded-xl bg-red-50 p-3 text-sm">
                      <p className="font-semibold text-red-800">سبب الرفض:</p>
                      <p className="mt-0.5 text-red-700">
                        {s.reviewNotes[0].reason ? `${s.reviewNotes[0].reason} — ` : ''}
                        {s.reviewNotes[0].note}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Favorites */}
          <h2 className="mb-4 mt-10 text-lg font-bold text-brand-800">المفضلة</h2>
          {favorites.length === 0 ? (
            <div className="card p-10 text-center text-muted">لا توجد مواد في المفضلة بعد.</div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {favorites.map((f) => (
                <MaterialCard key={f.id} material={f.material} />
              ))}
            </div>
          )}
        </section>

        {/* Notifications */}
        <aside>
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-brand-800">
            <Icon.bell width={18} height={18} /> الإشعارات
          </h2>
          <div className="card divide-y divide-ivory-200">
            {notifications.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted">لا توجد إشعارات.</p>
            ) : (
              notifications.map((n) => (
                <div key={n.id} className="p-4">
                  <p className="text-sm font-semibold text-brand-800">{n.title}</p>
                  {n.body && <p className="mt-0.5 text-sm text-muted">{n.body}</p>}
                  <p className="mt-1 text-xs text-muted">{timeAgo(n.createdAt)}</p>
                </div>
              ))
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
