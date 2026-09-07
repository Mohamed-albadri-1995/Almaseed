import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { Icon } from '@/components/icons';
import { getCurrentUser } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { markAllNotificationsRead, markNotificationRead } from '@/app/actions';
import { timeAgo } from '@/lib/format';

export const metadata: Metadata = { title: 'الإشعارات' };
export const dynamic = 'force-dynamic';

export default async function NotificationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?redirect=/account/notifications');

  const notifications = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  const unread = notifications.filter((n) => !n.read).length;

  return (
    <div className="container-page py-10">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <nav className="mb-1 flex items-center gap-1 text-sm text-muted">
              <Link href="/account" className="hover:text-brand-600">حسابي</Link>
              <Icon.chevronLeft width={14} height={14} />
              <span className="text-brand-700">الإشعارات</span>
            </nav>
            <h1 className="section-title">الإشعارات</h1>
          </div>
          {unread > 0 && (
            <form action={markAllNotificationsRead}>
              <button className="btn-outline text-sm">تعليم الكل كمقروء</button>
            </form>
          )}
        </div>

        {notifications.length === 0 ? (
          <div className="card p-12 text-center text-muted">لا توجد إشعارات.</div>
        ) : (
          <div className="space-y-2">
            {notifications.map((n) => (
              <div
                key={n.id}
                className={`card flex items-start justify-between gap-4 p-4 ${
                  n.read ? '' : 'ring-1 ring-brand-200'
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {!n.read && <span className="h-2 w-2 shrink-0 rounded-full bg-brand-600" />}
                    <p className="font-semibold text-brand-800">{n.title}</p>
                  </div>
                  {n.body && <p className="mt-0.5 text-sm text-muted">{n.body}</p>}
                  <div className="mt-1 flex items-center gap-3">
                    <span className="text-xs text-muted">{timeAgo(n.createdAt)}</span>
                    {n.link && (
                      <Link href={n.link} className="text-xs font-semibold text-brand-700 hover:underline">
                        فتح
                      </Link>
                    )}
                  </div>
                </div>
                {!n.read && (
                  <form action={markNotificationRead.bind(null, n.id)}>
                    <button className="text-xs text-muted hover:text-brand-700" aria-label="تعليم كمقروء">
                      <Icon.check width={16} height={16} />
                    </button>
                  </form>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
