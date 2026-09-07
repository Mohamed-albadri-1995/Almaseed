'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { Icon, DynamicIcon } from './icons';
import { submitMaterialAction, type SubmitState } from '@/app/submit/actions';

interface CategoryOption {
  slug: string;
  name: string;
  description?: string | null;
  icon?: string | null;
}

interface FieldDef {
  name: string;
  label: string;
  type?: 'text' | 'textarea' | 'date';
  hint?: string;
  canBeUnknown?: boolean; // show a "لا أعلم" toggle
}

const UNKNOWN = 'غير معروف';

// Fields shown per category. Every field is required; the ones that a
// contributor might genuinely not know carry a "لا أعلم" toggle. Location is a
// single field (المكان/المدينة) to avoid the earlier duplication.
const FIELDS: Record<string, { titleLabel: string; fields: FieldDef[] }> = {
  madeeh: {
    titleLabel: 'اسم المدحة',
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
    fields: [
      { name: 'speaker', label: 'اسم المحاضر', canBeUnknown: true },
      { name: 'host', label: 'مقدم البرنامج', canBeUnknown: true },
      { name: 'topic', label: 'الموضوع', canBeUnknown: true },
      { name: 'occasion', label: 'المناسبة', canBeUnknown: true },
      { name: 'city', label: 'المكان أو المدينة', hint: 'القاعة أو المدينة', canBeUnknown: true },
      { name: 'recordDate', label: 'التاريخ', type: 'date', canBeUnknown: true },
      { name: 'summary', label: 'ملخص المحاضرة', type: 'textarea', canBeUnknown: true },
      { name: 'keywords', label: 'الكلمات المفتاحية', hint: 'افصل بينها بفاصلة', canBeUnknown: true },
    ],
  },
  sermons: {
    titleLabel: 'عنوان الموعظة',
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
    fields: [
      { name: 'occasion', label: 'نوع المناسبة', canBeUnknown: true },
      { name: 'organizer', label: 'الجهة المنظمة', canBeUnknown: true },
      { name: 'participants', label: 'أسماء المشاركين', hint: 'افصل بينها بفاصلة', canBeUnknown: true },
      { name: 'city', label: 'المكان أو المدينة', canBeUnknown: true },
      { name: 'recordDate', label: 'التاريخ', type: 'date', canBeUnknown: true },
      { name: 'description', label: 'وصف المناسبة', type: 'textarea', canBeUnknown: true },
    ],
  },
};

const initial: SubmitState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary btn-lg">
      {pending ? 'جارٍ الإرسال…' : 'إرسال للمراجعة'}
    </button>
  );
}

// One field with an optional "لا أعلم" toggle.
function Field({ field }: { field: FieldDef }) {
  const [unknown, setUnknown] = useState(false);
  const commonProps = {
    id: field.name,
    name: field.name,
    required: true,
    className: 'input',
  };

  return (
    <div className={field.type === 'textarea' ? 'sm:col-span-2' : ''}>
      <div className="mb-1.5 flex items-center justify-between">
        <label className="text-sm font-medium text-brand-800" htmlFor={field.name}>
          {field.label}
        </label>
        {field.canBeUnknown && (
          <label className="flex cursor-pointer items-center gap-1 text-xs text-muted">
            <input
              type="checkbox"
              className="rounded"
              checked={unknown}
              onChange={(e) => setUnknown(e.target.checked)}
            />
            لا أعلم
          </label>
        )}
      </div>

      {unknown ? (
        // readOnly (not disabled) so the value is still submitted & passes required
        <input {...commonProps} readOnly value={UNKNOWN} className="input bg-ivory-100 text-muted" />
      ) : field.type === 'textarea' ? (
        <textarea {...commonProps} rows={3} />
      ) : (
        <input {...commonProps} type={field.type === 'date' ? 'date' : 'text'} />
      )}
      {field.hint && !unknown && <p className="field-hint">{field.hint}</p>}
    </div>
  );
}

function FileUpload({
  onUploaded,
}: {
  onUploaded: (data: { url: string; fileKind: string; fileType: string; fileSize: number } | null) => void;
}) {
  const [state, setState] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle');
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const upload = async (file: File) => {
    setState('uploading');
    setName(file.name);
    setError('');
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) {
        setState('error');
        setError(data.error || 'فشل الرفع');
        onUploaded(null);
        return;
      }
      setState('done');
      onUploaded(data);
    } catch {
      setState('error');
      setError('تعذّر رفع الملف');
      onUploaded(null);
    }
  };

  return (
    <div>
      <label className="label">رفع الملف (صوت / فيديو / مستند / صورة)</label>
      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-brand-200 bg-brand-50/40 p-8 text-center hover:bg-brand-50">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-brand-600">
          <Icon.download width={24} height={24} className="rotate-180" />
        </span>
        {state === 'idle' && <span className="text-sm text-muted">اضغط لاختيار ملف (حتى 200 ميجابايت)</span>}
        {state === 'uploading' && <span className="text-sm text-brand-700">جارٍ رفع «{name}»…</span>}
        {state === 'done' && (
          <span className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-600">
            <Icon.check width={16} height={16} /> تم رفع «{name}»
          </span>
        )}
        {state === 'error' && <span className="text-sm text-danger">{error}</span>}
        <input
          type="file"
          className="hidden"
          accept=".mp3,.wav,.m4a,.ogg,.mp4,.mov,.webm,.pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
          }}
        />
      </label>
      <p className="field-hint">أرفق ملف المادة (صوت أو فيديو). يمكن رفعه لاحقاً إن لم يكن جاهزاً الآن.</p>
    </div>
  );
}

export function SubmitForm({ categories }: { categories: CategoryOption[] }) {
  const [state, action] = useFormState(submitMaterialAction, initial);
  const [step, setStep] = useState(1);
  const [slug, setSlug] = useState('');
  const [file, setFile] = useState<{ url: string; fileKind: string; fileType: string; fileSize: number } | null>(null);

  const config = slug ? FIELDS[slug] : null;
  const activeCat = categories.find((c) => c.slug === slug);

  return (
    <div>
      {/* Steps indicator */}
      <div className="mb-8 flex items-center justify-center gap-2">
        {[1, 2, 3].map((n) => (
          <div key={n} className="flex items-center gap-2">
            <span
              className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold ${
                step >= n ? 'bg-brand-700 text-ivory-50' : 'bg-ivory-200 text-muted'
              }`}
            >
              {n}
            </span>
            {n < 3 && <span className={`h-0.5 w-10 ${step > n ? 'bg-brand-700' : 'bg-ivory-200'}`} />}
          </div>
        ))}
      </div>

      {/* Step 1: category */}
      {step === 1 && (
        <div>
          <h2 className="mb-1 text-xl font-bold text-brand-800">اختر نوع المادة</h2>
          <p className="mb-6 text-sm text-muted">حدد التصنيف المناسب للمادة التي تريد مشاركتها.</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((c) => (
              <button
                key={c.slug}
                onClick={() => {
                  setSlug(c.slug);
                  setStep(2);
                }}
                className={`flex items-center gap-3 rounded-2xl border p-4 text-right transition ${
                  slug === c.slug
                    ? 'border-brand-400 bg-brand-50'
                    : 'border-ivory-300 bg-white hover:border-brand-200 hover:bg-brand-50/40'
                }`}
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-100 text-brand-600">
                  <DynamicIcon name={c.icon} width={22} height={22} />
                </span>
                <span>
                  <span className="block font-bold text-brand-800">{c.name}</span>
                  <span className="block text-xs text-muted">{c.description}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Steps 2 & 3 share one form so all fields submit together */}
      {step >= 2 && config && (
        <form action={action}>
          <input type="hidden" name="categorySlug" value={slug} />
          {file && (
            <>
              <input type="hidden" name="fileUrl" value={file.url} />
              <input type="hidden" name="fileKind" value={file.fileKind} />
              <input type="hidden" name="fileType" value={file.fileType} />
              <input type="hidden" name="fileSize" value={file.fileSize} />
            </>
          )}

          {/* Step 2: data */}
          <div className={step === 2 ? 'block' : 'hidden'}>
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-brand-800">بيانات {activeCat?.name}</h2>
                <p className="text-sm text-muted">
                  كل الحقول مطلوبة. إن كنت لا تعرف قيمة حقل، فعّل خيار «لا أعلم» بجانبه.
                </p>
              </div>
              <button type="button" onClick={() => setStep(1)} className="btn-ghost text-sm">
                تغيير النوع
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="label" htmlFor="title">{config.titleLabel}</label>
                <input id="title" name="title" required className="input" />
              </div>
              {config.fields.map((f) => (
                <Field key={f.name} field={f} />
              ))}
            </div>

            <div className="mt-8 flex justify-between">
              <button type="button" onClick={() => setStep(1)} className="btn-outline">السابق</button>
              <button type="button" onClick={() => setStep(3)} className="btn-primary">التالي</button>
            </div>
          </div>

          {/* Step 3: file + confirmation */}
          <div className={step === 3 ? 'block' : 'hidden'}>
            <h2 className="mb-6 text-xl font-bold text-brand-800">الملف والإقرار</h2>
            <FileUpload onUploaded={setFile} />

            {state.error && (
              <div className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {state.error}
              </div>
            )}

            <div className="mt-6 space-y-3">
              <label className="flex items-start gap-3 rounded-xl bg-ivory-50 p-4 text-sm text-ink/90">
                <input type="checkbox" name="rightsConfirmed" required className="mt-1 rounded" />
                <span>أقر بأن لدي الحق في مشاركة هذه المادة، وأن مشاركتها لا تخالف حقوق الآخرين.</span>
              </label>
              <label className="flex items-start gap-3 rounded-xl bg-ivory-50 p-4 text-sm text-ink/90">
                <input type="checkbox" name="reviewConsent" required className="mt-1 rounded" />
                <span>أوافق على مراجعة المادة من فريق الإشراف قبل نشرها.</span>
              </label>
            </div>

            <div className="mt-8 flex justify-between">
              <button type="button" onClick={() => setStep(2)} className="btn-outline">السابق</button>
              <SubmitButton />
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
