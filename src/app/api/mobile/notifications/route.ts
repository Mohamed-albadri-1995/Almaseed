import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { MATERIAL_STATUS, STAFF_ROLES, type Role } from '@/lib/constants';
import { verifyMobileToken, bearer } from '@/lib/mobile-auth';
import { assignedCategoriesOf } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

type Item = {
  id: string;
  title: string;
  fileKind: string | null;
  fileUrl: string | null;
  coverImage: string | null;
  at: Date | null;
  type: 'new' | 'review';
  category: { name: string | null; slug: string } | null;
};

// In-app notifications feed:
//  • Everyone: the most recently PUBLISHED materials («إضافة جديدة»).
//  • Staff (only when a valid staff bearer is sent — so older app builds are
//    unaffected): also the materials PENDING review in the sections they are
//    assigned to («بانتظار المراجعة»), each per their permissions.
// The app compares each item's `at` against the last time the bell was opened
// to compute the unread count.
export async function GET(req: Request) {
  const published = await prisma.material.findMany({
    where: { status: MATERIAL_STATUS.PUBLISHED, mergedIntoId: null },
    orderBy: { publishedAt: 'desc' },
    take: 40,
    select: {
      id: true, title: true, fileKind: true, fileUrl: true, coverImage: true,
      publishedAt: true, category: { select: { name: true, slug: true } },
    },
  });

  const items: Item[] = published.map((m) => ({
    id: m.id, title: m.title, fileKind: m.fileKind, fileUrl: m.fileUrl,
    coverImage: m.coverImage, at: m.publishedAt, type: 'new', category: m.category,
  }));

  // Staff review queue — scoped to the reviewer's assigned sections.
  const auth = await verifyMobileToken(bearer(req));
  if (auth) {
    const user = await prisma.user.findUnique({
      where: { id: auth.uid },
      select: { role: true, active: true, assignedCategories: true },
    });
    if (user?.active && (STAFF_ROLES as Role[]).includes(user.role as Role)) {
      const slugs = assignedCategoriesOf(user);
      const pending = await prisma.material.findMany({
        where: {
          status: MATERIAL_STATUS.PENDING,
          mergedIntoId: null,
          ...(slugs.length ? { category: { slug: { in: slugs } } } : {}),
        },
        orderBy: { updatedAt: 'desc' },
        take: 40,
        select: {
          id: true, title: true, fileKind: true, fileUrl: true, coverImage: true,
          updatedAt: true, category: { select: { name: true, slug: true } },
        },
      });
      for (const m of pending) {
        items.push({
          id: m.id, title: m.title, fileKind: m.fileKind, fileUrl: m.fileUrl,
          coverImage: m.coverImage, at: m.updatedAt, type: 'review', category: m.category,
        });
      }
    }
  }

  // Newest activity first; review items (just submitted) naturally rise to top.
  items.sort((a, b) => (b.at ? b.at.getTime() : 0) - (a.at ? a.at.getTime() : 0));

  // Keep publishedAt for backward compatibility with older app builds that read
  // it directly (they never send a bearer, so they only ever get 'new' items).
  const out = items.slice(0, 60).map((it) => ({ ...it, publishedAt: it.at }));
  return NextResponse.json({ items: out });
}
