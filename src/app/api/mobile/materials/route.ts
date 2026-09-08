import { NextResponse } from 'next/server';
import { searchMaterials } from '@/lib/queries';

export const dynamic = 'force-dynamic';

// Public list of published materials for the app's media player.
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const result = await searchMaterials({
    categorySlug: sp.get('category') || undefined,
    q: sp.get('q') || undefined,
    page: Math.max(1, Number(sp.get('page')) || 1),
    perPage: 20,
  });
  return NextResponse.json({
    items: result.items,
    total: result.total,
    page: result.page,
    pages: result.pages,
  });
}
