// Minimal transactional email sender.
//
// Uses the Resend HTTPS API (no extra dependency) when RESEND_API_KEY and
// EMAIL_FROM are configured. Returns false (and logs) when email isn't set up,
// so callers can degrade gracefully without leaking that to the end user.

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
}

export function isEmailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

// Resend's shared sender works out of the box (to the account owner) until a
// verified domain sender is set via EMAIL_FROM.
const DEFAULT_FROM = 'أرشيف المسيد <onboarding@resend.dev>';

export async function sendEmail({ to, subject, html }: EmailMessage): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || DEFAULT_FROM;
  if (!key) {
    console.warn('[email] RESEND_API_KEY not set — email not sent.');
    return false;
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, subject, html }),
    });
    if (!res.ok) {
      console.error('[email] send failed:', res.status, await res.text().catch(() => ''));
      return false;
    }
    return true;
  } catch (e) {
    console.error('[email] send error:', e instanceof Error ? e.message : e);
    return false;
  }
}

export function appUrl(): string {
  return (process.env.APP_URL || 'https://almaseeed.com').replace(/\/$/, '');
}
