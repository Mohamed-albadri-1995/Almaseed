import { prisma } from '@/lib/prisma';
import { MATERIAL_STATUS } from '@/lib/constants';
import { SITE_URL, OG_IMAGE, absUrl, clampDescription } from '@/lib/seo';

export const dynamic = 'force-dynamic';

// A Google Video sitemap: declares each published VIDEO material as a video so
// it can appear in video search and be counted in Search Console. The regular
// sitemap can't carry the video: namespace, so this is a separate file.
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export async function GET() {
  const vids = await prisma.material.findMany({
    where: {
      status: MATERIAL_STATUS.PUBLISHED,
      mergedIntoId: null,
      fileKind: 'VIDEO',
      fileUrl: { not: null },
    },
    orderBy: { publishedAt: 'desc' },
    take: 45000,
    select: {
      id: true, title: true, description: true, summary: true, transcript: true,
      fileUrl: true, coverImage: true, durationSec: true, publishedAt: true,
    },
  });

  const entries = vids
    .map((m) => {
      const page = `${SITE_URL}/material/${m.id}`;
      const thumb = absUrl(m.coverImage) || absUrl(OG_IMAGE)!;
      const desc = clampDescription(m.description || m.summary || m.transcript, 500) || m.title;
      const dur = m.durationSec && m.durationSec > 0 ? `      <video:duration>${m.durationSec}</video:duration>\n` : '';
      const pub = m.publishedAt ? `      <video:publication_date>${new Date(m.publishedAt).toISOString()}</video:publication_date>\n` : '';
      return `  <url>
    <loc>${page}</loc>
    <video:video>
      <video:thumbnail_loc>${esc(thumb)}</video:thumbnail_loc>
      <video:title>${esc(m.title)}</video:title>
      <video:description>${esc(desc)}</video:description>
      <video:content_loc>${esc(m.fileUrl as string)}</video:content_loc>
${dur}${pub}    </video:video>
  </url>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
${entries}
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
