'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { Icon, DynamicIcon } from './icons';
import { ArticleEditor } from './ArticleEditor';
import { submitMaterialAction, type SubmitState } from '@/app/submit/actions';
import { CATEGORY_FORMS, type FieldDef } from '@/lib/fields';

interface CategoryOption {
  slug: string;
  name: string;
  description?: string | null;
  icon?: string | null;
}

const initial: SubmitState = {};

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending || disabled} className="btn-primary btn-lg">
      {pending ? 'جارٍ الإرسال…' : 'إرسال للمراجعة'}
    </button>
  );
}

function Field({ field }: { field: FieldDef }) {
  const common = {
    id: field.name,
    name: field.name,
    required: !!field.required,
    className: 'input',
  };
  return (
    <div className={field.type === 'textarea' ? 'sm:col-span-2' : ''}>
      <label className="mb-1.5 block text-sm font-medium text-brand-800" htmlFor={field.name}>
        {field.label}{field.required ? ' *' : ''}
      </label>
      {field.type === 'textarea' ? (
        <textarea {...common} rows={3} />
      ) : (
        <input {...common} type={field.type === 'date' ? 'date' : 'text'} />
      )}
      {field.hint && <p className="field-hint">{field.hint}</p>}
    </div>
  );
}

type Uploaded = { url: string; fileKind: string; fileType: string; fileSize: number; durationSec?: number };

function readMediaDuration(file: File): Promise<number | undefined> {
  return new Promise((resolve) => {
    const isVideo = /video/.test(file.type) || /\.(mp4|mov|webm)$/i.test(file.name);
    if (!isVideo && !/audio/.test(file.type) && !/\.(mp3|wav|m4a|ogg)$/i.test(file.name)) return resolve(undefined);
    const el = document.createElement(isVideo ? 'video' : 'audio');
    el.preload = 'metadata';
    const done = (v?: number) => { try { URL.revokeObjectURL(el.src); } catch {} resolve(v); };
    el.onloadedmetadata = () => done(Number.isFinite(el.duration) ? Math.round(el.duration) : undefined);
    el.onerror = () => done(undefined);
    setTimeout(() => done(undefined), 8000);
    el.src = URL.createObjectURL(file);
  });
}

function FileUpload({ onUploaded, accept, label, idle = 'اضغط لاختيار ملف (حتى 200 ميجابايت)' }: {
  onUploaded: (d: Uploaded | null) => void;
  accept: string;
  label: string;
  idle?: string;
}) {
  const [state, setState] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle');
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const upload = async (file: File) => {
    setState('uploading'); setName(file.name); setError('');
    const fd = new FormData(); fd.append('file', file);
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const text = await res.text();
      let data: Partial<Uploaded> & { error?: string } = {};
      try { data = JSON.parse(text); } catch { data = { error: text.slice(0, 200) || `خطأ ${res.status}` }; }
      if (!res.ok || !data.url) {
        setState('error'); setError(data.error || `فشل الرفع (${res.status})`); onUploaded(null); return;
      }
      const durationSec = await readMediaDuration(file);
      setState('done'); onUploaded({ ...(data as Uploaded), durationSec });
    } catch (err) {
      setState('error'); setError(err instanceof Error ? err.message : 'تعذّر رفع الملف'); onUploaded(null);
    }
  };

  return (
    <div>
      <label className="label">{label}</label>
      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-brand-200 bg-brand-50/40 p-8 text-center hover:bg-brand-50">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-brand-600"><Icon.download width={24} height={24} className="rotate-180" /></span>
        {state === 'idle' && <span className="text-sm text-muted">{idle}</span>}
        {state === 'uploading' && <span className="text-sm text-brand-700">جارٍ رفع «{name}»…</span>}
        {state === 'done' && <span className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-600"><Icon.check width={16} height={16} /> تم رفع «{name}»</span>}
        {state === 'error' && <span className="text-sm text-danger">{error}</span>}
        <input type="file" className="hidden" accept={accept} onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }} />
      </label>
    </div>
  );
}

export function SubmitForm({ categories }: { categories: CategoryOption[] }) {
  const [state, action] = useFormState(submitMaterialAction, initial);
  const [step, setStep] = useState(1);
  const [slug, setSlug] = useState('');
  const [file, setFile] = useState<Uploaded | null>(null);
  const [cover, setCover] = useState<Uploaded | null>(null);
  const [readingMode, setReadingMode] = useState<'file' | 'article'>('file');
  const [articleText, setArticleText] = useState('');

  const config = slug ? CATEGORY_FORMS[slug] : null;
  const activeCat = categories.find((c) => c.slug === slug);
  const isReadings = !!config?.article;
  const articleMode = isReadings && readingMode === 'article';
  const fileSatisfied = articleMode ? articleText.trim().length > 1 : !!file;

  return (
    <div>
      <div className="mb-8 flex items-center justify-center gap-2">
        {[1, 2, 3, 4].map((n) => <div key={n} className="flex items-center gap-2"><span className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold ${step >= n ? 'bg-brand-700 text-ivory-50' : 'bg-ivory-200 text-muted'}`}>{n}</span>{n < 4 && <span className={`h-0.5 w-8 ${step > n ? 'bg-brand-700' : 'bg-ivory-200'}`} />}</div>)}
      </div>

      {step === 1 && (
        <div>
          <h2 className="mb-1 text-xl font-bold text-brand-800">اختر نوع المادة</h2>
          <p className="mb-6 text-sm text-muted">حدد التصنيف المناسب للمادة التي تريد مشاركتها.</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {categories.filter((c) => CATEGORY_FORMS[c.slug]).map((c) => (
              <button key={c.slug} type="button" onClick={() => { setSlug(c.slug); setFile(null); setStep(2); }} className={`flex items-center gap-3 rounded-2xl border p-4 text-right transition ${slug === c.slug ? 'border-brand-400 bg-brand-50' : 'border-ivory-300 bg-white hover:border-brand-200 hover:bg-brand-50/40'}`}>
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-100 text-brand-600"><DynamicIcon name={c.icon} width={22} height={22} /></span>
                <span><span className="block font-bold text-brand-800">{c.name}</span><span className="block text-xs text-muted">{c.description}</span></span>
              </button>
            ))}
          </div>
        </div>
      )}

      {step >= 2 && config && (
        <form action={action}>
          <input type="hidden" name="categorySlug" value={slug} />
          {file && <><input type="hidden" name="fileUrl" value={file.url} /><input type="hidden" name="fileKind" value={file.fileKind} /><input type="hidden" name="fileType" value={file.fileType} /><input type="hidden" name="fileSize" value={file.fileSize} />{file.durationSec ? <input type="hidden" name="durationSec" value={file.durationSec} /> : null}</>}
          {cover && <input type="hidden" name="coverImage" value={cover.url} />}
          {articleMode && <input type="hidden" name="bodyText" value={articleText} />}

          <div className={step === 2 ? 'block' : 'hidden'}>
            <div className="mb-6 flex items-center justify-between"><div><h2 className="text-xl font-bold text-brand-800">ملف {activeCat?.name}</h2><p className="text-sm text-muted">ارفع الملف أولاً — لا يمكن الإرسال دون اكتمال الرفع.</p></div><button type="button" onClick={() => setStep(1)} className="btn-ghost text-sm">تغيير النوع</button></div>
            {isReadings && <div className="mb-5 flex gap-2"><button type="button" onClick={() => setReadingMode('file')} className={readingMode === 'file' ? 'btn-primary' : 'btn-outline'}>رفع ملف</button><button type="button" onClick={() => setReadingMode('article')} className={readingMode === 'article' ? 'btn-primary' : 'btn-outline'}>كتابة مقال</button></div>}
            {articleMode ? <div><label className="label">نص المقال</label><ArticleEditor value={articleText} onChange={setArticleText} /><p className="field-hint">يمكنك أيضاً إرفاق صورة غلاف في الخطوة التالية.</p></div> : <FileUpload onUploaded={setFile} accept={config.accept} label={`رفع الملف (${config.file === 'required' ? 'مطلوب' : 'اختياري'})`} />}
            <div className="mt-8 flex justify-between"><button type="button" onClick={() => setStep(1)} className="btn-outline">السابق</button><button type="button" onClick={() => setStep(3)} disabled={!fileSatisfied} className="btn-primary disabled:opacity-50">التالي</button></div>
            {!fileSatisfied && <p className="mt-2 text-left text-xs text-muted">{articleMode ? 'اكتب نص المقال للمتابعة.' : 'أكمل رفع الملف للمتابعة.'}</p>}
          </div>

          <div className={step === 3 ? 'block' : 'hidden'}>
            <h2 className="mb-1 text-xl font-bold text-brand-800">بيانات {activeCat?.name}</h2>
            <p className="mb-6 text-sm text-muted">الحقول المعلّمة بعلامة * مطلوبة، والباقي اختياري.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2"><label className="label" htmlFor="title">{config.titleLabel} *</label><input id="title" name="title" required className="input" /></div>
              <div className="sm:col-span-2"><label className="label" htmlFor="subtitle">{config.subtitleLabel}</label><input id="subtitle" name="subtitle" className="input" /></div>
              {config.fields.map((f) => <Field key={f.name} field={f} />)}
            </div>
            {config.cover !== false && <div className="mt-6"><CoverUpload onUploaded={setCover} cover={cover} /></div>}
            <div className="mt-8 flex justify-between"><button type="button" onClick={() => setStep(2)} className="btn-outline">السابق</button><button type="button" onClick={() => setStep(4)} className="btn-primary">التالي</button></div>
          </div>

          <div className={step === 4 ? 'block' : 'hidden'}>
            <h2 className="mb-6 text-xl font-bold text-brand-800">الإقرار والإرسال</h2>
            {state.error && <div className="mb-5 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{state.error}</div>}
            <div className="space-y-3"><label className="flex items-start gap-3 rounded-xl bg-ivory-50 p-4 text-sm text-ink/90"><input type="checkbox" name="rightsConfirmed" required className="mt-1 rounded" /><span>أقر بأن لدي الحق في مشاركة هذه المادة، وأن مشاركتها لا تخالف حقوق الآخرين.</span></label><label className="flex items-start gap-3 rounded-xl bg-ivory-50 p-4 text-sm text-ink/90"><input type="checkbox" name="reviewConsent" required className="mt-1 rounded" /><span>أوافق على مراجعة المادة من فريق الإشراف قبل نشرها.</span></label></div>
            <div className="mt-8 flex justify-between"><button type="button" onClick={() => setStep(3)} className="btn-outline">السابق</button><SubmitButton disabled={!fileSatisfied} /></div>
            {!fileSatisfied && <p className="mt-2 text-left text-xs text-danger">يجب إرفاق ملف أو كتابة مقال قبل الإرسال.</p>}
          </div>
        </form>
      )}
    </div>
  );
}

function CoverUpload({ onUploaded, cover }: { onUploaded: (d: Uploaded | null) => void; cover: Uploaded | null }) {
  return <div><FileUpload onUploaded={onUploaded} accept=".jpg,.jpeg,.png,.webp" label="صورة الغلاف (اختياري)" idle="اضغط لاختيار صورة" />{cover && <p className="field-hint mt-1 text-emerald-600">تم اختيار صورة الغلاف.</p>}</div>;
}
