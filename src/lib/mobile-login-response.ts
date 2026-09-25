import 'server-only';
import { NextResponse } from 'next/server';
import { signMobileToken } from './mobile-auth';
import { ROLE_LABELS, type Role } from './constants';

// The app's signed-in payload (token + user summary), shared by the password
// login and its two-step verify endpoint so both answer identically.
export async function mobileLoginResponse(user: { id: string; name: string; role: string; sessionVersion: number }) {
  const token = await signMobileToken({ uid: user.id, role: user.role as Role, name: user.name, sv: user.sessionVersion });
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
