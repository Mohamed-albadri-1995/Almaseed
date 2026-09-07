'use server';

import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { hashPassword, verifyPassword } from '@/lib/auth';
import { createSession, destroySession } from '@/lib/session';
import { loginSchema, registerSchema } from '@/lib/validation';
import { ROLES, type Role } from '@/lib/constants';

export interface AuthState {
  error?: string;
}

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

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email.toLowerCase() },
  });
  if (!user || !user.active) {
    return { error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' };
  }
  const ok = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!ok) {
    return { error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' };
  }

  await createSession({ uid: user.id, role: user.role as Role, name: user.name });

  const redirectTo = (formData.get('redirect') as string) || '/account';
  redirect(redirectTo);
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
