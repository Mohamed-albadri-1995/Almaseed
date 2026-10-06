import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { MATERIAL_STATUS } from '@/lib/constants';
import { listComments, createComment } from '@/lib/comments';
import { getMobileUser, bearer } from '@/lib/mobile-auth';

export const dynamic = 'force-dynamic';

// The app's comments for one material (one level of replies).
//   GET                               → { items: [...] } (public)
//   POST { body, parentId? } + Bearer → { comment } (signed-in users)
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const m = await prisma.material.findUnique({ where: { id: params.id }, select: { status: true } });
  if (!m || m.status !== MATERIAL_STATUS.PUBLISHED) {
    return NextResponse.json({ error: 'غير موجودة' }, { status: 404 });
  }
  return NextResponse.json({ items: await listComments(params.id) }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getMobileUser(bearer(req));
  if (!user) return NextResponse.json({ error: 'سجّل الدخول للتعليق' }, { status: 401 });
  const body = await req.json().catch(() => null) as { body?: unknown; parentId?: unknown } | null;
  const res = await createComment(user, params.id, body?.body, body?.parentId);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
  return NextResponse.json({ comment: res.comment });
}
