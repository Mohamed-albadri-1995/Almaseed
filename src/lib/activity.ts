import { prisma } from './prisma';

export async function logActivity(entry: {
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  meta?: Record<string, unknown>;
}) {
  await prisma.activityLog.create({
    data: {
      userId: entry.userId ?? null,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId ?? null,
      meta: entry.meta ? JSON.stringify(entry.meta) : null,
    },
  });
}
