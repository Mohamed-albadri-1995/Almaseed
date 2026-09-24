import 'server-only';
import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import { cache } from 'react';
import { prisma } from './prisma';
import type { Role } from './constants';

const COOKIE_NAME = 'almaseed_session';
const secret = new TextEncoder().encode(
  process.env.AUTH_SECRET || 'insecure-dev-secret',
);
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export interface SessionPayload {
  uid: string;
  role: Role;
  name: string;
  // The user's sessionVersion when this session was issued (missing = 0, so
  // sessions created before this field existed stay valid until a bump).
  sv?: number;
}

export async function createSession(payload: SessionPayload) {
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret);

  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: MAX_AGE,
    path: '/',
  });
}

export function destroySession() {
  cookies().set(COOKIE_NAME, '', { maxAge: 0, path: '/' });
}

async function readToken(): Promise<SessionPayload | null> {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    return {
      uid: payload.uid as string,
      role: payload.role as Role,
      name: payload.name as string,
      sv: typeof payload.sv === 'number' ? payload.sv : 0,
    };
  } catch {
    return null;
  }
}

// Full user record for the current session (or null). Cached per request.
export const getCurrentUser = cache(async () => {
  const session = await readToken();
  if (!session) return null;
  const user = await prisma.user.findUnique({ where: { id: session.uid } });
  if (!user || !user.active) return null;
  // Revoked by a password reset or «sign out everywhere».
  if ((session.sv ?? 0) !== user.sessionVersion) return null;
  return user;
});
