import { NextResponse } from 'next/server';
import { removeComment } from '@/lib/comments';
import { getMobileUser, bearer } from '@/lib/mobile-auth';

export const dynamic = 'force-dynamic';

// Delete a comment from the app — its author or staff only; replies go with it.
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const user = await getMobileUser(bearer(req));
  if (!user) return NextResponse.json({ error: 'سجّل الدخول' }, { status: 401 });
  const res = await removeComment(user, params.id);
  if (!res.ok) return NextResponse.json({ error: 'لا يمكن حذف هذا التعليق' }, { status: 403 });
  return NextResponse.json({ ok: true });
}
