import { prisma } from './prisma';
import { MATERIAL_STATUS } from './constants';
import { rateLimit, MIN } from './rate-limit';

// Comments and one-level replies, shared by the website (server actions) and
// the app (/api/mobile/...). Posting needs a signed-in account; reading is public.

export interface ThreadComment {
  id: string;
  body: string;
  createdAt: Date;
  authorName: string;
  authorId: string;
  replies: Omit<ThreadComment, 'replies'>[];
}

type Row = { id: string; body: string; createdAt: Date; parentId: string | null; user: { id: string; name: string } };

// Newest conversations first; replies under each in the order they were written.
export async function listComments(materialId: string): Promise<ThreadComment[]> {
  const rows: Row[] = await prisma.comment.findMany({
    where: { materialId, hidden: false },
    orderBy: { createdAt: 'asc' },
    select: { id: true, body: true, createdAt: true, parentId: true, user: { select: { id: true, name: true } } },
  });
  const top = new Map<string, ThreadComment>();
  for (const r of rows) {
    if (!r.parentId) top.set(r.id, { id: r.id, body: r.body, createdAt: r.createdAt, authorName: r.user.name, authorId: r.user.id, replies: [] });
  }
  for (const r of rows) {
    if (r.parentId) top.get(r.parentId)?.replies.push({ id: r.id, body: r.body, createdAt: r.createdAt, authorName: r.user.name, authorId: r.user.id });
  }
  return Array.from(top.values()).reverse();
}

type Author = { id: string; name: string };
type Result = { ok: true; comment: Omit<ThreadComment, 'replies'> & { parentId: string | null } } | { ok: false; error: string };

export async function createComment(user: Author, materialId: string, rawBody: unknown, rawParentId?: unknown): Promise<Result> {
  const text = String(rawBody ?? '').trim();
  if (text.length < 2) return { ok: false, error: 'اكتب تعليقاً أطول' };
  if (text.length > 1000) return { ok: false, error: 'التعليق طويل جداً' };
  if (!rateLimit(`comment:${user.id}`, 10, 10 * MIN)) {
    return { ok: false, error: 'علّقت كثيرًا في وقت قصير — انتظر قليلًا.' };
  }
  const material = typeof materialId === 'string' && materialId
    ? await prisma.material.findUnique({ where: { id: materialId }, select: { status: true, title: true } })
    : null;
  if (material?.status !== MATERIAL_STATUS.PUBLISHED) return { ok: false, error: 'المادة غير متاحة' };

  // A reply always hangs off the top-level comment, so threads stay one level deep.
  let parentId: string | null = null;
  let notifyUserId: string | null = null;
  if (typeof rawParentId === 'string' && rawParentId) {
    const parent = await prisma.comment.findUnique({ where: { id: rawParentId }, select: { id: true, materialId: true, parentId: true, userId: true, hidden: true } });
    if (!parent || parent.materialId !== materialId || parent.hidden) return { ok: false, error: 'التعليق غير موجود' };
    parentId = parent.parentId ?? parent.id;
    notifyUserId = parent.userId;
  }

  const c = await prisma.comment.create({
    data: { userId: user.id, materialId, body: text, parentId },
    select: { id: true, body: true, createdAt: true, parentId: true },
  });
  // Let the person who was answered know (not when replying to yourself).
  if (notifyUserId && notifyUserId !== user.id) {
    await prisma.notification.create({
      data: {
        userId: notifyUserId,
        title: `ردّ ${user.name} على تعليقك`,
        body: `${material.title}: ${text.slice(0, 120)}`,
        link: `/material/${materialId}#comments`,
      },
    }).catch(() => {});
  }
  return { ok: true, comment: { ...c, authorName: user.name, authorId: user.id } };
}

// The author or any staff member may delete; replies go with it (cascade).
export async function removeComment(user: { id: string; role: string }, commentId: string): Promise<{ ok: boolean; materialId?: string }> {
  if (typeof commentId !== 'string' || !commentId) return { ok: false };
  const comment = await prisma.comment.findUnique({ where: { id: commentId }, select: { userId: true, materialId: true } });
  if (!comment) return { ok: false };
  if (comment.userId !== user.id && user.role === 'CONTRIBUTOR') return { ok: false };
  await prisma.comment.delete({ where: { id: commentId } });
  return { ok: true, materialId: comment.materialId };
}
