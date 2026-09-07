import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { can } from '@/lib/rbac';
import { changeRoleAction, toggleUserActiveAction } from '@/app/admin/actions';
import { ROLES, ROLE_LABELS, type Role } from '@/lib/constants';
import { formatDate } from '@/lib/format';

export const metadata: Metadata = { title: 'المستخدمون' };
export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  const me = await getCurrentUser();
  if (!me || !can.manageUsers(me.role as Role)) redirect('/admin');

  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'asc' },
    include: { _count: { select: { submissions: true } } },
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="section-title">إدارة المستخدمين والصلاحيات</h1>
        <p className="text-muted">امنح الأدوار المناسبة للمشرفين والمحررين.</p>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-ivory-50 text-xs text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">الاسم</th>
                <th className="px-4 py-3 font-medium">البريد</th>
                <th className="px-4 py-3 font-medium">المواد</th>
                <th className="px-4 py-3 font-medium">انضم</th>
                <th className="px-4 py-3 font-medium">الدور</th>
                <th className="px-4 py-3 font-medium">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ivory-200">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-ivory-50/60">
                  <td className="px-4 py-3 font-medium text-brand-800">
                    {u.name}
                    {u.id === me.id && <span className="mr-1 text-xs text-muted">(أنت)</span>}
                  </td>
                  <td className="px-4 py-3 text-muted" dir="ltr">{u.email}</td>
                  <td className="px-4 py-3 text-muted">{u._count.submissions}</td>
                  <td className="px-4 py-3 text-muted">{formatDate(u.createdAt)}</td>
                  <td className="px-4 py-3">
                    <form action={changeRoleAction} className="flex items-center gap-2">
                      <input type="hidden" name="id" value={u.id} />
                      <select
                        name="role"
                        defaultValue={u.role}
                        disabled={u.id === me.id}
                        className="input w-40 py-1.5 text-sm disabled:opacity-60"
                      >
                        {Object.values(ROLES).map((r) => (
                          <option key={r} value={r}>{ROLE_LABELS[r as Role]}</option>
                        ))}
                      </select>
                      {u.id !== me.id && (
                        <button className="btn-outline px-3 py-1.5 text-xs">حفظ</button>
                      )}
                    </form>
                  </td>
                  <td className="px-4 py-3">
                    {u.id === me.id ? (
                      <span className="chip bg-emerald-100 text-emerald-700">نشط</span>
                    ) : (
                      <form action={toggleUserActiveAction}>
                        <input type="hidden" name="id" value={u.id} />
                        <button
                          className={`chip ${
                            u.active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {u.active ? 'نشط' : 'معطّل'}
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="mt-4 text-xs text-muted">
        مستويات الصلاحيات: المراجع (مراجعة ونشر) · المحرر (تعديل المواد والتصنيفات) · مدير المحتوى (إدارة كل المحتوى والمساهمين) · مدير النظام (إدارة المستخدمين والإعدادات).
      </p>
    </div>
  );
}
