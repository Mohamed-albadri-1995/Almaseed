// Arabic-aware text normalization and search helpers.

// Remove diacritics (tashkeel), tatweel, unify alef/hamza/ya/ta-marbuta so
// that "المُدَّاح" ~ "المداح" ~ "مداح" all match.
export function normalizeArabic(input?: string | null): string {
  if (!input) return '';
  return input
    .normalize('NFKD')
    .replace(/[ؐ-ًؚ-ٰٟۖ-ۭ]/g, '') // tashkeel
    .replace(/ـ/g, '') // tatweel ـ
    .replace(/[آأإٱ]/g, 'ا') // آ أ إ ٱ -> ا
    .replace(/ى/g, 'ي') // ى -> ي
    .replace(/ة/g, 'ه') // ة -> ه
    .replace(/ؤ/g, 'و') // ؤ -> و
    .replace(/ئ/g, 'ي') // ئ -> ي
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// Build the normalized haystack stored on each material.
export function buildSearchText(m: {
  title?: string | null;
  subtitle?: string | null;
  bodyText?: string | null;
  performer?: string | null;
  narrator?: string | null;
  speaker?: string | null;
  host?: string | null;
  participants?: string | null;
  occasion?: string | null;
  topic?: string | null;
  place?: string | null;
  city?: string | null;
  organizer?: string | null;
  author?: string | null;
  source?: string | null;
  keywords?: string | null;
  description?: string | null;
  summary?: string | null;
}): string {
  return normalizeArabic(
    [
      m.title,
      m.subtitle,
      m.bodyText,
      m.performer,
      m.narrator,
      m.speaker,
      m.host,
      m.participants,
      m.occasion,
      m.topic,
      m.place,
      m.city,
      m.organizer,
      m.author,
      m.source,
      m.keywords,
      m.description,
      m.summary,
    ]
      .filter(Boolean)
      .join(' '),
  );
}

// Synonym groups — searching any word expands to the others.
const SYNONYMS: string[][] = [
  ['محاضره', 'درس', 'موعظه', 'كلمه', 'خطبه'],
  ['مدحه', 'انشاد', 'نشيد', 'قصيده'],
  ['ندوه', 'لقاء', 'حوار', 'مجلس'],
  ['مناسبه', 'احتفال', 'حفل', 'ذكرى'],
];

// Given a normalized query, return the query terms plus any synonyms.
export function expandSynonyms(normalizedQuery: string): string[] {
  const terms = new Set<string>();
  const words = normalizedQuery.split(' ').filter(Boolean);
  for (const w of words) {
    terms.add(w);
    for (const group of SYNONYMS) {
      if (group.includes(w)) group.forEach((g) => terms.add(g));
    }
  }
  return Array.from(terms);
}
