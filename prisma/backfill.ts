// Idempotent data maintenance, safe to run on each deploy:
//  1. Normalize single-line name/label fields (stray non-breaking/zero-width
//     spaces, bidi marks, doubled or trailing spaces) so identical names match
//     in filters, stats and duplicate detection.
//  2. Recompute searchText for every material.
import { PrismaClient } from '@prisma/client';
import { buildSearchText } from '../src/lib/search';
import { normalizeLine } from '../src/lib/format';

const prisma = new PrismaClient();

const LINE_FIELDS = [
  'title', 'subtitle', 'performer', 'narrator', 'speaker', 'host', 'participants',
  'occasion', 'topic', 'place', 'city', 'organizer', 'source', 'author', 'keywords', 'docType',
] as const;

async function main() {
  const materials = await prisma.material.findMany();
  let normalized = 0;
  let reindexed = 0;
  for (const m of materials) {
    const rec = m as unknown as Record<string, string | null>;
    const data: Record<string, string | null> = {};
    for (const f of LINE_FIELDS) {
      const v = rec[f];
      if (typeof v !== 'string') continue;
      const nv = normalizeLine(v);
      // Never blank out the (required) title.
      if (f === 'title' && !nv) continue;
      if (nv !== v) data[f] = nv;
    }
    if (Object.keys(data).length) normalized++;
    const merged = { ...m, ...data };
    const searchText = buildSearchText(merged);
    if (searchText !== m.searchText) data.searchText = searchText;
    if (Object.keys(data).length) {
      await prisma.material.update({ where: { id: m.id }, data });
      if (data.searchText !== undefined) reindexed++;
    }
  }
  console.log(`🧹 Normalized names on ${normalized} materials; 🔎 reindexed ${reindexed}/${materials.length}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
