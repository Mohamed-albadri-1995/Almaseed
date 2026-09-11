'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { resubmitMaterialAction, type SubmitState } from '@/app/submit/actions';
import { CATEGORY_FORMS } from '@/lib/fields';
import { ArticleEditor } from './ArticleEditor';
import { MediaUpload, type Uploaded } from './MediaUpload';

interface MaterialData {
  id: string;
  categorySlug: string;
  title: string;
  subtitle?: string | null;
  fileUrl?: string | null;
  fileType?: string | null;
  fileKind?: string | null;
  bodyText?: string | null;
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
  author?: string | null;
  source?: string | null;
  docType?: string | null;
  description?: string | null;
  summary?: string | null;
  lyrics?: string | null;
  keywords?: string | null;
}

const initial: SubmitState = {};

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
  const form = CATEGORY_FORMS[material.categorySlug];
  const [bodyText, setBodyText] = useState(material.bodyText ?? '');
  const [file, setFile] = useState<Uploaded | null>(null);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={material.id} />
      <input type="hidden" name="categorySlug" value={material.categorySlug} />
      {/* confirmations already given on first submit */}
      <input type="hidden" name="rightsConfirmed" value="true" />
      <input type="hidden" name="reviewConsent" value="true" />

      {state.error && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{state.error}</div>
      )}

      <div>
        <label className="label" htmlFor="title">العنوان</label>
        <input id="title" name="title" defaultValue={material.title} required className="input" />
      </div>
      <div>
        <label className="label" htmlFor="subtitle">عنوان فرعي</label>
        <input id="subtitle" name="subtitle" defaultValue={material.subtitle ?? ''} className="input" />
      </div>

      {form && (
        <div>
          {material.fileUrl && !file && (
            <p className="mb-2 text-sm text-muted">
              الملف الحالي: {material.fileType || 'ملف'}{' '}—{' '}
              <a href={material.fileUrl} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">استماع / عرض</a>
            </p>
          )}
          {file && (
            <>
              <input type="hidden" name="fileUrl" value={file.url} />
              <input type="hidden" name="fileKind" value={file.fileKind} />
              <input type="hidden" name="fileType" value={file.fileType} />
              <input type="hidden" name="fileSize" value={file.fileSize} />
              {file.durationSec ? <input type="hidden" name="durationSec" value={file.durationSec} /> : null}
            </>
          )}
          <MediaUpload
            onUploaded={setFile}
            accept={form.accept}
            capture={!!form.capture}
            label={material.fileUrl ? 'استبدال الملف (اختياري)' : `رفع الملف (${form.file === 'required' ? 'مطلوب' : 'اختياري'})`}
          />
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {form?.fields.map((f) => {
          const val = (material[f.name as keyof MaterialData] as string | null) ?? '';
          return (
            <div key={f.name} className={f.type === 'textarea' ? 'sm:col-span-2' : ''}>
              <label className="label" htmlFor={f.name}>{f.label}</label>
              {f.type === 'textarea' ? (
                <textarea id={f.name} name={f.name} rows={3} defaultValue={val} className="input" />
              ) : f.type === 'select' ? (
                <select id={f.name} name={f.name} defaultValue={val} required={!!f.required} className="input">
                  <option value="" disabled>اختر…</option>
                  {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : (
                <input id={f.name} name={f.name} type={f.type === 'date' ? 'date' : 'text'} defaultValue={val} className="input" />
              )}
            </div>
          );
        })}
      </div>

      {form?.article && (
        <div>
          <label className="label">نص المقال</label>
          <input type="hidden" name="bodyText" value={bodyText} />
          <ArticleEditor value={bodyText} onChange={setBodyText} />
        </div>
      )}

      <div className="pt-2">
        <SubmitButton />
      </div>
    </form>
  );
}
