import { normalizeArabic } from './search';

// Name identity for people/occasions entered as free text. The same person is
// often typed several ways — «شيخ إبراهيم دنقول», «الشيخ ابراهيم دنقول»,
// «شيخ إبراهيم(دنقول)» — so compare names by a KEY that ignores spelling
// variants (hamza/alef, ى/ي, ة/ه, tashkeel), brackets/punctuation, and a leading
// honorific. Two names with the same key are treated as one.
//
// Only generic leading titles are dropped. «الشريف» is deliberately kept: in
// this archive it is part of how people are named (أحمد الشريف هارون), and
// dropping it would wrongly merge different people.
const TITLES = [
  'الشيخ', 'شيخ', 'الخليفه', 'خليفه', 'المقدم', 'مقدم', 'الاستاذ', 'استاذ',
  'السيد', 'سيدي', 'الحاج', 'حاج', 'مولانا', 'ابونا', 'الشاعر', 'المادح',
  'الدكتور', 'دكتور', 'د',
];

export function nameKey(value?: string | null): string {
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

// Identity of a name: its key with spaces removed too, so a missing or extra
// space («محمدإبراهيم» / «محمد إبراهيم», «عبدالله» / «عبد الله») is the same name.
export function nameId(value?: string | null): string {
  return nameKey(value).replace(/ /g, '');
}

export interface NameGroup { key: string; names: { name: string; count: number }[]; total: number }

// Group raw values by nameKey. Each group's names are sorted most-used first,
// so names[0] is the natural display/canonical spelling.
export function groupNames(values: (string | null | undefined)[]): NameGroup[] {
  const byKey = new Map<string, Map<string, number>>();
  for (const v of values) {
    const name = (v || '').trim();
    if (!name) continue;
    const id = nameId(name) || name;
    let m = byKey.get(id);
    if (!m) { m = new Map(); byKey.set(id, m); }
    m.set(name, (m.get(name) ?? 0) + 1);
  }
  return Array.from(byKey.values()).map((m) => {
    const names = Array.from(m.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.length - b.name.length || a.name.localeCompare(b.name, 'ar'));
    // The (spaced) key of the most-used spelling, for the looser word checks.
    return { key: nameKey(names[0].name) || names[0].name, names, total: names.reduce((s, n) => s + n.count, 0) };
  });
}

// Looser "probably the same" check for the admin review list: one key's words
// contained in the other's (e.g. «ابراهيم دنقول» ⊂ «الشريف ابراهيم دنقول»), or
// a tiny edit distance (typos such as «البشير و سعيد» / «البشير ود سعيد»).
export function looksSimilar(a: string, b: string): boolean {
  if (a === b) return true;
  const wa = a.split(' '), wb = b.split(' ');
  const [short, long] = wa.length <= wb.length ? [wa, wb] : [wb, wa];
  if (short.length >= 2 && short.every((w) => long.includes(w))) return true;
  const max = Math.max(a.length, b.length);
  if (max < 6) return false;
  return editDistance(a, b, 2) <= (max >= 12 ? 2 : 1);
}

function editDistance(a: string, b: string, cap: number): number {
  if (Math.abs(a.length - b.length) > cap) return cap + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      rowMin = Math.min(rowMin, cur[j]);
    }
    if (rowMin > cap) return cap + 1;
    prev = cur;
  }
  return prev[b.length];
}
