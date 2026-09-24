import 'server-only';
import { NextResponse } from 'next/server';
import { planUpload } from './upload-rules';
import { presignUpload, saveUpload } from './storage';
import { rateLimit, HOUR } from './rate-limit';

// Shared bodies of the web (cookie) and app (bearer) upload endpoints, so the
// two can never drift apart. Callers authenticate first and pass the user id.

// Direct-to-storage: validate, then return a short-lived presigned PUT URL.
// 409 {fallback:true} = storage not configured → client uses the multipart route.
export async function presignResponse(userId: string, req: Request) {
  if (!rateLimit(`upload:${userId}`, 120, HOUR)) {
    return NextResponse.json({ error: 'رفعت ملفات كثيرة — حاول لاحقًا.' }, { status: 403 });
  }
  const body = (await req.json().catch(() => ({}))) as { name?: string; size?: number; type?: string };
  const plan = planUpload(String(body.name || ''), Number(body.size), body.type);
  if (!plan.ok) return NextResponse.json({ error: plan.error }, { status: 400 });

  const signed = await presignUpload(plan.key, plan.contentType, plan.size).catch((e) => {
    console.error('presign failed:', e);
    return null;
  });
  if (!signed) return NextResponse.json({ fallback: true }, { status: 409 });

  console.log(`[upload] direct-to-storage presign user=${userId} size=${plan.size} key=${plan.key}`);
  return NextResponse.json({
    uploadUrl: signed.uploadUrl,
    contentType: plan.contentType,
    url: signed.publicUrl,
    fileKind: plan.kind,
    fileType: plan.ext.toUpperCase(),
    fileSize: plan.size,
  });
}

// Classic multipart upload through the server (fallback path; buffers the file).
export async function multipartResponse(userId: string, req: Request) {
  if (!rateLimit(`upload:${userId}`, 120, HOUR)) {
    return NextResponse.json({ error: 'رفعت ملفات كثيرة — حاول لاحقًا.' }, { status: 403 });
  }
  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'لم يتم اختيار ملف' }, { status: 400 });
  }
  const plan = planUpload(file.name, file.size, file.type);
  if (!plan.ok) return NextResponse.json({ error: plan.error }, { status: 400 });

  // The السجادة watermark is applied later by the background worker, so the
  // upload itself stays instant for the contributor.
  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const url = await saveUpload(plan.key, bytes, plan.contentType);
    console.log(`[upload] via-server (fallback) user=${userId} size=${bytes.length} key=${plan.key}`);
    return NextResponse.json({ url, fileKind: plan.kind, fileType: plan.ext.toUpperCase(), fileSize: bytes.length });
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    console.error('Upload failed:', detail);
    return NextResponse.json({ error: `تعذّر حفظ الملف: ${detail}` }, { status: 500 });
  }
}
