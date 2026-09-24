import { prisma } from './prisma';
import { saveUpload, storageConfigured } from './storage';

// Build a full JSON snapshot of every content table. Secrets (password hashes,
// reset/push tokens) are deliberately excluded. Shared by the admin download
// endpoint and the scheduled backup job.
export async function buildBackupJson(generatedBy = 'scheduled'): Promise<string> {
  const [
    categories, materials, reviewNotes, versions, ratings, comments,
    favorites, deletionRequests, deletionVotes, contentReports, users,
  ] = await Promise.all([
    prisma.category.findMany(),
    prisma.material.findMany(),
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

// Write a dated backup to durable object storage (R2). No-op when storage isn't
// configured. Returns the stored URL, or null.
export async function runScheduledBackupToStorage(): Promise<string | null> {
  if (!storageConfigured()) return null;
  const json = await buildBackupJson('scheduled');
  const date = new Date().toISOString().slice(0, 10);
  const name = `backups/almaseed-backup-${date}.json`;
  return saveUpload(name, Buffer.from(json, 'utf8'), 'application/json');
}
