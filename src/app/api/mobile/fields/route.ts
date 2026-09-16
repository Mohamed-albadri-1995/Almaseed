import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { CATEGORY_FORMS } from '@/lib/fields';

export const dynamic = 'force-dynamic';

// The app's native share-to-app submit screen renders its fields from THIS
// endpoint, so it always matches the website form exactly (single source of
// truth: lib/fields.ts). Returns the ordered categories plus each category's
// form definition (labels, required flags, options, allowed kinds…).
export async function GET() {
  const categories = await prisma.category.findMany({
    orderBy: { order: 'asc' },
    select: { slug: true, name: true },
  });
  // Only categories that have a form definition are submittable.
  const submittable = categories.filter((c) => CATEGORY_FORMS[c.slug]);
  return NextResponse.json({ categories: submittable, forms: CATEGORY_FORMS });
}
