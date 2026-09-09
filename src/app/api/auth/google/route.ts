import { NextResponse } from 'next/server';
import { jwtVerify, createRemoteJWKSet } from 'jose';
import crypto from 'crypto';

import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';
import { createSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

const GOOGLE_JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/oauth2/v3/certs'),
);

export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    const credential = formData.get('credential');
    const csrfToken = formData.get('g_csrf_token');

    const cookieHeader = req.headers.get('cookie') ?? '';
    const cookieMatch = cookieHeader.match(
      /(?:^|;\s*)g_csrf_token=([^;]+)/,
    );
    const cookieCsrfToken = cookieMatch?.[1];

    if (
      typeof credential !== 'string' ||
      typeof csrfToken !== 'string' ||
      !cookieCsrfToken ||
      csrfToken !== cookieCsrfToken
    ) {
      return NextResponse.json(
        { error: 'طلب Google غير صالح' },
        { status: 400 },
      );
    }

    if (!GOOGLE_CLIENT_ID) {
      console.error('GOOGLE_CLIENT_ID is not configured');

      return NextResponse.json(
        { error: 'Google login is not configured' },
        { status: 500 },
      );
    }

    const { payload } = await jwtVerify(credential, GOOGLE_JWKS, {
      issuer: ['https://accounts.google.com', 'accounts.google.com'],
      audience: GOOGLE_CLIENT_ID,
    });

    const email =
      typeof payload.email === 'string'
        ? payload.email.toLowerCase().trim()
        : null;

    const name =
      typeof payload.name === 'string' && payload.name.trim()
        ? payload.name.trim()
        : email?.split('@')[0] ?? null;

    const googleId =
      typeof payload.sub === 'string' ? payload.sub : null;

    const emailVerified = payload.email_verified === true;

    if (!email || !name || !googleId || !emailVerified) {
      return NextResponse.json(
        { error: 'بيانات حساب Google غير صالحة' },
        { status: 401 },
      );
    }

    let user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      const randomPassword = crypto.randomBytes(32).toString('hex');
      const passwordHash = await hashPassword(randomPassword);

      user = await prisma.user.create({
        data: {
          name,
          email,
          passwordHash,
          role: 'CONTRIBUTOR',
          active: true,
        },
      });
    }

    if (!user.active) {
      return NextResponse.json(
        { error: 'هذا الحساب غير مفعل' },
        { status: 403 },
      );
    }

    await createSession({
      uid: user.id,
      role: user.role as 'ADMIN' | 'CONTRIBUTOR',
      name: user.name,
    });

    return NextResponse.redirect(
      new URL('/account', req.url),
      303,
    );
  } catch (error) {
    console.error('Google authentication error:', error);

    return NextResponse.json(
      { error: 'فشل تسجيل الدخول باستخدام Google' },
      { status: 401 },
    );
  }
}
