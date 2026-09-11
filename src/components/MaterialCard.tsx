import Link from 'next/link';
import { Icon } from './icons';
import { StatusBadge } from './StatusBadge';
import { FILE_KIND_LABELS, type FileKind } from '@/lib/constants';
import { getPrimaryPerson } from '@/lib/fields';
import { formatCount, formatDurationLabel } from '@/lib/format';

export interface MaterialCardData {
  id: string;
  title: string;
  status?: string;
  fileKind?: string | null;
  fileUrl?: string | null;
  fileType?: string | null;
  durationSec?: number | null;
  performer?: string | null;
  speaker?: string | null;
  host?: string | null;
  organizer?: string | null;
  author?: string | null;
  occasion?: string | null;
  plays?: number;
  downloads?: number;
  category?: { name: string; slug: string } | null;
}

// Show the headline person/author that matches the material's type, so a book
// shows its كاتب and a madeeh shows its مادح — never a mismatched field.
function personLabel(m: MaterialCardData): string | null {
  const primary = getPrimaryPerson(m.category?.slug ?? '');
  if (primary) {
    const v = (m as unknown as Record<string, unknown>)[primary.field];
    if (typeof v === 'string' && v) return v;
  }
  return m.performer || m.speaker || m.host || null;
}

const KIND_ICON: Record<string, keyof typeof Icon> = {
  AUDIO: 'headphones',
  VIDEO: 'video',
  DOCUMENT: 'file',
  IMAGE: 'image',
};

export function MaterialCard({
  material,
  showStatus = false,
}: {
  material: MaterialCardData;
  showStatus?: boolean;
}) {
  // A material with no file is a written article (مقال) — never audio. Detect it
  // by the absence of a file so even an old row with a stray fileKind is right.
  const isWritten = !material.fileUrl;
  const kind = material.fileKind ?? 'AUDIO';
  const KindIcon = isWritten ? Icon.edit : Icon[KIND_ICON[kind] ?? 'headphones'];
  const person = personLabel(material);

  return (
    <div className="card group flex flex-col overflow-hidden transition hover:shadow-card-hover">
      {/* Cover strip */}
      <Link
        href={`/material/${material.id}`}
        className="relative flex h-28 items-center justify-center bg-gradient-to-br from-brand-700 to-brand-800"
      >
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10 text-gold-300 ring-1 ring-white/15">
          <KindIcon width={26} height={26} />
        </span>
        {material.category && (
          <span className="absolute right-3 top-3 rounded-full bg-black/25 px-2.5 py-1 text-xs font-medium text-ivory-50">
            {material.category.name}
          </span>
        )}
        {material.fileType && (
          <span className="absolute left-3 top-3 rounded-md bg-gold-400 px-2 py-0.5 text-[10px] font-bold text-brand-900">
            {material.fileType}
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col p-4">
        <div className="mb-1 flex items-start justify-between gap-2">
          <Link
            href={`/material/${material.id}`}
            className="line-clamp-2 font-bold leading-6 text-brand-800 hover:text-brand-600"
          >
            {material.title}
          </Link>
        </div>

        {person && <p className="mb-2 text-sm text-muted">{person}</p>}

        <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          {material.durationSec ? (
            <span className="inline-flex items-center gap-1">
              <Icon.clock width={13} height={13} />
              {formatDurationLabel(material.durationSec)}
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1">
            {isWritten ? 'مقال' : FILE_KIND_LABELS[kind as FileKind]}
          </span>
          {typeof material.plays === 'number' && material.plays > 0 && (
            <span className="inline-flex items-center gap-1">
              <Icon.play width={11} height={11} />
              {formatCount(material.plays)}
            </span>
          )}
        </div>

        <div className="mt-auto flex items-center justify-between gap-2">
          {showStatus && material.status ? (
            <StatusBadge status={material.status} />
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <Link
              href={`/material/${material.id}`}
              className="btn-outline px-3 py-1.5 text-xs"
            >
              التفاصيل
            </Link>
            <Link
              href={`/material/${material.id}`}
              aria-label="تشغيل"
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-700 text-ivory-50 transition hover:bg-brand-800"
            >
              <Icon.play width={16} height={16} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
