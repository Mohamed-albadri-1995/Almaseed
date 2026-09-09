export interface FieldDef {
  name: string;
  label: string;
  type?: 'text' | 'textarea' | 'date';
  hint?: string;
  required?: boolean;
}

export interface CategoryForm {
  titleLabel: string;
  subtitleLabel: string;
  fields: FieldDef[];
  file: 'required' | 'optional';
  accept: string;
  article: boolean;
  cover?: boolean;
}

const AUDIO = '.mp3,.wav,.m4a,.ogg';
const VIDEO = '.mp4,.mov,.webm';
const MEDIA = `${AUDIO},${VIDEO}`;
const IMAGES = '.jpg,.jpeg,.png,.webp';
const DOCS = '.pdf,.doc,.docx';
const ALL = `${MEDIA},${DOCS},${IMAGES}`;

const COMMON_OPTIONAL: FieldDef[] = [
  { name: 'city', label: 'المكان أو المدينة' },
  { name: 'recordDate', label: 'التاريخ', type: 'date' },
  { name: 'description', label: 'الوصف', type: 'textarea' },
];

export const CATEGORY_FORMS: Record<string, CategoryForm> = {
  madeeh: {
    titleLabel: 'اسم المدحة', subtitleLabel: 'عنوان فرعي (اختياري)', file: 'optional', accept: ALL, article: true,
    fields: [
      { name: 'performer', label: 'اسم المادح', required: true },
      { name: 'narrator', label: 'اسم الراوي', required: true },
      { name: 'occasion', label: 'المناسبة' },
      ...COMMON_OPTIONAL,
      { name: 'lyrics', label: 'كلمات المدحة', type: 'textarea' },
    ],
  },
  lectures: {
    titleLabel: 'عنوان المحاضرة', subtitleLabel: 'عنوان فرعي (اختياري)', file: 'optional', accept: ALL, article: true,
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
    titleLabel: 'عنوان الموعظة', subtitleLabel: 'عنوان فرعي (اختياري)', file: 'optional', accept: ALL, article: true,
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
    titleLabel: 'عنوان الندوة', subtitleLabel: 'عنوان فرعي (اختياري)', file: 'optional', accept: ALL, article: true,
    fields: [
      { name: 'topic', label: 'موضوع الندوة', required: true },
      { name: 'occasion', label: 'اسم الندوة أو المناسبة' },
      { name: 'participants', label: 'أسماء المتحدثين', hint: 'افصل بينها بفاصلة' },
      { name: 'host', label: 'مدير الندوة' },
      ...COMMON_OPTIONAL,
    ],
  },
  occasions: {
    titleLabel: 'اسم المناسبة', subtitleLabel: 'عنوان فرعي (اختياري)', file: 'optional', accept: ALL, article: true,
    fields: [
      { name: 'occasion', label: 'اسم المناسبة', required: true },
      { name: 'organizer', label: 'الجهة المنظمة' },
      { name: 'participants', label: 'أسماء المشاركين', hint: 'افصل بينها بفاصلة' },
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
    titleLabel: 'عنوان الكتاب', subtitleLabel: 'عنوان فرعي (اختياري)', file: 'optional', accept: ALL, article: true,
    fields: [
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
