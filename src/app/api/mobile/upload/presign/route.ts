import { NextResponse } from 'next/server';
import { getMobileUser, bearer } from '@/lib/mobile-auth';
import { presignResponse } from '@/lib/upload-server';

export const dynamic = 'force-dynamic';

// App (bearer) twin of /api/upload/presign.
export async function POST(req: Request) {
  const user = await getMobileUser(bearer(req));
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });
  return presignResponse(user.id, req);
}
