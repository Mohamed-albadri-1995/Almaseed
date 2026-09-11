// Manual one-shot backfill: drain ALL pending materials (watermarkedAt = null)
// through the same worker used in the background — images, PDFs, cover art,
// video (ffmpeg), and mp3 embedded artwork. Processes one at a time so memory
// stays flat; safe to stop and re-run (idempotent via watermarkedAt).
//
// Run where DB + storage creds (and ideally ffmpeg) are available:
//   npx tsx scripts/watermark-existing.ts
//
// The background worker handles new uploads automatically; use this to catch up
// files that existed before the feature, or to force a full pass.

import { prisma } from '../src/lib/prisma';
import { processOnePending } from '../src/lib/watermark-worker';

async function main() {
  let processed = 0;
  for (;;) {
    const r = await processOnePending();
    if (r === 'idle') break;
    processed++;
  }
  console.log(`\nDone. Processed ${processed} pending material(s).`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
