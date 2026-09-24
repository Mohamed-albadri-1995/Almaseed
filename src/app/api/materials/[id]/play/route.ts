import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { MATERIAL_STATUS } from '@/lib/constants';
import { rateLimit, ipFromHeaders, MIN } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

// Count one listen/view for a published material. Clients (web player, mobile
// app) call this AT MOST ONCE per material per playback session — they dedupe
// locally so replays, pauses, and seeks don't inflate the number. Kept public
// (no auth) like the download route, and best-effort so it never blocks playback.
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  // Clients already dedupe per session; this also stops a script from inflating
  // «مرات الاستماع»: at most one count per IP per material every 30 minutes.
  if (!rateLimit(`play:${ipFromHeaders(req.headers)}:${params.id}`, 1, 30 * MIN)) {
    return NextResponse.json({ ok: true, counted: false });
  }
  try {
    const material = await prisma.material.findUnique({
      where: { id: params.id },
      select: { status: true },
    });
    if (!material || material.status !== MATERIAL_STATUS.PUBLISHED) {
      return NextResponse.json({ ok: false }, { status: 404 });
    }
    await prisma.material.update({
      where: { id: params.id },
      data: { plays: { increment: 1 } },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
