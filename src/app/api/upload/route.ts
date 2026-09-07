import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { randomBytes } from 'crypto';
import { getCurrentUser } from '@/lib/session';
import { FILE_KINDS } from '@/lib/constants';

const MAX_SIZE = 200 * 1024 * 1024; // 200MB

const EXT_KIND: Record<string, string> = {
  mp3: FILE_KINDS.AUDIO,
  wav: FILE_KINDS.AUDIO,
  m4a: FILE_KINDS.AUDIO,
  ogg: FILE_KINDS.AUDIO,
  mp4: FILE_KINDS.VIDEO,
  mov: FILE_KINDS.VIDEO,
  webm: FILE_KINDS.VIDEO,
  pdf: FILE_KINDS.DOCUMENT,
  doc: FILE_KINDS.DOCUMENT,
  docx: FILE_KINDS.DOCUMENT,
  jpg: FILE_KINDS.IMAGE,
  jpeg: FILE_KINDS.IMAGE,
  png: FILE_KINDS.IMAGE,
  webp: FILE_KINDS.IMAGE,
};

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });
  }

  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'لم يتم اختيار ملف' }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'حجم الملف يتجاوز الحد المسموح (200 ميجابايت)' }, { status: 400 });
  }

  const ext = (file.name.split('.').pop() || '').toLowerCase();
  const kind = EXT_KIND[ext];
  if (!kind) {
    return NextResponse.json({ error: 'نوع الملف غير مدعوم' }, { status: 400 });
  }

  const dir = join(process.cwd(), 'public', 'uploads');
  await mkdir(dir, { recursive: true });
  const name = `${randomBytes(8).toString('hex')}.${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(join(dir, name), bytes);

  return NextResponse.json({
    url: `/uploads/${name}`,
    fileKind: kind,
    fileType: ext.toUpperCase(),
    fileSize: file.size,
  });
}
