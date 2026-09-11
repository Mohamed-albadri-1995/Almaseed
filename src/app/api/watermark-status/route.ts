import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import type { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

// Staff-only progress readout for the background watermark worker. Open it while
// signed in as staff: https://almaseeed.com/api/watermark-status
// pending = 0  → the backfill has finished.
const WATERMARKABLE: Prisma.MaterialWhereInput = {
  OR: [
    { fileKind: 'IMAGE' },
    { fileKind: 'DOCUMENT' },
    { fileKind: 'VIDEO' },
    { fileKind: 'AUDIO' },
    { coverImage: { not: null } },
  ],
};

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role === 'CONTRIBUTOR') {
    return NextResponse.json({ error: 'غير مصرّح' }, { status: 403 });
  }

  const [total, pending, images, pdfs, videos, audios] = await Promise.all([
    prisma.material.count({ where: WATERMARKABLE }),
    prisma.material.count({ where: { watermarkedAt: null, ...WATERMARKABLE } }),
    prisma.material.count({ where: { watermarkedAt: null, fileKind: 'IMAGE' } }),
    prisma.material.count({ where: { watermarkedAt: null, fileKind: 'DOCUMENT' } }),
    prisma.material.count({ where: { watermarkedAt: null, fileKind: 'VIDEO' } }),
    prisma.material.count({ where: { watermarkedAt: null, fileKind: 'AUDIO' } }),
  ]);

  return NextResponse.json({
    finished: pending === 0,
    total,
    done: total - pending,
    pending,
    pendingByKind: { images, pdfs, videos, audios },
  });
}
