import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { MATERIAL_STATUS } from '@/lib/constants';

export const dynamic = 'force-dynamic';

// In-app notifications feed: the most recently published materials, newest
// first. The app compares publishedAt against the last time the user opened the
// notifications screen to show an unread count.
export async function GET() {
  const items = await prisma.material.findMany({
    where: { status: MATERIAL_STATUS.PUBLISHED, mergedIntoId: null },
    orderBy: { publishedAt: 'desc' },
    take: 40,
    select: {
      id: true,
      title: true,
      fileKind: true,
      fileUrl: true,
      coverImage: true,
      publishedAt: true,
      category: { select: { name: true, slug: true } },
    },
  });
  return NextResponse.json({ items });
}
