import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { MATERIAL_STATUS } from '@/lib/constants';

export const dynamic = 'force-dynamic';

// Build a clean download filename: «title.ext». Arabic titles are preserved via
// RFC 5987 (filename*), with an ASCII fallback for older clients.
const SOURCE_TAG = 'أرشيف المسيد';

function fileNameFor(title: string, fileUrl: string, fileType?: string | null): string {
  const urlExt = (fileUrl.split('?')[0].split('.').pop() || '').toLowerCase();
  const ext = (fileType || urlExt || 'dat').toLowerCase().replace(/[^a-z0-9]/g, '');
  const base = (title || 'material').replace(/[\\/:*?"<>|\n\r\t]+/g, ' ').trim().slice(0, 80) || 'material';
  // Tag the source in the filename so a shared file is traceable to the archive.
  return `${base} - ${SOURCE_TAG}.${ext}`;
}

// Streams the actual file back to the browser with an attachment header, so the
// «تنزيل الملف» button truly downloads instead of navigating to the file (which
// made the browser render the video/PDF inline on a blank page).
export async function GET(
  req: Request,
  { params }: { params: { id: string } },
) {
  const material = await prisma.material.findUnique({
    where: { id: params.id },
    select: { fileUrl: true, status: true, title: true, fileType: true },
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
  }).catch(() => {});

  const fileUrl = new URL(material.fileUrl, req.url).toString();
  const name = fileNameFor(material.title, fileUrl, material.fileType);
  const asciiName = name.replace(/[^\x20-\x7E]/g, '_');

  try {
    // Forward Range so seeking/resumable downloads keep working for big media.
    const range = req.headers.get('range');
    const upstream = await fetch(fileUrl, {
      headers: range ? { Range: range } : {},
    });
    if (!upstream.ok || !upstream.body) {
      // Couldn't stream — fall back to a plain redirect so the user still gets the file.
      return NextResponse.redirect(fileUrl);
    }

    const headers = new Headers();
    headers.set('Content-Type', upstream.headers.get('content-type') || 'application/octet-stream');
    const len = upstream.headers.get('content-length');
    if (len) headers.set('Content-Length', len);
    const acceptRanges = upstream.headers.get('accept-ranges');
    if (acceptRanges) headers.set('Accept-Ranges', acceptRanges);
    const contentRange = upstream.headers.get('content-range');
    if (contentRange) headers.set('Content-Range', contentRange);
    headers.set(
      'Content-Disposition',
      `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(name)}`,
    );

    return new Response(upstream.body, { status: upstream.status, headers });
  } catch {
    return NextResponse.redirect(fileUrl);
  }
}
