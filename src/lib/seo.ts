// Central SEO helpers: the canonical site URL, absolute-URL building, and the
// JSON-LD (schema.org) builders used across pages. Keeping them here means every
// page emits consistent structured data and canonical links.

export const SITE_URL = (process.env.APP_URL || 'https://almaseeed.com').replace(/\/$/, '');

export const SITE_NAME = 'الطريقة السمّانية — السجادة السليمانية';
export const SITE_NAME_SHORT = 'أرشيف المسيد';
export const SITE_DESCRIPTION =
  'أرشيف الطريقة السمّانية السجادة السليمانية للمدائح والمحاضرات والنوادر والمواعظ والمناسبات والاحتفالات — نجمع ونحفظ وننظّم ما يستحق أن يبقى قريباً من القلب.';

// The default social-share image (1200×630 recommended). hero-banner.jpg ships
// in /public and reads well as a branded card.
export const OG_IMAGE = '/hero-banner.jpg';

// Make a relative path absolute against the site origin; pass through anything
// already absolute (an R2/S3 cover URL, a data URI, …).
export function absUrl(path?: string | null): string | undefined {
  if (!path) return undefined;
  if (/^https?:\/\//i.test(path) || path.startsWith('data:')) return path;
  return `${SITE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}

// A trimmed, single-line description of a given length — safe for meta tags.
export function clampDescription(text?: string | null, max = 160): string | undefined {
  if (!text) return undefined;
  const clean = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  if (!clean) return undefined;
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

type Json = Record<string, unknown>;

// WebSite node with a search action, so Google can show a sitelinks searchbox
// pointing at our archive search.
export function websiteJsonLd(): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    alternateName: SITE_NAME_SHORT,
    url: SITE_URL,
    inLanguage: 'ar',
    description: SITE_DESCRIPTION,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE_URL}/archive?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

// Organization node — brand identity for the knowledge panel.
export function organizationJsonLd(): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    alternateName: SITE_NAME_SHORT,
    url: SITE_URL,
    logo: absUrl('/logo.png'),
    description: SITE_DESCRIPTION,
  };
}

// A breadcrumb trail (Home → … → current).
export function breadcrumbJsonLd(items: { name: string; url: string }[]): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: absUrl(it.url),
    })),
  };
}

// An ordered list of links (categories on the home page, results on a listing
// page) — helps search engines understand the page as a collection.
export function itemListJsonLd(name: string, items: { name: string; url: string }[]): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name,
    numberOfItems: items.length,
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      url: absUrl(it.url),
    })),
  };
}

// Image rights metadata (Google «Image metadata» / IPTC fields). Every
// ImageObject we emit carries who to credit, the copyright notice, the terms
// page (license) and where to ask for permission (acquireLicensePage).
export function imageRights(credit?: string | null): Json {
  const who = (credit && credit.trim()) || SITE_NAME;
  return {
    creditText: who === SITE_NAME ? SITE_NAME : `${who} — ${SITE_NAME}`,
    copyrightNotice: `© ${SITE_NAME}`,
    license: `${SITE_URL}/policy`,
    acquireLicensePage: `${SITE_URL}/contact`,
    creator: { '@type': who === SITE_NAME ? 'Organization' : 'Person', name: who },
  };
}

// The main entity for a single material, typed by its media kind so search
// engines index it as audio / video / image / article correctly.
export function materialJsonLd(m: {
  id: string;
  title: string;
  description?: string | null;
  fileUrl?: string | null;
  fileKind?: string | null;
  coverImage?: string | null;
  durationSec?: number | null;
  publishedAt?: Date | string | null;
  updatedAt?: Date | string | null;
  author?: string | null;
  categoryName?: string | null;
  contributor?: string | null;
}): Json {
  const url = `${SITE_URL}/material/${m.id}`;
  const kind = m.fileUrl ? m.fileKind : 'ARTICLE';
  const type =
    kind === 'AUDIO' ? 'AudioObject'
    : kind === 'VIDEO' ? 'VideoObject'
    : kind === 'IMAGE' ? 'ImageObject'
    : 'Article';
  const iso = (d?: Date | string | null) => (d ? new Date(d).toISOString() : undefined);
  // ISO-8601 duration (PT#M#S) for audio/video.
  const dur = m.durationSec && m.durationSec > 0
    ? `PT${Math.floor(m.durationSec / 60)}M${m.durationSec % 60}S`
    : undefined;

  const node: Json = {
    '@context': 'https://schema.org',
    '@type': type,
    name: m.title,
    headline: m.title,
    url,
    mainEntityOfPage: url,
    inLanguage: 'ar',
    description: clampDescription(m.description, 300) || m.title,
    datePublished: iso(m.publishedAt),
    dateModified: iso(m.updatedAt) || iso(m.publishedAt),
    isPartOf: m.categoryName || undefined,
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      logo: { '@type': 'ImageObject', url: absUrl('/logo.png'), contentUrl: absUrl('/logo.png'), ...imageRights() },
    },
  };
  const credit = m.author || m.contributor || null;
  if (m.coverImage || type === 'ImageObject') {
    const imgUrl = absUrl(m.coverImage) || absUrl(m.fileUrl) || absUrl(OG_IMAGE);
    node.image = { '@type': 'ImageObject', url: imgUrl, contentUrl: imgUrl, ...imageRights(credit) };
  }
  if (type === 'AudioObject' || type === 'VideoObject') {
    if (m.fileUrl) node.contentUrl = absUrl(m.fileUrl);
    if (dur) node.duration = dur;
    if (type === 'VideoObject') node.thumbnailUrl = absUrl(m.coverImage) || absUrl(OG_IMAGE);
    node.uploadDate = iso(m.publishedAt);
  }
  if (type === 'ImageObject') {
    if (m.fileUrl) node.contentUrl = absUrl(m.fileUrl);
    Object.assign(node, imageRights(credit));
  }
  if (type === 'Article') {
    node.author = { '@type': m.author ? 'Person' : 'Organization', name: m.author || SITE_NAME };
  }
  if (m.author || m.contributor) {
    node.creator = { '@type': 'Person', name: m.author || m.contributor };
  }
  return node;
}

// Serialize a JSON-LD object for a <script type="application/ld+json"> tag,
// escaping the closing-tag sequence so it can't break out of the script.
export function jsonLdString(obj: Json | Json[]): string {
  return JSON.stringify(obj).replace(/</g, '\\u003c');
}
