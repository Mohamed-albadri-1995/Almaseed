'use client';

import { useMemo, useState } from 'react';
import { nameId } from '@/lib/names';
import { SuggestInput } from './SuggestInput';

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
  const [value, setValue] = useState(defaultValue ?? '');
  const [match, setMatch] = useState<string | null>(null);
  const byKey = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of suggestions ?? []) { const k = nameId(s); if (k && !m.has(k)) m.set(k, s); }
    return m;
  }, [suggestions]);

  const check = (v: string) => {
    const existing = v ? byKey.get(nameId(v)) : undefined;
    setMatch(existing && existing !== v ? existing : null);
  };

  return (
    <>
      <SuggestInput
        id={id} name={name} value={value} required={required} className={className}
        suggestions={suggestions ?? []}
        onValueChange={(v) => { setValue(v); if (match) setMatch(null); }}
        onBlur={check}
      />
      {match && (
        <p className="mt-1.5 flex flex-wrap items-center gap-2 rounded-lg bg-gold-50 px-3 py-2 text-sm text-brand-800 ring-1 ring-gold-200">
          <span>موجود في الأرشيف باسم «{match}» — هل تقصده؟</span>
          <button
            type="button"
            className="font-bold text-brand-700 underline"
            onClick={() => { setValue(match); setMatch(null); }}
          >
            استخدم هذا الاسم
          </button>
        </p>
      )}
    </>
  );
}
