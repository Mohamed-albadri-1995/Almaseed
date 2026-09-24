'use client';

import { useMemo, useRef, useState } from 'react';
import { nameKey } from '@/lib/names';

// Text input with the archive's existing values as suggestions (choose-or-add).
// If what was typed is only a spelling variant of an existing name («شيخ ابراهيم
// دنقول» vs «الشيخ إبراهيم دنقول»), offer the existing spelling in one tap so
// the same person isn't recorded under a new variant.
export function NameInput({
  id, name, defaultValue, required, suggestions, className = 'input',
}: {
  id: string;
  name: string;
  defaultValue?: string;
  required?: boolean;
  suggestions?: string[];
  className?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [match, setMatch] = useState<string | null>(null);
  const byKey = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of suggestions ?? []) { const k = nameKey(s); if (k && !m.has(k)) m.set(k, s); }
    return m;
  }, [suggestions]);
  const listId = `${id}-options`;
  const hasList = !!suggestions && suggestions.length > 0;

  const check = () => {
    const v = (ref.current?.value || '').trim();
    const existing = v ? byKey.get(nameKey(v)) : undefined;
    setMatch(existing && existing !== v ? existing : null);
  };

  return (
    <>
      <input
        ref={ref} id={id} name={name} type="text" defaultValue={defaultValue} required={required}
        className={className} list={hasList ? listId : undefined} autoComplete="off"
        onBlur={check} onChange={() => match && setMatch(null)}
      />
      {hasList && (
        <datalist id={listId}>
          {suggestions!.map((s) => <option key={s} value={s} />)}
        </datalist>
      )}
      {match && (
        <p className="mt-1.5 flex flex-wrap items-center gap-2 rounded-lg bg-gold-50 px-3 py-2 text-sm text-brand-800 ring-1 ring-gold-200">
          <span>موجود في الأرشيف باسم «{match}» — هل تقصده؟</span>
          <button
            type="button"
            className="font-bold text-brand-700 underline"
            onClick={() => { if (ref.current) ref.current.value = match; setMatch(null); }}
          >
            استخدم هذا الاسم
          </button>
        </p>
      )}
    </>
  );
}
