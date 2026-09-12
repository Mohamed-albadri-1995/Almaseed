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

    // Extract existing cover art; if the file has none, ffmpeg fails → skip.
    try {
      await runFfmpeg(['-y', '-i', inPath, '-an', '-frames:v', '1', artPath]);
    } catch {
      return null;
    }
    const raw = await readFile(artPath).catch(() => null);
    if (!raw || raw.length === 0) return null;

    const stamped = await watermarkImage(raw, 'jpg');
    await writeFile(artWm, stamped);

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
