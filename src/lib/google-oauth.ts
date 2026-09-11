// Minimal Google OAuth 2.0 (web redirect flow) — no extra dependency.
//
// Used for «sign in with Google» from the mobile app: the app opens the web
// flow, Google authenticates on the web (a standard https redirect, so no
// native SDK and no app-signing SHA-1 needed), and the app captures the session
// on the way back. Configure on the server:
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
// and register the redirect URI (APP_URL + /api/auth/google/callback) in the
// Google Cloud console.

import { appUrl } from '@/lib/email';

export function googleConfigured(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function googleRedirectUri(): string {
  return `${appUrl()}/api/auth/google/callback`;
}

export function googleAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || '',
    redirect_uri: googleRedirectUri(),
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'online',
    prompt: 'select_account',
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export interface GoogleUser {
  email: string;
  name: string;
  emailVerified: boolean;
}

// Exchange the auth code for tokens, then fetch the verified profile.
export async function googleExchange(code: string): Promise<GoogleUser | null> {
  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID || '',
        client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
        redirect_uri: googleRedirectUri(),
        grant_type: 'authorization_code',
      }),
    });
    if (!tokenRes.ok) {
      console.error('[google] token exchange failed:', tokenRes.status, await tokenRes.text().catch(() => ''));
      return null;
    }
    const tok = (await tokenRes.json()) as { access_token?: string };
    if (!tok.access_token) return null;

    const infoRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${tok.access_token}` },
    });
    if (!infoRes.ok) return null;
    const info = (await infoRes.json()) as {
      email?: string;
      name?: string;
      email_verified?: boolean;
    };
    if (!info.email) return null;
    return {
      email: info.email.toLowerCase(),
      name: info.name || info.email.split('@')[0],
      emailVerified: info.email_verified !== false,
    };
  } catch (e) {
    console.error('[google] exchange error:', e instanceof Error ? e.message : e);
    return null;
  }
}
