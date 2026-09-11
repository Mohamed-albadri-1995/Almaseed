import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { ResubmitForm } from '@/components/ResubmitForm';
import { Icon } from '@/components/icons';
import { getCurrentUser } from '@/lib/session';
import { prisma } from '@/lib/prisma';

export const metadata: Metadata = { title: 'تعديل وإعادة الإرسال' };

export default async function EditSubmissionPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?redirect=/account/edit/${params.id}`);

  const material = await prisma.material.findUnique({
    where: { id: params.id },
    include: {
      category: { select: { slug: true } },
      reviewNotes: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  });
  if (!material || material.submittedById !== user.id) notFound();

  const note = material.reviewNotes[0];

  return (
    <div className="container-page py-10">
      <div className="mx-auto max-w-3xl">
        <nav className="mb-4 flex items-center gap-1 text-sm text-muted">
          <Link href="/account" className="hover:text-brand-600">حسابي</Link>
          <Icon.chevronLeft width={14} height={14} />
          <span className="text-brand-700">تعديل المادة</span>
        </nav>

        <h1 className="section-title">تعديل وإعادة الإرسال</h1>
        <p className="mt-1 text-muted">عدّل البيانات وفق ملاحظة المراجع ثم أعد الإرسال.</p>

        {note && (
          <div className="mt-5 rounded-xl bg-sky-50 p-4 text-sm">
            <p className="font-semibold text-sky-800">ملاحظة المراجع:</p>
            <p className="mt-0.5 text-sky-700">
              {note.reason ? `${note.reason} — ` : ''}
              {note.note}
            </p>
          </div>
        )}

        <div className="card mt-6 p-6 sm:p-8">
          <ResubmitForm
            material={{
              id: material.id,
              categorySlug: material.category.slug,
              title: material.title,
              subtitle: material.subtitle,
              fileUrl: material.fileUrl,
              fileType: material.fileType,
              fileKind: material.fileKind,
              bodyText: material.bodyText,
              performer: material.performer,
              narrator: material.narrator,
              speaker: material.speaker,
              host: material.host,
              participants: material.participants,
              occasion: material.occasion,
              topic: material.topic,
              place: material.place,
              city: material.city,
              organizer: material.organizer,
              description: material.description,
              summary: material.summary,
              lyrics: material.lyrics,
              keywords: material.keywords,
            }}
          />
        </div>
      </div>
    </div>
  );
}
