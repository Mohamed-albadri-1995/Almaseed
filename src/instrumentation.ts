// Runs once when the Next.js server boots. Starts the background watermark
// worker in the Node runtime only (never edge). Set WATERMARK_WORKER=off to
// disable it (e.g. if watermarking is run as a separate job instead).
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (process.env.WATERMARK_WORKER === 'off') return;
  const { startWorkerLoop } = await import('./lib/watermark-worker');
  startWorkerLoop();
}
