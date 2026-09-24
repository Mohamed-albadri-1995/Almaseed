'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { MATERIAL_STATUS } from '@/lib/constants';
import { rateLimit, clientIp, MIN, HOUR } from '@/lib/rate-limit';

// Interactions (favorite/rate/comment/report) only make sense on a published
// material. Checking up front also turns a bad/foreign id into a clean «not
// found» instead of a foreign-key crash.
async function isPublished(materialId: string): Promise<boolean> {
  if (typeof materialId !== 'string' || !materialId) return false;
  const m = await prisma.material.findUnique({ where: { id: materialId }, select: { status: true } });
  return m?.status === MATERIAL_STATUS.PUBLISHED;
}
const NOT_FOUND = { ok: false as const, error: 'المادة غير متاحة' };

export async function toggleFavorite(materialId: string) {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'يجب تسجيل الدخول' };
  if (!(await isPublished(materialId))) return NOT_FOUND;

  const existing = await prisma.favorite.findUnique({
    where: { userId_materialId: { userId: user.id, materialId } },
  });
  if (existing) {
    await prisma.favorite.delete({ where: { id: existing.id } });
    revalidatePath(`/material/${materialId}`);
    return { ok: true, favorited: false };
  }
  await prisma.favorite.create({ data: { userId: user.id, materialId } });
  revalidatePath(`/material/${materialId}`);
  return { ok: true, favorited: true };
}

export async function reportContent(materialId: string, reason: string, contact?: string) {
  const text = String(reason ?? '').trim();
  if (!text) return { ok: false, error: 'يرجى كتابة سبب البلاغ' };
  if (text.length > 2000) return { ok: false, error: 'نص البلاغ طويل جدًا' };
  if (!rateLimit(`report:${clientIp()}`, 10, HOUR)) {
    return { ok: false, error: 'أرسلت بلاغات كثيرة — حاول لاحقًا.' };
  }
  if (!(await isPublished(materialId))) return NOT_FOUND;
  await prisma.contentReport.create({
    data: { materialId, reason: text, contact: String(contact ?? '').trim().slice(0, 200) || null },
  });
  return { ok: true };
}

export async function sendContactMessage(data: {
  name: string;
  email: string;
  message: string;
}) {
  const name = String(data?.name ?? '').trim();
  const email = String(data?.email ?? '').trim();
  const message = String(data?.message ?? '').trim();
  if (!name || !message) {
    return { ok: false, error: 'يرجى كتابة الاسم والرسالة' };
  }
  if (name.length > 120 || email.length > 200 || message.length > 5000) {
    return { ok: false, error: 'الرسالة طويلة جدًا' };
  }
  if (!rateLimit(`contact:${clientIp()}`, 5, HOUR)) {
    return { ok: false, error: 'أرسلت رسائل كثيرة — حاول لاحقًا.' };
  }
  await prisma.activityLog.create({
    data: {
      action: 'contact',
      entity: 'contact',
      meta: JSON.stringify({ name, email, message }),
    },
  });
  return { ok: true };
}

export async function rateMaterial(materialId: string, value: number) {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'يجب تسجيل الدخول' };
  const v = Math.round(value);
  if (!Number.isFinite(v) || v < 1 || v > 5) return { ok: false, error: 'قيمة غير صحيحة' };
  if (!(await isPublished(materialId))) return NOT_FOUND;

  await prisma.rating.upsert({
    where: { userId_materialId: { userId: user.id, materialId } },
    update: { value: v },
    create: { userId: user.id, materialId, value: v },
  });
  revalidatePath(`/material/${materialId}`);
  return { ok: true, value: v };
}

export async function postComment(materialId: string, body: string) {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'يجب تسجيل الدخول' };
  const text = String(body ?? '').trim();
  if (text.length < 2) return { ok: false, error: 'اكتب تعليقاً أطول' };
  if (text.length > 1000) return { ok: false, error: 'التعليق طويل جداً' };
  if (!rateLimit(`comment:${user.id}`, 10, 10 * MIN)) {
    return { ok: false, error: 'علّقت كثيرًا في وقت قصير — انتظر قليلًا.' };
  }
  if (!(await isPublished(materialId))) return NOT_FOUND;

  await prisma.comment.create({
    data: { userId: user.id, materialId, body: text },
  });
  revalidatePath(`/material/${materialId}`);
  return { ok: true };
}

export async function deleteComment(commentId: string) {
  const user = await getCurrentUser();
  if (!user) return { ok: false };
  const comment = await prisma.comment.findUnique({ where: { id: commentId } });
  if (!comment) return { ok: false };
  // The author or any staff member may delete a comment.
  const isStaffUser = user.role !== 'CONTRIBUTOR';
  if (comment.userId !== user.id && !isStaffUser) return { ok: false };
  await prisma.comment.delete({ where: { id: commentId } });
  revalidatePath(`/material/${comment.materialId}`);
  return { ok: true };
}

export async function markAllNotificationsRead(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  await prisma.notification.updateMany({
    where: { userId: user.id, read: false },
    data: { read: true },
  });
  revalidatePath('/account/notifications');
  revalidatePath('/account');
}

export async function markNotificationRead(id: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  await prisma.notification.updateMany({
    where: { id, userId: user.id },
    data: { read: true },
  });
  revalidatePath('/account/notifications');
}
