'use client';

// «توحيد» submit button that shows exactly what will happen before it runs:
// which spellings are ticked and the name they'll all become.
export function ConfirmUnify() {
  return (
    <button
      type="submit"
      className="btn-primary shrink-0"
      onClick={(e) => {
        const form = e.currentTarget.form;
        if (!form) return;
        const target = (form.elements.namedItem('target') as HTMLInputElement | null)?.value.trim() || '';
        const picked = Array.from(form.querySelectorAll<HTMLInputElement>('[name="names"]'))
          .filter((i) => (i.type === 'checkbox' ? i.checked : i.value.trim()))
          .map((i) => i.value.trim());
        if (!target || picked.length === 0) return;
        const msg = `سيتم تغيير:\n${picked.map((p) => `• ${p}`).join('\n')}\n\nإلى: «${target}»\n\nمتابعة؟`;
        if (!window.confirm(msg)) e.preventDefault();
      }}
    >
      توحيد
    </button>
  );
}
