import { getCurrentUser } from '@/lib/session';
import { ROLES, type Role } from '@/lib/constants';
import { buildBackupJson } from '@/lib/backup';

export const dynamic = 'force-dynamic';

// Admin-only full metadata backup: a single JSON snapshot of every content table
// so the archive's data can be restored if the database is ever lost.
export async function GET() {
  const user = await getCurrentUser();
  if (!user || (user.role as Role) !== ROLES.ADMIN) {
    return new Response('Forbidden', { status: 403 });
  }

  const body = await buildBackupJson(user.email);
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="almaseed-backup-${stamp}.json"`,
      'Cache-Control': 'no-store',
    },
  });
}
