import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { prisma } from '@/lib/prisma';
import { googleExchange } from '@/lib/google-oauth';
import { signMobileToken } from '@/lib/mobile-auth';
import { hashPassword } from '@/lib/auth';
import { appUrl } from '@/lib/email';
import { ROLES, type Role } from '@/lib/constants';

export const dynamic = 'force-dynamic';

function done(params: Record<string, string>): NextResponse {
  const sp = new URLSearchParams(params);
  const res = NextResponse.redirect(`${appUrl()}/mobile-login/done?${sp.toString()}`);
  res.cookies.delete('g_state');
  return res;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const cookieState = req.headers.get('cookie')?.match(/(?:^|;\s*)g_state=([^;]+)/)?.[1];

  if (!code || !state || !cookieState || state !== cookieState) {
    return done({ error: 'state' });
  }

  const profile = await googleExchange(code);
  if (!profile || !profile.emailVerified) {
    return done({ error: 'auth' });
  }

  // Match an existing account by email (keeps a staff member's role), else make
  // a new contributor. Google users get a random unusable password hash.
  let user = await prisma.user.findUnique({ where: { email: profile.email } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: profile.email,
        name: profile.name,
        passwordHash: await hashPassword(randomBytes(24).toString('hex')),
        role: ROLES.CONTRIBUTOR,
      },
    });
  } else if (!user.active) {
    return done({ error: 'disabled' });
  }

  const token = await signMobileToken({
    uid: user.id,
    role: user.role as Role,
    name: user.name,
  });
  return done({ token });
}
