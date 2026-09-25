import 'server-only';
import { randomInt, createHash, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import { prisma } from './prisma';
import { sendEmail, isEmailConfigured } from './email';
import { rateLimit, HOUR } from './rate-limit';
import { ROLES } from './constants';

// Two-step sign-in (email code) for every account ABOVE reviewer: editors,
// content managers and admins can change or delete the archive, so a stolen
// password alone must not be enough. Applies to password logins (web + app);
// Google sign-in is already protected by the user's Google account.

const STRONG_ROLES: string[] = [ROLES.EDITOR, ROLES.CONTENT_MANAGER, ROLES.ADMIN];
const CODE_TTL_MIN = 10;
const MAX_ATTEMPTS = 5;
const TRUST_DAYS = 30;
const PENDING_COOKIE = 'almaseed_2fa';
const TRUST_COOKIE = 'almaseed_trust';
const secret = new TextEncoder().encode(process.env.AUTH_SECRET || 'insecure-dev-secret');

const hashCode = (challengeId: string, code: string) =>
  createHash('sha256').update(`${challengeId}:${code}`).digest('hex');

// If email can't be sent, requiring a code would lock every admin out — so the
// second step only applies when email is configured.
export function needsTwoFactor(role: string): boolean {
  return STRONG_ROLES.includes(role) && isEmailConfigured();
}

export function maskEmail(email: string): string {
  const [u, d] = email.split('@');
  if (!d) return email;
  return `${u.slice(0, 2)}${'•'.repeat(Math.max(2, u.length - 2))}@${d}`;
}

// Create a challenge and email its code. Returns the challenge id, or an error
// message (rate limit / send failure).
export async function startChallenge(user: { id: string; email: string; name: string }): Promise<{ id: string } | { error: string }> {
  if (!rateLimit(`2fa:send:${user.id}`, 5, HOUR)) {
    return { error: 'طلبت رموزًا كثيرة — انتظر قليلًا ثم حاول مجددًا.' };
  }
  // One live challenge per user: older codes stop working.
  await prisma.loginChallenge.deleteMany({ where: { userId: user.id } });
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const ch = await prisma.loginChallenge.create({
    data: { userId: user.id, codeHash: 'pending', expiresAt: new Date(Date.now() + CODE_TTL_MIN * 60_000) },
  });
  await prisma.loginChallenge.update({ where: { id: ch.id }, data: { codeHash: hashCode(ch.id, code) } });
  const sent = await sendEmail({
    to: user.email,
    subject: `رمز الدخول: ${code} — أرشيف المسيد`,
    html: `<div dir="rtl" style="font-family:sans-serif;line-height:1.9">
      <p>السلام عليكم ${user.name}،</p>
      <p>رمز تسجيل الدخول إلى لوحة الإشراف:</p>
      <p style="font-size:28px;font-weight:800;letter-spacing:6px;direction:ltr;text-align:right">${code}</p>
      <p>صالح لمدة ${CODE_TTL_MIN} دقائق. إن لم تكن أنت من يحاول الدخول فغيّر كلمة المرور فورًا.</p>
    </div>`,
  });
  if (!sent) {
    await prisma.loginChallenge.delete({ where: { id: ch.id } }).catch(() => {});
    return { error: 'تعذّر إرسال رمز التحقق إلى بريدك — حاول مجددًا بعد قليل.' };
  }
  return { id: ch.id };
}

// Check a code. On success the challenge is consumed and the user returned.
export async function verifyChallenge(id: string, code: string): Promise<
  { user: { id: string; name: string; role: string; email: string; sessionVersion: number; active: boolean } } | { error: string }
> {
  const clean = String(code || '').replace(/\D/g, '');
  const ch = await prisma.loginChallenge.findUnique({ where: { id } });
  if (!ch || ch.expiresAt.getTime() < Date.now()) return { error: 'انتهت صلاحية الرمز — اطلب رمزًا جديدًا.' };
  if (ch.attempts >= MAX_ATTEMPTS) return { error: 'محاولات كثيرة — اطلب رمزًا جديدًا.' };
  await prisma.loginChallenge.update({ where: { id }, data: { attempts: { increment: 1 } } });
  const a = Buffer.from(hashCode(id, clean));
  const b = Buffer.from(ch.codeHash);
  if (clean.length !== 6 || a.length !== b.length || !timingSafeEqual(a, b)) {
    return { error: 'الرمز غير صحيح.' };
  }
  await prisma.loginChallenge.delete({ where: { id } }).catch(() => {});
  const user = await prisma.user.findUnique({ where: { id: ch.userId } });
  if (!user || !user.active) return { error: 'الحساب غير متاح.' };
  return { user };
}

// ---- Web cookies -----------------------------------------------------------

// Short-lived pointer to the pending challenge (+ where to go after sign-in).
export async function setPendingChallenge(challengeId: string, redirectTo: string) {
  const token = await new SignJWT({ cid: challengeId, r: redirectTo })
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime(`${CODE_TTL_MIN * 60}s`).sign(secret);
  cookies().set(PENDING_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: CODE_TTL_MIN * 60, path: '/' });
}

export async function readPendingChallenge(): Promise<{ cid: string; r: string } | null> {
  const t = cookies().get(PENDING_COOKIE)?.value;
  if (!t) return null;
  try {
    const { payload } = await jwtVerify(t, secret);
    return { cid: String(payload.cid), r: String(payload.r || '/admin') };
  } catch { return null; }
}

export function clearPendingChallenge() {
  cookies().set(PENDING_COOKIE, '', { maxAge: 0, path: '/' });
}

// «تذكّر هذا الجهاز»: skip the code on this browser for TRUST_DAYS. Bound to the
// user's sessionVersion, so a password change / «sign out everywhere» revokes it.
export async function setTrustedDevice(user: { id: string; sessionVersion: number }) {
  const token = await new SignJWT({ uid: user.id, sv: user.sessionVersion, t: 'trust' })
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime(`${TRUST_DAYS}d`).sign(secret);
  cookies().set(TRUST_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: TRUST_DAYS * 86400, path: '/' });
}

export async function isTrustedDevice(user: { id: string; sessionVersion: number }): Promise<boolean> {
  const t = cookies().get(TRUST_COOKIE)?.value;
  if (!t) return false;
  try {
    const { payload } = await jwtVerify(t, secret);
    return payload.t === 'trust' && payload.uid === user.id && payload.sv === user.sessionVersion;
  } catch { return false; }
}

export async function pendingUserEmail(challengeId: string): Promise<string | null> {
  const ch = await prisma.loginChallenge.findUnique({ where: { id: challengeId } });
  if (!ch) return null;
  const u = await prisma.user.findUnique({ where: { id: ch.userId }, select: { email: true } });
  return u ? maskEmail(u.email) : null;
}
