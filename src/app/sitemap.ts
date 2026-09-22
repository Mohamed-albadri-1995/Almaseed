import type { MetadataRoute } from 'next';
import { prisma } from '@/lib/prisma';
import { MATERIAL_STATUS } from '@/lib/constants';
import { SITE_URL } from '@/lib/seo';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [materials, categories] = await Promise.all([
    prisma.material.findMany({
      where: { status: MATERIAL_STATUS.PUBLISHED, mergedIntoId: null },
      select: { id: true, updatedAt: true, publishedAt: true },
      orderBy: { publishedAt: 'desc' },
      take: 45000, // stay under the 50k-URL sitemap limit
    }),
    prisma.category.findMany({ orderBy: { order: 'asc' }, select: { slug: true } }),
  ]);

  const now = new Date();
  const staticPages: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/archive`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE_URL}/guide`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE_URL}/about`, lastModified: now, changeFrequency: 'yearly', priority: 0.5 },
    { url: `${SITE_URL}/faq`, lastModified: now, changeFrequency: 'yearly', priority: 0.5 },
    { url: `${SITE_URL}/contact`, lastModified: now, changeFrequency: 'yearly', priority: 0.4 },
    { url: `${SITE_URL}/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE_URL}/policy`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
  ];

  const categoryPages: MetadataRoute.Sitemap = categories.map((c) => ({
    url: `${SITE_URL}/archive?category=${encodeURIComponent(c.slug)}`,
    lastModified: now,
    changeFrequency: 'daily',
    priority: 0.8,
  }));

  const materialPages: MetadataRoute.Sitemap = materials.map((m) => ({
    url: `${SITE_URL}/material/${m.id}`,
    lastModified: m.updatedAt ?? m.publishedAt ?? now,
    changeFrequency: 'weekly',
    priority: 0.7,
  }));

  return [...staticPages, ...categoryPages, ...materialPages];
}
