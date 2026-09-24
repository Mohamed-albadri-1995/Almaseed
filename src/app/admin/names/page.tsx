import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { can } from '@/lib/rbac';
import { type Role } from '@/lib/constants';
import { formatCount } from '@/lib/format';
import { groupNames, looksSimilar, type NameGroup } from '@/lib/names';
import { NAME_FIELDS, type NameField } from './fields';
import { unifyNamesAction } from './actions';

export const metadata: Metadata = { title: 'توحيد الأسماء' };
export const dynamic = 'force-dynamic';

type Cluster = { names: { name: string; count: number; sameKey: boolean }[]; total: number };

// Exact-key groups (spelling variants) first, then join groups that merely look
// alike (a title/extra word, or a small typo) so the reviewer sees them side by
// side. Only exact-key variants are pre-ticked; «looks alike» needs a human.
function buildClusters(groups: NameGroup[]): Cluster[] {
  const parent = groups.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  if (groups.length <= 1500) {
    for (let i = 0; i < groups.length; i++) {
      for (let j = i + 1; j < groups.length; j++) {
        if (looksSimilar(groups[i].key, groups[j].key)) parent[find(j)] = find(i);
      }
    }
  }
  const byRoot = new Map<number, NameGroup[]>();
  groups.forEach((g, i) => {
    const r = find(i);
    byRoot.set(r, [...(byRoot.get(r) ?? []), g]);
  });
  const clusters: Cluster[] = [];
  for (const gs of Array.from(byRoot.values())) {
    const distinct = gs.reduce((n, g) => n + g.names.length, 0);
    if (distinct < 2) continue;
    gs.sort((a, b) => b.total - a.total);
    const lead = gs[0];
    clusters.push({
      names: gs.flatMap((g) => g.names.map((n) => ({ ...n, sameKey: g === lead }))),
      total: gs.reduce((s, g) => s + g.total, 0),
    });
  }
  return clusters.sort((a, b) => b.total - a.total);
}

export default async function NamesPage({ searchParams }: { searchParams: { field?: string; done?: string; err?: string } }) {
  const user = await getCurrentUser();
  if (!user || !can.manageContent(user.role as Role)) redirect('/admin');

  const field = (NAME_FIELDS.find((f) => f.key === searchParams.field)?.key ?? 'performer') as NameField;
  const fieldLabel = NAME_FIELDS.find((f) => f.key === field)!.label;
  const rows = (await prisma.material.findMany({
    where: { [field]: { not: null } },
    select: { [field]: true },
  })) as unknown as Record<string, string | null>[];
  const groups = groupNames(rows.map((r) => r[field]));
  const clusters = buildClusters(groups);
  const allNames = groups.flatMap((g) => g.names).sort((a, b) => a.name.localeCompare(b.name, 'ar'));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-800">توحيد الأسماء</h1>
        <p className="mt-1 text-sm leading-7 text-muted">
          الشخص الواحد قد يُكتب بعدّة صيغ («شيخ إبراهيم دنقول»، «الشيخ ابراهيم دنقول»، «شيخ إبراهيم(دنقول)»).
          اختر الصيغ التي تخص الشخص نفسه، واكتب الاسم الصحيح، ثم اضغط «توحيد» — تُعدَّل كل المواد دفعة واحدة
          فتتوحّد الإحصائيات والفلاتر والبحث.
        </p>
      </div>

      <nav className="flex flex-wrap gap-2">
        {NAME_FIELDS.map((f) => (
          <Link key={f.key} href={`/admin/names?field=${f.key}`} className={f.key === field ? 'chip bg-brand-600 text-white' : 'chip'}>
            {f.label}
          </Link>
        ))}
      </nav>

      {searchParams.done && (
        <p className="rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">
          تم التوحيد — عُدّلت {formatCount(Number(searchParams.done) || 0)} مادة.
        </p>
      )}
      {searchParams.err && (
        <p className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-danger">اختر صيغة واحدة على الأقل واكتب الاسم الصحيح.</p>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-brand-800">
          أسماء متشابهة — {fieldLabel} <span className="text-sm font-normal text-muted">({formatCount(clusters.length)} مجموعة)</span>
        </h2>
        {clusters.length === 0 && <p className="card p-5 text-sm text-muted">لا توجد أسماء متشابهة في هذا الحقل.</p>}
        {clusters.map((c, idx) => (
          <form key={idx} action={unifyNamesAction} className="card min-w-0 space-y-3 p-4">
            <input type="hidden" name="field" value={field} />
            <ul className="space-y-1.5">
              {c.names.map((n) => (
                <li key={n.name}>
                  <label className="flex min-w-0 cursor-pointer items-center gap-2 rounded-lg bg-ivory-50 px-3 py-2 text-sm">
                    <input type="checkbox" name="names" value={n.name} defaultChecked={n.sameKey} className="h-4 w-4 shrink-0" />
                    <span className="min-w-0 flex-1 truncate font-medium text-brand-800">{n.name}</span>
                    <span className="shrink-0 text-xs text-muted">{formatCount(n.count)} مادة</span>
                  </label>
                </li>
              ))}
            </ul>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                name="target"
                defaultValue={c.names[0].name}
                list={`target-${idx}`}
                required
                className="input min-w-0 flex-1"
                aria-label="الاسم الصحيح"
              />
              <datalist id={`target-${idx}`}>
                {c.names.map((n) => <option key={n.name} value={n.name} />)}
              </datalist>
              <button type="submit" className="btn-primary shrink-0">توحيد</button>
            </div>
            <p className="field-hint">المُعلَّم مسبقًا: صيغ إملائية للاسم نفسه. غير المُعلَّم: أسماء قريبة — علّمها فقط إن كانت للشخص نفسه.</p>
          </form>
        ))}
      </section>

      <section className="card min-w-0 space-y-3 p-4">
        <h2 className="text-lg font-bold text-brand-800">توحيد يدوي</h2>
        <p className="text-sm text-muted">لأسماء لم تظهر أعلاه (مثل «قسم ود يوسف» و«قسم يوسف»): اختر الاسم الخطأ واكتب الصحيح.</p>
        <form action={unifyNamesAction} className="flex flex-col gap-2 sm:flex-row">
          <input type="hidden" name="field" value={field} />
          <input name="names" list="all-names" required placeholder="الاسم المراد تغييره" className="input min-w-0 flex-1" />
          <input name="target" list="all-names" required placeholder="الاسم الصحيح" className="input min-w-0 flex-1" />
          <datalist id="all-names">
            {allNames.map((n) => <option key={n.name} value={n.name}>{`${n.count} مادة`}</option>)}
          </datalist>
          <button type="submit" className="btn-primary shrink-0">توحيد</button>
        </form>
      </section>
    </div>
  );
}
