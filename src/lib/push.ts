// Push / broadcast notifications for أرشيف المسيد.
//
// Two channels, chosen per audience:
//  • App users  → Expo push (mobile installs). Every registered device gets a
//    notification when new content is published.
//  • Reviewers  → email (via Resend). Reviewers work on the website and have
//    accounts with verified emails, so a submission-pending alert is delivered
//    reliably without needing the app or a login inside it.
//
// Both degrade gracefully: when the relevant service isn't configured the
// helpers log and return, so publishing/submitting never fails because of a
// notification.

import { prisma } from '@/lib/prisma';
import { sendEmail, isEmailConfigured, appUrl } from '@/lib/email';
import { STAFF_ROLES } from '@/lib/constants';

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

// Email the reviewers/admins responsible for a section when a new submission
// is waiting. Respects per-reviewer section scoping (assignedCategories).
export async function notifyReviewersNewSubmission(material: {
  id: string;
  title: string;
  category?: { slug?: string | null; name?: string | null } | null;
  contributorName?: string | null;
}): Promise<void> {
  if (!isEmailConfigured()) {
    console.warn('[push] email not configured — reviewers not notified.');
    return;
  }

  let reviewers: { email: string; name: string; assignedCategories: string | null }[] = [];
  try {
    reviewers = await prisma.user.findMany({
      where: { active: true, role: { in: STAFF_ROLES } },
      select: { email: true, name: true, assignedCategories: true },
    });
  } catch (e) {
    console.error('[push] reviewer lookup failed:', e instanceof Error ? e.message : e);
    return;
  }

  const slug = material.category?.slug ?? '';
  // A reviewer with no assigned sections covers everything; otherwise only the
  // sections listed for them.
  const recipients = reviewers.filter((r) => {
    if (!r.assignedCategories) return true;
    const sections = r.assignedCategories.split(',').map((s) => s.trim()).filter(Boolean);
    return sections.length === 0 || sections.includes(slug);
  });
  if (recipients.length === 0) return;

  const sectionName = material.category?.name ?? 'قسم غير محدد';
  const contributor = material.contributorName ? ` من ${material.contributorName}` : '';
  const reviewUrl = `${appUrl()}/admin/review/${material.id}`;
  const subject = `مادة جديدة بانتظار المراجعة — ${material.title}`;
  const html = `
    <div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;line-height:1.9;color:#1f2937">
      <h2 style="color:#1f3d33;margin:0 0 12px">مادة جديدة بانتظار المراجعة</h2>
      <p style="margin:0 0 6px">وصلت مادة جديدة${contributor} في قسم «${sectionName}»:</p>
      <p style="font-size:18px;font-weight:bold;margin:0 0 16px;color:#1f3d33">«${material.title}»</p>
      <p style="margin:0 0 20px">يرجى مراجعتها من لوحة الإشراف.</p>
      <a href="${reviewUrl}"
         style="display:inline-block;background:#1f3d33;color:#fff;text-decoration:none;padding:10px 22px;border-radius:8px;font-weight:bold">
        فتح صفحة المراجعة
      </a>
      <p style="margin:24px 0 0;font-size:13px;color:#6b7280">أرشيف المسيد — الطريقة السمّانية</p>
    </div>`;

  await Promise.all(
    recipients.map((r) =>
      sendEmail({ to: r.email, subject, html }).catch((e) =>
        console.error('[push] reviewer email error:', e instanceof Error ? e.message : e),
      ),
    ),
  );
}
