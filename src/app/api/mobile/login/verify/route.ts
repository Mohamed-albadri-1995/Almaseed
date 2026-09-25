import { NextResponse } from 'next/server';
import { verifyChallenge } from '@/lib/two-factor';
import { mobileLoginResponse } from '@/lib/mobile-login-response';
import { rateLimit, ipFromHeaders, MIN } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

// Second step of a staff sign-in from the app: { challenge, code } → token.
export async function POST(req: Request) {
  if (!rateLimit(`2fa:verify:ip:${ipFromHeaders(req.headers)}`, 30, 15 * MIN)) {
    return NextResponse.json({ error: 'محاولات كثيرة جدًا — انتظر قليلًا ثم حاول مجددًا.' }, { status: 403 });
  }
  const body = (await req.json().catch(() => ({}))) as { challenge?: string; code?: string };
  const res = await verifyChallenge(String(body.challenge || ''), String(body.code || ''));
  if ('error' in res) return NextResponse.json({ error: res.error }, { status: 403 });
  return mobileLoginResponse(res.user);
}
