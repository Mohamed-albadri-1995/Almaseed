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

const EMBLEM = () => join(process.cwd(), 'public', 'logo.png');

// A branded square cover (emblem centered on the brand green) — embedded into
// audio files that have no artwork, so the emblem shows in external players. It
// is written INTO the audio file only; the material's coverImage in the DB is
// left untouched, so the app's card/kind icons are unaffected.
let coverPromise: Promise<Buffer> | null = null;
async function brandCover(): Promise<Buffer> {
  if (!coverPromise) {
    coverPromise = (async () => {
      const sharpMod = (await import('sharp')).default;
      const logo = await sharpMod(await readFile(EMBLEM())).resize({ width: 460 }).png().toBuffer();
      return sharpMod({ create: { width: 640, height: 640, channels: 3, background: '#1f3d33' } })
        .composite([{ input: logo, gravity: 'center' }])
        .jpeg({ quality: 88 })
        .toBuffer();
    })();
  }
  return coverPromise;
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
): Promise<string> {
  return withTempDir(async (dir) => {
    const inPath = join(dir, `in.${ext || 'mp4'}`);
    const outPath = join(dir, `out.${ext || 'mp4'}`);
    await localCopy(url, inPath);
    await runFfmpeg([
      '-y',
      '-i', inPath,
      '-i', EMBLEM(),
      '-filter_complex',
      // logo → 45% opacity, scaled to 140px wide, overlaid 20px from bottom-right
      '[1:v]format=rgba,colorchannelmixer=aa=0.45,scale=140:-1[lg];[0:v][lg]overlay=W-w-20:H-h-20[v]',
      '-map', '[v]',
      '-map', '0:a?',
      '-c:a', 'copy',
      outPath,
    ]);
    const ct = ext === 'webm' ? 'video/webm' : ext === 'mkv' ? 'video/x-matroska' : 'video/mp4';
    return save(outPath, ct);
  });
}

// Watermark the embedded cover art of an mp3 (what external players show), if it
// has any. Best-effort and mp3-only; returns true if art was stamped.
export async function watermarkMp3ArtworkInPlace(
  url: string,
  save: (localPath: string, contentType: string) => Promise<string>,
): Promise<string | null> {
  return withTempDir(async (dir) => {
    const inPath = join(dir, 'in.mp3');
    const artPath = join(dir, 'art.jpg');
    const artWm = join(dir, 'art_wm.jpg');
    const outPath = join(dir, 'out.mp3');
    await localCopy(url, inPath);

    // If the mp3 already has cover art, stamp it; otherwise embed the branded
    // emblem cover — either way the emblem ends up in the player.
    let art: Buffer | null = null;
    try {
      await runFfmpeg(['-y', '-i', inPath, '-an', '-frames:v', '1', artPath]);
      const raw = await readFile(artPath).catch(() => null);
      if (raw && raw.length > 0) art = await watermarkImage(raw, 'jpg');
    } catch { /* no embedded art */ }
    if (!art) art = await brandCover();
    await writeFile(artWm, art);

    await runFfmpeg([
      '-y',
      '-i', inPath,
      '-i', artWm,
      '-map', '0:a',
      '-map', '1:0',
      '-c:a', 'copy',
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
