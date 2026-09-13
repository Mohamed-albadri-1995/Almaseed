import { Icon } from './icons';

// A small, eye-catching inline hint. Used inside the submission steps and other
// spots where a contributor needs a nudge right where they are.
export function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-gold-200 bg-gold-50 px-3.5 py-3 text-sm text-brand-900">
      <span className="mt-0.5 shrink-0 text-gold-600">
        <Icon.sparkle width={18} height={18} />
      </span>
      <p className="leading-6">{children}</p>
    </div>
  );
}
