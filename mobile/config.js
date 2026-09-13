// Public site (used for the admin/contributor web pages opened in the app).
export const API_BASE = 'https://almaseeed.com';

// The mobile DATA API talks straight to the Railway origin, bypassing the
// Cloudflare proxy. Cloudflare was challenging the app's (non-browser) requests
// and answering 429 «الخادم مشغول», which blocked the feed; the origin serves
// the same /api/mobile endpoints directly and reliably.
export const API_HOST = 'https://almaseed-production.up.railway.app';

// Web pages opened inside the app for the admin/contributor options.
export const ADMIN_URL = `${API_BASE}/admin`;
export const CONTRIBUTOR_URL = `${API_BASE}/account`;

// Human-visible build marker. Bump this with every mobile change so it is
// obvious on the device which build is actually installed (shown on the
// account screen).
export const BUILD = 106;
