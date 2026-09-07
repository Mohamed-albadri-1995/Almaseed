'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { can } from '@/lib/rbac';
import { logActivity } from '@/lib/activity';
import type { Role } from '@/lib/constants';

async function requireEditor() {
  const user = await getCurrentUser();
  if (!user || !can.editContent(user.role as Role)) throw new Error('غير مصرّح');
  return user;
}

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9؀-ۿ]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

export async function createCategoryAction(formData: FormData) {
  const user = await requireEditor();
  const name = String(formData.get('name') ?? '').trim();
  if (!name) redirect('/admin/categories?error=name');

  let slug = slugify(String(formData.get('slug') ?? '') || name);
  if (!slug) slug = `cat-${Date.now()}`;

  // Ensure the slug is unique.
  const exists = await prisma.category.findUnique({ where: { slug } });
  if (exists) slug = `${slug}-${Date.now().toString().slice(-4)}`;

  const max = await prisma.category.aggregate({ _max: { order: true } });

  await prisma.category.create({
    data: {
      slug,
      name,
      description: String(formData.get('description') ?? '').trim() || null,
      icon: String(formData.get('icon') ?? 'archive'),
      color: String(formData.get('color') ?? 'brand'),
      order: (max._max.order ?? 0) + 1,
    },
  });

  await logActivity({ userId: user.id, action: 'create', entity: 'category', meta: { name } });
  revalidatePath('/admin/categories');
  redirect('/admin/categories?created=1');
}

export async function updateCategoryAction(formData: FormData) {
  const user = await requireEditor();
  const id = String(formData.get('id') ?? '');
  const name = String(formData.get('name') ?? '').trim();
  if (!id || !name) redirect('/admin/categories?error=name');

  await prisma.category.update({
    where: { id },
    data: {
      name,
      description: String(formData.get('description') ?? '').trim() || null,
      icon: String(formData.get('icon') ?? 'archive'),
      color: String(formData.get('color') ?? 'brand'),
    },
  });

  await logActivity({ userId: user.id, action: 'edit', entity: 'category', entityId: id });
  revalidatePath('/admin/categories');
  redirect('/admin/categories?updated=1');
}

export async function moveCategoryAction(formData: FormData) {
  await requireEditor();
  const id = String(formData.get('id') ?? '');
  const dir = String(formData.get('dir') ?? ''); // 'up' | 'down'

  const cats = await prisma.category.findMany({ orderBy: { order: 'asc' } });
  const idx = cats.findIndex((c) => c.id === id);
  if (idx === -1) redirect('/admin/categories');
  const swapWith = dir === 'up' ? idx - 1 : idx + 1;
  if (swapWith < 0 || swapWith >= cats.length) redirect('/admin/categories');

  const a = cats[idx];
  const b = cats[swapWith];
  await prisma.$transaction([
    prisma.category.update({ where: { id: a.id }, data: { order: b.order } }),
    prisma.category.update({ where: { id: b.id }, data: { order: a.order } }),
  ]);
  revalidatePath('/admin/categories');
  redirect('/admin/categories');
}

export async function deleteCategoryAction(formData: FormData) {
  const user = await requireEditor();
  const id = String(formData.get('id') ?? '');
  const count = await prisma.material.count({ where: { categoryId: id } });
  if (count > 0) redirect('/admin/categories?error=hasmaterials');

  await prisma.category.delete({ where: { id } });
  await logActivity({ userId: user.id, action: 'delete', entity: 'category', entityId: id });
  revalidatePath('/admin/categories');
  redirect('/admin/categories?deleted=1');
}
