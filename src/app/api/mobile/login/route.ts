import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPassword } from '@/lib/auth';
import { signMobileToken } from '@/lib/mobile-auth';
import { loginSchema } from '@/lib/validation';
import { ROLE_LABELS, type Role } from '@/lib/constants';
import { rateLimit, ipFromHeaders, MIN } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'بيانات غير صحيحة' }, { status: 400 });
  }
  // Brute-force guard (same limits as the website login).
  const email = parsed.data.email.toLowerCase();
  const ip = ipFromHeaders(req.headers);
  if (!rateLimit(`login:ip:${ip}`, 20, 15 * MIN) || !rateLimit(`login:email:${email}`, 8, 15 * MIN)) {
    // 403 (not 429): the app auto-retries 429s as transient server load, which
    // would keep hammering and show «الخادم مشغول» instead of this message.
    return NextResponse.json({ error: 'محاولات كثيرة جدًا — انتظر قليلًا ثم حاول مجددًا.' }, { status: 403 });
  }
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.active || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return NextResponse.json({ error: 'البريد أو كلمة المرور غير صحيحة' }, { status: 401 });
  }

  const token = await signMobileToken({
    uid: user.id,
    role: user.role as Role,
    name: user.name,
    sv: user.sessionVersion,
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
