import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPassword } from '@/lib/auth';
import { signMobileToken } from '@/lib/mobile-auth';
import { loginSchema } from '@/lib/validation';
import { ROLE_LABELS, type Role } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'بيانات غير صحيحة' }, { status: 400 });
  }
  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email.toLowerCase() },
  });
  if (!user || !user.active || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return NextResponse.json({ error: 'البريد أو كلمة المرور غير صحيحة' }, { status: 401 });
  }

  const token = await signMobileToken({
    uid: user.id,
    role: user.role as Role,
    name: user.name,
  });
  return NextResponse.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      role: user.role,
      roleLabel: ROLE_LABELS[user.role as Role] ?? user.role,
      isStaff: user.role !== 'CONTRIBUTOR',
    },
  });
}
