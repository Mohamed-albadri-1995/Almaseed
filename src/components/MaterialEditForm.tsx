'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { editMaterialAction } from '@/app/admin/actions';
import { Icon } from './icons';

interface MaterialData {
  id: string;
  categorySlug: string;
  title: string;
  coverImage?: string | null;
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
  description?: string | null;
  summary?: string | null;
  lyrics?: string | null;
  keywords?: string | null;
}

const FIELDS: { name: keyof MaterialData; label: string; area?: boolean }[] = [
  { name: 'performer', label: 'المادح' },
  { name: 'speaker', label: 'المحاضر / المتحدث' },
  { name: 'narrator', label: 'الراوي' },
  { name: 'host', label: 'مدير الندوة / المقدم' },
  { name: 'participants', label: 'المشاركون' },
  { name: 'occasion', label: 'المناسبة' },
  { name: 'topic', label: 'الموضوع' },
  { name: 'organizer', label: 'الجهة المنظمة' },
  { name: 'place', label: 'المكان' },
  { name: 'city', label: 'المدينة' },
  { name: 'keywords', label: 'الكلمات المفتاحية' },
  { name: 'description', label: 'الوصف', area: true },
  { name: 'summary', label: 'الملخص', area: true },
  { name: 'lyrics', label: 'الكلمات', area: true },
];

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary">
      {pending ? 'جارٍ الحفظ…' : 'حفظ البيانات'}
    </button>
  );
}

// Cover image field: shows current image, lets an editor replace or remove it.
function CoverField({ initial }: { initial?: string | null }) {
  const [url, setUrl] = useState<string>(initial ?? '');
  const [busy, setBusy] = useState(false);

  const upload = async (file: File) => {
    setBusy(true);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (res.ok) setUrl(data.url);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sm:col-span-2">
      <label className="label">صورة الغلاف</label>
      {/* Always present so an empty value clears the cover on save. */}
      <input type="hidden" name="coverImage" value={url} />
      <div className="flex items-center gap-4">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="غلاف" className="h-20 w-28 rounded-xl object-cover ring-1 ring-black/5" />
        ) : (
          <span className="flex h-20 w-28 items-center justify-center rounded-xl bg-ivory-100 text-muted">
            <Icon.image width={22} height={22} />
          </span>
        )}
        <div className="flex flex-col gap-2">
          <label className="btn-outline cursor-pointer text-sm">
            {busy ? 'جارٍ الرفع…' : url ? 'استبدال الصورة' : 'رفع صورة'}
            <input
              type="file"
              className="hidden"
              accept=".jpg,.jpeg,.png,.webp"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) upload(f);
              }}
            />
          </label>
          {url && (
            <button type="button" onClick={() => setUrl('')} className="text-xs text-muted hover:text-danger">
              إزالة الصورة
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function MaterialEditForm({
  material,
  categories,
  saved,
}: {
  material: MaterialData;
  categories: { slug: string; name: string }[];
  saved?: boolean;
}) {
  return (
    <form action={editMaterialAction} className="card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-brand-800">بيانات المادة</h2>
        {saved && <span className="text-xs font-semibold text-emerald-600">تم الحفظ ✓</span>}
      </div>

      <input type="hidden" name="id" value={material.id} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="title">العنوان</label>
          <input id="title" name="title" defaultValue={material.title} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="categorySlug">التصنيف</label>
          <select id="categorySlug" name="categorySlug" defaultValue={material.categorySlug} className="input">
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>{c.name}</option>
            ))}
          </select>
        </div>
        {FIELDS.map((f) => {
          const val = (material[f.name] as string | null) ?? '';
          return (
            <div key={f.name} className={f.area ? 'sm:col-span-2' : ''}>
              <label className="label" htmlFor={f.name}>{f.label}</label>
              {f.area ? (
                <textarea id={f.name} name={f.name} rows={3} defaultValue={val} className="input" />
              ) : (
                <input id={f.name} name={f.name} defaultValue={val} className="input" />
              )}
            </div>
          );
        })}
        <CoverField initial={material.coverImage} />
      </div>

      <div className="mt-5">
        <SaveButton />
      </div>
    </form>
  );
}
