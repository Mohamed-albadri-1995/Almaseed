// Video + audio-artwork watermarking via ffmpeg, for the background worker.
//
// Everything works on temp files on disk and lets ffmpeg stream, so memory
// stays bounded no matter how large the media is. These run OFF the upload path
// (a background worker calls them), so a contributor's upload/download is never
// blocked or slowed.

import { spawn } from 'child_process';
import { mkdtemp, rm, readFile, writeFile } from 'fs/promises';
import { createWriteStream, createReadStream } from 'fs';
import { tmpdir } from 'os';
import { join, basename } from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { uploadsDir } from './uploads';
import { watermarkImage } from './watermark';
import { buildBrandLabel } from './brand-label';

const EMBLEM = () => join(process.cwd(), 'public', 'logo.png');

// A branded square cover (emblem + المساهم name + site on the brand green) —
// embedded into audio files so the brand shows in external players. It is
// written INTO the audio file only; the material's coverImage in the DB is
// left untouched, so the app's card/kind icons are unaffected.
async function brandCover(contributor?: string | null): Promise<Buffer> {
  const sharpMod = (await import('sharp')).default;
  const logo = await sharpMod(await readFile(EMBLEM())).resize({ width: 380 }).png().toBuffer();
  const name = (contributor || '').trim().replace(/\s+/g, ' ').slice(0, 30);
  const site = 'almaseeed.com';
  const textSvg = Buffer.from(
    `<svg width="600" height="200" xmlns="http://www.w3.org/2000/svg">` +
      (name
        ? `<text x="300" y="72" font-size="52" fill="#ffffff" text-anchor="middle" direction="rtl" font-family="'Noto Naskh Arabic','Noto Sans Arabic','Amiri','DejaVu Sans',sans-serif" font-weight="600">${name.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</text>`
        : '') +
      `<text x="300" y="${name ? 150 : 110}" font-size="42" fill="#e8d9a0" text-anchor="middle" font-family="'DejaVu Sans','Noto Sans',sans-serif" letter-spacing="1">${site}</text>` +
      `</svg>`,
  );
  const text = await sharpMod(textSvg).png().toBuffer();
  return sharpMod({ create: { width: 640, height: 640, channels: 3, background: '#1f3d33' } })
    .composite([
      { input: logo, top: 70, left: (640 - 380) / 2 },
      { input: text, top: 480, left: 20 },
    ])
    .jpeg({ quality: 88 })
    .toBuffer();
}

let ffmpegChecked = false;
let ffmpegOk = false;
export async function hasFfmpeg(): Promise<boolean> {
  if (ffmpegChecked) return ffmpegOk;
  ffmpegChecked = true;
  ffmpegOk = await new Promise<boolean>((resolve) => {
    try {
      const p = spawn('ffmpeg', ['-version']);
      p.on('error', () => resolve(false));
      p.on('close', (code) => resolve(code === 0));
    } catch {
      resolve(false);
    }
  });
  return ffmpegOk;
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => { err += d.toString(); if (err.length > 8000) err = err.slice(-8000); });
    p.on('error', reject);
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}: ${err.slice(-400)}`))));
  });
}

// Put the remote/local source onto local disk (streamed) so ffmpeg can read it.
async function localCopy(url: string, dest: string): Promise<void> {
  if (/^https?:\/\//.test(url)) {
    const res = await fetch(url);
    if (!res.ok || !res.body) throw new Error(`fetch ${res.status} for ${url}`);
    await pipeline(Readable.fromWeb(res.body as never), createWriteStream(dest));
    return;
  }
  const src = join(uploadsDir(), basename(url));
  await pipeline(createReadStream(src), createWriteStream(dest));
}

async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), 'wm-'));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

// Overlay a small, faint emblem in the bottom corner of a video, then write the
// result back to `url` via the provided saver (kept out of this module so it has
// no storage dependency). ffmpeg streams frame-by-frame → low, flat memory.
export async function watermarkVideoInPlace(
  url: string,
  ext: string,
  save: (localPath: string, contentType: string) => Promise<string>,
  contributor?: string | null,
): Promise<string> {
  return withTempDir(async (dir) => {
    const inPath = join(dir, `in.${ext || 'mp4'}`);
    const outPath = join(dir, `out.${ext || 'mp4'}`);
    const labelPath = join(dir, 'label.png');
    await localCopy(url, inPath);
    // The brand label (emblem + المساهم name + site) already carries its own
    // faint alpha, so ffmpeg just scales and overlays it bottom-right.
    await writeFile(labelPath, await buildBrandLabel(contributor));
    await runFfmpeg([
      '-y',
      '-i', inPath,
      '-i', labelPath,
      '-filter_complex',
      '[1:v]format=rgba,scale=200:-1[lg];[0:v][lg]overlay=W-w-20:H-h-20[v]',
      '-map', '[v]',
      '-map', '0:a?',
      '-c:a', 'copy',
      outPath,
    ]);
    const ct = ext === 'webm' ? 'video/webm' : ext === 'mkv' ? 'video/x-matroska' : 'video/mp4';
    return save(outPath, ct);
  });
}

function metaArg(key: string, value?: string | null): string[] {
  const v = (value || '').replace(/[\r\n]+/g, ' ').trim();
  return v ? ['-metadata', `${key}=${v}`] : [];
}

// Embed the branded cover (+ title/artist tags) into an audio file so external
// players show the emblem and a proper name instead of «Unknown artist».
//
// The output is ALWAYS mp3: mp3's ID3 cover art is the one format every phone
// player reliably renders. If the source is already mp3 the audio is copied
// (lossless, fast); otherwise it is transcoded to mp3 (VBR ~165kbps). Returns
// the new URL, or null if nothing could be produced.
export async function watermarkAudioInPlace(
  url: string,
  ext: string,
  save: (localPath: string, contentType: string) => Promise<string>,
  meta?: { contributor?: string | null; title?: string | null },
): Promise<string | null> {
  const contributor = meta?.contributor ?? null;
  return withTempDir(async (dir) => {
    const inPath = join(dir, `in.${ext || 'mp3'}`);
    const artPath = join(dir, 'art.jpg');
    const artWm = join(dir, 'art_wm.jpg');
    const outPath = join(dir, 'out.mp3');
    await localCopy(url, inPath);

    // If the file already has cover art, stamp the label on it; otherwise embed
    // the branded cover — either way the brand ends up in the player.
    let art: Buffer | null = null;
    try {
      await runFfmpeg(['-y', '-i', inPath, '-an', '-frames:v', '1', artPath]);
      const raw = await readFile(artPath).catch(() => null);
      if (raw && raw.length > 0) art = await watermarkImage(raw, 'jpg', await buildBrandLabel(contributor));
    } catch { /* no embedded art */ }
    if (!art) art = await brandCover(contributor);
    await writeFile(artWm, art);

    const isMp3 = (ext || '').toLowerCase() === 'mp3';
    await runFfmpeg([
      '-y',
      '-i', inPath,
      '-i', artWm,
      '-map', '0:a',
      '-map', '1:0',
      // Copy when already mp3; otherwise transcode to mp3 so the cover sticks.
      '-c:a', ...(isMp3 ? ['copy'] : ['libmp3lame', '-q:a', '4']),
      ...metaArg('title', meta?.title),
      ...metaArg('artist', contributor || 'الطريقة السمّانية — السجادة السليمانية'),
      ...metaArg('album', 'أرشيف المسيد'),
      '-c:v', 'mjpeg',
      '-id3v2_version', '3',
      '-metadata:s:v', 'title=Album cover',
      '-metadata:s:v', 'comment=Cover (front)',
      '-disposition:v:0', 'attached_pic',
      outPath,
    ]);
    return save(outPath, 'audio/mpeg');
  });
}
