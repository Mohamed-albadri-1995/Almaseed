import { NextResponse } from 'next/server';
import { verifyMobileToken } from '@/lib/mobile-auth';
import { createSession } from '@/lib/session';
import { appUrl } from '@/lib/email';

export const dynamic = 'force-dynamic';

// Single sign-on bridge for the app: the app opens this with its mobile token,
// we mint the matching WEB session cookie, then redirect to the requested page —
// so the contributor/admin web pages open already signed in (one login, not two).
// Allowed as prefixes so deep links work too (e.g. /admin/review/<id> from a
// review notification). Only same-site relative paths are accepted.
const ALLOWED = ['/account', '/admin', '/submit'];

function safeTo(toParam: string): string {
  // Must be a same-site relative path (no scheme, no protocol-relative //).
  if (!toParam.startsWith('/') || toParam.startsWith('//')) return '/account';
  const path = toParam.split(/[?#]/)[0];
  const ok = ALLOWED.some((base) => path === base || path.startsWith(`${base}/`));
  return ok ? toParam : '/account';
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get('token');
  const to = safeTo(url.searchParams.get('to') || '/account');

  const auth = await verifyMobileToken(token);
  if (!auth) {
    return NextResponse.redirect(`${appUrl()}/login`);
  }
  await createSession({ uid: auth.uid, role: auth.role, name: auth.name });
  return NextResponse.redirect(`${appUrl()}${to}`);
}
