import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPassword } from '@/lib/auth';
import { loginSchema } from '@/lib/validation';
import { rateLimit, ipFromHeaders, MIN } from '@/lib/rate-limit';
import { needsTwoFactor, startChallenge, maskEmail, originFromHeaders } from '@/lib/two-factor';
import { mobileLoginResponse } from '@/lib/mobile-login-response';

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

  // Accounts above reviewer: second step by emailed code. Older app builds
  // can't show the code field, so they get a clear «update the app» message.
  if (needsTwoFactor(user.role)) {
    if (req.headers.get('x-almaseed-2fa') !== '1') {
      return NextResponse.json({ error: 'لحماية حسابات الإدارة صار الدخول برمز يصل إلى بريدك — حدّث التطبيق من Google Play ثم سجّل الدخول.' }, { status: 403 });
    }
    const ch = await startChallenge(user, originFromHeaders(req.headers, 'app'));
    if ('error' in ch) return NextResponse.json({ error: ch.error }, { status: 403 });
    return NextResponse.json({ needsCode: true, challenge: ch.id, email: maskEmail(user.email) });
  }

  return mobileLoginResponse(user);
}
