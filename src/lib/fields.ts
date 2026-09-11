import type { FileKind } from './constants';
import { DOC_TYPES } from './constants';

export interface FieldDef {
  name: string;
  label: string;
  type?: 'text' | 'textarea' | 'date' | 'select';
  hint?: string;
  required?: boolean;
  options?: readonly { value: string; label: string }[];
}

export interface CategoryForm {
  titleLabel: string;
  subtitleLabel: string;
  fields: FieldDef[];
  file: 'required' | 'optional';
  accept: string;
  article: boolean;
  cover?: boolean;
  /** Show in-app recording (studio) options alongside the file manager. */
  capture?: boolean;
  /** Allowed uploaded file kinds; undefined = all kinds allowed. */
  kinds?: FileKind[];
}

const AUDIO = '.mp3,.wav,.m4a,.ogg,.aac,.opus,.amr,.oga,.weba';
const VIDEO = '.mp4,.mov,.webm,.m4v,.3gp,.mkv';
const MEDIA = `${AUDIO},${VIDEO}`;
const IMAGES = '.jpg,.jpeg,.png,.webp';
const DOCS = '.pdf,.doc,.docx';
const ALL = `${MEDIA},${DOCS},${IMAGES}`;
// Audio + video only — EXTENSIONS ONLY (no `audio/*,video/*` MIME wildcards):
// on Android the wildcards make the picker open the media chooser
// (camera / recorder / gallery) and hide the file manager. Listing extensions
// opens the Files/Documents app; the studio (record) buttons are separate.
const MEDIA_ONLY = MEDIA;

const COMMON_OPTIONAL: FieldDef[] = [
  { name: 'city', label: 'المكان أو المدينة' },
  { name: 'recordDate', label: 'التاريخ', type: 'date' },
  { name: 'description', label: 'الوصف', type: 'textarea' },
];

export const CATEGORY_FORMS: Record<string, CategoryForm> = {
  madeeh: {
    titleLabel: 'اسم المدحة', subtitleLabel: 'عنوان فرعي (اختياري)', file: 'required', accept: MEDIA_ONLY, article: false, capture: true, kinds: ['AUDIO', 'VIDEO'],
    fields: [
      { name: 'performer', label: 'اسم المادح', required: true },
      { name: 'narrator', label: 'اسم الراوي', required: true },
      { name: 'occasion', label: 'المناسبة' },
      ...COMMON_OPTIONAL,
      { name: 'lyrics', label: 'كلمات المدحة', type: 'textarea' },
    ],
  },
  lectures: {
    titleLabel: 'عنوان المحاضرة', subtitleLabel: 'عنوان فرعي (اختياري)', file: 'required', accept: MEDIA_ONLY, article: false, capture: true, kinds: ['AUDIO', 'VIDEO'],
    fields: [
      { name: 'speaker', label: 'اسم المحاضر', required: true },
      { name: 'topic', label: 'الموضوع' },
      { name: 'occasion', label: 'المناسبة' },
      ...COMMON_OPTIONAL,
      { name: 'summary', label: 'ملخص المحاضرة', type: 'textarea' },
      { name: 'keywords', label: 'الكلمات المفتاحية', hint: 'افصل بينها بفاصلة' },
    ],
  },
  sermons: {
    titleLabel: 'عنوان الموعظة', subtitleLabel: 'عنوان فرعي (اختياري)', file: 'required', accept: MEDIA_ONLY, article: false, capture: true, kinds: ['AUDIO', 'VIDEO'],
    fields: [
      { name: 'speaker', label: 'اسم الواعظ', required: true },
      { name: 'topic', label: 'الموضوع' },
      { name: 'occasion', label: 'المناسبة' },
      ...COMMON_OPTIONAL,
      { name: 'summary', label: 'ملخص الموعظة', type: 'textarea' },
      { name: 'keywords', label: 'الكلمات المفتاحية', hint: 'افصل بينها بفاصلة' },
    ],
  },
  seminars: {
    titleLabel: 'عنوان الندوة', subtitleLabel: 'عنوان فرعي (اختياري)', file: 'required', accept: MEDIA_ONLY, article: false, capture: true, kinds: ['AUDIO', 'VIDEO'],
    fields: [
      { name: 'topic', label: 'موضوع الندوة', required: true },
      { name: 'participants', label: 'أسماء المتحدثين', hint: 'افصل بين الأسماء بفاصلة' },
      { name: 'host', label: 'مدير الندوة' },
      { name: 'occasion', label: 'المناسبة المرتبطة', hint: 'اختياري' },
      ...COMMON_OPTIONAL,
    ],
  },
  occasions: {
    // The title IS the occasion's name (titleLabel below), so we don't ask for
    // it again as a separate field.
    titleLabel: 'اسم المناسبة', subtitleLabel: 'عنوان فرعي (اختياري)', file: 'required', accept: MEDIA_ONLY, article: false, capture: true, kinds: ['AUDIO', 'VIDEO'],
    fields: [
      { name: 'organizer', label: 'الجهة المنظمة' },
      { name: 'participants', label: 'أسماء المشاركين', hint: 'افصل بين الأسماء بفاصلة' },
      ...COMMON_OPTIONAL,
    ],
  },
  images: {
    titleLabel: 'عنوان الصورة', subtitleLabel: 'عنوان فرعي (اختياري)', file: 'required', accept: IMAGES, article: false, cover: false,
    fields: [
      { name: 'description', label: 'وصف الصورة', type: 'textarea', required: true },
      { name: 'occasion', label: 'المناسبة' },
      ...COMMON_OPTIONAL.filter((f) => f.name !== 'description'),
    ],
  },
  readings: {
    titleLabel: 'عنوان المادة', subtitleLabel: 'عنوان فرعي (اختياري)', file: 'optional', accept: ALL, article: true,
    fields: [
      { name: 'docType', label: 'نوع المادة المكتوبة', type: 'select', required: true, options: DOC_TYPES, hint: 'يُستخدم لتسهيل البحث والفرز' },
      { name: 'author', label: 'الكاتب / المؤلف', required: true },
      { name: 'source', label: 'المصدر', hint: 'اختياري، إذا كان الكتاب منقولاً أو من مصدر محدد' },
      { name: 'topic', label: 'الموضوع' },
      { name: 'occasion', label: 'المناسبة' },
      ...COMMON_OPTIONAL,
    ],
  },
};

export function getCategoryForm(slug: string): CategoryForm | null {
  return CATEGORY_FORMS[slug] ?? null;
}

// Whether an uploaded file of the given kind is allowed for a category.
// Categories without an explicit `kinds` list accept every kind.
export function isFileKindAllowed(slug: string, kind?: string | null): boolean {
  const kinds = CATEGORY_FORMS[slug]?.kinds;
  if (!kinds) return true;
  return !!kind && kinds.includes(kind as FileKind);
}

// Fields rendered as their own full-width sections on the detail page, so they
// must NOT be repeated inside the compact "معلومات المادة" info table.
const SECTION_FIELDS = new Set(['description', 'summary', 'lyrics', 'bodyText', 'keywords']);

// The short, type-specific fields that belong in the info table for a given
// category — driven entirely by the category form, so a book never shows
// «المحاضر» and a madeeh never shows «الكاتب».
export function getInfoFields(slug: string): FieldDef[] {
  const form = CATEGORY_FORMS[slug];
  if (!form) return [];
  return form.fields.filter((f) => !SECTION_FIELDS.has(f.name) && f.type !== 'textarea' && f.type !== 'select');
}

// The single "headline" person/author shown under the title, chosen per type.
const PRIMARY_PERSON: Record<string, { field: string; label: string }> = {
  madeeh: { field: 'performer', label: 'المادح' },
  lectures: { field: 'speaker', label: 'المحاضر' },
  sermons: { field: 'speaker', label: 'الواعظ' },
  seminars: { field: 'host', label: 'مدير الندوة' },
  occasions: { field: 'organizer', label: 'الجهة المنظمة' },
  readings: { field: 'author', label: 'الكاتب' },
};

export function getPrimaryPerson(slug: string): { field: string; label: string } | null {
  return PRIMARY_PERSON[slug] ?? null;
}
