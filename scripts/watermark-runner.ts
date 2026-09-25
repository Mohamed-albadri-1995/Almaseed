// Long-running background watermark worker, launched from start:prod as a
// SEPARATE process (not inside Next). Keeping it out of the Next bundle avoids
// pulling sharp/ffmpeg/node-builtins into webpack, and isolates ffmpeg/sharp
// memory from the web server. Disable with WATERMARK_WORKER=off.
import { startWorkerLoop } from '../src/lib/watermark-worker';

// Keep native memory flat on the small (≈512MB) Railway container: libvips (sharp)
// otherwise spins up one worker thread per CPU and keeps an operation cache, and
// those native allocations — added to the web server sharing this container —
// are what got the process OOM-killed. One thread, no cache: slower, but steady.
import('sharp')
  .then((m) => { m.default.cache(false); m.default.concurrency(1); })
  .catch(() => { /* sharp not present — image stamps just get skipped */ });

if (process.env.WATERMARK_WORKER === 'off') {
  console.log('[watermark] background worker disabled (WATERMARK_WORKER=off)');
} else {
  console.log('[watermark] background worker starting');
  startWorkerLoop();
}

// Automatic transcription of spoken recordings (idle unless TRANSCRIBE_API_KEY is set).
import('../src/lib/transcribe')
  .then(({ startTranscribeLoop, transcriptionConfigured }) => {
    if (transcriptionConfigured()) {
      console.log('[transcribe] background transcription starting');
      startTranscribeLoop();
    }
  })
  .catch((e) => console.error('[transcribe] init failed', e));

// Automatic daily database backup to durable storage (R2), off the request path.
// A second, off-site copy of the archive's metadata in case the DB is lost. This
// timer also keeps the process alive.
import('../src/lib/backup')
  .then(({ runScheduledBackupToStorage, cleanupLegacyBackups, emailWeeklyBackup }) => {
    // Remove backups written by the first version at a guessable public path.
    if (process.env.STORAGE_PUBLIC_URL) {
      cleanupLegacyBackups(process.env.STORAGE_PUBLIC_URL)
        .then(() => console.log('[backup] legacy public backups removed'))
        .catch((e) => console.error('[backup] legacy cleanup failed', e));
    }
    const tick = async () => {
      try {
        const url = await runScheduledBackupToStorage();
        console.log(url ? `[backup] wrote ${url}` : '[backup] skipped (storage not configured)');
      } catch (e) {
        console.error('[backup] failed', e);
      }
      try {
        const { cleanupOrphanUploads } = await import('../src/lib/orphans');
        const res = await cleanupOrphanUploads();
        if (res) console.log(`[orphans] ${res}`);
      } catch (e) {
        console.error('[orphans] cleanup failed', e);
      }
      try {
        const sent = await emailWeeklyBackup();
        if (sent) console.log(`[backup] weekly off-site copy ${sent}`);
      } catch (e) {
        console.error('[backup] weekly email failed', e);
      }
    };
    setTimeout(tick, 90_000); // once shortly after boot
    setInterval(tick, 24 * 60 * 60 * 1000); // then daily
  })
  .catch((e) => {
    console.error('[backup] init failed', e);
    setInterval(() => {}, 2147483647); // keep the process alive regardless
  });
