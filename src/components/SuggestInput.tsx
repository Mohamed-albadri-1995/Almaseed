'use client';

import { useId, useMemo, useState } from 'react';
import { normalizeArabic } from '@/lib/search';

// Text input with a small inline list of matching suggestions under it.
// Replaces <datalist>: on Android (and inside the app's WebView) a datalist
// opens a full-screen native popup of EVERY option that steals taps, covers the
// next field and makes the page jump — the reported «it resists» when moving on.
// Here only a few matches show, right below the field, and a tap fills it.
export function SuggestInput({
  name, value: controlled, onValueChange, defaultValue = '', suggestions, hints,
  placeholder, required, className = 'input', wrapperClassName = '', ariaLabel, id, onBlur, max = 8,
}: {
  name: string;
  value?: string;
  onValueChange?: (v: string) => void;
  defaultValue?: string;
  suggestions: string[];
  hints?: Record<string, string>; // e.g. «3 مادة» shown beside a suggestion
  placeholder?: string;
  required?: boolean;
  className?: string;
  wrapperClassName?: string;
  ariaLabel?: string;
  id?: string;
  onBlur?: (v: string) => void;
  max?: number;
}) {
  const [own, setOwn] = useState(defaultValue);
  const value = controlled ?? own;
  const set = (v: string) => { if (controlled === undefined) setOwn(v); onValueChange?.(v); };
  const [open, setOpen] = useState(false);
  const listId = useId();

  const matches = useMemo(() => {
    const q = normalizeArabic(value.trim());
    const uniq = Array.from(new Set(suggestions.filter(Boolean)));
    if (!q) return uniq.slice(0, max);
    const starts: string[] = [], contains: string[] = [];
    for (const s of uniq) {
      if (s === value) continue;
      const n = normalizeArabic(s);
      if (n.startsWith(q)) starts.push(s); else if (n.includes(q)) contains.push(s);
    }
    return starts.concat(contains).slice(0, max);
  }, [value, suggestions, max]);

  const show = open && matches.length > 0;

  return (
    <div className={`relative min-w-0 ${wrapperClassName}`}>
      <input
        id={id} name={name} type="text" value={value} required={required} placeholder={placeholder}
        aria-label={ariaLabel} autoComplete="off" role="combobox" aria-expanded={show} aria-controls={listId}
        className={`${className} w-full`}
        onChange={(e) => { set(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => { setOpen(false); onBlur?.(value.trim()); }}
        onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}
      />
      {show && (
        <ul
          id={listId} role="listbox"
          className="absolute inset-x-0 top-full z-30 mt-1 max-h-56 overflow-y-auto rounded-xl bg-white py-1 text-sm shadow-lg ring-1 ring-black/10"
        >
          {matches.map((s) => (
            <li key={s} role="option" aria-selected={false}>
              <button
                type="button"
                // mousedown/touch: keep focus in the input so blur doesn't close
                // the list before the tap lands.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { set(s); setOpen(false); }}
                className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-start hover:bg-ivory-50 active:bg-ivory-100"
              >
                <span className="min-w-0 break-words text-brand-800">{s}</span>
                {hints?.[s] && <span className="shrink-0 text-xs text-muted">{hints[s]}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
