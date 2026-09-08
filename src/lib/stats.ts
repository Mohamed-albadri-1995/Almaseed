import 'server-only';
import { prisma } from './prisma';

function today(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
}

// Increment today's page-view counter. Best-effort — never blocks the page.
export async function recordVisit(): Promise<void> {
  try {
    const date = today();
    await prisma.dailyView.upsert({
      where: { date },
      update: { count: { increment: 1 } },
      create: { date, count: 1 },
    });
  } catch {
    /* ignore — stats must never break a page render */
  }
}

// Aggregate stats for the system-admin dashboard.
export async function getSystemStats() {
  const since = new Date();
  since.setDate(since.getDate() - 6);
  const sinceStr = since.toISOString().slice(0, 10);
  const todayStr = new Date().toISOString().slice(0, 10);

  const [rows, totalAgg, storageAgg, materials, users] = await Promise.all([
    prisma.dailyView.findMany({ orderBy: { date: 'desc' }, take: 14 }),
    prisma.dailyView.aggregate({ _sum: { count: true } }),
    prisma.material.aggregate({ _sum: { fileSize: true } }),
    prisma.material.count(),
    prisma.user.count(),
  ]);

  const last7 = rows
    .filter((r) => r.date >= sinceStr)
    .reduce((s, r) => s + r.count, 0);
  const todayViews = rows.find((r) => r.date === todayStr)?.count ?? 0;

  const mem = process.memoryUsage();

  return {
    views: {
      today: todayViews,
      last7,
      total: totalAgg._sum.count ?? 0,
      daily: rows.slice(0, 14).reverse(), // oldest→newest for a chart
    },
    storageBytes: storageAgg._sum.fileSize ?? 0,
    materials,
    users,
    memory: { rss: mem.rss, heapUsed: mem.heapUsed, heapTotal: mem.heapTotal },
  };
}
