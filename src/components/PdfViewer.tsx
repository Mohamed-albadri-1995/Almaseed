import { Icon } from './icons';

// Inline document viewer. PDFs render in-page (iframe); other document types
// fall back to an open-in-new-tab action since browsers can't display them inline.
export function PdfViewer({
  url,
  fileType,
  title,
}: {
  url: string;
  fileType?: string | null;
  title?: string;
}) {
  const isPdf = (fileType || '').toUpperCase() === 'PDF' || /\.pdf($|\?)/i.test(url);

  if (!isPdf) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 rounded-2xl border border-brand-200 bg-brand-50/50 p-6 text-brand-700 hover:bg-brand-50"
      >
        <Icon.file width={22} height={22} />
        فتح المستند {fileType ? `(${fileType})` : ''}
      </a>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-ivory-300 bg-white">
      <iframe
        src={`${url}#view=FitH&toolbar=1`}
        title={title || 'مستند'}
        className="h-[78vh] w-full bg-ivory-100"
      />
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ivory-200 bg-ivory-50 px-4 py-2">
        <span className="text-xs text-muted">إن لم يظهر المستند هنا، افتحه في نافذة جديدة.</span>
        <div className="flex gap-2">
          <a href={url} target="_blank" rel="noopener noreferrer" className="btn-outline px-3 py-1.5 text-xs">
            فتح في نافذة
          </a>
          <a href={url} download className="btn-primary px-3 py-1.5 text-xs">
            تنزيل
          </a>
        </div>
      </div>
    </div>
  );
}
