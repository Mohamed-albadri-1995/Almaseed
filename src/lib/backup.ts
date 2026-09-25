import { prisma } from './prisma';
import { createHmac } from 'crypto';
import { gzipSync } from 'zlib';
import { saveUpload, storageConfigured, deleteUpload } from './storage';
import { sendEmail, isEmailConfigured } from './email';
import { logActivity } from './activity';

// Build a full JSON snapshot of every content table. Secrets (password hashes,
// reset/push tokens) are deliberately excluded. Shared by the admin download
// endpoint and the scheduled backup job.
export async function buildBackupJson(generatedBy = 'scheduled'): Promise<string> {
  const [
    categories, materials, reviewNotes, versions, ratings, comments,
    favorites, deletionRequests, deletionVotes, contentReports, users,
  ] = await Promise.all([
    prisma.category.findMany(),
    // Transcripts are omitted from queries by default — a backup needs them.
    prisma.material.findMany({ omit: { transcript: false, transcriptSearch: false } }),
    prisma.reviewNote.findMany(),
    prisma.materialVersion.findMany(),
    prisma.rating.findMany(),
    prisma.comment.findMany(),
    prisma.favorite.findMany(),
    prisma.deletionRequest.findMany(),
    prisma.deletionVote.findMany(),
    prisma.contentReport.findMany(),
    prisma.user.findMany({
      select: {
        id: true, name: true, email: true, role: true, active: true,
        assignedCategories: true, createdAt: true,
      },
    }),
  ]);

  const backup = {
    meta: {
      site: 'almaseeed.com',
      generatedAt: new Date().toISOString(),
      generatedBy,
      version: 1,
      counts: {
        categories: categories.length,
        materials: materials.length,
        users: users.length,
        reviewNotes: reviewNotes.length,
        versions: versions.length,
        ratings: ratings.length,
        comments: comments.length,
        favorites: favorites.length,
        deletionRequests: deletionRequests.length,
        deletionVotes: deletionVotes.length,
        contentReports: contentReports.length,
      },
    },
    data: {
      categories, users, materials, reviewNotes, versions, ratings,
      comments, favorites, deletionRequests, deletionVotes, contentReports,
    },
  };

  return JSON.stringify(backup, null, 2);
}

// The media bucket is served publicly (files must be playable), so a backup —
// which holds contributors' emails and unpublished material data — must never
// sit at a guessable path. The folder name is an HMAC of the server secret:
// stable (same-day reruns overwrite, old files can be pruned) yet unguessable,
// and public buckets don't allow listing. Visible only in the R2 dashboard.
function backupPrefix(): string {
  const secret = process.env.AUTH_SECRET || 'insecure-dev-secret';
  return createHmac('sha256', secret).update('almaseed-backup-prefix').digest('hex').slice(0, 40);
}
function backupKey(date: string): string {
  return `backups/${backupPrefix()}/almaseed-backup-${date}.json`;
}
const RETAIN_DAYS = 30;

// The first version of the scheduled backup wrote to a GUESSABLE public path
// (backups/almaseed-backup-<date>.json). Delete any such file for recent days.
// Runs at worker start; idempotent (deleting a missing object is a no-op).
export async function cleanupLegacyBackups(publicBase: string): Promise<void> {
  const base = publicBase.replace(/\/$/, '') + '/';
  for (let i = 0; i < 21; i++) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    await deleteUpload(`${base}backups/almaseed-backup-${d}.json`).catch(() => {});
  }
}

// Write today's backup to durable object storage (R2) and prune the copy that
// just fell out of the retention window. No-op when storage isn't configured.
// Returns a log-safe label (never the full secret URL), or null.
export async function runScheduledBackupToStorage(): Promise<string | null> {
  if (!storageConfigured()) return null;
  const json = await buildBackupJson('scheduled');
  const today = new Date().toISOString().slice(0, 10);
  const key = backupKey(today);
  const url = await saveUpload(key, Buffer.from(json, 'utf8'), 'application/json');

  // Retention: delete the file from RETAIN_DAYS days ago (names are
  // deterministic, so no listing is needed).
  const old = new Date(Date.now() - RETAIN_DAYS * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const base = url.slice(0, url.length - key.length);
  await deleteUpload(base + backupKey(old)).catch(() => {});

  return `backups/…/almaseed-backup-${today}.json (${Math.round(json.length / 1024)} KB, keeps ${RETAIN_DAYS} days)`;
}

// Off-site copy: once a week, email the backup (gzipped) to the owner, so the
// archive's data survives even if the R2 account itself is lost. Recipient:
// BACKUP_EMAIL, else the first active admin. At most one per 6 days — tracked in
// the activity log, so worker restarts on deploy never send duplicates.
export async function emailWeeklyBackup(): Promise<string | null> {
  if (!isEmailConfigured()) return null;
  const since = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);
  const recent = await prisma.activityLog.findFirst({ where: { action: 'backup_email', createdAt: { gte: since } } });
  if (recent) return null;

  const to = process.env.BACKUP_EMAIL
    || (await prisma.user.findFirst({ where: { role: 'ADMIN', active: true }, orderBy: { createdAt: 'asc' }, select: { email: true } }))?.email;
  if (!to) return null;

  const json = await buildBackupJson('weekly-email');
  const gz = gzipSync(Buffer.from(json, 'utf8'));
  const date = new Date().toISOString().slice(0, 10);
  const counts = (JSON.parse(json) as { meta: { counts: Record<string, number> } }).meta.counts;
  const ok = await sendEmail({
    to,
    subject: `نسخة احتياطية أسبوعية — أرشيف المسيد ${date}`,
    html: `<div dir="rtl" style="font-family:sans-serif;line-height:1.8">
      <p>مرفق نسخة احتياطية كاملة من بيانات أرشيف المسيد بتاريخ ${date}.</p>
      <p>المواد: ${counts.materials} · المستخدمون: ${counts.users} · الأقسام: ${counts.categories}</p>
      <p>احتفظ بهذه الرسالة؛ يمكن استرجاع الأرشيف منها عند الحاجة. الملفات نفسها (الصوت والفيديو) محفوظة في التخزين السحابي ولا تحتاج نسخًا.</p>
    </div>`,
    attachments: [{ filename: `almaseed-backup-${date}.json.gz`, content: gz.toString('base64') }],
  });
  if (!ok) return null;
  await logActivity({ action: 'backup_email', entity: 'system', meta: { date, bytes: gz.length } });
  return `emailed ${Math.round(gz.length / 1024)} KB`;
}
