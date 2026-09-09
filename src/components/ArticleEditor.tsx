'use client';

import { useEffect, useRef, useState } from 'react';

const FONTS = [
  { label: 'الخط الافتراضي', value: '' },
  { label: 'Cairo', value: "'Cairo', sans-serif" },
  { label: 'Tajawal', value: "'Tajawal', sans-serif" },
  { label: 'عريف الرقعة', value: "'Aref Ruqaa', serif" },
];
const SIZES = [
  { label: 'صغير', value: '2' }, { label: 'عادي', value: '3' }, { label: 'كبير', value: '5' },
  { label: 'أكبر', value: '6' }, { label: 'عنوان', value: '7' },
];
const COLORS = ['#2b2b2b', '#1f3d33', '#b47f33', '#c0554e', '#356b57', '#2c2c63'];

function Btn({ title, onClick, children, active }: { title: string; onClick: () => void; children: React.ReactNode; active?: boolean }) {
  return <button type="button" title={title} aria-label={title} onMouseDown={(e) => e.preventDefault()} onTouchStart={(e) => e.preventDefault()} onClick={onClick} className={`flex h-9 min-w-9 shrink-0 touch-manipulation items-center justify-center rounded-md px-2 text-sm font-bold transition ${active ? 'bg-brand-100 text-brand-800' : 'text-brand-700 hover:bg-brand-100'}`}>{children}</button>;
}

export function ArticleEditor({ value, onChange, placeholder = 'اكتب مقالك هنا…', minHeight = 320 }: { value: string; onChange: (v: string) => void; placeholder?: string; minHeight?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const selectionRef = useRef<Range | null>(null);
  const [empty, setEmpty] = useState(!value || !value.replace(/<[^>]*>/g, '').trim());

  useEffect(() => {
    if (!ref.current) return;
    if (ref.current.innerHTML !== value) ref.current.innerHTML = value || '';
    setEmpty(!ref.current.textContent?.trim());
    try { document.execCommand('styleWithCSS', false, 'true'); } catch {}
  }, [value]);

  const rememberSelection = () => {
    const editor = ref.current, selection = window.getSelection();
    if (!editor || !selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    if (editor.contains(range.commonAncestorContainer)) selectionRef.current = range.cloneRange();
  };
  const sync = () => {
    const html = ref.current?.innerHTML ?? '', text = ref.current?.textContent?.trim() ?? '';
    setEmpty(!text); onChange(html === '<br>' ? '' : html); rememberSelection();
  };
  const restoreSelection = () => {
    const editor = ref.current, range = selectionRef.current;
    if (!editor || !range) return;
    editor.focus({ preventScroll: true });
    const selection = window.getSelection(); if (!selection) return;
    try { selection.removeAllRanges(); selection.addRange(range); } catch {}
  };
  const exec = (cmd: string, val?: string) => {
    const editor = ref.current; if (!editor) return;
    const scrollX = window.scrollX, scrollY = window.scrollY;
    restoreSelection();
    try { document.execCommand('styleWithCSS', false, 'true'); } catch {}
    try { document.execCommand(cmd, false, val); } catch {}
    sync();
    window.scrollTo({ left: scrollX, top: scrollY, behavior: 'instant' as ScrollBehavior });
  };
  const setBlock = (tag: string) => exec('formatBlock', tag);
  const addLink = () => { rememberSelection(); const url = window.prompt('أدخل الرابط:'); if (url) exec('createLink', url.trim()); };

  return <div className="overflow-visible rounded-2xl border border-ivory-300 bg-white">
    <div className="sticky top-[80px] z-30 flex min-h-12 flex-nowrap items-center gap-1 overflow-x-auto overscroll-contain rounded-t-2xl border-b border-ivory-200 bg-ivory-50 p-1.5 shadow-sm [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <select title="نوع الخط" aria-label="نوع الخط" onMouseDown={() => rememberSelection()} onTouchStart={() => rememberSelection()} onChange={(e) => exec('fontName', e.target.value)} className="h-9 shrink-0 rounded-md border border-ivory-300 bg-white px-2 text-sm text-brand-800" defaultValue="">
        {FONTS.map((f) => <option key={f.label} value={f.value}>{f.label}</option>)}
      </select>
      <select title="حجم الخط" aria-label="حجم الخط" onMouseDown={() => rememberSelection()} onTouchStart={() => rememberSelection()} onChange={(e) => exec('fontSize', e.target.value)} className="h-9 shrink-0 rounded-md border border-ivory-300 bg-white px-2 text-sm text-brand-800" defaultValue="3">
        {SIZES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>
      <span className="mx-1 h-6 w-px shrink-0 bg-ivory-300" />
      <Btn title="عريض" onClick={() => exec('bold')}><b>ب</b></Btn><Btn title="مائل" onClick={() => exec('italic')}><i>م</i></Btn><Btn title="تحته خط" onClick={() => exec('underline')}><u>خ</u></Btn>
      <span className="mx-1 h-6 w-px shrink-0 bg-ivory-300" /><Btn title="عنوان" onClick={() => setBlock('H2')}>ع١</Btn><Btn title="عنوان فرعي" onClick={() => setBlock('H3')}>ع٢</Btn><Btn title="فقرة" onClick={() => setBlock('P')}>¶</Btn>
      <span className="mx-1 h-6 w-px shrink-0 bg-ivory-300" /><Btn title="محاذاة لليمين" onClick={() => exec('justifyRight')}>▷</Btn><Btn title="توسيط" onClick={() => exec('justifyCenter')}>≡</Btn><Btn title="محاذاة لليسار" onClick={() => exec('justifyLeft')}>◁</Btn><Btn title="ضبط" onClick={() => exec('justifyFull')}>☰</Btn>
      <span className="mx-1 h-6 w-px shrink-0 bg-ivory-300" /><Btn title="قائمة نقطية" onClick={() => exec('insertUnorderedList')}>•</Btn><Btn title="قائمة مرقّمة" onClick={() => exec('insertOrderedList')}>۱.</Btn><Btn title="اقتباس" onClick={() => setBlock('BLOCKQUOTE')}>❝</Btn><Btn title="رابط" onClick={addLink}>🔗</Btn>
      <span className="mx-1 h-6 w-px shrink-0 bg-ivory-300" />
      {COLORS.map((c) => <button key={c} type="button" title="لون النص" aria-label={`لون النص ${c}`} onMouseDown={(e) => e.preventDefault()} onTouchStart={(e) => e.preventDefault()} onClick={() => exec('foreColor', c)} className="h-7 w-7 shrink-0 touch-manipulation rounded-full border border-black/10" style={{ backgroundColor: c }} />)}
      <span className="mx-1 h-6 w-px shrink-0 bg-ivory-300" /><Btn title="مسح التنسيق" onClick={() => exec('removeFormat')}>⌫</Btn>
    </div>
    <div className="relative">{empty && <span className="pointer-events-none absolute right-6 top-5 text-muted/70">{placeholder}</span>}
      <div ref={ref} contentEditable dir="rtl" role="textbox" aria-multiline="true" aria-label="نص المقال" suppressContentEditableWarning onInput={sync} onBlur={sync} onKeyUp={rememberSelection} onMouseUp={rememberSelection} onTouchEnd={rememberSelection} className="article-prose block w-full px-4 py-5 text-[16px] leading-8 outline-none sm:px-6 sm:text-base" style={{ minHeight }} />
    </div>
    <p className="border-t border-ivory-200 bg-ivory-50/60 px-4 py-2 text-xs text-muted">حرّر النص مباشرةً كما سيظهر للقارئ — شريط الأدوات يبقى متاحًا أثناء الكتابة والتمرير.</p>
  </div>;
}
