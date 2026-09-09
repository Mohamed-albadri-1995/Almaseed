import { API_BASE } from './config';

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
    const res = await fetch(`${API_BASE}${path}`, {
      ...opts,
      signal: controller.signal,
    });
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text.slice(0, 200) || `خطأ ${res.status}` };
    }

    // A duplicated startup request can briefly hit a proxy/server rate limit.
    // Retry only once, and never spin in a retry loop.
    if (res.status === 429 && attempt === 0) {
      const retryAfter = Number(res.headers.get('retry-after'));
      const delay = Number.isFinite(retryAfter) && retryAfter > 0
        ? Math.min(retryAfter * 1000, 5000)
        : 1500;
      await sleep(delay);
      return j(path, opts, 1);
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

  materials: (category, q, page = 1) => {
    const sp = new URLSearchParams();
    if (category) sp.set('category', category);
    if (q) sp.set('q', q);
    sp.set('page', String(page));
    const path = `/api/mobile/materials?${sp.toString()}`;
    return getCached(path, () => j(path));
  },

  material: (id) => getCached(`/api/mobile/materials/${id}`, () => j(`/api/mobile/materials/${id}`)),
};
