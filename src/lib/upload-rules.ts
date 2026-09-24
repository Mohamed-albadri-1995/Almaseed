import { randomBytes } from 'crypto';
import { FILE_KINDS } from './constants';

// Single source of truth for what may be uploaded (was duplicated in the web and
// mobile upload routes): allowed extensions → file kind, and the size cap.
export const MAX_UPLOAD_SIZE = 200 * 1024 * 1024; // 200MB

export const EXT_KIND: Record<string, string> = {
  // Audio (incl. common device-recorder outputs)
  mp3: FILE_KINDS.AUDIO, wav: FILE_KINDS.AUDIO, m4a: FILE_KINDS.AUDIO,
  ogg: FILE_KINDS.AUDIO, oga: FILE_KINDS.AUDIO, aac: FILE_KINDS.AUDIO,
  opus: FILE_KINDS.AUDIO, amr: FILE_KINDS.AUDIO, weba: FILE_KINDS.AUDIO,
  // Video (incl. common device-recorder outputs)
  mp4: FILE_KINDS.VIDEO, m4v: FILE_KINDS.VIDEO, mov: FILE_KINDS.VIDEO,
  webm: FILE_KINDS.VIDEO, '3gp': FILE_KINDS.VIDEO, '3gpp': FILE_KINDS.VIDEO,
  mkv: FILE_KINDS.VIDEO, avi: FILE_KINDS.VIDEO,
  // Documents & images
  pdf: FILE_KINDS.DOCUMENT, doc: FILE_KINDS.DOCUMENT, docx: FILE_KINDS.DOCUMENT,
  jpg: FILE_KINDS.IMAGE, jpeg: FILE_KINDS.IMAGE, png: FILE_KINDS.IMAGE, webp: FILE_KINDS.IMAGE,
};

// A safe content type per extension, used when the client reports none (or a
// generic one) so the stored object is served with the right type.
const EXT_MIME: Record<string, string> = {
  mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/mp4', ogg: 'audio/ogg', oga: 'audio/ogg',
  aac: 'audio/aac', opus: 'audio/ogg', amr: 'audio/amr', weba: 'audio/webm',
  mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm',
  '3gp': 'video/3gpp', '3gpp': 'video/3gpp', mkv: 'video/x-matroska', avi: 'video/x-msvideo',
  pdf: 'application/pdf', doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
};

export type UploadPlan =
  | { ok: true; ext: string; kind: string; key: string; contentType: string; size: number }
  | { ok: false; error: string };

// Validate a would-be upload (by file name + declared size) and pick its
// storage key. Used by both the direct-to-storage (presign) and server paths.
export function planUpload(fileName: string, size: number, clientType?: string | null): UploadPlan {
  const ext = (String(fileName || '').split('.').pop() || '').toLowerCase();
  const kind = EXT_KIND[ext];
  if (!kind) return { ok: false, error: 'نوع الملف غير مدعوم' };
  if (!Number.isFinite(size) || size <= 0) return { ok: false, error: 'حجم الملف غير صالح' };
  if (size > MAX_UPLOAD_SIZE) return { ok: false, error: 'حجم الملف يتجاوز الحد المسموح (200 ميجابايت)' };
  const t = (clientType || '').toLowerCase();
  const contentType = t && t !== 'application/octet-stream' && /^[a-z]+\/[a-z0-9.+-]+$/.test(t) ? t : (EXT_MIME[ext] || 'application/octet-stream');
  return { ok: true, ext, kind, key: `${randomBytes(8).toString('hex')}.${ext}`, contentType, size };
}
