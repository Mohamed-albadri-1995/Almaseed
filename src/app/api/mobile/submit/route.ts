import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyMobileToken, bearer } from '@/lib/mobile-auth';
import { createSubmission } from '@/lib/submit-core';

export const dynamic = 'force-dynamic';

// Native share-to-app submission. Accepts the SAME fields as the website form
// (as JSON) and runs the SAME validation + creation (lib/submit-core), so a
// material submitted from the app is identical to one from the site.
export async function POST(req: Request) {
  const auth = await verifyMobileToken(bearer(req));
  if (!auth) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { id: auth.uid } });
  if (!user || !user.active) return NextResponse.json({ error: 'الحساب غير متاح' }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'بيانات غير صحيحة' }, { status: 400 });
  }

  const result = await createSubmission({ id: user.id, name: user.name }, body);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true, materialId: result.materialId });
}
