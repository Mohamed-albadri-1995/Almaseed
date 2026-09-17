'use client';

import { useEffect, useState } from 'react';

// A gentle, one-time "look here" coach-mark for first-time users. It wraps a key
// element and, only on the visitor's first encounter, floats an animated
// «انظر هنا» pointer above it with a soft glowing ring around the element —
// as if telling the user "focus here". It disappears the moment the user
// interacts with it (or taps the pointer) and never shows again on this device.
//
// It is deliberately non-blocking: the click that dismisses the cue still
// reaches the wrapped element, so tapping the target both opens it and clears
// the cue. Rendering the cue only after mount avoids any hydration mismatch.
export function FirstUseCue({
  id,
  label = 'انظر هنا',
  align = 'start',
  children,
}: {
  id: string;
  label?: string;
  align?: 'start' | 'center' | 'end';
  children: React.ReactNode;
}) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem('almaseed:cue:' + id)) setShow(true);
    } catch {
      /* storage unavailable (private mode) — just skip the cue */
    }
  }, [id]);

  const dismiss = () => {
    setShow(false);
    try {
      localStorage.setItem('almaseed:cue:' + id, '1');
    } catch {
      /* ignore */
    }
  };

  const pos =
    align === 'center' ? 'left-1/2 -translate-x-1/2' : align === 'end' ? 'left-3' : 'right-3';
  const arrowPos = align === 'center' ? 'left-1/2 -translate-x-1/2' : align === 'end' ? 'left-6' : 'right-6';

  return (
    <div className="relative" onClickCapture={show ? dismiss : undefined}>
      {show && (
        <>
          {/* Soft glowing ring around the target */}
          <span
            aria-hidden
            className="guide-attn pointer-events-none absolute -inset-1 z-10 rounded-3xl ring-2 ring-gold-400/70"
          />
          {/* Floating pointer above the target */}
          <div className={`absolute -top-2 z-20 -translate-y-full ${pos}`}>
            <button
              type="button"
              onClick={dismiss}
              className="cue-float flex items-center gap-1.5 rounded-full bg-gold-500 px-3.5 py-1.5 text-xs font-extrabold text-white shadow-lg ring-1 ring-black/5"
            >
              <span aria-hidden>👀</span>
              {label}
            </button>
            <span
              aria-hidden
              className={`cue-float absolute top-full text-lg leading-none text-gold-500 ${arrowPos}`}
            >
              ▾
            </span>
          </div>
        </>
      )}
      {children}
    </div>
  );
}
