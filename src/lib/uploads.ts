import { join } from 'path';

// Directory where uploaded files are stored. Locally defaults to
// public/uploads (served statically by Next). In a container deployment set
// UPLOADS_DIR to a path on a persistent volume, e.g. /data/uploads.
export function uploadsDir(): string {
  return process.env.UPLOADS_DIR || join(process.cwd(), 'public', 'uploads');
}
