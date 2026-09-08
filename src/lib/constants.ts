// Central definitions for enum-like string fields (SQLite has no enums) and
// their Arabic labels used throughout the UI.

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------
export const ROLES = {
  CONTRIBUTOR: 'CONTRIBUTOR',
  REVIEWER: 'REVIEWER',
  EDITOR: 'EDITOR',
  CONTENT_MANAGER: 'CONTENT_MANAGER',
  ADMIN: 'ADMIN',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_LABELS: Record<Role, string> = {
  CONTRIBUTOR: 'مساهم',
  REVIEWER: 'مراجع',
  EDITOR: 'محرر',
  CONTENT_MANAGER: 'مدير محتوى',
  ADMIN: 'مدير النظام',
};

// Any role that can access the admin area.
export const STAFF_ROLES: Role[] = [
  ROLES.REVIEWER,
  ROLES.EDITOR,
  ROLES.CONTENT_MANAGER,
  ROLES.ADMIN,
];

// ---------------------------------------------------------------------------
// Material status
// ---------------------------------------------------------------------------
export const MATERIAL_STATUS = {
  DRAFT: 'DRAFT',
  PENDING: 'PENDING',
  PUBLISHED: 'PUBLISHED',
  NEEDS_EDIT: 'NEEDS_EDIT',
  REJECTED: 'REJECTED',
  HIDDEN: 'HIDDEN',
} as const;

export type MaterialStatus =
  (typeof MATERIAL_STATUS)[keyof typeof MATERIAL_STATUS];

export const STATUS_LABELS: Record<MaterialStatus, string> = {
  DRAFT: 'مسودة',
  PENDING: 'قيد المراجعة',
  PUBLISHED: 'منشورة',
  NEEDS_EDIT: 'تحتاج إلى تعديل',
  REJECTED: 'مرفوضة',
  HIDDEN: 'مخفية',
};

// tone → maps to a badge color class group
export const STATUS_TONE: Record<MaterialStatus, 'neutral' | 'warning' | 'success' | 'info' | 'danger'> = {
  DRAFT: 'neutral',
  PENDING: 'warning',
  PUBLISHED: 'success',
  NEEDS_EDIT: 'info',
  REJECTED: 'danger',
  HIDDEN: 'neutral',
};

// ---------------------------------------------------------------------------
// File kinds
// ---------------------------------------------------------------------------
export const FILE_KINDS = {
  AUDIO: 'AUDIO',
  VIDEO: 'VIDEO',
  DOCUMENT: 'DOCUMENT',
  IMAGE: 'IMAGE',
} as const;

export type FileKind = (typeof FILE_KINDS)[keyof typeof FILE_KINDS];

export const FILE_KIND_LABELS: Record<FileKind, string> = {
  AUDIO: 'صوت',
  VIDEO: 'فيديو',
  DOCUMENT: 'مستند',
  IMAGE: 'صورة',
};

// ---------------------------------------------------------------------------
// Review actions & rejection reasons
// ---------------------------------------------------------------------------
export const REVIEW_ACTIONS = {
  APPROVE: 'APPROVE',
  REQUEST_EDIT: 'REQUEST_EDIT',
  REJECT: 'REJECT',
  DRAFT: 'DRAFT',
  RESUBMIT: 'RESUBMIT',
} as const;

export type ReviewAction =
  (typeof REVIEW_ACTIONS)[keyof typeof REVIEW_ACTIONS];

export const REVIEW_ACTION_LABELS: Record<ReviewAction, string> = {
  APPROVE: 'موافقة ونشر',
  REQUEST_EDIT: 'طلب تعديل',
  REJECT: 'رفض المادة',
  DRAFT: 'حفظ كمسودة',
  RESUBMIT: 'إعادة إرسال',
};

// Standard reasons offered when requesting an edit or rejecting.
export const REVIEW_REASONS = [
  'بيانات ناقصة',
  'جودة الملف ضعيفة',
  'تكرار مادة موجودة',
  'مخالفة لشروط النشر',
  'مشكلة في حقوق الاستخدام',
] as const;

// ---------------------------------------------------------------------------
// Categories (canonical slugs — seeded into the DB)
// ---------------------------------------------------------------------------
export const CATEGORY_SLUGS = {
  MADEEH: 'madeeh',
  LECTURES: 'lectures',
  SEMINARS: 'seminars',
  SERMONS: 'sermons',
  OCCASIONS: 'occasions',
  IMAGES: 'images',
  READINGS: 'readings',
} as const;

export const CATEGORIES_SEED = [
  {
    slug: CATEGORY_SLUGS.MADEEH,
    name: 'المدائح',
    description: 'أصوات المادحين وذاكرة الإنشاد',
    icon: 'headphones',
    color: 'gold',
    order: 1,
  },
  {
    slug: CATEGORY_SLUGS.LECTURES,
    name: 'المحاضرات',
    description: 'دروس علمية ومعارف نافعة',
    icon: 'mic',
    color: 'brand',
    order: 2,
  },
  {
    slug: CATEGORY_SLUGS.SERMONS,
    name: 'المواعظ',
    description: 'كلمات تلامس القلب',
    icon: 'book-open',
    color: 'rose',
    order: 3,
  },
  {
    slug: CATEGORY_SLUGS.SEMINARS,
    name: 'الندوات',
    description: 'حوارات ولقاءات فكرية',
    icon: 'users',
    color: 'sky',
    order: 4,
  },
  {
    slug: CATEGORY_SLUGS.OCCASIONS,
    name: 'المناسبات',
    description: 'احتفالات وذكريات المسيد',
    icon: 'calendar',
    color: 'violet',
    order: 5,
  },
  {
    slug: CATEGORY_SLUGS.IMAGES,
    name: 'الصور',
    description: 'صور ووثائق من ذاكرة المسيد',
    icon: 'image',
    color: 'sky',
    order: 6,
  },
  {
    slug: CATEGORY_SLUGS.READINGS,
    name: 'المقروءات',
    description: 'مقالات ونصوص وملفات مقروءة',
    icon: 'file',
    color: 'brand',
    order: 7,
  },
] as const;

// Icon keys available for categories (must exist in components/icons.tsx).
export const CATEGORY_ICON_OPTIONS = [
  { value: 'headphones', label: 'سماعات' },
  { value: 'mic', label: 'ميكروفون' },
  { value: 'book-open', label: 'كتاب' },
  { value: 'users', label: 'مجموعة' },
  { value: 'calendar', label: 'تقويم' },
  { value: 'archive', label: 'أرشيف' },
  { value: 'sparkle', label: 'نجمة' },
  { value: 'quote', label: 'اقتباس' },
] as const;

// Color themes available for category cards.
export const CATEGORY_COLOR_OPTIONS = [
  { value: 'gold', label: 'ذهبي' },
  { value: 'brand', label: 'أخضر' },
  { value: 'rose', label: 'وردي' },
  { value: 'sky', label: 'سماوي' },
  { value: 'violet', label: 'بنفسجي' },
] as const;

// Sort options for the archive listing.
export const SORT_OPTIONS = [
  { value: 'newest', label: 'الأحدث' },
  { value: 'downloads', label: 'الأكثر تحميلاً' },
  { value: 'plays', label: 'الأكثر استماعاً' },
  { value: 'title', label: 'الأبجدية' },
] as const;
