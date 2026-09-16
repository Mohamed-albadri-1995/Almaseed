import { NextResponse, type NextRequest } from 'next/server';

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

  const res = NextResponse.next();
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
