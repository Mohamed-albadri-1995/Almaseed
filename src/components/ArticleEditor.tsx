'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Rich WYSIWYG editor for المقروءات articles. Stores HTML (rendered safely via
 * `renderArticle`). Toolbar: font family & size, bold/italic/underline, colour,
 * headings, alignment, lists, quote, link, divider, clear formatting.
 *
 * Scoped intentionally: only the categories whose form sets `article: true`
 * (currently المقروءات) mount this editor — it is not the site-wide input.
 */

const FONTS = [
  { label: 'الخط الافتراضي', value: '' },
  { label: 'Cairo', value: "'Cairo', sans-serif" },
  { label: 'Tajawal', value: "'Tajawal', sans-serif" },
  { label: 'عريف الرقعة', value: "'Aref Ruqaa', serif" },
];

const SIZES = [
  { label: 'صغير', value: '2' },
  { label: 'عادي', value: '3' },
  { label: 'كبير', value: '5' },
  { label: 'أكبر', value: '6' },
  { label: 'عنوان', value: '7' },
];

const COLORS = ['#2b2b2b', '#1f3d33', '#b47f33', '#c0554e', '#356b57', '#2c2c63'];

function Btn({
  title, onClick, children, active,
}: { title: string; onClick: () => void; children: React.ReactNode; active?: boolean }) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()} // keep the editor selection
      onClick={onClick}
      className={`flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-sm font-bold transition ${
        active ? 'bg-brand-100 text-brand-800' : 'text-brand-700 hover:bg-brand-100'
      }`}
    >
      {children}
    </button>
  );
}

export function ArticleEditor({
  value,
  onChange,
  placeholder = 'اكتب مقالك هنا…',
  minHeight = 320,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  minHeight?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [empty, setEmpty] = useState(!value);

  // Initialise once (uncontrolled thereafter, so the caret is never reset).
  useEffect(() => {
    if (ref.current && value && ref.current.innerHTML !== value) {
      ref.current.innerHTML = value;
      setEmpty(false);
    }
    try { document.execCommand('styleWithCSS', false, 'true'); } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sync = () => {
    const html = ref.current?.innerHTML ?? '';
    setEmpty(!ref.current?.textContent?.trim());
    onChange(html === '<br>' ? '' : html);
  };

  const exec = (cmd: string, val?: string) => {
    ref.current?.focus();
    try { document.execCommand('styleWithCSS', false, 'true'); } catch {}
    document.execCommand(cmd, false, val);
    sync();
  };

  const setBlock = (tag: string) => exec('formatBlock', tag);

  const addLink = () => {
    const url = window.prompt('أدخل الرابط:');
    if (url) exec('createLink', url);
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-ivory-300 bg-white">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 border-b border-ivory-200 bg-ivory-50/70 p-2">
        <select
          title="نوع الخط"
          onMouseDown={(e) => e.stopPropagation()}
          onChange={(e) => exec('fontName', e.target.value)}
          className="h-8 rounded-md border border-ivory-300 bg-white px-2 text-sm text-brand-800"
          defaultValue=""
        >
          {FONTS.map((f) => <option key={f.label} value={f.value}>{f.label}</option>)}
        </select>
        <select
          title="حجم الخط"
          onChange={(e) => exec('fontSize', e.target.value)}
          className="h-8 rounded-md border border-ivory-300 bg-white px-2 text-sm text-brand-800"
          defaultValue="3"
        >
          {SIZES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>

        <span className="mx-1 h-6 w-px bg-ivory-300" />
        <Btn title="عريض" onClick={() => exec('bold')}><b>ب</b></Btn>
        <Btn title="مائل" onClick={() => exec('italic')}><i>م</i></Btn>
        <Btn title="تحته خط" onClick={() => exec('underline')}><u>خ</u></Btn>

        <span className="mx-1 h-6 w-px bg-ivory-300" />
        <Btn title="عنوان" onClick={() => setBlock('H2')}>ع١</Btn>
        <Btn title="عنوان فرعي" onClick={() => setBlock('H3')}>ع٢</Btn>
        <Btn title="فقرة" onClick={() => setBlock('P')}>¶</Btn>

        <span className="mx-1 h-6 w-px bg-ivory-300" />
        <Btn title="محاذاة لليمين" onClick={() => exec('justifyRight')}>▷</Btn>
        <Btn title="توسيط" onClick={() => exec('justifyCenter')}>≡</Btn>
        <Btn title="محاذاة لليسار" onClick={() => exec('justifyLeft')}>◁</Btn>
        <Btn title="ضبط" onClick={() => exec('justifyFull')}>☰</Btn>

        <span className="mx-1 h-6 w-px bg-ivory-300" />
        <Btn title="قائمة نقطية" onClick={() => exec('insertUnorderedList')}>•</Btn>
        <Btn title="قائمة مرقّمة" onClick={() => exec('insertOrderedList')}>۱.</Btn>
        <Btn title="اقتباس" onClick={() => setBlock('BLOCKQUOTE')}>❝</Btn>
        <Btn title="رابط" onClick={addLink}>🔗</Btn>

        <span className="mx-1 h-6 w-px bg-ivory-300" />
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            title="لون النص"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => exec('foreColor', c)}
            className="h-6 w-6 rounded-full border border-black/10"
            style={{ backgroundColor: c }}
          />
        ))}

        <span className="mx-1 h-6 w-px bg-ivory-300" />
        <Btn title="مسح التنسيق" onClick={() => exec('removeFormat')}>⌫</Btn>
      </div>

      {/* Editable surface */}
      <div className="relative">
        {empty && (
          <span className="pointer-events-none absolute right-6 top-5 text-muted/70">{placeholder}</span>
        )}
        <div
          ref={ref}
          contentEditable
          dir="rtl"
          suppressContentEditableWarning
          onInput={sync}
          onBlur={sync}
          className="article-prose block w-full px-6 py-5 outline-none"
          style={{ minHeight }}
        />
      </div>

      <p className="border-t border-ivory-200 bg-ivory-50/60 px-4 py-2 text-xs text-muted">
        حرّر النص مباشرةً كما سيظهر للقارئ — اختر الخط وحجمه، واستخدم أدوات التنسيق أعلاه.
      </p>
    </div>
  );
}
