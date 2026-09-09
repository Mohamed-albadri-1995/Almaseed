// Helpers that give a reviewer a quick read on whether a submission is worth
// publishing: whether the file size is plausible for its duration, and whether
// similar/duplicate material already exists.

export type InsightLevel = 'ok' | 'warn' | 'bad' | 'unknown';

export interface FileAssessment {
  level: InsightLevel;
  label: string;
  note: string;
  kbps?: number;
}

// Rough, format-aware bitrate sanity check. A wildly low bitrate usually means a
// truncated/corrupt upload; a wildly high one usually means the stored duration
// is wrong.
export function assessFile(
  kind?: string | null,
  fileSize?: number | null,
  durationSec?: number | null,
): FileAssessment {
  if (kind !== 'AUDIO' && kind !== 'VIDEO') {
    return { level: 'unknown', label: 'لا ينطبق', note: 'فحص التناسب يخص الصوت والفيديو فقط.' };
  }
  if (!fileSize || !durationSec) {
    return {
      level: 'unknown',
      label: 'بيانات ناقصة',
      note: 'لا تتوفر مدة المقطع أو حجمه لتقدير التناسب.',
    };
  }
  const kbps = Math.round((fileSize * 8) / durationSec / 1000);

  if (kind === 'AUDIO') {
    if (kbps < 24) return { level: 'bad', kbps, label: 'مؤشّر خلل محتمل', note: 'معدل منخفض جداً للصوت — قد يكون الملف ناقصاً أو تالفاً.' };
    if (kbps < 48) return { level: 'warn', kbps, label: 'يحتاج انتباهاً', note: 'معدل منخفض — جودة الصوت متدنية.' };
    if (kbps > 400) return { level: 'warn', kbps, label: 'يحتاج انتباهاً', note: 'معدل مرتفع للصوت — تأكّد من صحة المدة.' };
    return { level: 'ok', kbps, label: 'يبدو متناسباً', note: 'حجم الملف متناسب مع مدة المقطع.' };
  }
  // VIDEO
  if (kbps < 120) return { level: 'bad', kbps, label: 'مؤشّر خلل محتمل', note: 'معدل منخفض جداً للفيديو — قد يكون الملف ناقصاً.' };
  if (kbps < 300) return { level: 'warn', kbps, label: 'يحتاج انتباهاً', note: 'جودة الفيديو متدنية.' };
  if (kbps > 12000) return { level: 'warn', kbps, label: 'يحتاج انتباهاً', note: 'معدل مرتفع جداً — تأكّد من صحة المدة.' };
  return { level: 'ok', kbps, label: 'يبدو متناسباً', note: 'حجم الملف متناسب مع مدة المقطع.' };
}
