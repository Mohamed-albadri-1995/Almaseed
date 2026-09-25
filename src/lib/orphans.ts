import { prisma } from './prisma';
import { listStoredObjects, deleteStoredKey, storagePublicBase, storageConfigured } from './storage';
import { logActivity } from './activity';

// Weekly clean-up of uploads nothing points to — mostly files uploaded from a
// form that was then abandoned (with direct-to-R2 uploads the file lands in
// storage before the material exists). Deliberately conservative:
//  - only our own upload names (16 hex chars + extension, flat keys) — never
//    backups/ or anything else in the bucket;
//  - only objects older than MIN_AGE_DAYS (a form may still be open);
//  - "referenced" means the key appears ANYWHERE in a material (file, cover,
//    originals, article body) or in the edit history (so rollbacks keep working);
//  - aborts if the reference scan looks wrong (no materials) or if an
//    implausible share of files would go; at most MAX_DELETE per run.
const MIN_AGE_DAYS = 14;
const MAX_DELETE = 300;
const MAX_SHARE = 0.3;
const UPLOAD_KEY = /^[0-9a-f]{16}\.[a-z0-9]{1,5}$/;

async function referencedKeys(base: string): Promise<{ keys: Set<string>; materials: number }> {
  const keys = new Set<string>();
  const re = new RegExp(`${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/([0-9a-f]{16}\\.[a-z0-9]{1,5})`, 'g');
  const scan = (text?: string | null) => {
    if (!text) return;
    for (const m of text.matchAll(re)) keys.add(m[1]);
  };
  const materials = await prisma.material.findMany({
    select: { fileUrl: true, coverImage: true, originalFileUrl: true, originalCoverImage: true, bodyText: true },
  });
  for (const m of materials) {
    scan(m.fileUrl); scan(m.coverImage); scan(m.originalFileUrl); scan(m.originalCoverImage); scan(m.bodyText);
  }
  const versions = await prisma.materialVersion.findMany({ select: { snapshot: true } });
  for (const v of versions) scan(v.snapshot);
  return { keys, materials: materials.length };
}

type Listed = { key: string; size: number; lastModified: Date | null };
export async function cleanupOrphanUploads(opts: {
  dryRun?: boolean;
  // Injectable for tests; default to the real bucket.
  base?: string;
  list?: () => AsyncIterable<Listed>;
  del?: (key: string) => Promise<void>;
} = {}): Promise<string | null> {
  const base = opts.base ?? (storageConfigured() ? storagePublicBase() : null);
  if (!base) return null;
  const list = opts.list ?? listStoredObjects;
  const del = opts.del ?? deleteStoredKey;

  if (!opts.dryRun) {
    const since = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);
    const recent = await prisma.activityLog.findFirst({ where: { action: 'orphan_cleanup', createdAt: { gte: since } } });
    if (recent) return null; // weekly
  }

  const { keys, materials } = await referencedKeys(base);
  if (materials === 0 || keys.size === 0) return 'skipped: reference scan found nothing (safety stop)';

  const cutoff = Date.now() - MIN_AGE_DAYS * 24 * 60 * 60 * 1000;
  let eligible = 0;
  const orphans: { key: string; size: number }[] = [];
  for await (const o of list()) {
    if (!UPLOAD_KEY.test(o.key)) continue;
    eligible++;
    if (keys.has(o.key)) continue;
    if (!o.lastModified || o.lastModified.getTime() > cutoff) continue;
    orphans.push({ key: o.key, size: o.size });
  }
  if (eligible && orphans.length / eligible > MAX_SHARE) {
    const msg = `skipped: ${orphans.length}/${eligible} uploads look unreferenced — too many, not deleting (safety stop)`;
    await logActivity({ action: 'orphan_cleanup', entity: 'system', meta: { skipped: true, orphans: orphans.length, eligible } });
    return msg;
  }

  const batch = orphans.slice(0, MAX_DELETE);
  const bytes = batch.reduce((s, o) => s + o.size, 0);
  if (opts.dryRun) return `dry run: would delete ${batch.length} of ${eligible} uploads (${Math.round(bytes / 1048576)} MB)`;

  let deleted = 0;
  for (const o of batch) {
    try { await del(o.key); deleted++; } catch (e) { console.error('[orphans] delete failed', o.key, e); }
  }
  await logActivity({ action: 'orphan_cleanup', entity: 'system', meta: { deleted, eligible, mb: Math.round(bytes / 1048576), keys: batch.map((o) => o.key) } });
  return `deleted ${deleted} unused upload(s) of ${eligible} (${Math.round(bytes / 1048576)} MB freed)`;
}
