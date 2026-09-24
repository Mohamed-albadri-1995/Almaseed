import { prisma } from './prisma';
import { groupNames, nameKey } from './names';
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
  organizer: true,
  author: true,
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
  /** True when this looks like the very same file (same URL, or same size+duration). */
  exactFile: boolean;
  /** Media so the reviewer can play/view the suspected duplicate side by side. */
  fileUrl: string | null;
  fileKind: string | null;
  fileType: string | null;
  coverImage: string | null;
}

export async function getSimilarMaterials(m: {
  id: string;
  title: string;
  searchText?: string | null;
  fileUrl?: string | null;
  fileSize?: number | null;
  durationSec?: number | null;
  performer?: string | null;
  speaker?: string | null;
}): Promise<SimilarMaterial[]> {
  const normTitle = normalizeArabic(m.title || '');
  const or: Prisma.MaterialWhereInput[] = [{ title: { contains: m.title } }];
  if (normTitle) or.push({ searchText: { contains: normTitle } });
  if (m.fileUrl) or.push({ fileUrl: m.fileUrl });
  if (m.fileSize) or.push({ fileSize: m.fileSize });
  if (m.performer) or.push({ performer: m.performer });
  if (m.speaker) or.push({ speaker: m.speaker });

  const rows = await prisma.material.findMany({
    where: { id: { not: m.id }, OR: or },
    orderBy: { createdAt: 'desc' },
    take: 6,
    select: {
      id: true, title: true, status: true, fileSize: true, durationSec: true,
      performer: true, speaker: true, publishedAt: true, searchText: true, fileUrl: true,
      fileKind: true, fileType: true, coverImage: true,
      category: { select: { name: true } },
    },
  });

  const scored = rows.map((r) => {
    const reasons: string[] = [];
    // Strongest first: the same stored file, then identical size AND duration.
    const sameUrl = !!m.fileUrl && r.fileUrl === m.fileUrl;
    const sameSizeDur = !!m.fileSize && !!m.durationSec && r.fileSize === m.fileSize && r.durationSec === m.durationSec;
    const exactFile = sameUrl || sameSizeDur;
    if (sameUrl) reasons.push('نفس الملف تمامًا');
    else if (sameSizeDur) reasons.push('نفس الحجم والمدة');
    else if (m.fileSize && r.fileSize === m.fileSize) reasons.push('نفس حجم الملف');
    if (normTitle && r.searchText && r.searchText.includes(normTitle)) reasons.push('تطابق العنوان');
    else if (r.title === m.title) reasons.push('نفس العنوان');
    if (m.performer && r.performer === m.performer) reasons.push('نفس المادح');
    if (m.speaker && r.speaker === m.speaker) reasons.push('نفس المحاضر');
    if (reasons.length === 0) reasons.push('عنوان مشابه');
    // Keep fileUrl now — the reviewer needs it to play/view the duplicate.
    const { searchText: _omit, ...rest } = r;
    void _omit;
    return { ...rest, reasons, exactFile };
  });
  // Show exact-file matches first so the reviewer sees the strongest signal.
  return scored.sort((a, b) => Number(b.exactFile) - Number(a.exactFile));
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
  docType?: string;
  city?: string;
  person?: string;
  occasion?: string;
  year?: string;
  language?: string;
  sort?: string;
  page?: number;
  perPage?: number;
  // Per-category facet filters, matched exactly against their own field.
  facets?: Partial<Record<'performer' | 'narrator' | 'speaker' | 'topic' | 'host' | 'organizer' | 'author', string>>;
}

export async function searchMaterials(filters: ArchiveFilters) {
  const {
    categorySlug,
    q,
    fileKind,
    docType,
    city,
    person,
    occasion,
    year,
    language,
    facets,
    sort = 'newest',
    page = 1,
    perPage = 12,
  } = filters;

  const where: Prisma.MaterialWhereInput = { ...PUBLIC_WHERE };

  if (categorySlug) where.category = { slug: categorySlug };
  // Category-specific facets: an exact match on the field itself (the value
  // came from that category's distinct-value list), so مديح filters by المادح,
  // محاضرات by المحاضر/الموضوع, and so on.
  // Spelling variants of the chosen name («شيخ إبراهيم دنقول» / «الشيخ ابراهيم
  // دنقول») are included too, so one person's materials show together.
  if (facets) {
    for (const key of ['performer', 'narrator', 'speaker', 'topic', 'host', 'organizer', 'author'] as const) {
      const v = facets[key];
      if (!v) continue;
      const k = nameKey(v);
      const used = await prisma.material.findMany({
        where: { ...PUBLIC_WHERE, [key]: { not: null } },
        select: { [key]: true },
        distinct: [key],
      }) as unknown as Record<string, string | null>[];
      const variants = Array.from(new Set([v, ...used.map((r) => r[key] || '').filter((x) => x && nameKey(x) === k)]));
      (where as Record<string, unknown>)[key] = { in: variants };
    }
  }
  // «مقال» = a written material with NO file — the same definition used for the
  // card badge (isWritten = !fileUrl). Keying off bodyText was wrong: an audio
  // sermon that also has body text leaked into the «مقالات» filter.
  //
  // The reverse also happened: a written material (no file) can carry a stray
  // fileKind (e.g. a legacy written madeeh saved with fileKind=AUDIO), which
  // leaked into the «صوتيات»/«مرئيات» filters and showed there badged «مقال».
  // A media filter must therefore also require an actual file, so every
  // fileless material is treated as an article everywhere — matching the badge.
  if (fileKind === 'ARTICLE') where.fileUrl = null;
  else if (fileKind) {
    where.fileKind = fileKind;
    where.fileUrl = { not: null };
  }
  if (docType) where.docType = docType;
  if (city) where.city = { contains: city };
  if (language) where.language = language;
  if (occasion) where.occasion = { contains: occasion };
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
    // The "person" filter matches whichever person field is relevant — the
    // label shown to the user adapts to the chosen type, but the query stays
    // broad so a name is found wherever it was stored.
    and.push({
      OR: [
        { performer: { contains: person } },
        { speaker: { contains: person } },
        { narrator: { contains: person } },
        { host: { contains: person } },
        { author: { contains: person } },
        { organizer: { contains: person } },
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

// Distinct filter values for the dropdowns. When a category is given, the
// per-field facets (المادح، الراوي، الموضوع، …) are scoped to that category so
// each section filters by its OWN fields; otherwise only the shared
// city/year/language facets are meaningful.
export async function getFilterFacets(categorySlug?: string) {
  const where: Prisma.MaterialWhereInput = categorySlug
    ? { ...PUBLIC_WHERE, category: { slug: categorySlug } }
    : PUBLIC_WHERE;
  const rows = await prisma.material.findMany({
    where,
    select: {
      city: true, language: true, recordDate: true,
      performer: true, narrator: true, speaker: true, topic: true,
      host: true, organizer: true, author: true, occasion: true,
    },
  });
  const distinct = (vals: (string | null)[]) =>
    Array.from(new Set(vals.filter((v): v is string => !!v && v.trim().length > 0).map((v) => v.trim()))).sort((a, b) => a.localeCompare(b, 'ar'));
  // Name fields: one entry per person (variants collapse to the most-used spelling).
  const people = (vals: (string | null)[]) =>
    groupNames(vals).map((g) => g.names[0].name).sort((a, b) => a.localeCompare(b, 'ar'));
  const cities = distinct(rows.map((r) => r.city));
  const languages = distinct(rows.map((r) => r.language));
  const years = Array.from(
    new Set(
      rows
        .map((r) => (r.recordDate ? r.recordDate.getFullYear() : null))
        .filter(Boolean) as number[],
    ),
  ).sort((a, b) => b - a);
  // Per-field distinct values, keyed by field name so the page can render a
  // dropdown for whichever facet fields the selected category defines.
  const fields: Record<string, string[]> = {
    performer: people(rows.map((r) => r.performer)),
    narrator: people(rows.map((r) => r.narrator)),
    speaker: people(rows.map((r) => r.speaker)),
    topic: people(rows.map((r) => r.topic)),
    host: people(rows.map((r) => r.host)),
    organizer: people(rows.map((r) => r.organizer)),
    author: people(rows.map((r) => r.author)),
    occasion: people(rows.map((r) => r.occasion)),
  };
  return { cities, languages, years, fields };
}

// Distinct occasion names already used in the archive — for the «المناسبة»
// choose-or-add list on the submit/edit forms (published + unpublished, so a
// contributor sees occasions others have entered even before publishing).
export async function getOccasions(): Promise<string[]> {
  const rows = await prisma.material.findMany({
    where: { occasion: { not: null } },
    select: { occasion: true },
    distinct: ['occasion'],
  });
  return groupNames(rows.map((r) => r.occasion))
    .map((g) => g.names[0].name)
    .sort((a, b) => a.localeCompare(b, 'ar'));
}

// Distinct values already used for each name/text field, so EVERY form field can
// suggest what's already in the archive (choose-or-add). This is what keeps the
// same person from being entered under slight variants — «أحمد الشريف هارون» vs
// «الشريف أحمد الشريف هارون». Scanned across all materials (published or not).
const SUGGEST_FIELDS = ['performer', 'narrator', 'speaker', 'host', 'organizer', 'author', 'occasion', 'topic', 'city', 'place', 'source'] as const;
export type SuggestMap = Partial<Record<(typeof SUGGEST_FIELDS)[number], string[]>>;
export async function getFieldSuggestions(): Promise<SuggestMap> {
  const rows = await prisma.material.findMany({
    select: {
      performer: true, narrator: true, speaker: true, host: true, organizer: true,
      author: true, occasion: true, topic: true, city: true, place: true, source: true,
    },
  });
  const out: SuggestMap = {};
  for (const f of SUGGEST_FIELDS) {
    // One suggestion per person: variants collapse to their most-used spelling,
    // so the list itself stops offering duplicates to copy.
    const groups = groupNames(rows.map((r) => (r as Record<string, string | null>)[f]));
    if (groups.length) out[f] = groups.map((g) => g.names[0].name).sort((a, b) => a.localeCompare(b, 'ar'));
  }
  return out;
}

// Aggregate statistics for the review/admin stats page: totals, per-category
// breakdown (with distinct contributors), counts by file kind, and the ranked
// person/occasion tallies requested (المادح/الراوي/المحاضر, والمناسبات). Counts
// reflect the PUBLISHED archive — what's actually live on the site.
export interface RankedCount { name: string; count: number }
export async function getReviewStats() {
  const [categories, rows] = await Promise.all([
    prisma.category.findMany({ orderBy: { order: 'asc' }, select: { id: true, slug: true, name: true } }),
    prisma.material.findMany({
      where: PUBLIC_WHERE,
      select: {
        categoryId: true, submittedById: true,
        fileUrl: true, fileKind: true, fileType: true,
        performer: true, narrator: true, speaker: true, occasion: true,
        category: { select: { slug: true } },
      },
    }),
  ]);

  const total = rows.length;

  // Per-category: total count + distinct contributors in that category.
  const catContribs = new Map<string, Set<string>>();
  const catCount = new Map<string, number>();
  for (const r of rows) {
    catCount.set(r.categoryId, (catCount.get(r.categoryId) ?? 0) + 1);
    if (r.submittedById) {
      let s = catContribs.get(r.categoryId);
      if (!s) { s = new Set(); catContribs.set(r.categoryId, s); }
      s.add(r.submittedById);
    }
  }
  const perCategory = categories.map((c) => ({
    slug: c.slug,
    name: c.name,
    count: catCount.get(c.id) ?? 0,
    contributors: catContribs.get(c.id)?.size ?? 0,
  }));

  // Total distinct contributors across the whole published archive.
  const allContribs = new Set<string>();
  for (const r of rows) if (r.submittedById) allContribs.add(r.submittedById);
  const totalContributors = allContribs.size;

  // By file kind. «مكتوبة» = no file (an article); «PDF» = a document file whose
  // type/extension is pdf; the rest by fileKind.
  const isPdf = (r: { fileType: string | null; fileUrl: string | null }) =>
    (r.fileType || '').toLowerCase().includes('pdf') || /\.pdf(\?|$)/i.test(r.fileUrl || '');
  const byKind = { image: 0, video: 0, audio: 0, written: 0, pdf: 0 };
  for (const r of rows) {
    if (!r.fileUrl) { byKind.written += 1; continue; }
    if (isPdf(r)) { byKind.pdf += 1; continue; }
    if (r.fileKind === 'IMAGE') byKind.image += 1;
    else if (r.fileKind === 'VIDEO') byKind.video += 1;
    else if (r.fileKind === 'AUDIO') byKind.audio += 1;
    else byKind.written += 1; // a fileless/other written material
  }

  // Ranked tallies. A small helper counts non-empty values into a sorted list.
  // Spelling variants of one name («شيخ إبراهيم دنقول» / «الشيخ ابراهيم دنقول»)
  // are counted together under their most-used spelling.
  const rank = (vals: (string | null)[]): RankedCount[] =>
    groupNames(vals)
      .map((g) => ({ name: g.names[0].name, count: g.total }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ar'));

  const madeehRows = rows.filter((r) => r.category?.slug === 'madeeh');
  const lectureRows = rows.filter((r) => r.category?.slug === 'lectures');

  return {
    total,
    totalContributors,
    perCategory,
    byKind,
    madeehByPerformer: rank(madeehRows.map((r) => r.performer)),
    madeehByNarrator: rank(madeehRows.map((r) => r.narrator)),
    lecturesBySpeaker: rank(lectureRows.map((r) => r.speaker)),
    byOccasion: rank(rows.map((r) => r.occasion)),
  };
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
