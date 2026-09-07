import { STATUS_LABELS, STATUS_TONE, type MaterialStatus } from '@/lib/constants';

const TONE_CLASS: Record<string, string> = {
  neutral: 'bg-ivory-200 text-muted',
  warning: 'bg-amber-100 text-amber-700',
  success: 'bg-emerald-100 text-emerald-700',
  info: 'bg-sky-100 text-sky-700',
  danger: 'bg-red-100 text-red-700',
};

export function StatusBadge({ status }: { status: string }) {
  const s = status as MaterialStatus;
  const tone = STATUS_TONE[s] ?? 'neutral';
  const label = STATUS_LABELS[s] ?? status;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${TONE_CLASS[tone]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {label}
    </span>
  );
}
