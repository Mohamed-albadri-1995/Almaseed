import type { MetadataRoute } from 'next';
import { SITE_NAME, SITE_NAME_SHORT, SITE_DESCRIPTION } from '@/lib/seo';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: SITE_NAME_SHORT,
    description: SITE_DESCRIPTION,
    start_url: '/',
    display: 'standalone',
    background_color: '#1f3d33',
    theme_color: '#1f3d33',
    lang: 'ar',
    dir: 'rtl',
    categories: ['education', 'books', 'lifestyle'],
    icons: [
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
