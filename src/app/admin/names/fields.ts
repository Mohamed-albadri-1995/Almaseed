import { CATEGORY_FORMS } from '@/lib/fields';

// Free-text name fields the «توحيد الأسماء» tool can clean up.
export const NAME_KEYS = ['performer', 'narrator', 'speaker', 'author', 'occasion', 'organizer', 'topic', 'source', 'city'] as const;
export type NameField = (typeof NAME_KEYS)[number];

export function isNameField(k: string): k is NameField {
  return (NAME_KEYS as readonly string[]).includes(k);
}

// Across all sections: one tab per field, labelled for every section using it.
const ALL_FIELDS: { key: NameField; label: string }[] = [
  { key: 'performer', label: 'المادح' },
  { key: 'narrator', label: 'الراوي' },
  { key: 'speaker', label: 'المحاضر / الواعظ / المتحدث' },
  { key: 'author', label: 'الكاتب / المؤلف' },
  { key: 'occasion', label: 'المناسبة' },
  { key: 'organizer', label: 'الجهة المنظمة' },
  { key: 'topic', label: 'الموضوع' },
  { key: 'source', label: 'المصدر' },
  { key: 'city', label: 'المكان أو المدينة' },
];

// The tabs for one section come from that section's CURRENT form (same labels
// contributors see — e.g. «المتحدث» in أرشيف النوادر, «اسم الواعظ» in المواعظ),
// so the tool follows any change to a section's fields automatically.
export function fieldsFor(section?: string | null): { key: NameField; label: string }[] {
  const form = section ? CATEGORY_FORMS[section] : null;
  if (!form) return ALL_FIELDS;
  return form.fields
    .filter((f) => isNameField(f.name) && f.type !== 'textarea' && f.type !== 'select' && f.type !== 'date')
    .map((f) => ({ key: f.name as NameField, label: f.label.replace(/^اسم\s+/, '') }));
}
