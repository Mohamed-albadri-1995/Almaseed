import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { DynamicIcon } from '@/components/icons';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { can } from '@/lib/rbac';
import {
  createCategoryAction,
  updateCategoryAction,
  moveCategoryAction,
  deleteCategoryAction,
} from '@/app/admin/category-actions';
import {
  CATEGORY_ICON_OPTIONS,
  CATEGORY_COLOR_OPTIONS,
  type Role,
} from '@/lib/constants';
import { formatCount } from '@/lib/format';

export const metadata: Metadata = { title: 'إدارة التصنيفات' };
export const dynamic = 'force-dynamic';

export default async function CategoriesPage({
  searchParams,
}: {
  searchParams: { created?: string; updated?: string; deleted?: string; error?: string };
}) {
  const user = await getCurrentUser();
  if (!user || !can.editContent(user.role as Role)) redirect('/admin');

  const categories = await prisma.category.findMany({ orderBy: { order: 'asc' } });
  const counts = await prisma.material.groupBy({
    by: ['categoryId'],
    _count: { _all: true },
  });
  const countFor = (id: string) =>
    counts.find((c) => c.categoryId === id)?._count._all ?? 0;

  const IconSelect = ({ name, defaultValue }: { name: string; defaultValue?: string }) => (
    <select name={name} defaultValue={defaultValue ?? 'archive'} className="input">
      {CATEGORY_ICON_OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
  const ColorSelect = ({ name, defaultValue }: { name: string; defaultValue?: string }) => (
    <select name={name} defaultValue={defaultValue ?? 'brand'} className="input">
      {CATEGORY_COLOR_OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );

  return (
    <div>
      <div className="mb-6">
        <h1 className="section-title">إدارة التصنيفات</h1>
        <p className="text-muted">أضف أبواب الأرشيف، عدّل أسماءها وأيقوناتها ورتّبها.</p>
      </div>

      {searchParams.created && <Banner tone="ok">تمت إضافة التصنيف.</Banner>}
      {searchParams.updated && <Banner tone="ok">تم حفظ التعديلات.</Banner>}
      {searchParams.deleted && <Banner tone="ok">تم حذف التصنيف.</Banner>}
      {searchParams.error === 'hasmaterials' && (
        <Banner tone="err">لا يمكن حذف تصنيف يحتوي على مواد. انقل المواد أو أخفِها أولاً.</Banner>
      )}
      {searchParams.error === 'name' && <Banner tone="err">اسم التصنيف مطلوب.</Banner>}

      {/* Existing categories */}
      <div className="space-y-3">
        {categories.map((c, i) => (
          <div key={c.id} className="card p-4">
            <form action={updateCategoryAction} className="grid items-end gap-3 sm:grid-cols-[auto_1fr_1fr_auto]">
              <input type="hidden" name="id" value={c.id} />
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-100 text-brand-600">
                <DynamicIcon name={c.icon} width={22} height={22} />
              </span>
              <div>
                <label className="label">الاسم</label>
                <input name="name" defaultValue={c.name} required className="input" />
              </div>
              <div>
                <label className="label">الوصف</label>
                <input name="description" defaultValue={c.description ?? ''} className="input" />
              </div>
              <div className="flex items-center gap-2">
                <span className="chip">{formatCount(countFor(c.id))} مادة</span>
              </div>
              <div>
                <label className="label">الأيقونة</label>
                <IconSelect name="icon" defaultValue={c.icon ?? 'archive'} />
              </div>
              <div>
                <label className="label">اللون</label>
                <ColorSelect name="color" defaultValue={c.color ?? 'brand'} />
              </div>
              <div className="sm:col-span-2 flex items-center justify-between gap-2">
                <div className="flex gap-1">
                  <MoveButton id={c.id} dir="up" disabled={i === 0} />
                  <MoveButton id={c.id} dir="down" disabled={i === categories.length - 1} />
                </div>
                <div className="flex gap-2">
                  <button className="btn-primary px-4 py-2 text-sm">حفظ</button>
                </div>
              </div>
            </form>
            <form action={deleteCategoryAction} className="mt-2 flex justify-end border-t border-ivory-200 pt-2">
              <input type="hidden" name="id" value={c.id} />
              <button className="text-xs text-muted hover:text-danger" title={countFor(c.id) ? 'يحتوي على مواد' : ''}>
                حذف التصنيف
              </button>
            </form>
          </div>
        ))}
      </div>

      {/* New category */}
      <div className="card mt-8 p-5">
        <h2 className="mb-4 text-lg font-bold text-brand-800">إضافة تصنيف جديد</h2>
        <form action={createCategoryAction} className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">الاسم</label>
            <input name="name" required className="input" placeholder="مثال: القصائد" />
          </div>
          <div>
            <label className="label">المُعرّف (اختياري، إنجليزي)</label>
            <input name="slug" className="input" placeholder="poems" dir="ltr" />
          </div>
          <div className="sm:col-span-2">
            <label className="label">الوصف</label>
            <input name="description" className="input" placeholder="وصف مختصر يظهر على البطاقة" />
          </div>
          <div>
            <label className="label">الأيقونة</label>
            <IconSelect name="icon" />
          </div>
          <div>
            <label className="label">اللون</label>
            <ColorSelect name="color" />
          </div>
          <div className="sm:col-span-2">
            <button className="btn-gold">إضافة التصنيف</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Banner({ tone, children }: { tone: 'ok' | 'err'; children: React.ReactNode }) {
  return (
    <div
      className={`mb-4 rounded-xl px-4 py-3 text-sm font-medium ${
        tone === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
      }`}
    >
      {children}
    </div>
  );
}

function MoveButton({ id, dir, disabled }: { id: string; dir: 'up' | 'down'; disabled: boolean }) {
  return (
    <form action={moveCategoryAction}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="dir" value={dir} />
      <button
        disabled={disabled}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-ivory-300 text-brand-700 hover:bg-brand-50 disabled:opacity-40"
        aria-label={dir === 'up' ? 'أعلى' : 'أسفل'}
      >
        {dir === 'up' ? '↑' : '↓'}
      </button>
    </form>
  );
}
