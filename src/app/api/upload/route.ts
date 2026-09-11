import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { getCurrentUser } from '@/lib/session';
import { FILE_KINDS } from '@/lib/constants';
import { saveUpload } from '@/lib/storage';
import {
  isWatermarkableImage,
  isWatermarkablePdf,
  watermarkImage,
  watermarkPdf,
} from '@/lib/watermark';

const MAX_SIZE = 200 * 1024 * 1024; // 200MB

const EXT_KIND: Record<string, string> = {
  // Audio (incl. common device-recorder outputs)
  mp3: FILE_KINDS.AUDIO,
  wav: FILE_KINDS.AUDIO,
  m4a: FILE_KINDS.AUDIO,
  ogg: FILE_KINDS.AUDIO,
  oga: FILE_KINDS.AUDIO,
  aac: FILE_KINDS.AUDIO,
  opus: FILE_KINDS.AUDIO,
  amr: FILE_KINDS.AUDIO,
  weba: FILE_KINDS.AUDIO,
  // Video (incl. common device-recorder outputs)
  mp4: FILE_KINDS.VIDEO,
  m4v: FILE_KINDS.VIDEO,
  mov: FILE_KINDS.VIDEO,
  webm: FILE_KINDS.VIDEO,
  '3gp': FILE_KINDS.VIDEO,
  '3gpp': FILE_KINDS.VIDEO,
  mkv: FILE_KINDS.VIDEO,
  avi: FILE_KINDS.VIDEO,
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

  const name = `${randomBytes(8).toString('hex')}.${ext}`;
  let bytes: Buffer = Buffer.from(await file.arrayBuffer());

  // Stamp a small السجادة emblem onto images and PDF pages at save time. Never
  // fatal — on any failure the original bytes are kept so the upload succeeds.
  try {
    if (kind === FILE_KINDS.IMAGE && isWatermarkableImage(ext)) {
      bytes = await watermarkImage(bytes, ext);
    } else if (kind === FILE_KINDS.DOCUMENT && isWatermarkablePdf(ext)) {
      bytes = await watermarkPdf(bytes);
    }
  } catch (e) {
    console.error('Watermark skipped:', e instanceof Error ? e.message : e);
  }

  try {
    const url = await saveUpload(name, bytes, file.type || 'application/octet-stream');
    return NextResponse.json({
      url,
      fileKind: kind,
      fileType: ext.toUpperCase(),
      fileSize: bytes.length,
    });
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    console.error('Upload failed:', detail);
    return NextResponse.json(
      { error: `تعذّر حفظ الملف: ${detail}` },
      { status: 500 },
    );
  }
}
