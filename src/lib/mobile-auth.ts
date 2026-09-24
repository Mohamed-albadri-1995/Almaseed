import { SignJWT, jwtVerify } from 'jose';
import type { Role } from './constants';
import { prisma } from './prisma';

const secret = new TextEncoder().encode(
  process.env.AUTH_SECRET || 'insecure-dev-secret',
);

export interface MobileToken {
  uid: string;
  role: Role;
  name: string;
  // The user's sessionVersion at issue time (missing = 0 for older tokens).
  sv?: number;
}

// Bearer token used by the native app (returned as JSON, not a cookie).
export async function signMobileToken(payload: MobileToken): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(secret);
}

// Signature/expiry check only. Prefer getMobileUser(), which also enforces that
// the account is still active and the token hasn't been revoked.
export async function verifyMobileToken(
  token?: string | null,
): Promise<MobileToken | null> {
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

// Verify an app token and return the LIVE user record — null when the token is
// invalid/expired, the account is gone or deactivated, or the token was revoked
// by a password reset / «sign out everywhere» (sessionVersion bump).
export async function getMobileUser(token?: string | null) {
  const auth = await verifyMobileToken(token);
  if (!auth) return null;
  const user = await prisma.user.findUnique({ where: { id: auth.uid } });
  if (!user || !user.active) return null;
  if ((auth.sv ?? 0) !== user.sessionVersion) return null;
  return user;
}

// Extract a bearer token from an Authorization header.
export function bearer(req: Request): string | null {
  const h = req.headers.get('authorization') || '';
  return h.startsWith('Bearer ') ? h.slice(7) : null;
}
