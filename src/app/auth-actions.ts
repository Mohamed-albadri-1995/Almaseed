'use server';

import { redirect } from 'next/navigation';
import { randomBytes, createHash } from 'crypto';
import { prisma } from '@/lib/prisma';
import { hashPassword, verifyPassword } from '@/lib/auth';
import { createSession, destroySession } from '@/lib/session';
import { loginSchema, registerSchema } from '@/lib/validation';
import { sendEmail, appUrl } from '@/lib/email';
import { ROLES, type Role } from '@/lib/constants';
import { rateLimit, clientIp, MIN, HOUR } from '@/lib/rate-limit';

const TOO_MANY = 'محاولات كثيرة جدًا — انتظر قليلًا ثم حاول مجددًا.';

// Only allow same-site relative paths after login. An absolute URL or a
// protocol-relative «//host» would turn the login page into an open redirect
// usable for phishing.
function safeRedirect(target: unknown): string {
  const t = typeof target === 'string' ? target.trim() : '';
  if (!t.startsWith('/') || t.startsWith('//') || t.startsWith('/\\')) return '/account';
  return t;
}

export interface AuthState {
  error?: string;
}

export interface ResetState {
  error?: string;
  sent?: boolean;
}

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

export async function loginAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'بيانات غير صحيحة' };
  }

  // Brute-force guard: per IP and per targeted account.
  const email = parsed.data.email.toLowerCase();
  if (!rateLimit(`login:ip:${clientIp()}`, 20, 15 * MIN) || !rateLimit(`login:email:${email}`, 8, 15 * MIN)) {
    return { error: TOO_MANY };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.active) {
    return { error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' };
  }
  const ok = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!ok) {
    return { error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' };
  }

  await createSession({ uid: user.id, role: user.role as Role, name: user.name });

  redirect(safeRedirect(formData.get('redirect')));
}

export async function registerAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = registerSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    password: formData.get('password'),
    city: formData.get('city') || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'بيانات غير صحيحة' };
  }

  if (!rateLimit(`register:ip:${clientIp()}`, 6, HOUR)) {
    return { error: TOO_MANY };
  }

  const email = parsed.data.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: 'هذا البريد الإلكتروني مسجّل مسبقاً' };
  }

  const user = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email,
      city: parsed.data.city,
      passwordHash: await hashPassword(parsed.data.password),
      role: ROLES.CONTRIBUTOR,
    },
  });

  await createSession({ uid: user.id, role: user.role as Role, name: user.name });
  redirect('/account');
}

export async function logoutAction() {
  destroySession();
  redirect('/');
}

// Step 1 — the user asks for a reset link by email. We always report success
// (never reveal whether an email is registered), and only actually send when a
// matching active account exists.
export async function requestPasswordResetAction(
  _prev: ResetState,
  formData: FormData,
): Promise<ResetState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { error: 'أدخل بريدًا إلكترونيًا صحيحًا' };
  }

  // Stop reset-email flooding (of a victim's inbox, and of our email quota).
  // Over the limit we still answer «sent» so nothing about accounts leaks.
  if (!rateLimit(`reset:ip:${clientIp()}`, 8, HOUR) || !rateLimit(`reset:email:${email}`, 3, HOUR)) {
    return { sent: true };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (user && user.active) {
    const token = randomBytes(32).toString('hex');
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetTokenHash: sha256(token),
        resetTokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      },
    });
    const link = `${appUrl()}/reset-password/${token}`;
    await sendEmail({
      to: email,
      subject: 'إعادة تعيين كلمة المرور — أرشيف المسيد',
      html: `
        <div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;line-height:1.9;color:#1c2a23">
          <h2 style="color:#1f3d33">إعادة تعيين كلمة المرور</h2>
          <p>وصلنا طلب لإعادة تعيين كلمة مرور حسابك في «أرشيف المسيد».</p>
          <p>اضغط الزر التالي لتعيين كلمة مرور جديدة. الرابط صالح لمدة ساعة واحدة:</p>
          <p style="margin:24px 0">
            <a href="${link}" style="background:#1f3d33;color:#fff;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:bold">تعيين كلمة مرور جديدة</a>
          </p>
          <p style="font-size:13px;color:#6b7280">إذا لم تطلب ذلك، تجاهل هذه الرسالة ولن يتغيّر شيء.</p>
        </div>`,
    });
  }

  return { sent: true };
}

// Step 2 — the user opens the emailed link and sets a new password.
export async function resetPasswordAction(
  _prev: ResetState,
  formData: FormData,
): Promise<ResetState> {
  const token = String(formData.get('token') ?? '');
  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('confirm') ?? '');

  if (password.length < 8) return { error: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' };
  if (password !== confirm) return { error: 'كلمتا المرور غير متطابقتين' };
  if (!token) return { error: 'رابط غير صالح' };

  const user = await prisma.user.findFirst({
    where: { resetTokenHash: sha256(token), resetTokenExpiresAt: { gt: new Date() } },
  });
  if (!user) {
    return { error: 'الرابط غير صالح أو منتهي الصلاحية — اطلب رابطًا جديدًا.' };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(password),
      resetTokenHash: null,
      resetTokenExpiresAt: null,
    },
  });

  redirect('/login?reset=1');
}
