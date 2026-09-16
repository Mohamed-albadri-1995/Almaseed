import { NextResponse, type NextRequest } from 'next/server';

// Known crawlers / link-preview fetchers — never counted as human visits.
const BOT_RE = /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|whatsapp|telegram|embedly|quora|pinterest|vkshare|preview|scanner|monitor|semrush|ahrefs|mj12|dotbot|petalbot|python-requests|okhttp|curl|wget|headless|lighthouse|uptime/i;
// Requests for files/assets — not page views.
const ASSET_RE = /\.(png|jpe?g|gif|webp|svg|ico|css|js|mjs|map|txt|xml|json|woff2?|ttf|otf|eot|mp3|m4a|mp4|webm|pdf)$/i;

function todayStr(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
}

// Force HTTPS: if a visitor reaches the app over http (Railway forwards the
// original scheme in x-forwarded-proto), redirect them to the https URL so
// browsers never show the "not secure / not encrypted" warning.
export function middleware(req: NextRequest) {
  const proto = req.headers.get('x-forwarded-proto');
  if (proto && proto.split(',')[0].trim() === 'http') {
    const url = req.nextUrl.clone();
    url.protocol = 'https:';
    url.port = '';
    return NextResponse.redirect(url, 308);
  }

  const { pathname } = req.nextUrl;

  // Decide whether THIS request counts as a real public visit. The old counter
  // fired on every page render (in the root layout), so it inflated the numbers
  // with the owner's own admin browsing, the app's review WebViews, bots, and
  // every extra page a single visitor opened. Here we count a genuine page view
  // — not an asset, API call, RSC/prefetch fetch, or admin-panel page — at most
  // once per browser per day, and never for known crawlers. The decision is
  // passed to the layout via the `x-count-visit` request header.
  const today = todayStr();
  let countVisit = false;
  const isPage =
    req.method === 'GET' &&
    !pathname.startsWith('/api') &&
    !pathname.startsWith('/admin') &&
    !pathname.startsWith('/_next') &&
    !ASSET_RE.test(pathname) &&
    req.headers.get('rsc') !== '1' &&
    req.headers.get('next-router-prefetch') !== '1' &&
    req.headers.get('purpose') !== 'prefetch';
  if (isPage) {
    const ua = req.headers.get('user-agent') || '';
    const seen = req.cookies.get('almaseed_v')?.value;
    if (ua && !BOT_RE.test(ua) && seen !== today) countVisit = true;
  }

  const requestHeaders = new Headers(req.headers);
  if (countVisit) requestHeaders.set('x-count-visit', '1');

  const res = NextResponse.next({ request: { headers: requestHeaders } });

  if (countVisit) {
    // Mark this browser as counted for today; expires after ~26h so tomorrow's
    // visit counts again as a fresh daily visitor.
    res.cookies.set('almaseed_v', today, {
      maxAge: 60 * 60 * 26,
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
    });
  }

  // Never let a logged-in user's page be cached by Cloudflare or the app's
  // WebView. Their HTML is personalized (the navbar shows their account +
  // «تسجيل الخروج»), and a cached copy served stale pages inside the app —
  // e.g. a freshly deployed logout button not appearing. Static assets are
  // excluded by the matcher below, so this only touches dynamic pages.
  if (req.cookies.has('almaseed_session')) {
    res.headers.set('Cache-Control', 'private, no-store, must-revalidate');
  }
  return res;
}

export const config = {
  // Run on everything except Next's internal assets.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
