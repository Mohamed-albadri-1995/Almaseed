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

  const [rows, totalAgg, storageAgg, materials, users, byCategory, categories, topDownloaded] = await Promise.all([
    prisma.dailyView.findMany({ orderBy: { date: 'desc' }, take: 14 }),
    prisma.dailyView.aggregate({ _sum: { count: true } }),
    prisma.material.aggregate({ _sum: { fileSize: true } }),
    prisma.material.count(),
    prisma.user.count(),
    prisma.material.groupBy({
      by: ['categoryId'],
      where: { status: 'PUBLISHED' },
      _count: { _all: true },
    }),
    prisma.category.findMany({ orderBy: { order: 'asc' }, select: { id: true, name: true } }),
    prisma.material.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: { downloads: 'desc' },
      take: 5,
      select: { id: true, title: true, downloads: true },
    }),
  ]);

  // Content distribution per category (published only), named and sorted by
  // category display order, so the system dashboard shows where materials sit.
  const distribution = categories
    .map((c) => ({ name: c.name, count: byCategory.find((b) => b.categoryId === c.id)?._count._all ?? 0 }))
    .filter((d) => d.count > 0);

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
    distribution,
    topDownloaded,
  };
}
