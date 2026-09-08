import { NextResponse } from 'next/server';
import { getCategoriesWithCounts } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export async function GET() {
  const cats = await getCategoriesWithCounts();
  return NextResponse.json({
    items: cats.map((c) => ({
      slug: c.slug,
      name: c.name,
      description: c.description,
      icon: c.icon,
      count: c.count,
    })),
  });
}
