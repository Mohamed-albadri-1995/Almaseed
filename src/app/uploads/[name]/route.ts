import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join, basename, extname } from 'path';
import { uploadsDir } from '@/lib/uploads';

// Serves uploaded files when they live outside the public/ folder (e.g. on a
// persistent volume in production). Locally, files in public/uploads are served
// statically by Next and never reach this handler.
const CONTENT_TYPES: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.ogg': 'audio/ogg',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

export async function GET(
  _req: Request,
  { params }: { params: { name: string } },
) {
  // basename() strips any path components — prevents directory traversal.
  const name = basename(params.name);
  const ext = extname(name).toLowerCase();

  try {
    const data = await readFile(join(uploadsDir(), name));
    return new NextResponse(new Uint8Array(data), {
      headers: {
        'Content-Type': CONTENT_TYPES[ext] || 'application/octet-stream',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return NextResponse.json({ error: 'الملف غير موجود' }, { status: 404 });
  }
}
