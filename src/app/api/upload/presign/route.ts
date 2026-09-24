import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { presignResponse } from '@/lib/upload-server';

export const dynamic = 'force-dynamic';

// Step 1 of a direct-to-storage upload from the website: the browser then PUTs
// the file straight to storage, so it never passes through this server.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });
  return presignResponse(user.id, req);
}
