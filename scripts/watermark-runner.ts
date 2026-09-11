// Long-running background watermark worker, launched from start:prod as a
// SEPARATE process (not inside Next). Keeping it out of the Next bundle avoids
// pulling sharp/ffmpeg/node-builtins into webpack, and isolates ffmpeg/sharp
// memory from the web server. Disable with WATERMARK_WORKER=off.
import { startWorkerLoop } from '../src/lib/watermark-worker';

if (process.env.WATERMARK_WORKER === 'off') {
  console.log('[watermark] background worker disabled (WATERMARK_WORKER=off)');
} else {
  console.log('[watermark] background worker starting');
  startWorkerLoop();
  // Keep the process alive (the loop schedules itself with timers).
  setInterval(() => {}, 2147483647);
}
