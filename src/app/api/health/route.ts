import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// Liveness + database check for the uptime monitor (.github/workflows/uptime.yml).
// 200 when the app answers AND the database responds within 5s; 503 otherwise.
// No details beyond ok/fail are exposed.
export async function GET() {
  const started = Date.now();
  let db = false;
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000)),
    ]);
    db = true;
  } catch {
    db = false;
  }
  return NextResponse.json(
    { ok: db, db, ms: Date.now() - started },
    { status: db ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
  );
}
