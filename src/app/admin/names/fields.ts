// Free-text name fields the «توحيد الأسماء» tool can clean up.
export const NAME_FIELDS = [
  { key: 'performer', label: 'المادح' },
  { key: 'narrator', label: 'الراوي' },
  { key: 'speaker', label: 'المحاضر' },
  { key: 'host', label: 'مدير الندوة' },
  { key: 'author', label: 'المؤلف' },
  { key: 'occasion', label: 'المناسبة' },
  { key: 'organizer', label: 'الجهة المنظمة' },
  { key: 'place', label: 'المكان' },
  { key: 'city', label: 'المدينة' },
] as const;
export type NameField = (typeof NAME_FIELDS)[number]['key'];
