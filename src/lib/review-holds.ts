import { prisma } from './prisma';
import { MATERIAL_STATUS } from './constants';
import { logActivity } from './activity';
import { notifyAllNewMaterial, pushToUsers } from './push';
import { pingIndexNow } from './indexnow';

// Days a rejection-hold waits for a second reviewer before auto-publishing.
export const HOLD_DAYS = 7;

// Publish any material that has been HELD (one rejection) for longer than
// HOLD_DAYS without a second reviewer confirming the rejection. Safe to call
// repeatedly / concurrently — it only acts on rows still HELD past the cutoff.
export async function releaseExpiredHolds(): Promise<number> {
  const cutoff = new Date(Date.now() - HOLD_DAYS * 24 * 60 * 60 * 1000);
  const due = await prisma.material.findMany({
    where: { status: MATERIAL_STATUS.HELD, heldAt: { lte: cutoff } },
    include: { category: { select: { name: true } } },
  });

  for (const m of due) {
    const wasPublishedBefore = !!m.publishedAt;
    await prisma.material.update({
      where: { id: m.id },
      data: {
        status: MATERIAL_STATUS.PUBLISHED,
        publishedAt: m.publishedAt ?? new Date(),
        heldAt: null,
      },
    });

    if (m.submittedById) {
      const body = `«${m.title}» — نُشرت تلقائيًّا بعد مرور ${HOLD_DAYS} أيام دون تأييد الرفض من مراجع ثانٍ.`;
      await prisma.notification.create({
        data: { userId: m.submittedById, title: 'تم نشر مادتك', body, link: '/account' },
      });
      await pushToUsers([m.submittedById], {
        title: 'تم نشر مادتك',
        body,
        data: { materialId: m.id, type: 'auto_published' },
      }).catch(() => {});
    }
    await logActivity({
      action: 'auto_publish_hold',
      entity: 'material',
      entityId: m.id,
      meta: { title: m.title },
    });
    if (!wasPublishedBefore) {
      await notifyAllNewMaterial({
        id: m.id,
        title: m.title,
        category: m.category ? { name: m.category.name } : null,
      }).catch(() => {});
      void pingIndexNow([`/material/${m.id}`]);
    }
  }
  return due.length;
}
