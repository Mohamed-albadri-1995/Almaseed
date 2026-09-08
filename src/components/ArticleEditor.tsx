'use client';

import { useRef, useState } from 'react';
import { renderMarkdown } from '@/lib/markdown';

type Wrap = { before: string; after: string };
type LinePrefix = { prefix: string };
type Action = Wrap | LinePrefix;

const isWrap = (a: Action): a is Wrap => 'before' in a;

const TOOLS: { label: string; title: string; action: Action }[] = [
  { label: 'عنوان', title: 'عنوان رئيسي', action: { prefix: '## ' } },
  { label: 'عنوان فرعي', title: 'عنوان فرعي', action: { prefix: '### ' } },
  { label: 'عريض', title: 'نص عريض', action: { before: '**', after: '**' } },
  { label: 'مائل', title: 'نص مائل', action: { before: '*', after: '*' } },
  { label: '• قائمة', title: 'قائمة نقطية', action: { prefix: '- ' } },
  { label: '۱ ترقيم', title: 'قائمة مرقّمة', action: { prefix: '1. ' } },
  { label: 'اقتباس', title: 'اقتباس', action: { prefix: '> ' } },
];

export function ArticleEditor({
  value,
  onChange,
  placeholder = 'اكتب مقالك هنا…\n\nاستخدم شريط الأدوات للعناوين والتنسيق.',
  rows = 16,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [tab, setTab] = useState<'write' | 'preview'>('write');

  function apply(action: Action) {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = value.slice(start, end);
    let next = value;
    let caret = end;

    if (isWrap(action)) {
      const text = selected || 'نص';
      next = value.slice(0, start) + action.before + text + action.after + value.slice(end);
      caret = start + action.before.length + text.length + action.after.length;
    } else {
      // Prefix each selected line (or the current line) with the marker.
      const lineStart = value.lastIndexOf('\n', start - 1) + 1;
      const block = value.slice(lineStart, end);
      const prefixed = block
        .split('\n')
        .map((l) => (l.startsWith(action.prefix) ? l : action.prefix + l))
        .join('\n');
      next = value.slice(0, lineStart) + prefixed + value.slice(end);
      caret = lineStart + prefixed.length;
    }

    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(caret, caret);
    });
  }

  const html = renderMarkdown(value);

  return (
    <div className="overflow-hidden rounded-2xl border border-ivory-300 bg-white">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 border-b border-ivory-200 bg-ivory-50/70 p-2">
        {TOOLS.map((t) => (
          <button
            key={t.label}
            type="button"
            title={t.title}
            onClick={() => apply(t.action)}
            disabled={tab === 'preview'}
            className="rounded-lg px-2.5 py-1.5 text-sm font-semibold text-brand-700 transition hover:bg-brand-100 disabled:opacity-40"
          >
            {t.label}
          </button>
        ))}
        <div className="ms-auto flex rounded-lg bg-ivory-200 p-0.5">
          <button
            type="button"
            onClick={() => setTab('write')}
            className={`rounded-md px-3 py-1 text-xs font-bold transition ${tab === 'write' ? 'bg-white text-brand-800 shadow-sm' : 'text-muted'}`}
          >
            كتابة
          </button>
          <button
            type="button"
            onClick={() => setTab('preview')}
            className={`rounded-md px-3 py-1 text-xs font-bold transition ${tab === 'preview' ? 'bg-white text-brand-800 shadow-sm' : 'text-muted'}`}
          >
            معاينة
          </button>
        </div>
      </div>

      {tab === 'write' ? (
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          placeholder={placeholder}
          dir="rtl"
          className="block w-full resize-y border-0 bg-white p-5 font-body text-base leading-9 text-ink outline-none placeholder:text-muted/70 focus:ring-0"
        />
      ) : html ? (
        <div
          className="article-prose min-h-[16rem] p-6"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <p className="p-6 text-sm text-muted">لا يوجد نص للمعاينة بعد.</p>
      )}

      <p className="border-t border-ivory-200 bg-ivory-50/60 px-4 py-2 text-xs text-muted">
        تنسيق بسيط: <b>**عريض**</b> ، <i>*مائل*</i> ، «## عنوان» ، «- قائمة» ، «&gt; اقتباس».
      </p>
    </div>
  );
}
