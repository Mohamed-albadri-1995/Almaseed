import { API_HOST } from './config';

// Server text can contain HTML entities (e.g. «&nbsp;» from the rich editor).
// Decode them for plain-text display. bodyText is intentionally NOT touched —
// it is rendered as HTML by ArticleHtml.
const PLAIN_FIELDS = ['title', 'subtitle', 'description', 'summary', 'lyrics', 'performer', 'speaker', 'host', 'narrator', 'author', 'occasion', 'organizer', 'participants', 'place', 'city', 'topic', 'source', 'contributor'];
function decodeEntitiesOnce(s) {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
}
function decodeEntities(s) {
  if (typeof s !== 'string') return s;
  // Some fields are double-encoded (e.g. «&amp;nbsp;»), so decode repeatedly
  // until the text stops changing (bounded to avoid any pathological loop).
  let out = s;
  for (let i = 0; i < 4; i++) {
    const next = decodeEntitiesOnce(out);
    if (next === out) break;
    out = next;
  }
  return out.trim();
}
function decodeItem(o) {
  if (!o || typeof o !== 'object') return o;
  for (const k of PLAIN_FIELDS) if (k in o) o[k] = decodeEntities(o[k]);
  if (o.category && o.category.name) o.category.name = decodeEntities(o.category.name);
  return o;
}
function decodeList(d) {
  if (d && Array.isArray(d.items)) d.items = d.items.map(decodeItem);
  return d;
}

// Network request timeout (milliseconds)
const REQUEST_TIMEOUT = 10000;
const CACHE_TTL = 30000;
const cache = new Map();
const pending = new Map();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function j(path, opts, attempt = 0) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    const res = await fetch(`${API_HOST}${path}`, {
      ...opts,
      // Present as a normal browser request so a CDN/WAF bot-filter (e.g.
      // Cloudflare Bot Fight Mode) doesn't flag the app's fetches and answer
      // with 429/403. Also identify the app for server-side allow-listing.
      headers: {
        Accept: 'application/json, text/plain, */*',
        'X-Almaseed-App': 'android',
        'User-Agent':
          'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 AlmaseedApp',
        ...(opts && opts.headers),
      },
      signal: controller.signal,
    });
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text.slice(0, 200) || `خطأ ${res.status}` };
    }

    // 429 can be temporary at the hosting/proxy layer. Back off progressively
    // instead of failing the app after a single short retry.
    if (res.status === 429 && attempt < 4) {
      const retryAfter = Number(res.headers.get('retry-after'));
      const backoff = 1500 * (2 ** attempt);
      const delay = Number.isFinite(retryAfter) && retryAfter > 0
        ? Math.min(retryAfter * 1000, 15000)
        : backoff;
      await sleep(delay);
      return j(path, opts, attempt + 1);
    }

    if (!res.ok) {
      if (res.status === 429) {
        throw new Error('الخادم مشغول حالياً، حاول مرة أخرى بعد قليل');
      }
      throw new Error(data.error || `خطأ ${res.status}`);
    }
    return data;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('انتهت مهلة الاتصال — تحقق من الاتصال بالإنترنت');
    }
    throw new Error(error.message || 'فشل الاتصال بالخادم');
  } finally {
    clearTimeout(timeoutId);
  }
}

function getCached(path, loader) {
  const now = Date.now();
  const hit = cache.get(path);
  if (hit && now - hit.time < CACHE_TTL) return Promise.resolve(hit.data);

  const existing = pending.get(path);
  if (existing) return existing;

  const request = loader()
    .then((data) => {
      cache.set(path, { time: Date.now(), data });
      return data;
    })
    .finally(() => pending.delete(path));

  pending.set(path, request);
  return request;
}

export const api = {
  login: (email, password) =>
    j('/api/mobile/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    }),

  categories: () => getCached('/api/mobile/categories', () => j('/api/mobile/categories')),

  materials: (category, q, page = 1, kind) => {
    const sp = new URLSearchParams();
    if (category) sp.set('category', category);
    if (q) sp.set('q', q);
    if (kind) sp.set('kind', kind);
    sp.set('page', String(page));
    const path = `/api/mobile/materials?${sp.toString()}`;
    return getCached(path, () => j(path).then(decodeList));
  },

  material: (id) => getCached(`/api/mobile/materials/${id}`, () => j(`/api/mobile/materials/${id}`).then(decodeItem)),

  // Recent published materials, newest first — the in-app notifications feed.
  notifications: () => j('/api/mobile/notifications').then(decodeList),

  // Resolve the signed-in user for a token (used after the Google web flow).
  me: (token) => j('/api/mobile/me', { headers: { Authorization: `Bearer ${token}` } }),

  // Register this device's FCM token so it receives push. When a staff member is
  // signed in, the bearer token tags the device with their role/id on the server.
  registerPush: (token, platform, authToken) =>
    j('/api/mobile/push/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      body: JSON.stringify({ token, platform }),
    }),
};
