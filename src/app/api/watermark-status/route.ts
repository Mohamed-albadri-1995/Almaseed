import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import type { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

// Staff-only progress + control for the background watermark worker.
//   GET /api/watermark-status                → progress (+ failures)
//   GET /api/watermark-status?requeue=all     → re-stamp everything
//   GET /api/watermark-status?requeue=failed  → re-stamp only failures
// pending = 0 AND failed = 0  → the backfill truly finished.
const WATERMARKABLE: Prisma.MaterialWhereInput = {
  OR: [
    { fileKind: 'IMAGE' },
    { fileKind: 'DOCUMENT' },
    { fileKind: 'VIDEO' },
    { fileKind: 'AUDIO' },
    { coverImage: { not: null } },
  ],
};

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.role === 'CONTRIBUTOR') {
    return NextResponse.json({ error: 'غير مصرّح' }, { status: 403 });
  }

  const requeue = new URL(req.url).searchParams.get('requeue');
  if (requeue === 'all' || requeue === 'failed') {
    const where: Prisma.MaterialWhereInput =
      requeue === 'failed'
        ? { watermarkError: { not: null } }
        : { AND: [WATERMARKABLE] };
    const r = await prisma.material.updateMany({
      where,
      data: { watermarkedAt: null, watermarkError: null },
    });
    return NextResponse.json({ requeued: r.count, note: 'العامل الخلفي سيعيد المعالجة تدريجيًا.' });
  }

  const [total, pending, failed, images, pdfs, videos, audios] = await Promise.all([
    prisma.material.count({ where: WATERMARKABLE }),
    prisma.material.count({ where: { watermarkedAt: null, ...WATERMARKABLE } }),
    prisma.material.count({ where: { watermarkError: { not: null } } }),
    prisma.material.count({ where: { watermarkedAt: null, fileKind: 'IMAGE' } }),
    prisma.material.count({ where: { watermarkedAt: null, fileKind: 'DOCUMENT' } }),
    prisma.material.count({ where: { watermarkedAt: null, fileKind: 'VIDEO' } }),
    prisma.material.count({ where: { watermarkedAt: null, fileKind: 'AUDIO' } }),
  ]);

  const errorSamples = await prisma.material.findMany({
    where: { watermarkError: { not: null } },
    select: { title: true, fileKind: true, watermarkError: true },
    take: 5,
  });

  return NextResponse.json({
    finished: pending === 0 && failed === 0,
    total,
    done: total - pending,
    pending,
    failed,
    pendingByKind: { images, pdfs, videos, audios },
    errorSamples,
  });
}
