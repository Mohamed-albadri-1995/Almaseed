// Reviewer notifications for أرشيف المسيد.
//
// When a new submission is pending, the reviewers/admins responsible for that
// section are emailed (via Resend). Reviewers work on the website and have
// accounts with verified emails, so email is the reliable channel for «an
// action is needed». App users see new *published* content through the in-app
// notifications feed instead (see /api/mobile/notifications), which needs no
// external setup.
//
// Degrades gracefully: when email isn't configured this logs and returns, so
// submitting never fails because of a notification.

import { prisma } from '@/lib/prisma';
import { sendEmail, isEmailConfigured, appUrl } from '@/lib/email';
import { STAFF_ROLES } from '@/lib/constants';

// Email the reviewers/admins responsible for a section when a new submission
// is waiting. Respects per-reviewer section scoping (assignedCategories).
export async function notifyReviewersNewSubmission(material: {
  id: string;
  title: string;
  category?: { slug?: string | null; name?: string | null } | null;
  contributorName?: string | null;
}): Promise<void> {
  if (!isEmailConfigured()) {
    console.warn('[notify] email not configured — reviewers not notified.');
    return;
  }

  let reviewers: { email: string; name: string; assignedCategories: string | null }[] = [];
  try {
    reviewers = await prisma.user.findMany({
      where: { active: true, role: { in: STAFF_ROLES } },
      select: { email: true, name: true, assignedCategories: true },
    });
  } catch (e) {
    console.error('[notify] reviewer lookup failed:', e instanceof Error ? e.message : e);
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
        console.error('[notify] reviewer email error:', e instanceof Error ? e.message : e),
      ),
    ),
  );
}
