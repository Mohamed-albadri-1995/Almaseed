// Single source of truth for which fields belong to each category. Used by the
// public submit form AND the admin edit/review form so both stay accurate and
// never show irrelevant fields (e.g. "المادح" under محاضرات).

export interface FieldDef {
  name: string; // maps to a Material column
  label: string;
  type?: 'text' | 'textarea' | 'date';
  hint?: string;
  canBeUnknown?: boolean; // submit form shows a "لا أعلم" toggle
}

export interface CategoryForm {
  titleLabel: string;
  subtitleLabel: string; // every category has an optional subtitle
  fields: FieldDef[]; // excludes title & subtitle (handled separately)
  file: 'required' | 'optional'; // whether an uploaded file is required
  accept: string; // <input accept> for the file
  article: boolean; // supports a typed article body (bodyText)
  cover?: boolean; // offer a separate cover image; defaults to true. Set false
                   // when the uploaded file IS an image (e.g. الصور).
}

const MEDIA = '.mp3,.wav,.m4a,.ogg,.mp4,.mov,.webm';
const IMAGES = '.jpg,.jpeg,.png,.webp';
const DOCS = '.pdf,.doc,.docx';

export const CATEGORY_FORMS: Record<string, CategoryForm> = {
  madeeh: {
    titleLabel: 'اسم المدحة',
    subtitleLabel: 'عنوان فرعي (اختياري)',
    file: 'required',
    accept: MEDIA,
    article: false,
    fields: [
      { name: 'performer', label: 'اسم المادح', canBeUnknown: true },
      { name: 'narrator', label: 'اسم الراوي', canBeUnknown: true },
      { name: 'occasion', label: 'المناسبة', canBeUnknown: true },
      { name: 'city', label: 'المكان أو المدينة', hint: 'المسيد أو المسجد أو المدينة', canBeUnknown: true },
      { name: 'recordDate', label: 'تاريخ التسجيل', type: 'date', canBeUnknown: true },
      { name: 'description', label: 'وصف مختصر', type: 'textarea', canBeUnknown: true },
      { name: 'lyrics', label: 'كلمات المدحة', type: 'textarea', canBeUnknown: true },
    ],
  },
  lectures: {
    titleLabel: 'عنوان المحاضرة',
    subtitleLabel: 'عنوان فرعي (اختياري)',
    file: 'required',
    accept: MEDIA,
    article: false,
    fields: [
      { name: 'speaker', label: 'اسم المحاضر', canBeUnknown: true },
      { name: 'host', label: 'مقدم البرنامج', canBeUnknown: true },
      { name: 'topic', label: 'الموضوع', canBeUnknown: true },
      { name: 'occasion', label: 'المناسبة', canBeUnknown: true },
      { name: 'city', label: 'المكان أو المدينة', canBeUnknown: true },
      { name: 'recordDate', label: 'التاريخ', type: 'date', canBeUnknown: true },
      { name: 'summary', label: 'ملخص المحاضرة', type: 'textarea', canBeUnknown: true },
      { name: 'keywords', label: 'الكلمات المفتاحية', hint: 'افصل بينها بفاصلة', canBeUnknown: true },
    ],
  },
  sermons: {
    titleLabel: 'عنوان الموعظة',
    subtitleLabel: 'عنوان فرعي (اختياري)',
    file: 'required',
    accept: MEDIA,
    article: false,
    fields: [
      { name: 'speaker', label: 'اسم الواعظ', canBeUnknown: true },
      { name: 'topic', label: 'الموضوع', canBeUnknown: true },
      { name: 'occasion', label: 'المناسبة', canBeUnknown: true },
      { name: 'city', label: 'المكان أو المدينة', canBeUnknown: true },
      { name: 'recordDate', label: 'التاريخ', type: 'date', canBeUnknown: true },
      { name: 'summary', label: 'ملخص الموعظة', type: 'textarea', canBeUnknown: true },
      { name: 'keywords', label: 'الكلمات المفتاحية', hint: 'افصل بينها بفاصلة', canBeUnknown: true },
    ],
  },
  seminars: {
    titleLabel: 'عنوان الندوة',
    subtitleLabel: 'عنوان فرعي (اختياري)',
    file: 'required',
    accept: MEDIA,
    article: false,
    fields: [
      { name: 'topic', label: 'موضوع الندوة', canBeUnknown: true },
      { name: 'occasion', label: 'اسم الندوة أو المناسبة', canBeUnknown: true },
      { name: 'participants', label: 'أسماء المتحدثين', hint: 'افصل بينها بفاصلة', canBeUnknown: true },
      { name: 'host', label: 'مدير الندوة', canBeUnknown: true },
      { name: 'city', label: 'المكان أو المدينة', canBeUnknown: true },
      { name: 'recordDate', label: 'التاريخ', type: 'date', canBeUnknown: true },
      { name: 'description', label: 'وصف الندوة', type: 'textarea', canBeUnknown: true },
    ],
  },
  occasions: {
    titleLabel: 'اسم المناسبة',
    subtitleLabel: 'عنوان فرعي (اختياري)',
    file: 'required',
    accept: MEDIA + ',' + IMAGES,
    article: false,
    fields: [
      { name: 'occasion', label: 'نوع المناسبة', canBeUnknown: true },
      { name: 'organizer', label: 'الجهة المنظمة', canBeUnknown: true },
      { name: 'participants', label: 'أسماء المشاركين', hint: 'افصل بينها بفاصلة', canBeUnknown: true },
      { name: 'city', label: 'المكان أو المدينة', canBeUnknown: true },
      { name: 'recordDate', label: 'التاريخ', type: 'date', canBeUnknown: true },
      { name: 'description', label: 'وصف المناسبة', type: 'textarea', canBeUnknown: true },
    ],
  },
  images: {
    titleLabel: 'عنوان الصورة',
    subtitleLabel: 'عنوان فرعي (اختياري)',
    file: 'required',
    accept: IMAGES,
    article: false,
    cover: false, // the uploaded file is itself the image — no separate cover
    fields: [
      { name: 'occasion', label: 'المناسبة', canBeUnknown: true },
      { name: 'city', label: 'المكان أو المدينة', canBeUnknown: true },
      { name: 'recordDate', label: 'التاريخ', type: 'date', canBeUnknown: true },
      { name: 'description', label: 'وصف الصورة', type: 'textarea', canBeUnknown: true },
    ],
  },
  readings: {
    titleLabel: 'عنوان المادة المقروءة',
    subtitleLabel: 'عنوان فرعي (اختياري)',
    file: 'optional', // may upload a file OR write an article
    accept: DOCS + ',' + IMAGES,
    article: true,
    fields: [
      { name: 'speaker', label: 'الكاتب أو المؤلف', canBeUnknown: true },
      { name: 'topic', label: 'الموضوع', canBeUnknown: true },
      { name: 'occasion', label: 'المناسبة', canBeUnknown: true },
      { name: 'city', label: 'المكان أو المصدر', canBeUnknown: true },
      { name: 'recordDate', label: 'التاريخ', type: 'date', canBeUnknown: true },
      { name: 'description', label: 'نبذة مختصرة', type: 'textarea', canBeUnknown: true },
    ],
  },
};

export function getCategoryForm(slug: string): CategoryForm | null {
  return CATEGORY_FORMS[slug] ?? null;
}
