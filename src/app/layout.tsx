import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import './fonts.css';
import './globals.css';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { getCurrentUser } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { recordVisit } from '@/lib/stats';
import { SITE_URL, SITE_NAME, SITE_NAME_SHORT, SITE_DESCRIPTION, OG_IMAGE, websiteJsonLd, organizationJsonLd, jsonLdString } from '@/lib/seo';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_NAME,
    template: `%s • ${SITE_NAME_SHORT}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME_SHORT,
  keywords: [
    'الطريقة السمّانية', 'السجادة السليمانية', 'أرشيف المسيد', 'المدائح', 'محاضرات', 'مواعظ',
    'ندوات', 'مناسبات', 'إنشاد', 'مديح', 'الطرق الصوفية', 'التصوف', 'السودان', 'مدائح نبوية',
  ],
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  category: 'religion',
  alternates: {
    canonical: '/',
    types: { 'application/rss+xml': `${SITE_URL}/feed.xml` },
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [{ url: '/logo.png', type: 'image/png' }],
    apple: [{ url: '/logo.png' }],
  },
  openGraph: {
    type: 'website',
    locale: 'ar_AR',
    url: SITE_URL,
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: SITE_NAME }],
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: [OG_IMAGE],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
};

export const viewport: Viewport = {
  themeColor: '#1f3d33',
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  // Count one visit only when the middleware judged this a genuine public page
  // view (real visitor, once per browser per day — not admin pages, assets, or
  // bots). Keeps the «زيارات» numbers meaningful instead of a raw hit counter.
  if (headers().get('x-count-visit') === '1') void recordVisit();
  const unread = user
    ? await prisma.notification.count({ where: { userId: user.id, read: false } })
    : 0;

  return (
    <html lang="ar" dir="rtl">
      <head>
        {/* Self-hosted fonts (src/app/fonts.css): no render-blocking third-party
            stylesheet. Preload the one face every page paints first. */}
        <link rel="preload" href="/fonts/cairo-arabic-0d2badd4.woff2" as="font" type="font/woff2" crossOrigin="" />
      </head>
      <body className="flex min-h-screen flex-col">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdString([websiteJsonLd(), organizationJsonLd()]) }}
        />
        <Navbar
          user={
            user
              ? { name: user.name, role: user.role, email: user.email, unread }
              : null
          }
        />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
