import { NextResponse } from 'next/server';
import { getMobileUser } from '@/lib/mobile-auth';
import { createSession, destroySession } from '@/lib/session';
import { appUrl } from '@/lib/email';
import type { Role } from '@/lib/constants';

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

  const user = await getMobileUser(token);
  if (!user) {
    // The app is signed out (or its token was revoked): end any web session
    // left in the app's web view too — otherwise signing out of the app still
    // left the admin/account pages open there without a password or code.
    destroySession();
    return NextResponse.redirect(`${appUrl()}/login?redirect=${encodeURIComponent(to)}`);
  }
  await createSession({ uid: user.id, role: user.role as Role, name: user.name, sv: user.sessionVersion });
  return NextResponse.redirect(`${appUrl()}${to}`);
}
