// One-time backfill: apply the السجادة watermark to files uploaded BEFORE the
// watermark feature existed. Idempotent — it only touches materials whose
// watermarkedAt is null, and stamps that field afterwards, so re-running is safe
// and never double-stamps.
//
// Covers: image files, PDF documents, and cover images (album art / thumbnails,
// including the images shown for audio clips). Audio/video media are not
// re-encoded (see the notes in README / the chat) — only their cover image, if
// any, is stamped.
//
// Run it where the DB + storage credentials are available (e.g. Railway shell):
//   npx tsx scripts/watermark-existing.ts
// Optional: DRY_RUN=1 to only list what would change.

import { prisma } from '../src/lib/prisma';
import {
  watermarkImage,
  watermarkPdf,
  isWatermarkableImage,
  isWatermarkablePdf,
} from '../src/lib/watermark';
import { overwriteUpload } from '../src/lib/storage';

const DRY = process.env.DRY_RUN === '1';

const MIME: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', pdf: 'application/pdf',
};

function extOf(url: string, fileType?: string | null): string {
  const t = (fileType || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (t) return t;
  return (url.split('?')[0].split('.').pop() || '').toLowerCase();
}

async function readBytes(url: string): Promise<Buffer> {
  if (/^https?:\/\//.test(url)) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`fetch ${res.status} for ${url}`);
    return Buffer.from(await res.arrayBuffer());
  }
  // Local storage (dev / Railway volume).
  const { readFile } = await import('fs/promises');
  const { join, basename } = await import('path');
  const { uploadsDir } = await import('../src/lib/uploads');
  return readFile(join(uploadsDir(), basename(url)));
}

async function main() {
  const materials = await prisma.material.findMany({
    where: {
      watermarkedAt: null,
      OR: [{ fileKind: 'IMAGE' }, { fileKind: 'DOCUMENT' }, { coverImage: { not: null } }],
    },
    select: { id: true, title: true, fileUrl: true, fileKind: true, fileType: true, coverImage: true },
  });
  console.log(`Found ${materials.length} material(s) to check.${DRY ? ' (dry run)' : ''}`);

  let stamped = 0;
  for (const m of materials) {
    const actions: string[] = [];
    try {
      // Main file: images and PDFs.
      if (m.fileUrl) {
        const ext = extOf(m.fileUrl, m.fileType);
        if (m.fileKind === 'IMAGE' && isWatermarkableImage(ext)) {
          if (!DRY) {
            const w = await watermarkImage(await readBytes(m.fileUrl), ext);
            await overwriteUpload(m.fileUrl, w, MIME[ext] || 'image/jpeg');
          }
          actions.push('image');
        } else if (m.fileKind === 'DOCUMENT' && isWatermarkablePdf(ext)) {
          if (!DRY) {
            const w = await watermarkPdf(await readBytes(m.fileUrl));
            await overwriteUpload(m.fileUrl, w, 'application/pdf');
          }
          actions.push('pdf');
        }
      }
      // Cover image (thumbnail / album art), whatever the material kind is.
      if (m.coverImage) {
        const cext = extOf(m.coverImage);
        if (isWatermarkableImage(cext)) {
          if (!DRY) {
            const w = await watermarkImage(await readBytes(m.coverImage), cext);
            await overwriteUpload(m.coverImage, w, MIME[cext] || 'image/jpeg');
          }
          actions.push('cover');
        }
      }
      if (!DRY) {
        await prisma.material.update({ where: { id: m.id }, data: { watermarkedAt: new Date() } });
      }
      if (actions.length) stamped++;
      console.log(`${actions.length ? '✔ stamped[' + actions.join(',') + ']' : '· nothing to stamp'}  ${m.id}  ${m.title}`);
    } catch (e) {
      console.error(`x failed  ${m.id}  ${m.title}:`, e instanceof Error ? e.message : e);
    }
  }
  console.log(`\nDone. Stamped ${stamped} material(s).`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
