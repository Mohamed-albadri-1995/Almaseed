import { NextResponse } from 'next/server';
import { verifyMobileToken } from '@/lib/mobile-auth';
import { createSession } from '@/lib/session';
import { appUrl } from '@/lib/email';

export const dynamic = 'force-dynamic';

// Single sign-on bridge for the app: the app opens this with its mobile token,
// we mint the matching WEB session cookie, then redirect to the requested page —
// so the contributor/admin web pages open already signed in (one login, not two).
const ALLOWED = ['/account', '/admin', '/submit'];

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get('token');
  const toParam = url.searchParams.get('to') || '/account';
  const to = ALLOWED.includes(toParam) ? toParam : '/account';

  const auth = await verifyMobileToken(token);
  if (!auth) {
    return NextResponse.redirect(`${appUrl()}/login`);
  }
  await createSession({ uid: auth.uid, role: auth.role, name: auth.name });
  return NextResponse.redirect(`${appUrl()}${to}`);
}
