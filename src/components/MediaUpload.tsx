'use client';

import { useState } from 'react';
import { Icon } from './icons';

export type Uploaded = {
  url: string;
  fileKind: string;
  fileType: string;
  fileSize: number;
  durationSec?: number;
};

// For media sections: reject only clearly non-audio/video files (images/documents);
// allow everything else (incl. m4a with a generic MIME) — the server is the final gate.
const BLOCK_EXT = /\.(pdf|docx?|jpe?g|png|webp|gif|bmp|heic|heif|txt|rtf|xlsx?|pptx?)$/i;
const isNotMedia = (f: File) => {
  const t = (f.type || '').toLowerCase();
  if (t.startsWith('image/')) return true;
  if (t === 'application/pdf' || t.startsWith('application/msword') || t.includes('officedocument') || t === 'text/plain') return true;
  return BLOCK_EXT.test(f.name);
};

export function readMediaDuration(file: File): Promise<number | undefined> {
  return new Promise((resolve) => {
    const isVideo = /video/.test(file.type) || /\.(mp4|mov|webm|m4v|3gp)$/i.test(file.name);
    if (!isVideo && !/audio/.test(file.type) && !/\.(mp3|wav|m4a|ogg|aac|opus|amr)$/i.test(file.name)) return resolve(undefined);
    const el = document.createElement(isVideo ? 'video' : 'audio');
    el.preload = 'metadata';
    const done = (v?: number) => { try { URL.revokeObjectURL(el.src); } catch {} resolve(v); };
    el.onloadedmetadata = () => done(Number.isFinite(el.duration) ? Math.round(el.duration) : undefined);
    el.onerror = () => done(undefined);
    setTimeout(() => done(undefined), 8000);
    el.src = URL.createObjectURL(file);
  });
}

/**
 * Upload control shared by the submit and resubmit flows. When `capture` is
 * on (media sections), it offers the file manager AND in-app recording
 * (studio) for video and audio.
 */
export function MediaUpload({ onUploaded, accept, label, idle = 'اضغط لاختيار ملف (حتى 200 ميجابايت)', capture = false }: {
  onUploaded: (d: Uploaded | null) => void;
  accept: string;
  label: string;
  idle?: string;
  capture?: boolean;
}) {
  const [state, setState] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  // Local preview so the contributor can play the clip (hear the مادح / judge
  // quality) before finalizing the submission.
  const [preview, setPreview] = useState<{ url: string; kind: 'audio' | 'video' } | null>(null);

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

  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = ''; if (!f) return;
    if (capture && isNotMedia(f)) { setState('error'); setError('هذا القسم للصوت والفيديو فقط — اختر ملفًا صوتيًا أو مرئيًا.'); onUploaded(null); return; }
    // Build a local preview (plays instantly, before the upload even finishes).
    const isVid = /video/.test(f.type) || /\.(mp4|mov|webm|m4v|3gp|mkv|avi)$/i.test(f.name);
    const isAud = /audio/.test(f.type) || /\.(mp3|wav|m4a|ogg|oga|aac|opus|amr|weba)$/i.test(f.name);
    setPreview((prev) => {
      if (prev) { try { URL.revokeObjectURL(prev.url); } catch {} }
      return isVid || isAud ? { url: URL.createObjectURL(f), kind: isVid ? 'video' : 'audio' } : null;
    });
    upload(f);
  };

  return (
    <div>
      <label className="label">{label}</label>
      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-brand-200 bg-brand-50/40 p-8 text-center hover:bg-brand-50">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-brand-600"><Icon.download width={24} height={24} className="rotate-180" /></span>
        {state === 'idle' && <span className="text-sm text-muted">{capture ? 'اختر من مدير الملفات (صوت أو فيديو فقط)' : idle}</span>}
        {state === 'uploading' && <span className="text-sm text-brand-700">جارٍ رفع «{name}»…</span>}
        {state === 'done' && <span className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-600"><Icon.check width={16} height={16} /> تم رفع «{name}»</span>}
        {state === 'error' && <span className="text-sm text-danger">{error}</span>}
        <input type="file" className="hidden" accept={capture ? undefined : accept} onChange={pick} />
      </label>

      {preview && (
        <div className="mt-3 rounded-2xl bg-ivory-50 p-3 ring-1 ring-ivory-200">
          <p className="field-hint mb-2">استمع/شاهد المقطع قبل الإرسال:</p>
          {preview.kind === 'video' ? (
            <video src={preview.url} controls playsInline className="max-h-64 w-full rounded-xl bg-black" />
          ) : (
            <audio src={preview.url} controls className="w-full" />
          )}
        </div>
      )}

      {capture && (
        <>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="btn-outline flex cursor-pointer items-center justify-center gap-2 text-sm">
              <Icon.video width={18} height={18} /> تسجيل فيديو
              <input type="file" className="hidden" accept="video/*" capture="environment" onChange={pick} />
            </label>
            <label className="btn-outline flex cursor-pointer items-center justify-center gap-2 text-sm">
              <Icon.mic width={18} height={18} /> تسجيل صوت
              <input type="file" className="hidden" accept="audio/*" capture onChange={pick} />
            </label>
          </div>
          <p className="field-hint mt-2">اختر ملفًا من جهازك، أو سجّل مباشرةً من الكاميرا أو الميكروفون. المسموح: ملفات الصوت والفيديو فقط.</p>
        </>
      )}
    </div>
  );
}
