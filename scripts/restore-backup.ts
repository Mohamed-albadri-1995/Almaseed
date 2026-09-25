// Restore the archive from a backup JSON (the daily R2 backup, the weekly email
// attachment, or «تنزيل نسخة احتياطية» from the admin system page).
//
//   npx tsx scripts/restore-backup.ts <backup.json | backup.json.gz>           # dry run: shows counts only
//   npx tsx scripts/restore-backup.ts <backup.json | backup.json.gz> --apply   # writes to DATABASE_URL
//
// Safe by design:
// - Dry run unless --apply is given.
// - Refuses to write into a database that already has materials, unless
//   --force is also given (then existing rows with the same id are kept and
//   only missing rows are added — nothing is overwritten or deleted).
// - Inserts in dependency order (categories/users → materials → the rest).
//
// Backups don't contain secrets, so restored accounts get an unusable password:
// people sign in with Google or use «نسيت كلمة المرور» to set a new one.
import { readFileSync } from 'fs';
import { gunzipSync } from 'zlib';
import { randomBytes } from 'crypto';
import { PrismaClient } from '@prisma/client';

type Rows = Record<string, unknown>[];
interface Backup {
  meta?: { generatedAt?: string; counts?: Record<string, number> };
  data: Record<string, Rows>;
}

// Order matters: parents before children.
const ORDER = [
  'categories', 'users', 'materials', 'reviewNotes', 'versions', 'ratings',
  'comments', 'favorites', 'deletionRequests', 'deletionVotes', 'contentReports',
] as const;

function load(path: string): Backup {
  let buf = readFileSync(path);
  if (path.endsWith('.gz') || (buf[0] === 0x1f && buf[1] === 0x8b)) buf = gunzipSync(buf);
  const json = JSON.parse(buf.toString('utf8')) as Backup;
  if (!json?.data || typeof json.data !== 'object') throw new Error('Not an almaseed backup file (no "data").');
  return json;
}

async function main() {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith('--'));
  const apply = args.includes('--apply');
  const force = args.includes('--force');
  if (!file) {
    console.error('Usage: npx tsx scripts/restore-backup.ts <backup.json[.gz]> [--apply] [--force]');
    process.exit(1);
  }

  const backup = load(file);
  console.log(`Backup: ${file}  (generated ${backup.meta?.generatedAt ?? 'unknown'})`);
  for (const k of ORDER) console.log(`  ${k.padEnd(18)} ${(backup.data[k] ?? []).length}`);

  if (!apply) {
    console.log('\nDry run only. Re-run with --apply to write to the database.');
    return;
  }

  const prisma = new PrismaClient();
  try {
    const existing = await prisma.material.count();
    if (existing > 0 && !force) {
      throw new Error(`Database already has ${existing} materials. Refusing to restore on top of live data (use --force to only add missing rows).`);
    }

    const models: Record<(typeof ORDER)[number], { createMany: (a: { data: Rows; skipDuplicates: boolean }) => Promise<{ count: number }> }> = {
      categories: prisma.category, users: prisma.user, materials: prisma.material,
      reviewNotes: prisma.reviewNote, versions: prisma.materialVersion, ratings: prisma.rating,
      comments: prisma.comment, favorites: prisma.favorite, deletionRequests: prisma.deletionRequest,
      deletionVotes: prisma.deletionVote, contentReports: prisma.contentReport,
    } as never;

    for (const key of ORDER) {
      let rows = backup.data[key] ?? [];
      if (key === 'users') {
        // No password hashes in backups: give each account an unusable random one.
        rows = rows.map((u) => ({ ...u, passwordHash: `!restored-${randomBytes(24).toString('hex')}` }));
      }
      let added = 0;
      for (let i = 0; i < rows.length; i += 500) {
        const res = await models[key].createMany({ data: rows.slice(i, i + 500), skipDuplicates: true });
        added += res.count;
      }
      console.log(`✓ ${key.padEnd(18)} added ${added}/${rows.length}`);
    }
    console.log('\nRestore complete. Files themselves live in R2 and are referenced by URL — nothing to copy.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error('✗', e instanceof Error ? e.message : e);
  process.exit(1);
});
