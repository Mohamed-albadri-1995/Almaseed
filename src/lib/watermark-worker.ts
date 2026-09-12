// Background watermark worker.
//
// Watermarking is done OFF the upload path so a contributor's upload and any
// download are instant and never blocked. This worker claims ONE pending
// material at a time (Material.watermarkedAt = null), stamps its file(s), and
// marks it done. Because it processes strictly one item at a time and ffmpeg
// streams to disk, memory stays flat regardless of file size — a slow, steady
// drain, exactly as intended.

import { randomBytes } from 'crypto';
import { prisma } from './prisma';
import {
  watermarkImage,
  watermarkPdf,
  isWatermarkableImage,
  isWatermarkablePdf,
} from './watermark';
import { saveUpload, saveUploadFromFile } from './storage';
import {
  hasFfmpeg,
  watermarkVideoInPlace,
  watermarkMp3ArtworkInPlace,
} from './watermark-media';
import { buildBrandLabel } from './brand-label';

const IMG_MIME: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
};

// A fresh storage key for the stamped file. Writing to a NEW url (instead of
// overwriting) sidesteps any CDN/browser caching of the old unstamped object.
function newName(ext: string): string {
  return `${randomBytes(8).toString('hex')}.${(ext || 'dat').toLowerCase()}`;
}

function extOf(url: string, fileType?: string | null): string {
  const t = (fileType || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (t && t.length <= 4) return t;
  return (url.split('?')[0].split('.').pop() || '').toLowerCase();
}

async function readBytes(url: string): Promise<Buffer> {
  if (/^https?:\/\//.test(url)) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`fetch ${res.status} for ${url}`);
    return Buffer.from(await res.arrayBuffer());
  }
  const { readFile } = await import('fs/promises');
  const { join, basename } = await import('path');
  const { uploadsDir } = await import('./uploads');
  return readFile(join(uploadsDir(), basename(url)));
}

// Watermark a plain image URL (image materials + cover art) → new URL, or null.
async function stampImageNew(url: string, label: Buffer): Promise<string | null> {
  const ext = extOf(url);
  if (!isWatermarkableImage(ext)) return null;
  const w = await watermarkImage(await readBytes(url), ext, label);
  return saveUpload(newName(ext), w, IMG_MIME[ext] || 'image/jpeg');
}

type PendingRow = {
  id: string;
  title: string;
  fileUrl: string | null;
  fileKind: string | null;
  fileType: string | null;
  coverImage: string | null;
  submittedBy: { name: string | null } | null;
};

async function processMaterial(m: PendingRow, ff: boolean): Promise<string[]> {
  const done: string[] = [];
  const updates: { fileUrl?: string; coverImage?: string } = {};
  // Pre-render the brand label once (emblem + المساهم name + site) so every
  // stamp on this material carries the same, correctly-shaped text.
  const contributor = m.submittedBy?.name ?? null;
  const label = await buildBrandLabel(contributor);

  if (m.fileUrl) {
    const ext = extOf(m.fileUrl, m.fileType);
    if (m.fileKind === 'IMAGE' && isWatermarkableImage(ext)) {
      const u = await stampImageNew(m.fileUrl, label);
      if (u) { updates.fileUrl = u; done.push('image'); }
    } else if (m.fileKind === 'DOCUMENT' && isWatermarkablePdf(ext)) {
      const w = await watermarkPdf(await readBytes(m.fileUrl), label);
      updates.fileUrl = await saveUpload(newName('pdf'), w, 'application/pdf');
      done.push('pdf');
    } else if (m.fileKind === 'VIDEO' && ff) {
      updates.fileUrl = await watermarkVideoInPlace(m.fileUrl, ext, (p, ct) => saveUploadFromFile(newName(ext || 'mp4'), p, ct), contributor);
      done.push('video');
    } else if (m.fileKind === 'AUDIO' && ff && ext === 'mp3') {
      const u = await watermarkMp3ArtworkInPlace(m.fileUrl, (p, ct) => saveUploadFromFile(newName('mp3'), p, ct), contributor);
      if (u) { updates.fileUrl = u; done.push('audio-art'); }
    }
  }

  // Cover image / thumbnail (album art shown in our player) — any material kind.
  if (m.coverImage) {
    try {
      const u = await stampImageNew(m.coverImage, label);
      if (u) { updates.coverImage = u; done.push('cover'); }
    } catch { /* ignore cover errors */ }
  }

  if (Object.keys(updates).length) {
    await prisma.material.update({ where: { id: m.id }, data: updates });
  }
  return done;
}

// Process exactly one pending material. Returns 'processed' | 'idle'.
export async function processOnePending(): Promise<'processed' | 'idle'> {
  const ff = await hasFfmpeg();
  // Pull a few candidates; skip VIDEO when ffmpeg is unavailable so those stay
  // pending until it is (rather than being marked done unstamped).
  const candidates = await prisma.material.findMany({
    where: {
      watermarkedAt: null,
      OR: [{ fileKind: 'IMAGE' }, { fileKind: 'DOCUMENT' }, { fileKind: 'VIDEO' }, { fileKind: 'AUDIO' }, { coverImage: { not: null } }],
    },
    orderBy: { createdAt: 'asc' },
    take: 8,
    select: { id: true, title: true, fileUrl: true, fileKind: true, fileType: true, coverImage: true, submittedBy: { select: { name: true } } },
  });

  for (const m of candidates) {
    if (m.fileKind === 'VIDEO' && !ff) continue; // leave for when ffmpeg exists
    // Claim atomically: only one worker/instance wins the null → now transition.
    const claim = await prisma.material.updateMany({
      where: { id: m.id, watermarkedAt: null },
      data: { watermarkedAt: new Date() },
    });
    if (claim.count !== 1) continue; // someone else took it

    try {
      const done = await processMaterial(m, ff);
      await prisma.material.update({ where: { id: m.id }, data: { watermarkError: null } }).catch(() => {});
      console.log(`[watermark] ${done.length ? 'stamped[' + done.join(',') + ']' : 'nothing'} ${m.id} ${m.title}`);
    } catch (e) {
      // Marked done to avoid a hot retry loop; the error is stored so it is
      // visible in /api/watermark-status and can be requeued after a fix.
      const msg = e instanceof Error ? e.message : String(e);
      await prisma.material.update({ where: { id: m.id }, data: { watermarkError: msg.slice(0, 300) } }).catch(() => {});
      console.error(`[watermark] failed ${m.id} ${m.title}:`, msg);
    }
    return 'processed';
  }
  return 'idle';
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let started = false;
export function startWorkerLoop(): void {
  if (started) return;
  started = true;
  (async () => {
    // Small initial delay so it never competes with server startup work.
    await sleep(15000);
    for (;;) {
      let did: 'processed' | 'idle' = 'idle';
      try {
        did = await processOnePending();
      } catch (e) {
        console.error('[watermark] loop error:', e instanceof Error ? e.message : e);
      }
      await sleep(did === 'processed' ? 2000 : 30000);
    }
  })();
}
