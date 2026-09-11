// OS push notifications (Expo) for أرشيف المسيد.
//
// When new content is published, every registered device receives an OS push.
// Degrades gracefully: when no tokens are registered (or Expo can't be reached)
// this logs and returns, so publishing never fails because of a notification.
//
// Android delivery additionally requires Firebase (google-services.json) and an
// Expo projectId to be configured in the build before devices can obtain tokens.

import { prisma } from '@/lib/prisma';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

export interface PushMessage {
  title: string;
  body: string;
  // Delivered to the app so a tap can deep-link to the material.
  data?: Record<string, unknown>;
}

// Expo tokens look like ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx].
function isExpoToken(token: string): boolean {
  return /^Expo(nent)?PushToken\[/.test(token);
}

// POST a batch of messages to Expo. Returns the tokens Expo reports as
// permanently invalid (DeviceNotRegistered), so the caller can prune them.
async function sendExpoBatch(
  messages: { to: string; title: string; body: string; data?: Record<string, unknown> }[],
): Promise<string[]> {
  const dead: string[] = [];
  try {
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(
        messages.map((m) => ({
          to: m.to,
          title: m.title,
          body: m.body,
          data: m.data,
          sound: 'default',
          priority: 'high',
          channelId: 'default',
        })),
      ),
    });
    if (!res.ok) {
      console.error('[push] Expo send failed:', res.status, await res.text().catch(() => ''));
      return dead;
    }
    const json = (await res.json().catch(() => null)) as
      | { data?: { status: string; details?: { error?: string } }[] }
      | null;
    const tickets = json?.data ?? [];
    tickets.forEach((ticket, i) => {
      if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
        dead.push(messages[i].to);
      }
    });
  } catch (e) {
    console.error('[push] Expo send error:', e instanceof Error ? e.message : e);
  }
  return dead;
}

// Send a push to an explicit list of device tokens (chunked at 100, Expo's
// per-request limit). Prunes tokens Expo reports as unregistered.
async function pushToTokens(tokens: string[], msg: PushMessage): Promise<void> {
  const valid = Array.from(new Set(tokens.filter(isExpoToken)));
  if (valid.length === 0) return;

  const dead: string[] = [];
  for (let i = 0; i < valid.length; i += 100) {
    const chunk = valid.slice(i, i + 100);
    const gone = await sendExpoBatch(
      chunk.map((to) => ({ to, title: msg.title, body: msg.body, data: msg.data })),
    );
    dead.push(...gone);
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
