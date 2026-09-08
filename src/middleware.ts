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
  return NextResponse.next();
}

export const config = {
  // Run on everything except Next's internal assets.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
