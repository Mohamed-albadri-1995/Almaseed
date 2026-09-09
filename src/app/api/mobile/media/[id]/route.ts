import { NextResponse } from 'next/server';
import { getMaterial } from '@/lib/queries';
import { MATERIAL_STATUS } from '@/lib/constants';

export const dynamic = 'force-dynamic';

/**
 * Mobile-only media proxy for videos.
 *
 * The mobile JSON API already bypasses Cloudflare by talking directly to
 * Railway. Video files used to go straight to the public R2/Cloudflare URL,
 * where native Android video requests could be challenged/blocked. This
 * endpoint streams the published video through the same Railway origin and
 * preserves HTTP Range headers so seeking works correctly.
 */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const material = await getMaterial(params.id);
  if (!material || material.status !== MATERIAL_STATUS.PUBLISHED || material.fileKind !== 'VIDEO' || !material.fileUrl) {
    return NextResponse.json({ error: 'الفيديو غير موجود' }, { status: 404 });
  }

  const headers: Record<string, string> = {};
  const range = req.headers.get('range');
  if (range) headers.Range = range;

  try {
    const upstream = await fetch(material.fileUrl, {
      headers,
      cache: 'no-store',
    });

    if (!upstream.ok && upstream.status !== 206) {
      return NextResponse.json({ error: 'تعذّر تحميل الفيديو' }, { status: upstream.status || 502 });
    }

    const responseHeaders = new Headers();
    const contentType = upstream.headers.get('content-type') || material.fileType || 'video/mp4';
    responseHeaders.set('Content-Type', contentType);
    responseHeaders.set('Accept-Ranges', upstream.headers.get('accept-ranges') || 'bytes');
    responseHeaders.set('Cache-Control', 'public, max-age=3600');

    for (const name of ['content-length', 'content-range', 'etag', 'last-modified']) {
      const value = upstream.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }

    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('mobile video proxy failed', params.id, error);
    return NextResponse.json({ error: 'تعذّر الاتصال بملف الفيديو' }, { status: 502 });
  }
}
