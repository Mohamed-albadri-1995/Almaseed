// Name matching for the app's submit form — a straight port of the website's
// src/lib/search.ts normalizeArabic + src/lib/names.ts nameKey. Keep in sync:
// two spellings of one person («شيخ إبراهيم دنقول» / «الشيخ ابراهيم دنقول»)
// must produce the same key here and on the server.

export function normalizeArabic(input) {
  if (!input) return '';
  let s = String(input);
  // Hermes without full Intl may lack normalize(); the replacements below
  // still unify the alef/hamza forms, so this is only a best-effort step.
  try { s = s.normalize('NFKD'); } catch {}
  return s
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

const TITLES = [
  'الشيخ', 'شيخ', 'الخليفه', 'خليفه', 'المقدم', 'مقدم', 'الاستاذ', 'استاذ',
  'السيد', 'سيدي', 'الحاج', 'حاج', 'مولانا', 'ابونا', 'الشاعر', 'المادح',
  'الدكتور', 'دكتور', 'د',
];

export function nameKey(value) {
  let s = normalizeArabic(value)
    .replace(/[()\[\]{}«»"'`.,،؛:!?؟\-_/\\|*]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  // Strip leading titles (repeatedly: «الخليفة الشيخ …»), but never the whole name.
  for (let changed = true; changed; ) {
    changed = false;
    for (const t of TITLES) {
      if (s.startsWith(t + ' ') && s.length > t.length + 1) {
        s = s.slice(t.length + 1).trim();
        changed = true;
      }
    }
  }
  return s;
}

// Existing names containing what was typed (by normalized text), best first.
export function matchSuggestions(list, typed, max = 5) {
  const q = normalizeArabic(typed);
  if (!q || !list || !list.length) return [];
  const starts = [], contains = [];
  for (const s of list) {
    const n = normalizeArabic(s);
    if (n === q) continue;
    if (n.startsWith(q)) starts.push(s); else if (n.includes(q)) contains.push(s);
    if (starts.length >= max) break;
  }
  return starts.concat(contains).slice(0, max);
}

// The archive's spelling of the same person, if what was typed is only a variant.
export function variantOf(list, typed) {
  const v = (typed || '').trim();
  if (!v || !list) return null;
  const k = nameKey(v);
  if (!k) return null;
  for (const s of list) if (s !== v && nameKey(s) === k) return s;
  return null;
}
