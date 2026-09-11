// OS push notifications via Firebase Cloud Messaging (FCM HTTP v1).
//
// When new content is published, every registered device receives an OS push.
// Sending goes straight to FCM using a Firebase service account — no Expo
// account/projectId needed. Configure once in the server env:
//   FCM_SERVICE_ACCOUNT = the full service-account JSON (as a string)
//
// Degrades gracefully: when the service account isn't configured, or no tokens
// are registered, this logs and returns so publishing never fails on a push.

import { SignJWT, importPKCS8 } from 'jose';
import { prisma } from '@/lib/prisma';
import { STAFF_ROLES } from '@/lib/constants';

interface ServiceAccount {
  client_email: string;
  private_key: string;
  project_id: string;
}

export interface PushMessage {
  title: string;
  body: string;
  data?: Record<string, string>;
}

function serviceAccount(): ServiceAccount | null {
  const raw = process.env.FCM_SERVICE_ACCOUNT;
  if (!raw) return null;
  try {
    const sa = JSON.parse(raw) as ServiceAccount;
    if (!sa.client_email || !sa.private_key || !sa.project_id) return null;
    // Env vars often store the private key with literal "\n" — normalize it.
    sa.private_key = sa.private_key.replace(/\\n/g, '\n');
    return sa;
  } catch (e) {
    console.error('[push] FCM_SERVICE_ACCOUNT is not valid JSON:', e instanceof Error ? e.message : e);
    return null;
  }
}

// Cache the OAuth access token (valid ~1h) so we don't re-mint per send.
let cachedToken: { token: string; exp: number } | null = null;

async function accessToken(sa: ServiceAccount): Promise<string | null> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.exp - 60 > now) return cachedToken.token;

  try {
    const key = await importPKCS8(sa.private_key, 'RS256');
    const assertion = await new SignJWT({
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
    })
      .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
      .setIssuer(sa.client_email)
      .setSubject(sa.client_email)
      .setAudience('https://oauth2.googleapis.com/token')
      .setIssuedAt(now)
      .setExpirationTime(now + 3600)
      .sign(key);

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }),
    });
    if (!res.ok) {
      console.error('[push] token exchange failed:', res.status, await res.text().catch(() => ''));
      return null;
    }
    const json = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!json.access_token) return null;
    cachedToken = { token: json.access_token, exp: now + (json.expires_in ?? 3600) };
    return json.access_token;
  } catch (e) {
    console.error('[push] access token error:', e instanceof Error ? e.message : e);
    return null;
  }
}

// Send one message to one device. Returns 'ok' | 'dead' (token unregistered) |
// 'error'. 'dead' tokens are pruned by the caller.
async function sendOne(
  token: string,
  bearer: string,
  projectId: string,
  msg: PushMessage,
): Promise<'ok' | 'dead' | 'error'> {
  try {
    const res = await fetch(
      `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: {
            token,
            notification: { title: msg.title, body: msg.body },
            data: msg.data ?? {},
            android: {
              priority: 'HIGH',
              notification: { channel_id: 'default', sound: 'default' },
            },
          },
        }),
      },
    );
    if (res.ok) return 'ok';
    const text = await res.text().catch(() => '');
    // A token that's no longer valid → prune it.
    if (res.status === 404 || /UNREGISTERED|INVALID_ARGUMENT|NOT_FOUND/.test(text)) {
      return 'dead';
    }
    console.error('[push] FCM send failed:', res.status, text.slice(0, 300));
    return 'error';
  } catch (e) {
    console.error('[push] FCM send error:', e instanceof Error ? e.message : e);
    return 'error';
  }
}

async function pushToTokens(tokens: string[], msg: PushMessage): Promise<void> {
  const sa = serviceAccount();
  if (!sa) {
    console.warn('[push] FCM not configured — OS push skipped.');
    return;
  }
  const unique = Array.from(new Set(tokens.filter(Boolean)));
  if (unique.length === 0) return;

  const bearer = await accessToken(sa);
  if (!bearer) return;

  const dead: string[] = [];
  // Modest concurrency so a large audience doesn't open hundreds of sockets.
  const CONCURRENCY = 20;
  for (let i = 0; i < unique.length; i += CONCURRENCY) {
    const batch = unique.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map((t) => sendOne(t, bearer, sa.project_id, msg)),
    );
    results.forEach((r, idx) => { if (r === 'dead') dead.push(batch[idx]); });
  }

  if (dead.length) {
    await prisma.pushToken
      .deleteMany({ where: { token: { in: dead } } })
      .catch((e) => console.error('[push] prune error:', e));
  }
}

// Broadcast to every registered device — used when new content is published.
export async function notifyAllNewMaterial(material: {
  id: string;
  title: string;
  category?: { name?: string | null } | null;
}): Promise<void> {
  let tokens: string[] = [];
  try {
    const rows = await prisma.pushToken.findMany({ select: { token: true } });
    tokens = rows.map((r) => r.token);
  } catch (e) {
    console.error('[push] token lookup failed:', e instanceof Error ? e.message : e);
    return;
  }
  if (tokens.length === 0) return;

  const section = material.category?.name ? `${material.category.name} · ` : '';
  await pushToTokens(tokens, {
    title: 'إضافة جديدة في أرشيف المسيد',
    body: `${section}${material.title}`,
    data: { materialId: material.id, type: 'new_material' },
  });
}

// Notify reviewers/admins that a new submission is waiting — only devices where
// a staff member is signed in (userId set + live role is staff). Respects each
// reviewer's assigned-section scoping. Keeps reviewers alert without email.
export async function notifyReviewersNewSubmission(material: {
  id: string;
  title: string;
  category?: { slug?: string | null; name?: string | null } | null;
}): Promise<void> {
  let rows: { token: string; user: { assignedCategories: string | null } | null }[] = [];
  try {
    rows = await prisma.pushToken.findMany({
      where: { user: { is: { role: { in: STAFF_ROLES }, active: true } } },
      select: { token: true, user: { select: { assignedCategories: true } } },
    });
  } catch (e) {
    console.error('[push] reviewer token lookup failed:', e instanceof Error ? e.message : e);
    return;
  }

  const slug = material.category?.slug ?? '';
  const tokens = rows
    .filter((r) => {
      const ac = r.user?.assignedCategories;
      if (!ac) return true; // no scoping → covers every section
      const sections = ac.split(',').map((s) => s.trim()).filter(Boolean);
      return sections.length === 0 || sections.includes(slug);
    })
    .map((r) => r.token);
  if (tokens.length === 0) return;

  const section = material.category?.name ? `${material.category.name} · ` : '';
  await pushToTokens(tokens, {
    title: 'مادة جديدة بانتظار المراجعة',
    body: `${section}${material.title}`,
    data: { materialId: material.id, type: 'review_pending' },
  });
}
