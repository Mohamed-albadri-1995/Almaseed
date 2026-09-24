import { NextResponse } from 'next/server';
import { getMobileUser, bearer } from '@/lib/mobile-auth';
import { ROLE_LABELS, type Role } from '@/lib/constants';

export const dynamic = 'force-dynamic';

// Returns the signed-in user for a bearer token — used by the app after the
// Google web flow hands back a token, to build its stored auth object.
export async function GET(req: Request) {
  // Invalid, expired, deactivated or revoked (password reset / sign-out
  // everywhere) → 401, so the app drops the stale login.
  const user = await getMobileUser(bearer(req));
  if (!user) return NextResponse.json({ error: 'غير مصرّح' }, { status: 401 });

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
