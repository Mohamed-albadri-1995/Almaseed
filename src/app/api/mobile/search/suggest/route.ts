import { NextResponse } from 'next/server';
import { getSuggestions } from '@/lib/queries';

export const dynamic = 'force-dynamic';

// Search autocomplete for the app (served on the Railway origin, like the other
// /api/mobile/* endpoints, so it bypasses the CDN bot filter).
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get('q') ?? '';
  if (q.trim().length < 2) return NextResponse.json({ items: [] });
  const items = await getSuggestions(q.trim());
  return NextResponse.json({ items });
}
