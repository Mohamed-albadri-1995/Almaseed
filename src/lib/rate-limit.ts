import 'server-only';
import { headers } from 'next/headers';

// Small in-memory fixed-window rate limiter. The site runs as a single Node
// process (one Railway replica), so a process-local map is enough to stop
// password brute-forcing, reset-email flooding and form spam. Counters reset
// on redeploy, which is acceptable for this purpose.
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();
let lastSweep = Date.now();

function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  buckets.forEach((b, k) => {
    if (b.resetAt <= now) buckets.delete(k);
  });
}

// Returns true when the action is allowed, false once `limit` hits within
// `windowMs` for this key.
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  // No client IP → don't lump every such visitor into one shared bucket (that
  // could lock everyone out). Per-account limits still apply separately.
  if (key.endsWith(':unknown') || key.includes(':unknown:')) return true;
  const now = Date.now();
  sweep(now);
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (b.count >= limit) return false;
  b.count += 1;
  return true;
}

// Best-effort client IP. Behind Cloudflare → Railway the real visitor IP is in
// cf-connecting-ip; fall back to the first x-forwarded-for hop.
export function ipFromHeaders(h: Headers): string {
  return (
    h.get('cf-connecting-ip') ||
    (h.get('x-forwarded-for') || '').split(',')[0].trim() ||
    h.get('x-real-ip') ||
    'unknown'
  );
}

// For server actions / server components (reads the incoming request headers).
export function clientIp(): string {
  try {
    return ipFromHeaders(headers());
  } catch {
    return 'unknown';
  }
}

export const MIN = 60_000;
export const HOUR = 60 * MIN;
