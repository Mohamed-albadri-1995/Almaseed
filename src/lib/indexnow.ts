import { createHash } from 'crypto';
import { SITE_URL } from './seo';

// IndexNow: tells Bing, Yandex, Seznam, Naver… the moment a page is new or
// changed (published, or its automatic transcript added), instead of waiting
// for their next crawl. Google doesn't use IndexNow — it follows the sitemap
// (whose lastmod changes with the same update).
//
// The key is derived from AUTH_SECRET (stable, nothing to configure) and served
// at /indexnow-key.txt, which proves we own the site.
export function indexNowKey(): string {
  return createHash('sha256').update(`${process.env.AUTH_SECRET || 'dev'}:indexnow`).digest('hex').slice(0, 32);
}

export async function pingIndexNow(paths: string[]): Promise<void> {
  if (process.env.NODE_ENV !== 'production' || !paths.length) return;
  const host = new URL(SITE_URL).host;
  try {
    const res = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host,
        key: indexNowKey(),
        keyLocation: `${SITE_URL}/indexnow-key.txt`,
        urlList: paths.map((p) => `${SITE_URL}${p}`),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok && res.status !== 202) console.warn('[indexnow]', res.status, (await res.text()).slice(0, 200));
  } catch (e) {
    console.warn('[indexnow] ping failed', e instanceof Error ? e.message : e);
  }
}
