'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { can, assignedCategoriesOf } from '@/lib/rbac';
import { logActivity } from '@/lib/activity';
import { buildSearchText } from '@/lib/search';
import { normalizeLine } from '@/lib/format';
import { type Role, ROLES } from '@/lib/constants';
import { isNameField, type NameField } from './fields';
import { CATEGORY_FORMS } from '@/lib/fields';

// Rewrite every material whose `field` is one of `names` to the single chosen
// spelling. This is how «شيخ إبراهيم دنقول» / «الشيخ ابراهيم دنقول» /
// «شيخ إبراهيم(دنقول)» become one person everywhere (stats, filters, search).
export async function unifyNamesAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || !can.manageContent(user.role as Role)) throw new Error('غير مصرّح');

  const field = String(formData.get('field') || '') as NameField;
  if (!isNameField(field)) throw new Error('حقل غير صالح');
  // Optional: limit the rewrite to one section (e.g. only أرشيف النوادر).
  const sectionRaw = String(formData.get('section') || '');
  const section = CATEGORY_FORMS[sectionRaw] ? sectionRaw : '';
  const target = normalizeLine(String(formData.get('target') || ''));
  const names = Array.from(new Set(formData.getAll('names').map((n) => String(n)).filter(Boolean)));
  const back = `/admin/names?field=${field}${section ? `&section=${section}` : ''}`;
  if (!target || names.length === 0) redirect(`${back}&err=1`);

  // A section-scoped manager only rewrites materials in their own sections.
  const scope = user.role === ROLES.ADMIN ? [] : assignedCategoriesOf(user);
  const slugs = section ? (scope.length && !scope.includes(section) ? [] : [section]) : scope;
  const materials = await prisma.material.findMany({
    where: { [field]: { in: names }, ...(slugs.length || section ? { category: { slug: { in: slugs } } } : {}) },
  });
  // Keep each material's previous value so the operation can be undone.
  const undo: { id: string; old: string }[] = [];
  for (const m of materials) {
    const old = (m as Record<string, unknown>)[field] as string;
    if (old === target) continue;
    const next = { ...m, [field]: target };
    await prisma.material.update({
      where: { id: m.id },
      data: { [field]: target, searchText: buildSearchText(next) },
    });
    undo.push({ id: m.id, old });
  }

  await logActivity({
    userId: user.id,
    action: 'unify_names',
    entity: 'material',
    meta: { field, section: section || null, from: names, to: target, changed: undo.length, undo },
  });
  const changed = undo.length;
  revalidatePath('/admin/names');
  revalidatePath('/admin/stats');
  revalidatePath('/archive');
  redirect(`${back}&done=${changed}`);
}

type UnifyMeta = { field: NameField; section?: string | null; from: string[]; to: string; changed: number; undo?: { id: string; old: string }[]; undone?: boolean };

// Undo one «توحيد»: restore each material's previous spelling — but only where
// the value is still the unified one, so later manual edits are never clobbered.
export async function undoUnifyAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || !can.manageContent(user.role as Role)) throw new Error('غير مصرّح');
  const logId = String(formData.get('logId') || '');
  const log = await prisma.activityLog.findUnique({ where: { id: logId } });
  if (!log || log.action !== 'unify_names' || !log.meta) redirect('/admin/names');
  const meta = JSON.parse(log.meta) as UnifyMeta;
  const back = `/admin/names?field=${meta.field}${meta.section ? `&section=${meta.section}` : ''}`;
  if (meta.undone || !meta.undo?.length || !isNameField(meta.field)) redirect(back);

  const field = meta.field;
  const scope = user.role === ROLES.ADMIN ? [] : assignedCategoriesOf(user);
  let restored = 0;
  for (const u of meta.undo) {
    const m = await prisma.material.findUnique({ where: { id: u.id }, include: { category: { select: { slug: true } } } });
    if (!m || (m as Record<string, unknown>)[field] !== meta.to) continue;
    if (scope.length && !scope.includes(m.category.slug)) continue;
    const { category: _c, ...rest } = m;
    await prisma.material.update({
      where: { id: m.id },
      data: { [field]: u.old, searchText: buildSearchText({ ...rest, [field]: u.old }) },
    });
    restored += 1;
  }
  await prisma.activityLog.update({ where: { id: log.id }, data: { meta: JSON.stringify({ ...meta, undone: true }) } });
  await logActivity({ userId: user.id, action: 'undo_unify_names', entity: 'material', meta: { field, to: meta.to, restored } });
  revalidatePath('/admin/names');
  revalidatePath('/admin/stats');
  revalidatePath('/archive');
  redirect(`${back}&undone=${restored}`);
}
