// Arabic-friendly formatting helpers.

const AR = 'ar-EG';

export function formatNumber(n: number | null | undefined): string {
  if (n == null) return '0';
  return new Intl.NumberFormat(AR).format(n);
}

// Short count for large numbers e.g. 1,248 -> ١٬٢٤٨
export function formatCount(n: number | null | undefined): string {
  return formatNumber(n ?? 0);
}

export function formatDuration(seconds?: number | null): string {
  if (!seconds || seconds <= 0) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatDurationLabel(seconds?: number | null): string {
  if (!seconds || seconds <= 0) return '';
  const m = Math.round(seconds / 60);
  if (m < 60) return `${formatNumber(m)} دقيقة`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `${formatNumber(h)} س ${formatNumber(rem)} د` : `${formatNumber(h)} ساعة`;
}

export function formatFileSize(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return '—';
  const mb = bytes / (1024 * 1024);
  if (mb < 1) return `${formatNumber(Math.round(bytes / 1024))} كيلوبايت`;
  return `${new Intl.NumberFormat(AR, { maximumFractionDigits: 1 }).format(mb)} ميجابايت`;
}

export function formatDate(date?: Date | string | null): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(AR, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(d);
}

export function formatDateTime(date?: Date | string | null): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(AR, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

// "منذ ٣ أيام"
export function timeAgo(date?: Date | string | null): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  const diff = Date.now() - d.getTime();
  const sec = Math.floor(diff / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  const rtf = new Intl.RelativeTimeFormat(AR, { numeric: 'auto' });
  if (day > 30) return formatDate(d);
  if (day > 0) return rtf.format(-day, 'day');
  if (hr > 0) return rtf.format(-hr, 'hour');
  if (min > 0) return rtf.format(-min, 'minute');
  return 'الآن';
}

export function splitKeywords(value?: string | null): string[] {
  if (!value) return [];
  return value
    .split(/[,،]/)
    .map((k) => k.trim())
    .filter(Boolean);
}
