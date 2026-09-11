import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyMobileToken, bearer } from '@/lib/mobile-auth';

export const dynamic = 'force-dynamic';

// The mobile app registers its Expo push token here on startup (and whenever it
// changes). Anonymous devices are allowed — every registered device receives
// «new content published» notifications. If the request carries a signed-in
// bearer token, the device is linked to that user/role for future targeting.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    token?: string;
    platform?: string;
  };
  const token = (body.token || '').trim();
  if (!token || !/^Expo(nent)?PushToken\[/.test(token)) {
    return NextResponse.json({ error: 'رمز غير صالح' }, { status: 400 });
  }

  const auth = await verifyMobileToken(bearer(req));
  const platform = body.platform === 'ios' || body.platform === 'android' ? body.platform : null;

  try {
    await prisma.pushToken.upsert({
      where: { token },
      create: {
        token,
        platform,
        userId: auth?.uid ?? null,
        role: auth?.role ?? null,
      },
      update: {
        platform,
        userId: auth?.uid ?? null,
        role: auth?.role ?? null,
      },
    });
  } catch (e) {
    console.error('[push/register] failed:', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'تعذّر التسجيل' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
