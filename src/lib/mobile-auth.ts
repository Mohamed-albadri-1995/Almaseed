import { SignJWT, jwtVerify } from 'jose';
import type { Role } from './constants';

const secret = new TextEncoder().encode(
  process.env.AUTH_SECRET || 'insecure-dev-secret',
);

export interface MobileToken {
  uid: string;
  role: Role;
  name: string;
}

// Bearer token used by the native app (returned as JSON, not a cookie).
export async function signMobileToken(payload: MobileToken): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(secret);
}

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
    };
  } catch {
    return null;
  }
}

// Extract a bearer token from an Authorization header.
export function bearer(req: Request): string | null {
  const h = req.headers.get('authorization') || '';
  return h.startsWith('Bearer ') ? h.slice(7) : null;
}
