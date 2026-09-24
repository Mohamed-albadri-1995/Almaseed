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
import { NAME_FIELDS, type NameField } from './fields';

// Rewrite every material whose `field` is one of `names` to the single chosen
// spelling. This is how «شيخ إبراهيم دنقول» / «الشيخ ابراهيم دنقول» /
// «شيخ إبراهيم(دنقول)» become one person everywhere (stats, filters, search).
export async function unifyNamesAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || !can.manageContent(user.role as Role)) throw new Error('غير مصرّح');

  const field = String(formData.get('field') || '') as NameField;
  if (!NAME_FIELDS.some((f) => f.key === field)) throw new Error('حقل غير صالح');
  const target = normalizeLine(String(formData.get('target') || ''));
  const names = Array.from(new Set(formData.getAll('names').map((n) => String(n)).filter(Boolean)));
  const back = `/admin/names?field=${field}`;
  if (!target || names.length === 0) redirect(`${back}&err=1`);

  // A section-scoped manager only rewrites materials in their own sections.
  const scope = user.role === ROLES.ADMIN ? [] : assignedCategoriesOf(user);
  const materials = await prisma.material.findMany({
    where: { [field]: { in: names }, ...(scope.length ? { category: { slug: { in: scope } } } : {}) },
  });
  let changed = 0;
  for (const m of materials) {
    if ((m as Record<string, unknown>)[field] === target) continue;
    const next = { ...m, [field]: target };
    await prisma.material.update({
      where: { id: m.id },
      data: { [field]: target, searchText: buildSearchText(next) },
    });
    changed += 1;
  }

  await logActivity({
    userId: user.id,
    action: 'unify_names',
    entity: 'material',
    meta: { field, from: names, to: target, changed },
  });
  revalidatePath('/admin/names');
  revalidatePath('/admin/stats');
  revalidatePath('/archive');
  redirect(`${back}&done=${changed}`);
}
