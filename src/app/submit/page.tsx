import Link from 'next/link';
import type { Metadata } from 'next';
import { SubmitForm } from '@/components/SubmitForm';
import { ContributorGuide } from '@/components/ContributorGuide';
import { FirstUseCue } from '@/components/FirstUseCue';
import { Icon } from '@/components/icons';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { getFieldSuggestions } from '@/lib/queries';

export const metadata: Metadata = { title: 'إرسال مادة' };

export default async function SubmitPage() {
  const user = await getCurrentUser();
  const [categories, suggestions] = await Promise.all([
    prisma.category.findMany({ orderBy: { order: 'asc' } }),
    getFieldSuggestions(),
  ]);

  return (
    <div className="container-page py-10">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 text-center">
          <p className="eyebrow">ساهم في الحفظ</p>
          <h1 className="section-title mt-1">إرسال مادة جديدة</h1>
          <p className="mx-auto mt-2 max-w-xl text-muted">
            شاركنا مادة نافعة لتُضاف إلى الأرشيف بعد مراجعتها. اختر النوع، أدخل البيانات، وأرفق الملف.
          </p>
          <Link href="/guide/upload" className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-4 py-1.5 text-sm font-semibold text-brand-700 transition hover:bg-brand-100">
            📷 دليل مصوّر: كيف أرفع مادة؟
          </Link>
        </div>

        {user ? (
          <>
            <FirstUseCue id="submit-helper" label="ابدأ من هنا">
              <ContributorGuide />
            </FirstUseCue>
            <div className="card p-6 sm:p-8">
              <SubmitForm categories={categories} suggestions={suggestions} />
            </div>
          </>
        ) : (
          <div className="card flex flex-col items-center gap-4 p-10 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 text-brand-600">
              <Icon.user width={28} height={28} />
            </span>
            <h2 className="text-lg font-bold text-brand-800">يلزم تسجيل الدخول للمساهمة</h2>
            <p className="max-w-sm text-sm text-muted">
              التصفّح والتنزيل متاحان للجميع، أما إرسال مادة ومتابعة حالتها فيتطلب حساباً.
            </p>
            <div className="flex gap-2">
              <Link href="/login?redirect=/submit" className="btn-primary">تسجيل الدخول</Link>
              <Link href="/register" className="btn-outline">إنشاء حساب</Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
