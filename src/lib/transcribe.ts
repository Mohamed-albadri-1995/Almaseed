import { spawn } from 'child_process';
import { mkdtemp, rm, readdir, readFile } from 'fs/promises';
import { createWriteStream } from 'fs';
import { tmpdir } from 'os';
import { join, basename } from 'path';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import { prisma } from './prisma';
import { normalizeArabic } from './search';
import { uploadsDir } from './uploads';

// Automatic speech-to-text for spoken recordings, so what was SAID in a lecture
// becomes searchable and readable. Uses any OpenAI-compatible Whisper endpoint:
//   TRANSCRIBE_API_KEY   (required — without it the job stays idle)
//   TRANSCRIBE_BASE_URL  default https://api.groq.com/openai/v1  (Groq: fast, cheap)
//   TRANSCRIBE_MODEL     default whisper-large-v3
// Audio is downmixed to 16kHz mono 32kbps MP3 and cut into 20-minute pieces
// (~5MB each, well under the 25MB upload limit), transcribed in order, joined.

const SECTIONS = ['lectures', 'sermons', 'seminars']; // محاضرات، مواعظ، أرشيف النوادر
const CHUNK_SEC = 20 * 60;

export function transcriptionConfigured(): boolean {
  return !!process.env.TRANSCRIBE_API_KEY;
}

function run(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => { err += d.toString(); if (err.length > 4000) err = err.slice(-2000); });
    p.on('error', reject);
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}: ${err.slice(-300)}`))));
  });
}

async function fetchToFile(url: string, dest: string) {
  if (/^https?:\/\//.test(url)) {
    const res = await fetch(url);
    if (!res.ok || !res.body) throw new Error(`download ${res.status}`);
    await pipeline(Readable.fromWeb(res.body as never), createWriteStream(dest));
  } else {
    const { createReadStream } = await import('fs');
    await pipeline(createReadStream(join(uploadsDir(), basename(url))), createWriteStream(dest));
  }
}

class RateLimited extends Error {}

async function transcribeChunk(path: string): Promise<string> {
  const base = (process.env.TRANSCRIBE_BASE_URL || 'https://api.groq.com/openai/v1').replace(/\/$/, '');
  const form = new FormData();
  form.append('file', new Blob([await readFile(path)], { type: 'audio/mpeg' }), basename(path));
  form.append('model', process.env.TRANSCRIBE_MODEL || 'whisper-large-v3');
  form.append('language', 'ar');
  form.append('response_format', 'text');
  form.append('temperature', '0');
  const res = await fetch(`${base}/audio/transcriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.TRANSCRIBE_API_KEY}` },
    body: form,
  });
  if (res.status === 429) throw new RateLimited('rate limited');
  const text = await res.text();
  if (!res.ok) throw new Error(`transcription API ${res.status}: ${text.slice(0, 200)}`);
  return text.trim();
}

// Split long runs of text into readable paragraphs (Whisper returns one block).
function paragraphs(text: string): string {
  const sentences = text.replace(/\s+/g, ' ').split(/(?<=[.!؟?۔])\s+/);
  const out: string[] = [];
  let cur = '';
  for (const s of sentences) {
    cur = cur ? `${cur} ${s}` : s;
    if (cur.length > 450) { out.push(cur); cur = ''; }
  }
  if (cur) out.push(cur);
  return out.join('\n\n');
}

export async function transcribeFile(url: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'tr-'));
  try {
    const src = join(dir, 'src');
    await fetchToFile(url, src);
    await run('ffmpeg', [
      '-y', '-threads', '1', '-i', src, '-vn', '-ac', '1', '-ar', '16000',
      '-c:a', 'libmp3lame', '-b:a', '32k',
      '-f', 'segment', '-segment_time', String(CHUNK_SEC), join(dir, 'part%03d.mp3'),
    ]);
    const parts = (await readdir(dir)).filter((f) => f.startsWith('part')).sort();
    const texts: string[] = [];
    for (const p of parts) texts.push(await transcribeChunk(join(dir, p)));
    return paragraphs(texts.filter(Boolean).join(' '));
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

// Process one published spoken recording that has no transcript yet.
// Returns 'done' | 'idle' | 'rate-limited'.
export async function transcribeOne(): Promise<'done' | 'idle' | 'rate-limited'> {
  if (!transcriptionConfigured()) return 'idle';
  const m = await prisma.material.findFirst({
    where: {
      status: 'PUBLISHED', transcribedAt: null, fileUrl: { not: null },
      fileKind: { in: ['AUDIO', 'VIDEO'] }, category: { slug: { in: SECTIONS } },
    },
    orderBy: { publishedAt: 'desc' }, // newest first: what visitors see now
    select: { id: true, title: true, fileUrl: true },
  });
  if (!m?.fileUrl) return 'idle';
  const claim = await prisma.material.updateMany({ where: { id: m.id, transcribedAt: null }, data: { transcribedAt: new Date() } });
  if (claim.count !== 1) return 'done';
  try {
    const transcript = await transcribeFile(m.fileUrl);
    await prisma.material.update({
      where: { id: m.id },
      data: { transcript: transcript || null, transcriptSearch: transcript ? normalizeArabic(transcript) : null, transcriptError: null, transcribedAt: new Date() },
    });
    console.log(`[transcribe] ${m.id} ${m.title} — ${transcript.length} chars`);
    return 'done';
  } catch (e) {
    if (e instanceof RateLimited) {
      // Put it back; try again after a pause.
      await prisma.material.update({ where: { id: m.id }, data: { transcribedAt: null } }).catch(() => {});
      return 'rate-limited';
    }
    const msg = e instanceof Error ? e.message : String(e);
    await prisma.material.update({ where: { id: m.id }, data: { transcriptError: msg.slice(0, 300) } }).catch(() => {});
    console.error(`[transcribe] failed ${m.id} ${m.title}:`, msg);
    return 'done';
  }
}

let started = false;
export function startTranscribeLoop(): void {
  if (started || !transcriptionConfigured()) return;
  started = true;
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  (async () => {
    await sleep(60_000);
    for (;;) {
      let r: 'done' | 'idle' | 'rate-limited' = 'idle';
      try { r = await transcribeOne(); } catch (e) { console.error('[transcribe] loop error', e); }
      // Gentle pace: one recording at a time; back off on rate limits; poll
      // every 10 min when there's nothing to do.
      await sleep(r === 'done' ? 20_000 : r === 'rate-limited' ? 10 * 60_000 : 10 * 60_000);
    }
  })();
}
