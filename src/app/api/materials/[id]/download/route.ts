import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { MATERIAL_STATUS } from '@/lib/constants';

// Increments the download counter and redirects to the actual file.
export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const material = await prisma.material.findUnique({
    where: { id: params.id },
    select: { fileUrl: true, status: true },
  });

  if (!material || !material.fileUrl) {
    return NextResponse.json({ error: 'الملف غير متاح' }, { status: 404 });
  }
  if (material.status !== MATERIAL_STATUS.PUBLISHED) {
    return NextResponse.json({ error: 'المادة غير منشورة' }, { status: 403 });
  }

  await prisma.material.update({
    where: { id: params.id },
    data: { downloads: { increment: 1 } },
  });

  return NextResponse.redirect(new URL(material.fileUrl, _req.url));
}
