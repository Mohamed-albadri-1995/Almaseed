import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { MATERIAL_STATUS } from '@/lib/constants';

export const dynamic = 'force-dynamic';

// Count one listen/view for a published material. Clients (web player, mobile
// app) call this AT MOST ONCE per material per playback session — they dedupe
// locally so replays, pauses, and seeks don't inflate the number. Kept public
// (no auth) like the download route, and best-effort so it never blocks playback.
export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
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
