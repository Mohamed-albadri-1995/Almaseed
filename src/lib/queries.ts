import { prisma } from './prisma';
import { MATERIAL_STATUS } from './constants';
import type { Prisma } from '@prisma/client';

const PUBLISHED = MATERIAL_STATUS.PUBLISHED;

export async function getCategoriesWithCounts() {
  const categories = await prisma.category.findMany({ orderBy: { order: 'asc' } });
  const counts = await prisma.material.groupBy({
    by: ['categoryId'],
    where: { status: PUBLISHED },
    _count: { _all: true },
  });
  const map = new Map(counts.map((c) => [c.categoryId, c._count._all]));
  return categories.map((c) => ({ ...c, count: map.get(c.id) ?? 0 }));
}

export async function getHomeStats() {
  const [total, published, contributors, downloadsAgg] = await Promise.all([
    prisma.material.count(),
    prisma.material.count({ where: { status: PUBLISHED } }),
    prisma.user.count(),
    prisma.material.aggregate({ _sum: { downloads: true } }),
  ]);
  return {
    total,
    published,
    contributors,
    downloads: downloadsAgg._sum.downloads ?? 0,
  };
}

const cardSelect = {
  id: true,
  title: true,
  status: true,
  fileKind: true,
  fileType: true,
  durationSec: true,
  performer: true,
  speaker: true,
  host: true,
  occasion: true,
  plays: true,
  downloads: true,
  category: { select: { name: true, slug: true } },
} satisfies Prisma.MaterialSelect;

export async function getLatestPublished(take = 8) {
  return prisma.material.findMany({
    where: { status: PUBLISHED },
    orderBy: { publishedAt: 'desc' },
    take,
    select: cardSelect,
  });
}

export async function getMostPlayed(take = 4) {
  return prisma.material.findMany({
    where: { status: PUBLISHED },
    orderBy: { plays: 'desc' },
    take,
    select: cardSelect,
  });
}

export interface ArchiveFilters {
  categorySlug?: string;
  q?: string;
  fileKind?: string;
  city?: string;
  person?: string;
  sort?: string;
  page?: number;
  perPage?: number;
}

export async function searchMaterials(filters: ArchiveFilters) {
  const {
    categorySlug,
    q,
    fileKind,
    city,
    person,
    sort = 'newest',
    page = 1,
    perPage = 12,
  } = filters;

  const where: Prisma.MaterialWhereInput = { status: PUBLISHED };

  if (categorySlug) where.category = { slug: categorySlug };
  if (fileKind) where.fileKind = fileKind;
  if (city) where.city = { contains: city };

  const and: Prisma.MaterialWhereInput[] = [];
  if (q) {
    and.push({
      OR: [
        { title: { contains: q } },
        { performer: { contains: q } },
        { speaker: { contains: q } },
        { narrator: { contains: q } },
        { host: { contains: q } },
        { occasion: { contains: q } },
        { topic: { contains: q } },
        { place: { contains: q } },
        { keywords: { contains: q } },
        { description: { contains: q } },
      ],
    });
  }
  if (person) {
    and.push({
      OR: [
        { performer: { contains: person } },
        { speaker: { contains: person } },
        { narrator: { contains: person } },
        { host: { contains: person } },
      ],
    });
  }
  if (and.length) where.AND = and;

  const orderBy: Prisma.MaterialOrderByWithRelationInput =
    sort === 'downloads'
      ? { downloads: 'desc' }
      : sort === 'plays'
        ? { plays: 'desc' }
        : sort === 'title'
          ? { title: 'asc' }
          : { publishedAt: 'desc' };

  const [items, total] = await Promise.all([
    prisma.material.findMany({
      where,
      orderBy,
      skip: (page - 1) * perPage,
      take: perPage,
      select: cardSelect,
    }),
    prisma.material.count({ where }),
  ]);

  return { items, total, page, perPage, pages: Math.ceil(total / perPage) };
}

export async function getMaterial(id: string) {
  return prisma.material.findUnique({
    where: { id },
    include: { category: true, submittedBy: { select: { name: true } } },
  });
}

export async function getRelatedMaterials(
  materialId: string,
  categoryId: string,
  take = 4,
) {
  return prisma.material.findMany({
    where: {
      status: PUBLISHED,
      categoryId,
      NOT: { id: materialId },
    },
    orderBy: { plays: 'desc' },
    take,
    select: cardSelect,
  });
}

// Distinct city/person values for filter dropdowns.
export async function getFilterFacets() {
  const rows = await prisma.material.findMany({
    where: { status: PUBLISHED },
    select: { city: true },
  });
  const cities = Array.from(
    new Set(rows.map((r) => r.city).filter(Boolean) as string[]),
  ).sort();
  return { cities };
}
