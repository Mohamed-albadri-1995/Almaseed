'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { resubmitMaterialAction, type SubmitState } from '@/app/submit/actions';

interface MaterialData {
  id: string;
  categorySlug: string;
  title: string;
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

const initial: SubmitState = {};

const FIELD_LABELS: { name: keyof MaterialData; label: string; area?: boolean }[] = [
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
  { name: 'description', label: 'الوصف', area: true },
  { name: 'summary', label: 'الملخص', area: true },
  { name: 'lyrics', label: 'الكلمات', area: true },
  { name: 'keywords', label: 'الكلمات المفتاحية' },
];

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary btn-lg">
      {pending ? 'جارٍ…' : 'حفظ وإعادة الإرسال'}
    </button>
  );
}

export function ResubmitForm({ material }: { material: MaterialData }) {
  const [state, action] = useFormState(resubmitMaterialAction, initial);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={material.id} />
      <input type="hidden" name="categorySlug" value={material.categorySlug} />
      {/* confirmations already given on first submit; keep them satisfied */}
      <input type="hidden" name="rightsConfirmed" value="true" />
      <input type="hidden" name="reviewConsent" value="true" />

      {state.error && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{state.error}</div>
      )}

      <div>
        <label className="label" htmlFor="title">العنوان</label>
        <input id="title" name="title" defaultValue={material.title} required className="input" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {FIELD_LABELS.map((f) => {
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
      </div>

      <div className="pt-2">
        <SubmitButton />
      </div>
    </form>
  );
}
