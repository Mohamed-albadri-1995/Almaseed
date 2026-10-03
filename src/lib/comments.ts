import { prisma } from './prisma';
import { MATERIAL_STATUS } from './constants';
import { rateLimit, MIN } from './rate-limit';
import { pushToUsers } from './push';

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
    ? await prisma.material.findUnique({ where: { id: materialId }, select: { status: true, title: true, submittedById: true } })
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
  // Notify (bell + phone push): a reply → the person answered; a new comment
  // → whoever contributed the material. Never yourself.
  const target = parentId ? notifyUserId : material.submittedById;
  if (target && target !== user.id) {
    await notifyComment(target, {
      title: parentId ? `ردّ ${user.name} على تعليقك` : `علّق ${user.name} على مادتك`,
      body: `«${material.title}»: ${text.slice(0, 120)}`,
      materialId,
    });
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

// The bell entry (its link marks it as a comment notification for the app's
// feed) plus a push to the user's signed-in devices. Best-effort.
async function notifyComment(userId: string, n: { title: string; body: string; materialId: string }) {
  try {
    await prisma.notification.create({
      data: { userId, title: n.title, body: n.body, link: `/material/${n.materialId}#comments` },
    });
    await pushToUsers([userId], { title: n.title, body: n.body, data: { materialId: n.materialId, type: 'comment' } });
  } catch (e) {
    console.error('[comments] notify failed:', e instanceof Error ? e.message : e);
  }
}
