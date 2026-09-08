import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/session';
import { can, isStaff } from '@/lib/rbac';
import { AdminNav } from '@/components/AdminNav';
import { ROLE_LABELS, type Role } from '@/lib/constants';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?redirect=/admin');
  if (!isStaff(user.role)) redirect('/');

  const role = user.role as Role;
  const nav = [
    { href: '/admin', label: 'لوحة التحكم', icon: 'chart', show: true },
    { href: '/admin/submissions', label: 'المراجعة', icon: 'file', show: can.reviewContent(role) },
    { href: '/admin/materials', label: 'إدارة المواد', icon: 'archive', show: can.editContent(role) },
    { href: '/admin/categories', label: 'التصنيفات', icon: 'book-open', show: can.editContent(role) },
    { href: '/admin/reports', label: 'البلاغات', icon: 'flag', show: can.manageContent(role) },
    { href: '/admin/users', label: 'المستخدمون', icon: 'users', show: can.manageUsers(role) },
    { href: '/admin/system', label: 'حالة النظام', icon: 'chart', show: can.manageUsers(role) },
    { href: '/admin/activity', label: 'سجل النشاط', icon: 'clock', show: can.viewReports(role) },
  ].filter((n) => n.show);

  return (
    <div className="container-page py-8">
      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <div className="card p-4">
            <div className="mb-4 rounded-xl bg-brand-50 p-3">
              <p className="text-xs text-muted">مسجّل الدخول باسم</p>
              <p className="font-bold text-brand-800">{user.name}</p>
              <span className="chip mt-1">{ROLE_LABELS[role]}</span>
            </div>
            <AdminNav items={nav} />
            <Link href="/" className="btn-ghost mt-3 w-full justify-start text-sm">
              ← العودة إلى الموقع
            </Link>
          </div>
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
