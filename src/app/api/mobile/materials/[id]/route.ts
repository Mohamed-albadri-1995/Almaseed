import { NextResponse } from 'next/server';
import { getMaterial } from '@/lib/queries';
import { MATERIAL_STATUS } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const m = await getMaterial(params.id);
  if (!m || m.status !== MATERIAL_STATUS.PUBLISHED) {
    return NextResponse.json({ error: 'غير موجودة' }, { status: 404 });
  }
  return NextResponse.json({
    id: m.id,
    title: m.title,
    subtitle: m.subtitle,
    bodyText: m.bodyText,
    description: m.description,
    lyrics: m.lyrics,
    summary: m.summary,
    performer: m.performer,
    speaker: m.speaker,
    narrator: m.narrator,
    host: m.host,
    occasion: m.occasion,
    place: m.place,
    city: m.city,
    author: m.author,
    source: m.source,
    docType: m.docType,
    contributor: m.submittedBy?.name ?? null,
    fileUrl: m.fileUrl,
    fileKind: m.fileKind,
    fileType: m.fileType,
    fileSize: m.fileSize,
    durationSec: m.durationSec,
    coverImage: m.coverImage,
    category: m.category ? { slug: m.category.slug, name: m.category.name } : null,
  });
}
