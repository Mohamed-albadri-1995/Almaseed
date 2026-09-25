import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { can } from '@/lib/rbac';
import { type Role } from '@/lib/constants';
import { formatDateTime } from '@/lib/format';

export const metadata: Metadata = { title: 'سجل النشاط' };
export const dynamic = 'force-dynamic';

const ACTION_LABELS: Record<string, string> = {
  submit: 'إرسال مادة',
  approve: 'موافقة ونشر',
  request_edit: 'طلب تعديل',
  reject: 'رفض مادة',
  draft: 'حفظ كمسودة',
  edit: 'تعديل بيانات',
  hide: 'إخفاء مادة',
  unhide: 'إظهار مادة',
  change_role: 'تغيير دور',
  unify_names: 'توحيد أسماء',
  backup_email: 'نسخة احتياطية بالبريد',
  orphan_cleanup: 'تنظيف ملفات غير مستخدمة',
  video_recompress_v1: 'إعادة ضغط الفيديوهات القديمة',
  login_code_sent: 'طلب رمز دخول',
  password_login_blocked: 'مُنع دخول بكلمة المرور (Google فقط)',
  undo_unify_names: 'تراجع عن توحيد أسماء',
};

const ENTITY_LABELS: Record<string, string> = {
  material: 'مادة', user: 'مستخدم', category: 'تصنيف', system: '', comment: 'تعليق', report: 'بلاغ',
};

export default async function ActivityPage() {
  const user = await getCurrentUser();
  if (!user || !can.viewReports(user.role as Role)) redirect('/admin');

  const logs = await prisma.activityLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { user: { select: { name: true } } },
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="section-title">سجل النشاط</h1>
        <p className="text-muted">توثيق للعمليات المهمة على المحتوى والمستخدمين.</p>
      </div>

      <div className="card overflow-hidden">
        {logs.length === 0 ? (
          <p className="p-10 text-center text-muted">لا يوجد نشاط مسجّل بعد.</p>
        ) : (
          <ul className="divide-y divide-ivory-200">
            {logs.map((l) => (
              // Stacked on phones (chip + who/what, then time) so names never squeeze into single letters.
              <li key={l.id} className="flex flex-col gap-1.5 px-5 py-3 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="chip shrink-0">{ACTION_LABELS[l.action] ?? l.action}</span>
                  <span className="min-w-0 break-words text-brand-800">
                    <span className="font-semibold">{l.user?.name ?? 'النظام'}</span>
                    {ENTITY_LABELS[l.entity] && <span className="text-muted"> — {ENTITY_LABELS[l.entity]}</span>}
                    {(l.action === 'login_code_sent' || l.action === 'password_login_blocked') && l.meta && (() => {
                      // Where the sign-in attempt came from (device · country · IP).
                      try {
                        const m = JSON.parse(l.meta) as { device?: string; country?: string | null; ip?: string };
                        return <span className="block break-words text-xs text-muted">{[m.device, m.country, m.ip].filter(Boolean).join(' · ')}</span>;
                      } catch { return null; }
                    })()}
                  </span>
                </div>
                <span className="shrink-0 text-xs text-muted">{formatDateTime(l.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
