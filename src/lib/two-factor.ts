import 'server-only';
import { randomInt, createHash, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import { prisma } from './prisma';
import { sendEmail, isEmailConfigured } from './email';
import { rateLimit, HOUR } from './rate-limit';
import { ROLES } from './constants';
import { logActivity } from './activity';

// Two-step sign-in (email code) for every account ABOVE reviewer: editors,
// content managers and admins can change or delete the archive, so a stolen
// password alone must not be enough. Applies to password logins (web + app);
// Google sign-in is already protected by the user's Google account.

const STRONG_ROLES: string[] = [ROLES.EDITOR, ROLES.CONTENT_MANAGER, ROLES.ADMIN];
const CODE_TTL_MIN = 10;
const MAX_ATTEMPTS = 5;
const RESEND_GAP_MS = 60_000;
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
// Where a sign-in attempt came from — shown in the code email and kept in the
// activity log, so an unexpected code can be traced (and a stolen password spotted).
export interface LoginOrigin { via: 'web' | 'app'; ip: string; country?: string | null; ua?: string | null }

export function originFromHeaders(h: Headers, via: 'web' | 'app'): LoginOrigin {
  return {
    via,
    ip: h.get('cf-connecting-ip') || (h.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown',
    country: h.get('cf-ipcountry'),
    ua: (h.get('user-agent') || '').slice(0, 160) || null,
  };
}

function deviceLabel(o: LoginOrigin): string {
  const ua = o.ua || '';
  const os = /android/i.test(ua) ? 'أندرويد' : /iphone|ipad|ios/i.test(ua) ? 'آيفون' : /windows/i.test(ua) ? 'ويندوز' : /mac os/i.test(ua) ? 'ماك' : /linux/i.test(ua) ? 'لينكس' : '';
  const where = o.via === 'app' ? 'تطبيق أرشيف المسيد' : 'متصفح الموقع';
  return [where, os].filter(Boolean).join(' · ');
}

export async function startChallenge(user: { id: string; email: string; name: string }, origin?: LoginOrigin): Promise<{ id: string; reused?: boolean } | { error: string }> {
  const now = Date.now();
  // Housekeeping: drop long-dead challenges (kept ~1h so the hourly cap can count them).
  await prisma.loginChallenge.deleteMany({ where: { userId: user.id, createdAt: { lt: new Date(now - 2 * HOUR) } } }).catch(() => {});
  // Email can take a minute to arrive. If a code was sent moments ago, don't
  // send another (that used to snowball: each new code cancelled the previous
  // one, so the code that finally arrived was already dead) — reuse it.
  const recent = await prisma.loginChallenge.findFirst({
    where: { userId: user.id, createdAt: { gt: new Date(now - RESEND_GAP_MS) }, expiresAt: { gt: new Date(now) }, attempts: { lt: MAX_ATTEMPTS } },
    orderBy: { createdAt: 'desc' },
  });
  if (recent) return { id: recent.id, reused: true };
  // At most 5 codes per hour per account (stored in the DB, so it survives restarts).
  const lastHour = await prisma.loginChallenge.count({ where: { userId: user.id, createdAt: { gt: new Date(now - HOUR) } } });
  if (lastHour >= 5 || !rateLimit(`2fa:send:${user.id}`, 5, HOUR)) {
    return { error: 'طلبت رموزًا كثيرة — انتظر قليلًا ثم حاول مجددًا.' };
  }
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
      <p>صالح لمدة ${CODE_TTL_MIN} دقائق.</p>
      ${origin ? `<p style="color:#555">طُلب من: ${deviceLabel(origin)}${origin.country ? ` · الدولة: ${origin.country}` : ''} · IP: <span dir="ltr">${origin.ip}</span></p>` : ''}
      <p><b>إن لم تكن أنت من يحاول الدخول</b> فكلمة مرورك معروفة لغيرك: غيّرها فورًا ثم اضغط «الخروج من الأجهزة الأخرى» في صفحة حسابك. لن يدخل أحد بدون هذا الرمز.</p>
    </div>`,
  });
  if (!sent) {
    await prisma.loginChallenge.delete({ where: { id: ch.id } }).catch(() => {});
    return { error: 'تعذّر إرسال رمز التحقق إلى بريدك — حاول مجددًا بعد قليل.' };
  }
  await logActivity({
    userId: user.id, action: 'login_code_sent', entity: 'user', entityId: user.id,
    meta: origin ? { via: origin.via, ip: origin.ip, country: origin.country ?? null, device: deviceLabel(origin) } : undefined,
  }).catch(() => {});
  return { id: ch.id };
}

// Check a code. Any code emailed to this account in the last 10 minutes is
// accepted (a late-arriving earlier email still works); attempts are counted on
// the sign-in's own challenge. On success every pending code is consumed.
export async function verifyChallenge(id: string, code: string): Promise<
  { user: { id: string; name: string; role: string; email: string; sessionVersion: number; active: boolean } } | { error: string }
> {
  const clean = String(code || '').replace(/\D/g, '');
  const ch = await prisma.loginChallenge.findUnique({ where: { id } });
  if (!ch) return { error: 'انتهت صلاحية الرمز — اطلب رمزًا جديدًا.' };
  if (ch.attempts >= MAX_ATTEMPTS) return { error: 'محاولات كثيرة — اطلب رمزًا جديدًا.' };
  await prisma.loginChallenge.update({ where: { id }, data: { attempts: { increment: 1 } } });
  const live = await prisma.loginChallenge.findMany({
    where: { userId: ch.userId, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });
  const ok = clean.length === 6 && live.some((c) => {
    const a = Buffer.from(hashCode(c.id, clean));
    const b = Buffer.from(c.codeHash);
    return a.length === b.length && timingSafeEqual(a, b);
  });
  if (!ok) {
    return { error: live.length ? 'الرمز غير صحيح.' : 'انتهت صلاحية الرمز — اطلب رمزًا جديدًا.' };
  }
  await prisma.loginChallenge.deleteMany({ where: { userId: ch.userId } }).catch(() => {});
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
