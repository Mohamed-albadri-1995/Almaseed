import { indexNowKey } from '@/lib/indexnow';

export const dynamic = 'force-dynamic';

// IndexNow ownership proof (see lib/indexnow).
export function GET() {
  return new Response(indexNowKey(), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
