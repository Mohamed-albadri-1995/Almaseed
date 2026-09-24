import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getMobileUser, bearer } from '@/lib/mobile-auth';

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
  // FCM registration tokens are long opaque strings — accept any non-trivial token.
  if (!token || token.length < 20) {
    return NextResponse.json({ error: 'رمز غير صالح' }, { status: 400 });
  }

  // Link the device to the account only for a live, non-revoked login.
  const user = await getMobileUser(bearer(req));
  const platform = body.platform === 'ios' || body.platform === 'android' ? body.platform : null;

  try {
    await prisma.pushToken.upsert({
      where: { token },
      create: {
        token,
        platform,
        userId: user?.id ?? null,
        role: user?.role ?? null,
      },
      update: {
        platform,
        userId: user?.id ?? null,
        role: user?.role ?? null,
      },
    });
  } catch (e) {
    console.error('[push/register] failed:', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'تعذّر التسجيل' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
