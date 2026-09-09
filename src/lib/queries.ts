import { prisma } from './prisma';
import { MATERIAL_STATUS } from './constants';
import { normalizeArabic, expandSynonyms } from './search';
import type { Prisma } from '@prisma/client';

const PUBLISHED = MATERIAL_STATUS.PUBLISHED;
// Public listings only ever show published items that were not merged away.
const PUBLIC_WHERE: Prisma.MaterialWhereInput = {
  status: PUBLISHED,
  mergedIntoId: null,
};

export async function getCategoriesWithCounts() {
  const categories = await prisma.category.findMany({ orderBy: { order: 'asc' } });
  const counts = await prisma.material.groupBy({
    by: ['categoryId'],
    where: PUBLIC_WHERE,
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
  fileUrl: true,
  coverImage: true,
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
    where: PUBLIC_WHERE,
    orderBy: { publishedAt: 'desc' },
    take,
    select: cardSelect,
  });
}

export async function getMostPlayed(take = 4) {
  return prisma.material.findMany({
    where: PUBLIC_WHERE,
    orderBy: { plays: 'desc' },
    take,
    select: cardSelect,
  });
}

// Find likely duplicates / near‑matches of a material, to help a reviewer spot
// content that already exists. Matches by title, by identical file size (a
// strong duplicate signal), and by same performer/speaker.
export interface SimilarMaterial {
  id: string;
  title: string;
  status: string;
  fileSize: number | null;
  durationSec: number | null;
  performer: string | null;
  speaker: string | null;
  publishedAt: Date | null;
  category: { name: string } | null;
  reasons: string[];
}

export async function getSimilarMaterials(m: {
  id: string;
  title: string;
  searchText?: string | null;
  fileSize?: number | null;
  performer?: string | null;
  speaker?: string | null;
}): Promise<SimilarMaterial[]> {
  const normTitle = normalizeArabic(m.title || '');
  const or: Prisma.MaterialWhereInput[] = [{ title: { contains: m.title } }];
  if (normTitle) or.push({ searchText: { contains: normTitle } });
  if (m.fileSize) or.push({ fileSize: m.fileSize });
  if (m.performer) or.push({ performer: m.performer });
  if (m.speaker) or.push({ speaker: m.speaker });

  const rows = await prisma.material.findMany({
    where: { id: { not: m.id }, OR: or },
    orderBy: { createdAt: 'desc' },
    take: 6,
    select: {
      id: true, title: true, status: true, fileSize: true, durationSec: true,
      performer: true, speaker: true, publishedAt: true, searchText: true,
      category: { select: { name: true } },
    },
  });

  return rows.map((r) => {
    const reasons: string[] = [];
    if (m.fileSize && r.fileSize === m.fileSize) reasons.push('نفس حجم الملف');
    if (normTitle && r.searchText && r.searchText.includes(normTitle)) reasons.push('تطابق العنوان');
    else if (r.title === m.title) reasons.push('نفس العنوان');
    if (m.performer && r.performer === m.performer) reasons.push('نفس المادح');
    if (m.speaker && r.speaker === m.speaker) reasons.push('نفس المحاضر');
    if (reasons.length === 0) reasons.push('عنوان مشابه');
    const { searchText: _omit, ...rest } = r;
    void _omit;
    return { ...rest, reasons };
  });
}

// Latest images and videos that actually have a viewable file — for the
// interactive media carousel on the home page.
export async function getMediaShowcase(take = 10) {
  return prisma.material.findMany({
    where: {
      ...PUBLIC_WHERE,
      fileKind: { in: ['IMAGE', 'VIDEO'] },
      fileUrl: { not: null },
    },
    orderBy: { publishedAt: 'desc' },
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
  year?: string;
  language?: string;
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
    year,
    language,
    sort = 'newest',
    page = 1,
    perPage = 12,
  } = filters;

  const where: Prisma.MaterialWhereInput = { ...PUBLIC_WHERE };

  if (categorySlug) where.category = { slug: categorySlug };
  if (fileKind === 'ARTICLE') where.bodyText = { not: null };
  else if (fileKind) where.fileKind = fileKind;
  if (city) where.city = { contains: city };
  if (language) where.language = language;
  if (year && /^\d{4}$/.test(year)) {
    const y = Number(year);
    where.recordDate = {
      gte: new Date(`${y}-01-01T00:00:00`),
      lt: new Date(`${y + 1}-01-01T00:00:00`),
    };
  }

  const and: Prisma.MaterialWhereInput[] = [];
  if (q) {
    // Match normalized query terms (and synonyms) against searchText, and
    // also fall back to the raw query for exact/partial matches.
    const terms = expandSynonyms(normalizeArabic(q));
    const or: Prisma.MaterialWhereInput[] = terms.map((t) => ({
      searchText: { contains: t },
    }));
    or.push({ title: { contains: q } });
    and.push({ OR: or });
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
      ...PUBLIC_WHERE,
      categoryId,
      NOT: { id: materialId },
    },
    orderBy: { plays: 'desc' },
    take,
    select: cardSelect,
  });
}

// Distinct city / year / language values for filter dropdowns.
export async function getFilterFacets() {
  const rows = await prisma.material.findMany({
    where: PUBLIC_WHERE,
    select: { city: true, language: true, recordDate: true },
  });
  const cities = Array.from(
    new Set(rows.map((r) => r.city).filter(Boolean) as string[]),
  ).sort();
  const languages = Array.from(
    new Set(rows.map((r) => r.language).filter(Boolean) as string[]),
  ).sort();
  const years = Array.from(
    new Set(
      rows
        .map((r) => (r.recordDate ? r.recordDate.getFullYear() : null))
        .filter(Boolean) as number[],
    ),
  ).sort((a, b) => b - a);
  return { cities, languages, years };
}

// Lightweight autocomplete suggestions for the search box.
export async function getSuggestions(q: string, take = 6) {
  const norm = normalizeArabic(q);
  if (norm.length < 2) return [];
  const rows = await prisma.material.findMany({
    where: { ...PUBLIC_WHERE, searchText: { contains: norm } },
    orderBy: { plays: 'desc' },
    take,
    select: { id: true, title: true, performer: true, speaker: true, category: { select: { name: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    subtitle: r.performer || r.speaker || r.category?.name || '',
  }));
}
