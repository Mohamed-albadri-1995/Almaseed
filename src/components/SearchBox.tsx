'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from './icons';

interface Suggestion {
  id: string;
  title: string;
  subtitle: string;
}

// Search input with live autocomplete suggestions. Submitting goes to /search.
export function SearchBox({
  defaultValue = '',
  autoFocus = false,
  variant = 'light',
}: {
  defaultValue?: string;
  autoFocus?: boolean;
  variant?: 'light' | 'plain';
}) {
  const router = useRouter();
  const [q, setQ] = useState(defaultValue);
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (q.trim().length < 2) {
      setItems([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search/suggest?q=${encodeURIComponent(q)}`, {
          signal: ctrl.signal,
        });
        const data = await res.json();
        setItems(data.items ?? []);
        setOpen(true);
        setActive(-1);
      } catch {
        /* ignore aborted */
      }
    }, 180);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const go = (query: string) => {
    setOpen(false);
    router.push(`/search?q=${encodeURIComponent(query)}`);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open || items.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter' && active >= 0) {
      e.preventDefault();
      router.push(`/material/${items[active].id}`);
      setOpen(false);
    }
  };

  return (
    <div ref={boxRef} className="relative">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          go(q);
        }}
      >
        <div className="flex items-center gap-2 rounded-2xl bg-ivory-50 p-2 shadow-lg">
          <span className="pr-2 text-muted">
            <Icon.search width={20} height={20} />
          </span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => items.length && setOpen(true)}
            onKeyDown={onKeyDown}
            type="search"
            autoFocus={autoFocus}
            placeholder="ابحث عن مدحة، مادح، محاضر، موضوع أو مناسبة…"
            className="flex-1 bg-transparent px-1 py-2 text-sm text-ink outline-none placeholder:text-muted/70"
            aria-label="بحث"
          />
          <button type="submit" className="btn-primary shrink-0">بحث</button>
        </div>
      </form>

      {open && items.length > 0 && (
        <ul className="absolute z-30 mt-2 w-full overflow-hidden rounded-2xl bg-white text-right shadow-card ring-1 ring-black/5">
          {items.map((it, i) => (
            <li key={it.id}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => router.push(`/material/${it.id}`)}
                className={`flex w-full items-center gap-3 px-4 py-2.5 text-right ${
                  active === i ? 'bg-brand-50' : 'hover:bg-ivory-100'
                }`}
              >
                <span className="text-brand-400">
                  <Icon.search width={16} height={16} />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-brand-800">{it.title}</span>
                  {it.subtitle && <span className="block truncate text-xs text-muted">{it.subtitle}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
