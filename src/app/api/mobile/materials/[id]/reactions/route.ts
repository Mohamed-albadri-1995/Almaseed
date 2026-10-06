import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { MATERIAL_STATUS } from '@/lib/constants';
import { rateLimit, ipFromHeaders, MIN } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

// Like / dislike + view count for a material (the app's reaction bar).
//   GET  ?device=<id>               → { likes, dislikes, views, mine }
//   POST { device, value: 1|-1|0 }  → same, after setting this device's reaction
// No sign-in: the app sends an anonymous per-install id, so each install has
// one reaction per material (0 removes it). Counters live on Material.

const DEVICE_RE = /^[A-Za-z0-9_-]{8,64}$/;

async function snapshot(id: string, device: string | null) {
  const [m, mine] = await Promise.all([
    prisma.material.findUnique({ where: { id }, select: { status: true, likes: true, dislikes: true, plays: true } }),
    device ? prisma.reaction.findUnique({ where: { materialId_voterKey: { materialId: id, voterKey: device } }, select: { value: true } }) : null,
  ]);
  if (!m || m.status !== MATERIAL_STATUS.PUBLISHED) return null;
  return { likes: m.likes, dislikes: m.dislikes, views: m.plays, mine: mine?.value ?? 0 };
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const d = new URL(req.url).searchParams.get('device');
  const snap = await snapshot(params.id, d && DEVICE_RE.test(d) ? d : null);
  if (!snap) return NextResponse.json({ error: 'غير موجودة' }, { status: 404 });
  return NextResponse.json(snap, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  if (!rateLimit(`react:${ipFromHeaders(req.headers)}`, 60, MIN)) {
    return NextResponse.json({ error: 'محاولات كثيرة، حاول بعد قليل' }, { status: 429 });
  }
  const body = await req.json().catch(() => null) as { device?: unknown; value?: unknown } | null;
  const device = typeof body?.device === 'string' ? body.device : '';
  const value = Number(body?.value);
  if (!DEVICE_RE.test(device) || ![1, -1, 0].includes(value)) {
    return NextResponse.json({ error: 'طلب غير صالح' }, { status: 400 });
  }
  const material = await prisma.material.findUnique({ where: { id: params.id }, select: { status: true } });
  if (!material || material.status !== MATERIAL_STATUS.PUBLISHED) {
    return NextResponse.json({ error: 'غير موجودة' }, { status: 404 });
  }

  const key = { materialId_voterKey: { materialId: params.id, voterKey: device } };
  try {
    await prisma.$transaction(async (tx) => {
      const prev = (await tx.reaction.findUnique({ where: key, select: { value: true } }))?.value ?? 0;
      if (prev === value) return;
      if (value === 0) await tx.reaction.delete({ where: key });
      else await tx.reaction.upsert({ where: key, create: { materialId: params.id, voterKey: device, value }, update: { value } });
      const likes = (value === 1 ? 1 : 0) - (prev === 1 ? 1 : 0);
      const dislikes = (value === -1 ? 1 : 0) - (prev === -1 ? 1 : 0);
      await tx.material.update({
        where: { id: params.id },
        data: { likes: { increment: likes }, dislikes: { increment: dislikes } },
      });
    });
  } catch {
    // A double-tap race on the unique key — the first write won; just report state.
  }
  return NextResponse.json(await snapshot(params.id, device), { headers: { 'Cache-Control': 'no-store' } });
}
