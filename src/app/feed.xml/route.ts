import { prisma } from '@/lib/prisma';
import { MATERIAL_STATUS } from '@/lib/constants';
import { SITE_URL, SITE_NAME, SITE_DESCRIPTION, clampDescription } from '@/lib/seo';

export const dynamic = 'force-dynamic';

// RSS 2.0 feed of the newest published materials — for feed readers and as an
// extra discovery signal for search engines.
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export async function GET() {
  const items = await prisma.material.findMany({
    where: { status: MATERIAL_STATUS.PUBLISHED, mergedIntoId: null },
    orderBy: { publishedAt: 'desc' },
    take: 50,
    select: {
      id: true, title: true, description: true, summary: true, publishedAt: true,
      category: { select: { name: true } },
    },
  });

  const now = new Date().toUTCString();
  const entries = items
    .map((m) => {
      const link = `${SITE_URL}/material/${m.id}`;
      const desc = clampDescription(m.description || m.summary, 300) || m.title;
      const pub = m.publishedAt ? new Date(m.publishedAt).toUTCString() : now;
      return `    <item>
      <title>${esc(m.title)}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      ${m.category?.name ? `<category>${esc(m.category.name)}</category>` : ''}
      <description>${esc(desc)}</description>
      <pubDate>${pub}</pubDate>
    </item>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${esc(SITE_NAME)}</title>
    <link>${SITE_URL}</link>
    <atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml" />
    <description>${esc(SITE_DESCRIPTION)}</description>
    <language>ar</language>
    <lastBuildDate>${now}</lastBuildDate>
${entries}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
