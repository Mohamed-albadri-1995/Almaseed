// Recomputes searchText for every material. Idempotent — safe to run on each
// deploy so existing rows become searchable after the search feature was added.
import { PrismaClient } from '@prisma/client';
import { buildSearchText } from '../src/lib/search';

const prisma = new PrismaClient();

async function main() {
  const materials = await prisma.material.findMany();
  let updated = 0;
  for (const m of materials) {
    const searchText = buildSearchText(m);
    if (searchText !== m.searchText) {
      await prisma.material.update({ where: { id: m.id }, data: { searchText } });
      updated++;
    }
  }
  console.log(`🔎 Backfilled searchText for ${updated}/${materials.length} materials.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
