import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { Icon } from '@/components/icons';
import { getCurrentUser } from '@/lib/session';
import { can } from '@/lib/rbac';
import { getSystemStats } from '@/lib/stats';
import { formatCount, formatFileSize } from '@/lib/format';
import { type Role } from '@/lib/constants';

export const metadata: Metadata = { title: 'حالة النظام' };
export const dynamic = 'force-dynamic';

export default async function SystemPage() {
  const user = await getCurrentUser();
  if (!user || !can.manageUsers(user.role as Role)) redirect('/admin');

  const s = await getSystemStats();
  const maxDaily = Math.max(1, ...s.views.daily.map((d) => d.count));

  const cards = [
    { label: 'زيارات اليوم', value: formatCount(s.views.today), icon: 'chart' as const },
    { label: 'زيارات آخر ٧ أيام', value: formatCount(s.views.last7), icon: 'chart' as const },
    { label: 'إجمالي الزيارات', value: formatCount(s.views.total), icon: 'chart' as const },
    { label: 'مساحة الملفات', value: formatFileSize(s.storageBytes), icon: 'archive' as const },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="section-title">حالة النظام والإحصاءات</h1>
        <p className="text-muted">نظرة على الزيارات واستهلاك المساحة والذاكرة.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map((c) => {
          const IconCmp = Icon[c.icon];
          return (
            <div key={c.label} className="card p-4">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                <IconCmp width={18} height={18} />
              </span>
              <div className="mt-3 text-2xl font-extrabold text-brand-800">{c.value}</div>
              <div className="text-xs text-muted">{c.label}</div>
            </div>
          );
        })}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {/* Visits chart */}
        <div className="card p-5">
          <h2 className="mb-4 text-lg font-bold text-brand-800">الزيارات اليومية</h2>
          {s.views.daily.length === 0 ? (
            <p className="text-sm text-muted">لا توجد بيانات بعد.</p>
          ) : (
            <div className="flex items-end gap-1.5" style={{ height: 160 }}>
              {s.views.daily.map((d) => (
                <div key={d.date} className="flex flex-1 flex-col items-center justify-end gap-1">
                  <div
                    className="w-full rounded-t bg-brand-500"
                    style={{ height: `${(d.count / maxDaily) * 130}px` }}
                    title={`${d.date}: ${d.count}`}
                  />
                  <span className="text-[9px] text-muted">{d.date.slice(5)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Memory & counts */}
        <div className="card p-5">
          <h2 className="mb-4 text-lg font-bold text-brand-800">الذاكرة والمحتوى</h2>
          <dl className="space-y-2 text-sm">
            {[
              ['ذاكرة الخادم المستخدمة (RSS)', formatFileSize(s.memory.rss)],
              ['ذاكرة heap المستخدمة', formatFileSize(s.memory.heapUsed)],
              ['إجمالي المواد', formatCount(s.materials)],
              ['إجمالي المستخدمين', formatCount(s.users)],
              ['مساحة ملفات الأرشيف', formatFileSize(s.storageBytes)],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between border-b border-ivory-200 py-1.5">
                <dt className="text-muted">{k}</dt>
                <dd className="font-semibold text-brand-800">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-muted">
            ملاحظة: ذاكرة الخادم لحظية لكل نسخة تشغيل، ومساحة الملفات مخزّنة على R2.
          </p>
        </div>
      </div>
    </div>
  );
}
