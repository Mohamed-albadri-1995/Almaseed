import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { ROLES, type Role } from '@/lib/constants';

export const dynamic = 'force-dynamic';

// Admin-only full metadata backup: a single JSON snapshot of every content table
// so the archive's data (materials, categories, contributors, reviews, ratings,
// comments…) can be restored if the database is ever lost. Secrets (password
// hashes, reset tokens, push tokens) are deliberately excluded.
export async function GET() {
  const user = await getCurrentUser();
  if (!user || (user.role as Role) !== ROLES.ADMIN) {
    return new Response('Forbidden', { status: 403 });
  }

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
      generatedBy: user.email,
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

  const stamp = new Date().toISOString().slice(0, 10);
  const body = JSON.stringify(backup, null, 2);
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="almaseed-backup-${stamp}.json"`,
      'Cache-Control': 'no-store',
    },
  });
}
