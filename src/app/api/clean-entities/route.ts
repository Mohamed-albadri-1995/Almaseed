import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { decodeEntities } from '@/lib/format';

export const dynamic = 'force-dynamic';

// Staff-only one-shot cleanup: decodes HTML entities (e.g. «&nbsp;», possibly
// double-encoded as «&amp;nbsp;») that leaked from the rich editor into
// plain-text fields, writing the clean text back to the DB. This fixes every
// surface at once (website info table, app of any build) because the stored
// value itself becomes clean. bodyText is intentionally NOT touched — it is
// rendered as HTML, where entities are correct.
//
//   GET /api/clean-entities        → report how many rows still contain entities
//   GET /api/clean-entities?run=1  → clean them and report what changed

// Plain-text fields only (bodyText excluded on purpose).
const FIELDS = [
  'title', 'subtitle', 'description', 'lyrics', 'summary', 'performer',
  'narrator', 'speaker', 'host', 'participants', 'occasion', 'topic',
  'place', 'city', 'organizer', 'source', 'author', 'keywords', 'docType',
] as const;

const ENTITY = /&(?:nbsp|amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);/;

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.role === 'CONTRIBUTOR') {
    return NextResponse.json({ error: 'غير مصرّح' }, { status: 403 });
  }

  const run = new URL(req.url).searchParams.get('run');
  const rows = await prisma.material.findMany({
    select: {
      id: true, title: true, subtitle: true, description: true, lyrics: true,
      summary: true, performer: true, narrator: true, speaker: true, host: true,
      participants: true, occasion: true, topic: true, place: true, city: true,
      organizer: true, source: true, author: true, keywords: true, docType: true,
    },
  });

  let affected = 0;
  const samples: { id: string; field: string; before: string; after: string }[] = [];

  for (const row of rows as Array<Record<string, string | null> & { id: string }>) {
    const data: Record<string, string> = {};
    for (const f of FIELDS) {
      const v = row[f];
      if (typeof v === 'string' && ENTITY.test(v)) {
        const decoded = decodeEntities(v);
        if (decoded !== v) {
          data[f] = decoded;
          if (samples.length < 10) samples.push({ id: row.id, field: f, before: v, after: decoded });
        }
      }
    }
    if (Object.keys(data).length) {
      affected++;
      if (run) await prisma.material.update({ where: { id: row.id }, data });
    }
  }

  return NextResponse.json({
    mode: run ? 'cleaned' : 'preview',
    materialsAffected: affected,
    note: run
      ? 'تم تنظيف النصوص في قاعدة البيانات.'
      : 'هذه معاينة فقط. أضف ?run=1 لتنفيذ التنظيف.',
    samples,
  });
}
