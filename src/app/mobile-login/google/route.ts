import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { googleConfigured, googleAuthUrl } from '@/lib/google-oauth';
import { appUrl } from '@/lib/email';

export const dynamic = 'force-dynamic';

// Entry point opened by the app's WebView. Kicks off Google OAuth on the web.
export async function GET() {
  if (!googleConfigured()) {
    return NextResponse.redirect(`${appUrl()}/mobile-login/done?error=notconfigured`);
  }
  const state = randomBytes(16).toString('hex');
  const res = NextResponse.redirect(googleAuthUrl(state));
  // CSRF: remember the state and check it on the callback.
  res.cookies.set('g_state', state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });
  return res;
}
