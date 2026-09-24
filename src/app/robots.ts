import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';

// Public content is crawlable; private/functional areas are not. The sitemap
// link tells crawlers where the full URL list lives.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin',
          '/admin/',
          '/account',
          '/account/',
          '/api/',
          '/login',
          '/register',
          '/reset-password',
          '/forgot-password',
          '/delete-account',
          '/mobile-login',
          '/mobile-bridge',
          '/uploads/',
        ],
      },
    ],
    sitemap: [`${SITE_URL}/sitemap.xml`, `${SITE_URL}/video-sitemap.xml`],
    host: SITE_URL,
  };
}
