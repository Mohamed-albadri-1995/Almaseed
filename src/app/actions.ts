'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';

export async function toggleFavorite(materialId: string) {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'يجب تسجيل الدخول' };

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
  if (!reason.trim()) return { ok: false, error: 'يرجى كتابة سبب البلاغ' };
  await prisma.contentReport.create({
    data: { materialId, reason: reason.trim(), contact: contact?.trim() || null },
  });
  return { ok: true };
}

export async function sendContactMessage(data: {
  name: string;
  email: string;
  message: string;
}) {
  if (!data.name.trim() || !data.message.trim()) {
    return { ok: false, error: 'يرجى كتابة الاسم والرسالة' };
  }
  await prisma.activityLog.create({
    data: {
      action: 'contact',
      entity: 'contact',
      meta: JSON.stringify({
        name: data.name.trim(),
        email: data.email.trim(),
        message: data.message.trim(),
      }),
    },
  });
  return { ok: true };
}

export async function rateMaterial(materialId: string, value: number) {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'يجب تسجيل الدخول' };
  const v = Math.round(value);
  if (v < 1 || v > 5) return { ok: false, error: 'قيمة غير صحيحة' };

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
  const text = body.trim();
  if (text.length < 2) return { ok: false, error: 'اكتب تعليقاً أطول' };
  if (text.length > 1000) return { ok: false, error: 'التعليق طويل جداً' };

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

export async function registerPlay(materialId: string) {
  await prisma.material.update({
    where: { id: materialId },
    data: { plays: { increment: 1 } },
  });
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
