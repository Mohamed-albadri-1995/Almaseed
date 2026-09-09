import { API_BASE } from './config';

// Network request timeout (milliseconds)
const REQUEST_TIMEOUT = 10000; // 10 seconds

async function j(path, opts) {
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
    if (!res.ok) throw new Error(data.error || `خطأ ${res.status}`);
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

export const api = {
  login: (email, password) =>
    j('/api/mobile/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    }),
  categories: () => j('/api/mobile/categories'),
  materials: (category, q, page = 1) => {
    const sp = new URLSearchParams();
    if (category) sp.set('category', category);
    if (q) sp.set('q', q);
    sp.set('page', String(page));
    return j(`/api/mobile/materials?${sp.toString()}`);
  },
  material: (id) => j(`/api/mobile/materials/${id}`),
};
