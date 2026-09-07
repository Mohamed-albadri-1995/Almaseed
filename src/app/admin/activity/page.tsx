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
              <li key={l.id} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
                <div className="flex items-center gap-3">
                  <span className="chip">{ACTION_LABELS[l.action] ?? l.action}</span>
                  <span className="text-brand-800">
                    <span className="font-semibold">{l.user?.name ?? 'نظام'}</span>
                    <span className="text-muted"> — {l.entity}</span>
                  </span>
                </div>
                <span className="text-xs text-muted">{formatDateTime(l.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
