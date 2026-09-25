import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/icons';
import { getCurrentUser } from '@/lib/session';
import { can } from '@/lib/rbac';
import { getSystemStats } from '@/lib/stats';
import { formatCount, formatFileSize } from '@/lib/format';
import { type Role } from '@/lib/constants';
import { prisma } from '@/lib/prisma';
import { transcriptionConfigured } from '@/lib/transcribe';

export const metadata: Metadata = { title: 'حالة النظام' };
export const dynamic = 'force-dynamic';

export default async function SystemPage() {
  const user = await getCurrentUser();
  if (!user || !can.manageUsers(user.role as Role)) redirect('/admin');

  const s = await getSystemStats();
  // Automatic transcription progress (published spoken recordings).
  const spoken = { status: 'PUBLISHED', fileUrl: { not: null }, fileKind: { in: ['AUDIO', 'VIDEO'] }, category: { slug: { in: ['lectures', 'sermons', 'seminars'] } } };
  const [trTotal, trDone, trFailed] = await Promise.all([
    prisma.material.count({ where: spoken }),
    prisma.material.count({ where: { ...spoken, transcriptSearch: { not: null } } }),
    prisma.material.count({ where: { ...spoken, transcriptError: { not: null } } }),
  ]);
  const maxDaily = Math.max(1, ...s.views.daily.map((d) => d.count));
  const maxCount = Math.max(1, ...s.distribution.map((d) => d.count));

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

      {/* Data backup: download a full JSON snapshot of the archive's data. */}
      <div className="mb-6 card flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <h2 className="text-lg font-bold text-brand-800">النسخ الاحتياطي</h2>
          <p className="mt-1 text-sm text-muted">نزّل نسخة كاملة من بيانات الأرشيف (المواد والتصنيفات والمساهمين والمراجعات…) كملف JSON. احفظها في مكان آمن دوريًا.</p>
        </div>
        <a href="/api/admin/backup" download className="btn-primary shrink-0">تنزيل نسخة احتياطية</a>
      </div>

      {/* Automatic transcription status */}
      <div className="mb-6 card p-5">
        <h2 className="text-lg font-bold text-brand-800">التفريغ النصي الآلي</h2>
        {transcriptionConfigured() ? (
          <p className="mt-1 text-sm text-muted">
            فُرّغ <b className="text-brand-800">{formatCount(trDone)}</b> من أصل <b className="text-brand-800">{formatCount(trTotal)}</b> تسجيلًا منشورًا (المحاضرات والمواعظ وأرشيف النوادر)
            {trFailed > 0 && <> · <span className="text-danger">تعذّر {formatCount(trFailed)}</span></>}. يعمل في الخلفية تسجيلًا تلو الآخر، الأحدث أولًا.
          </p>
        ) : (
          <p className="mt-1 text-sm text-muted">غير مفعّل — أضف المتغير <code dir="ltr">TRANSCRIBE_API_KEY</code> في Railway لبدء تفريغ {formatCount(trTotal)} تسجيلًا منشورًا.</p>
        )}
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

      <p className="mt-2 text-xs text-muted">
        تُحتسب الزيارة مرّةً واحدة لكل جهاز في اليوم، ولا تشمل صفحات لوحة الإشراف ولا برامج الفهرسة. و«الإجمالي» محسوب منذ بدء تفعيل العدّاد لا منذ إنشاء الموقع.
      </p>

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

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {/* Content distribution per category */}
        <div className="card p-5">
          <h2 className="mb-4 text-lg font-bold text-brand-800">توزيع المواد حسب التصنيف</h2>
          {s.distribution.length === 0 ? (
            <p className="text-sm text-muted">لا توجد مواد منشورة بعد.</p>
          ) : (
            <div className="space-y-3">
              {s.distribution.map((d) => (
                <div key={d.name}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium text-brand-800">{d.name}</span>
                    <span className="text-muted">{formatCount(d.count)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-ivory-200">
                    <div className="h-full rounded-full bg-brand-500" style={{ width: `${(d.count / maxCount) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Most downloaded */}
        <div className="card p-5">
          <h2 className="mb-4 text-lg font-bold text-brand-800">الأكثر تحميلاً</h2>
          {s.topDownloaded.length === 0 ? (
            <p className="text-sm text-muted">لا توجد بيانات بعد.</p>
          ) : (
            <ol className="space-y-2">
              {s.topDownloaded.map((m, i) => (
                <li key={m.id} className="flex items-center justify-between gap-3 border-b border-ivory-200 pb-2 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">{i + 1}</span>
                    <Link href={`/material/${m.id}`} className="truncate font-medium text-brand-800 hover:underline">{m.title}</Link>
                  </span>
                  <span className="shrink-0 text-muted">{formatCount(m.downloads)} تحميل</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
