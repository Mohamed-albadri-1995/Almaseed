import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyMobileToken, bearer } from '@/lib/mobile-auth';
import { ROLE_LABELS, type Role } from '@/lib/constants';

export const dynamic = 'force-dynamic';

// Returns the signed-in user for a bearer token — used by the app after the
// Google web flow hands back a token, to build its stored auth object.
export async function GET(req: Request) {
  const auth = await verifyMobileToken(bearer(req));
  if (!auth) return NextResponse.json({ error: 'غير مصرّح' }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { id: auth.uid } });
  if (!user || !user.active) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });

  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      role: user.role,
      roleLabel: ROLE_LABELS[user.role as Role] ?? user.role,
      isStaff: user.role !== 'CONTRIBUTOR',
    },
  });
}
